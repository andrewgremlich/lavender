-- Migration number: 0003	2026-04-07
-- Add default_date_range to user_settings

ALTER TABLE user_settings ADD COLUMN default_date_range TEXT NOT NULL DEFAULT '30';
