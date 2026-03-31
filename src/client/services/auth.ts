import {
	clearStoredKey,
	deriveKeyFromPassword,
	deriveLegacyKey,
	getStoredKey,
	storeKey,
	storeLegacyKey,
} from "@client/crypto/encryption";
import { api, clearToken, setToken } from "@client/services/api";

export async function register(
	username: string,
	password: string,
): Promise<void> {
	const result = await api.auth.register(username, password);
	setToken(result.token);
	const encryptionKey = await deriveKeyFromPassword(password, username);
	storeKey(encryptionKey);
}

export async function login(username: string, password: string): Promise<void> {
	const result = await api.auth.login(username, password);
	setToken(result.token);
	const encryptionKey = await deriveKeyFromPassword(password, username);
	storeKey(encryptionKey);
	const legacyKey = await deriveLegacyKey(password, username);
	storeLegacyKey(legacyKey);
}

export function logout(): void {
	clearToken();
	clearStoredKey();
}

export function isLoggedIn(): boolean {
	return !!sessionStorage.getItem("lavender_token");
}

export function hasEncryptionKey(): boolean {
	return !!getStoredKey();
}
