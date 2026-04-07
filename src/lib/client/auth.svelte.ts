// Reactive auth store using Svelte 5 runes. Exposes the current session
// (username, logged-in state) and the high-level register/login/recover/logout
// operations. Handles token + encryption key persistence via the api and
// crypto modules; UI never touches sessionStorage or crypto directly.

import { authApi, clearToken, getToken, setToken } from './api';
import {
	clearStoredKey,
	decrypt,
	deriveKeyFromPassword,
	deriveLegacyKey,
	encrypt,
	generateClientSalt,
	generateRecoveryCode,
	getStoredKey,
	hashWithSalt,
	importKey,
	storeKey,
	storeLegacyKey,
	unwrapEncryptionKey,
	wrapEncryptionKey
} from './crypto';

const VERIFY_KEY = 'lavender_last_verified';

function markVerified(): void {
	localStorage.setItem(VERIFY_KEY, String(Date.now()));
}

interface AuthState {
	username: string | null;
	loggedIn: boolean;
}

function readInitial(): AuthState {
	if (typeof localStorage === 'undefined') {
		return { username: null, loggedIn: false };
	}
	const token = getToken();
	if (!token) return { username: null, loggedIn: false };
	// JWT payload is the middle segment, base64url-encoded JSON.
	try {
		const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as {
			username?: string;
			exp?: number;
		};
		if (payload.exp && payload.exp * 1000 < Date.now()) {
			clearToken();
			clearStoredKey();
			return { username: null, loggedIn: false };
		}
		return { username: payload.username ?? null, loggedIn: true };
	} catch {
		return { username: null, loggedIn: true };
	}
}

const state = $state<AuthState>(readInitial());

// During SSR, sessionStorage is unavailable so state initializes as logged-out.
// Re-check on the client after hydration to pick up the persisted token.
if (globalThis.window !== undefined) {
	const clientState = readInitial();
	state.username = clientState.username;
	state.loggedIn = clientState.loggedIn;
}

export const auth = {
	get username() {
		return state.username;
	},
	get loggedIn() {
		return state.loggedIn;
	},
	get hasEncryptionKey() {
		return !!getStoredKey();
	},

	/**
	 * Register a new user. Derives an encryption key, generates a recovery code,
	 * wraps the key with it, and stores everything server-side.
	 * Returns the recovery code — the caller MUST show it to the user.
	 */
	async register(username: string, password: string): Promise<string> {
		const encryptionKey = await deriveKeyFromPassword(password, username);
		const recoveryCode = generateRecoveryCode();
		const { wrapped, iv } = await wrapEncryptionKey(encryptionKey, recoveryCode);
		const recoverySalt = generateClientSalt();
		const recoveryCodeHash = await hashWithSalt(recoveryCode, recoverySalt);

		const result = await authApi.register(username, password, {
			wrappedEncryptionKey: wrapped,
			wrappedEncryptionKeyIv: iv,
			recoveryCodeHash,
			recoveryCodeSalt: recoverySalt
		});
		setToken(result.token);
		storeKey(encryptionKey);
		state.username = result.username;
		state.loggedIn = true;
		markVerified();
		return recoveryCode;
	},

	/**
	 * Log in. Returns whether the account already has a recovery code set up;
	 * if false, the caller should prompt the user to set one up.
	 */
	async login(username: string, password: string): Promise<boolean> {
		const result = await authApi.login(username, password);
		setToken(result.token);
		const encryptionKey = await deriveKeyFromPassword(password, username);
		storeKey(encryptionKey);
		const legacyKey = await deriveLegacyKey(password, username);
		storeLegacyKey(legacyKey);
		state.username = result.username;
		state.loggedIn = true;
		markVerified();
		return result.hasRecovery;
	},

	/**
	 * Set up a recovery code for an already-logged-in user whose account
	 * does not yet have one. Wraps the current session encryption key with
	 * a fresh recovery code. Returns the code — caller MUST show it.
	 */
	async setupRecovery(): Promise<string> {
		const encKeyBase64 = getStoredKey();
		if (!encKeyBase64) throw new Error('No encryption key in session');

		const recoveryCode = generateRecoveryCode();
		const { wrapped, iv } = await wrapEncryptionKey(encKeyBase64, recoveryCode);
		const recoverySalt = generateClientSalt();
		const recoveryCodeHash = await hashWithSalt(recoveryCode, recoverySalt);

		await authApi.recoverySetup({
			wrappedEncryptionKey: wrapped,
			wrappedEncryptionKeyIv: iv,
			recoveryCodeHash,
			recoveryCodeSalt: recoverySalt
		});
		return recoveryCode;
	},

	/**
	 * Recover access using a recovery code. Re-encrypts all entries with the
	 * new password's key, rotates the recovery code, and returns the NEW
	 * recovery code. Caller MUST show the new code to the user.
	 */
	async recover(username: string, recoveryCode: string, newPassword: string): Promise<string> {
		// Normalize: strip spaces/dashes the user may paste with.
		const normalized = recoveryCode.replace(/[\s-]/g, '').toUpperCase();
		const formatted = `${normalized.slice(0, 8)}-${normalized.slice(8, 16)}-${normalized.slice(16, 24)}-${normalized.slice(24, 32)}`;

		const { wrappedEncryptionKey, wrappedEncryptionKeyIv, entries } = await authApi.recoveryStart(
			username,
			formatted
		);

		const oldEncKeyBase64 = await unwrapEncryptionKey(
			wrappedEncryptionKey,
			wrappedEncryptionKeyIv,
			formatted
		);
		const newEncKeyBase64 = await deriveKeyFromPassword(newPassword, username);

		const oldKey = await importKey(oldEncKeyBase64);
		const newKey = await importKey(newEncKeyBase64);
		const reEncryptedEntries = await Promise.all(
			entries.map(async (e) => {
				const plaintext = await decrypt(e.encryptedData, e.iv, oldKey);
				const { encrypted, iv } = await encrypt(plaintext, newKey);
				return { id: e.id, encryptedData: encrypted, iv };
			})
		);

		const newRecoveryCode = generateRecoveryCode();
		const { wrapped: newWrapped, iv: newWrappedIv } = await wrapEncryptionKey(
			newEncKeyBase64,
			newRecoveryCode
		);
		const newRecoverySalt = generateClientSalt();
		const newRecoveryCodeHash = await hashWithSalt(newRecoveryCode, newRecoverySalt);

		const result = await authApi.recover({
			username,
			recoveryCode: formatted,
			newPassword,
			reEncryptedEntries,
			newWrappedEncryptionKey: newWrapped,
			newWrappedEncryptionKeyIv: newWrappedIv,
			newRecoveryCodeHash,
			newRecoveryCodeSalt: newRecoverySalt
		});

		setToken(result.token);
		storeKey(newEncKeyBase64);
		const legacyKey = await deriveLegacyKey(newPassword, username);
		storeLegacyKey(legacyKey);
		state.username = result.username;
		state.loggedIn = true;
		markVerified();
		return newRecoveryCode;
	},

	logout(): void {
		clearToken();
		clearStoredKey();
		localStorage.removeItem(VERIFY_KEY);
		state.username = null;
		state.loggedIn = false;
	}
};
