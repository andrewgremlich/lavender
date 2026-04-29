-- Migration number: 0007   2026-04-29
ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE users ADD COLUMN subscription_status TEXT NOT NULL DEFAULT 'free';

CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);
