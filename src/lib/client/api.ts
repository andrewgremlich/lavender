// Fetch wrapper that auto-attaches the session JWT.
// Ported from legacy/src/client/services/api.ts. Only the auth subset is
// included here for Phase 4; metrics/settings clients land with Phase 5/6.

import type { AuthResponse } from '$lib/types';

const API_BASE = '/api';
const TOKEN_KEY = 'lavender_token';

export function getToken(): string | null {
	return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
	sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
	sessionStorage.removeItem(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
	return !!getToken();
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		...((options.headers as Record<string, string>) || {})
	};
	const token = getToken();
	if (token) headers.Authorization = `Bearer ${token}`;

	const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
	if (!response.ok) {
		const body = (await response.json().catch(() => ({ error: 'Request failed' }))) as {
			error?: string;
		};
		throw new Error(body.error || `HTTP ${response.status}`);
	}
	return response.json() as Promise<T>;
}

interface RecoverySetupPayload {
	wrappedEncryptionKey: string;
	wrappedEncryptionKeyIv: string;
	recoveryCodeHash: string;
	recoveryCodeSalt: string;
}

export const authApi = {
	register: (username: string, password: string, recovery: RecoverySetupPayload) =>
		request<AuthResponse>('/auth/register', {
			method: 'POST',
			body: JSON.stringify({ username, password, ...recovery })
		}),
	recoverySetup: (payload: RecoverySetupPayload) =>
		request<{ message: string }>('/auth/recovery-setup', {
			method: 'POST',
			body: JSON.stringify(payload)
		}),
	login: (username: string, password: string) =>
		request<AuthResponse>('/auth/login', {
			method: 'POST',
			body: JSON.stringify({ username, password })
		}),
	recoveryStart: (username: string, recoveryCode: string) =>
		request<{
			wrappedEncryptionKey: string;
			wrappedEncryptionKeyIv: string;
			entries: Array<{ id: string; encryptedData: string; iv: string }>;
		}>('/auth/recovery-start', {
			method: 'POST',
			body: JSON.stringify({ username, recoveryCode })
		}),
	recover: (payload: {
		username: string;
		recoveryCode: string;
		newPassword: string;
		reEncryptedEntries: Array<{ id: string; encryptedData: string; iv: string }>;
		newWrappedEncryptionKey: string;
		newWrappedEncryptionKeyIv: string;
		newRecoveryCodeHash: string;
		newRecoveryCodeSalt: string;
	}) =>
		request<AuthResponse>('/auth/recover', {
			method: 'POST',
			body: JSON.stringify(payload)
		})
};
