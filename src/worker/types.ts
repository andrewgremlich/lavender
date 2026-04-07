export interface Env {
	lavender_db: D1Database;
	JWT_SECRET: string;
}

export interface UserRow {
	id: string;
	username: string;
	password_hash: string;
	salt: string;
	created_at: string;
	recovery_code_hash: string | null;
	recovery_code_salt: string | null;
	wrapped_encryption_key: string | null;
	wrapped_encryption_key_iv: string | null;
}

export interface HealthEntryRow {
	id: string;
	user_id: string;
	encrypted_data: string;
	iv: string;
	created_at: string;
	expires_at: string;
}

export interface UserSettingsRow {
	user_id: string;
	data_retention_days: number;
	default_date_range: string;
	updated_at: string;
}
