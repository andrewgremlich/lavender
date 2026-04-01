-- Migration number: 0002 	 2026-04-01T03:40:21.127Z
-- Add E2EE-compatible password recovery columns

ALTER TABLE users ADD COLUMN recovery_code_hash TEXT;
ALTER TABLE users ADD COLUMN recovery_code_salt TEXT;
ALTER TABLE users ADD COLUMN wrapped_encryption_key TEXT;
ALTER TABLE users ADD COLUMN wrapped_encryption_key_iv TEXT;
