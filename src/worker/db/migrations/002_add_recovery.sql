ALTER TABLE users ADD COLUMN recovery_code_hash TEXT;
ALTER TABLE users ADD COLUMN recovery_code_salt TEXT;
ALTER TABLE users ADD COLUMN wrapped_encryption_key TEXT;
ALTER TABLE users ADD COLUMN wrapped_encryption_key_iv TEXT;
