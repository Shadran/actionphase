DROP INDEX IF EXISTS idx_messages_is_draft;

ALTER TABLE messages DROP COLUMN IF EXISTS is_draft;
