-- Migration number: 0001 	 2026-04-01T03:39:53.699Z
-- Initial schema

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY,
  data_retention_days INTEGER NOT NULL DEFAULT 180,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS health_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  encrypted_data TEXT NOT NULL,
  iv TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_health_entries_expires_at ON health_entries(expires_at);
CREATE INDEX IF NOT EXISTS idx_health_entries_user_id ON health_entries(user_id);
