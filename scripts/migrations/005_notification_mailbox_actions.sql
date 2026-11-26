-- 005_notification_mailbox_actions.sql
-- Adds mailbox state columns (star, archive, soft-delete) and indexes to notifications.
-- Fully idempotent for safe execution on existing PostgreSQL databases.

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS is_starred BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_notifications_user_inbox
  ON notifications (user_id, created_at DESC)
  WHERE deleted_at IS NULL AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user_starred
  ON notifications (user_id, created_at DESC)
  WHERE deleted_at IS NULL AND is_starred = TRUE;
