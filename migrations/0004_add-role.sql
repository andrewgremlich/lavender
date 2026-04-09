-- Migration number: 0004   2026-04-09
-- Add role column to users for demo/admin support

ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
