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
}

export async function loginWithPasskey(
	username: string,
	password: string,
): Promise<void> {
	const { startAuthentication } = await import("@simplewebauthn/browser");
	const options = await api.passkeys.getAuthenticationOptions();
	const authResponse = await startAuthentication({ optionsJSON: options });
	const result = await api.passkeys.verifyAuthentication(
		authResponse,
		options.challenge,
	);
	setToken(result.token);
	const encryptionKey = await deriveKeyFromPassword(password, username);
	storeKey(encryptionKey);
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
