export interface HealthEntryData {
	date: string;
	basalBodyTemp?: number;
	cervicalMucus?: 'dry' | 'sticky' | 'creamy' | 'watery' | 'eggWhite';
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
	bleedingFlow?: 'light' | 'medium' | 'heavy';
	notes?: string;
}

export interface EncryptedEntry {
	id: string;
	encryptedData: string;
	iv: string;
	createdAt: string;
	expiresAt: string;
}

export type DateRange = '7' | '30' | 'all';

export interface UserSettings {
	dataRetentionDays: number;
	defaultDateRange: DateRange;
}

export type Role = 'user' | 'demo' | 'admin';

export interface AuthResponse {
	token: string;
	username: string;
	hasRecovery: boolean;
	role?: Role;
}

export interface ApiError {
	error: string;
}
