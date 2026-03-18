export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  WEBAUTHN_RP_ID: string;
  WEBAUTHN_RP_NAME: string;
  WEBAUTHN_ORIGIN: string;
}

export interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  salt: string;
  created_at: string;
}

export interface PasskeyRow {
  id: string;
  user_id: string;
  credential_id: string;
  public_key: string;
  counter: number;
  transports: string | null;
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
