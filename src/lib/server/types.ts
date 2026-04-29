// Server-only types: D1 row shapes. Kept out of $lib/types.ts so they never
// leak into the client bundle.

import type { Role, SubscriptionStatus } from "$lib/types";

export interface UserRow {
	id: string;
	username: string;
	password_hash: string;
	salt: string;
	created_at: string;
	role: Role;
	recovery_code_hash: string | null;
	recovery_code_salt: string | null;
	wrapped_encryption_key: string | null;
	wrapped_encryption_key_iv: string | null;
	token_epoch: number;
	stripe_customer_id: string | null;
	subscription_status: SubscriptionStatus;
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
