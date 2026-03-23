export interface Env {
	DB: D1Database;
	JWT_SECRET: string;

}

export interface UserRow {
	id: string;
	username: string;
	password_hash: string;
	salt: string;
	created_at: string;
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
	updated_at: string;
}
