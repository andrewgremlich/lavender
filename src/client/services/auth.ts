import {
	clearStoredKey,
	deriveKeyFromPassword,
	getStoredKey,
	storeKey,
} from "@client/crypto/encryption";
import { api, clearToken, setToken } from "@client/services/api";

export async function register(
	username: string,
	password: string,
): Promise<void> {
	const encryptionKey = await deriveKeyFromPassword(password, username);
	const result = await api.auth.register(username, password, encryptionKey);
	setToken(result.token);
	storeKey(encryptionKey);
}

export async function login(username: string, password: string): Promise<void> {
	const encryptionKey = await deriveKeyFromPassword(password, username);
	const result = await api.auth.login(username, password, encryptionKey);
	setToken(result.token);
	storeKey(encryptionKey);
}

export async function loginWithPasskey(): Promise<void> {
	const { startAuthentication } = await import("@simplewebauthn/browser");
	const options = await api.passkeys.getAuthenticationOptions();
	const authResponse = await startAuthentication({ optionsJSON: options });
	const result = await api.passkeys.verifyAuthentication(
		authResponse,
		options.challenge,
	);
	setToken(result.token);
	if (!result.encryptionKey) {
		throw new Error(
			"No encryption key found. Please log in with your password once to enable passkey-only login.",
		);
	}
	storeKey(result.encryptionKey);
}

export async function registerPasskey(): Promise<void> {
	const { startRegistration } = await import("@simplewebauthn/browser");
	const options = await api.passkeys.getRegistrationOptions();
	const regResponse = await startRegistration({ optionsJSON: options });
	await api.passkeys.verifyRegistration(regResponse, options.challenge);
}

export function logout(): void {
	clearToken();
	clearStoredKey();
}

export function isLoggedIn(): boolean {
	return !!sessionStorage.getItem("lavendar_token");
}

export function hasEncryptionKey(): boolean {
	return !!getStoredKey();
}
