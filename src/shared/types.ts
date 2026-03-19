export interface HealthEntryData {
	date: string;
	basalBodyTemp?: number;
	cervicalMucus?: "dry" | "sticky" | "creamy" | "watery" | "eggWhite";
	lhSurge?: boolean;
	ovulationDay?: boolean;
	fertileWindow?: boolean;
	notes?: string;
}

export interface EncryptedEntry {
	id: string;
	encryptedData: string;
	iv: string;
	createdAt: string;
	expiresAt: string;
}

export interface UserSettings {
	dataRetentionDays: number;
}

export interface AuthResponse {
	token: string;
	username: string;
	encryptionKey?: string | null;
}

export interface ApiError {
	error: string;
}
