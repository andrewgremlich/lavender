// Fetch wrapper that auto-attaches the session JWT.
// Ported from legacy/src/client/services/api.ts.

import type { AuthResponse, EncryptedEntry, Role, UserSettings } from '$lib/types';

const API_BASE = '/api';
const TOKEN_KEY = 'lavender_token';

export function getToken(): string | null {
	return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
	localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
	localStorage.removeItem(TOKEN_KEY);
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
	register: (
		username: string,
		password: string,
		recovery: RecoverySetupPayload,
		turnstileToken?: string
	) =>
		request<AuthResponse>('/auth/register', {
			method: 'POST',
			body: JSON.stringify({ username, password, ...recovery, turnstileToken })
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
		}),
	changePassword: (
		oldPassword: string,
		newPassword: string,
		reEncryptedEntries: Array<{ id: string; encryptedData: string; iv: string }>
	) =>
		request<{ token: string; username: string }>('/auth/password', {
			method: 'PUT',
			body: JSON.stringify({ oldPassword, newPassword, reEncryptedEntries })
		}),
	deleteAccount: () => request<{ message: string }>('/auth/account', { method: 'DELETE' }),
	demoLogin: () => request<AuthResponse>('/auth/demo-login', { method: 'POST' })
};

export const metricsApi = {
	getAll: () => request<EncryptedEntry[]>('/metrics'),
	create: (encryptedData: string, iv: string) =>
		request<{ id: string; createdAt: string; expiresAt: string }>('/metrics', {
			method: 'POST',
			body: JSON.stringify({ encryptedData, iv })
		}),
	update: (id: string, encryptedData: string, iv: string) =>
		request<{ message: string }>(`/metrics/${id}`, {
			method: 'PUT',
			body: JSON.stringify({ encryptedData, iv })
		}),
	delete: (id: string) => request<{ message: string }>(`/metrics/${id}`, { method: 'DELETE' }),
	deleteAll: () => request<{ message: string }>('/metrics', { method: 'DELETE' })
};

let settingsCache: { value: UserSettings; expiresAt: number } | null = null;
const SETTINGS_TTL_MS = 5 * 60 * 1000;

export const settingsApi = {
	get: async () => {
		if (settingsCache && Date.now() < settingsCache.expiresAt) {
			return settingsCache.value;
		}
		const value = await request<UserSettings>('/settings');
		settingsCache = { value, expiresAt: Date.now() + SETTINGS_TTL_MS };
		return value;
	},
	update: async (patch: Partial<UserSettings>) => {
		const value = await request<UserSettings>('/settings', {
			method: 'PUT',
			body: JSON.stringify(patch)
		});
		settingsCache = { value, expiresAt: Date.now() + SETTINGS_TTL_MS };
		return value;
	},
	clearCache: () => {
		settingsCache = null;
	}
};

export interface AdminUser {
	id: string;
	username: string;
	role: Role;
	created_at: string;
}

export const adminApi = {
	getUsers: () => request<AdminUser[]>('/admin/users'),
	deleteUser: (id: string) => request<{ message: string }>(`/admin/users/${id}`, { method: 'DELETE' }),
	setUserRole: (id: string, role: Role) =>
		request<{ message: string; role: Role }>(`/admin/users/${id}`, {
			method: 'PATCH',
			body: JSON.stringify({ role })
		})
};

export type PostType = 'feature_request' | 'question';

export interface CommunityPost {
	id: string;
	user_id: string;
	type: PostType;
	title: string;
	description: string;
	votes: number;
	created_at: string;
}

export const communityApi = {
	getPosts: (type?: PostType) => {
		const params = type ? `?type=${type}` : '';
		return request<CommunityPost[]>(`/community-posts${params}`);
	},
	createPost: (type: PostType, title: string, description: string) =>
		request<{ id: string }>('/community-posts', {
			method: 'POST',
			body: JSON.stringify({ type, title, description })
		}),
	vote: (id: string) =>
		request<{ voted: boolean; votes: number }>(`/community-posts/${id}/vote`, { method: 'POST' }),
	updatePost: (id: string, title: string, description: string) =>
		request<{ message: string }>(`/community-posts/${id}`, {
			method: 'PATCH',
			body: JSON.stringify({ title, description })
		}),
	deletePost: (id: string) =>
		request<{ message: string }>(`/community-posts/${id}`, { method: 'DELETE' })
};
