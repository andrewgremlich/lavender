const API_BASE = "/api";

function getToken(): string | null {
	return sessionStorage.getItem("lavender_token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
	const token = getToken();
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		...((options.headers as Record<string, string>) || {}),
	};

	if (token) {
		headers.Authorization = `Bearer ${token}`;
	}

	const response = await fetch(`${API_BASE}${path}`, {
		...options,
		headers,
	});

	if (!response.ok) {
		const error = await response
			.json()
			.catch(() => ({ error: "Request failed" }));
		throw new Error((error as any).error || `HTTP ${response.status}`);
	}

	return response.json();
}

export const api = {
	auth: {
		register: (
			username: string,
			password: string,
			recovery?: {
				wrappedEncryptionKey: string;
				wrappedEncryptionKeyIv: string;
				recoveryCodeHash: string;
				recoveryCodeSalt: string;
			},
		) =>
			request<{ token: string; username: string; hasRecovery: boolean }>(
				"/auth/register",
				{
					method: "POST",
					body: JSON.stringify({ username, password, ...recovery }),
				},
			),
		login: (username: string, password: string) =>
			request<{ token: string; username: string; hasRecovery: boolean }>(
				"/auth/login",
				{
					method: "POST",
					body: JSON.stringify({ username, password }),
				},
			),
		changePassword: (
			oldPassword: string,
			newPassword: string,
			reEncryptedEntries: Array<{
				id: string;
				encryptedData: string;
				iv: string;
			}>,
		) =>
			request<{ token: string; username: string }>("/auth/password", {
				method: "PUT",
				body: JSON.stringify({ oldPassword, newPassword, reEncryptedEntries }),
			}),
		deleteAccount: () =>
			request<{ message: string }>("/auth/account", { method: "DELETE" }),
		recoverySetup: (payload: {
			wrappedEncryptionKey: string;
			wrappedEncryptionKeyIv: string;
			recoveryCodeHash: string;
			recoveryCodeSalt: string;
		}) =>
			request<{ message: string }>("/auth/recovery-setup", {
				method: "POST",
				body: JSON.stringify(payload),
			}),
		recoveryStart: (recoveryCode: string, username: string) =>
			request<{
				wrappedEncryptionKey: string;
				wrappedEncryptionKeyIv: string;
				entries: Array<{ id: string; encryptedData: string; iv: string }>;
			}>("/auth/recovery-start", {
				method: "POST",
				body: JSON.stringify({ username, recoveryCode }),
			}),
		recover: (payload: {
			username: string;
			recoveryCode: string;
			newPassword: string;
			reEncryptedEntries: Array<{
				id: string;
				encryptedData: string;
				iv: string;
			}>;
			newWrappedEncryptionKey: string;
			newWrappedEncryptionKeyIv: string;
			newRecoveryCodeHash: string;
			newRecoveryCodeSalt: string;
		}) =>
			request<{ token: string; username: string; hasRecovery: boolean }>(
				"/auth/recover",
				{ method: "POST", body: JSON.stringify(payload) },
			),
	},
	metrics: {
		getAll: () =>
			request<
				Array<{
					id: string;
					encryptedData: string;
					iv: string;
					createdAt: string;
					expiresAt: string;
				}>
			>("/metrics"),
		create: (encryptedData: string, iv: string) =>
			request<{ id: string; createdAt: string; expiresAt: string }>(
				"/metrics",
				{
					method: "POST",
					body: JSON.stringify({ encryptedData, iv }),
				},
			),
		update: (id: string, encryptedData: string, iv: string) =>
			request<{ message: string }>(`/metrics/${id}`, {
				method: "PUT",
				body: JSON.stringify({ encryptedData, iv }),
			}),
		delete: (id: string) =>
			request<{ message: string }>(`/metrics/${id}`, { method: "DELETE" }),
		deleteAll: () =>
			request<{ message: string }>("/metrics", { method: "DELETE" }),
	},
	settings: {
		get: () => request<{ dataRetentionDays: number; defaultDateRange: string }>("/settings"),
		update: (patch: { dataRetentionDays?: number; defaultDateRange?: string }) =>
			request<{ dataRetentionDays: number; defaultDateRange: string }>("/settings", {
				method: "PUT",
				body: JSON.stringify(patch),
			}),
	},
};

export function setToken(token: string): void {
	sessionStorage.setItem("lavender_token", token);
}

export function clearToken(): void {
	sessionStorage.removeItem("lavender_token");
}

export function isAuthenticated(): boolean {
	return !!getToken();
}
