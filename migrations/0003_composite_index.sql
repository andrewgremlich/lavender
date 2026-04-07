-- Migration number: 0003 	 2026-04-07
-- Replace separate user_id and expires_at indexes with a composite index
-- that covers the common query pattern: WHERE user_id = ? AND expires_at < datetime('now')

DROP INDEX IF EXISTS idx_health_entries_user_id;
DROP INDEX IF EXISTS idx_health_entries_expires_at;

CREATE INDEX IF NOT EXISTS idx_health_entries_user_expires
  ON health_entries(user_id, expires_at);
