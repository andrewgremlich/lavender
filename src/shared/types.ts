export interface HealthEntryData {
	date: string;
	basalBodyTemp?: number;
	cervicalMucus?: "dry" | "sticky" | "creamy" | "watery" | "eggWhite";
	lhSurge?: 0 | 1 | 2;
	appetiteChange?: boolean;
	moodChange?: boolean;
	increasedSexDrive?: boolean;
	breastTenderness?: boolean;
	mildSpotting?: boolean;
	heightenedSmell?: boolean;
	cervixChanges?: boolean;
	fluidRetention?: boolean;
	cramping?: boolean;
	bleedingStart?: boolean;
	bleedingEnd?: boolean;
	bleedingFlow?: "light" | "medium" | "heavy";
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
	hasRecovery: boolean;
}

export interface ApiError {
	error: string;
}
