DROP INDEX IF EXISTS idx_users_pending_approval;

ALTER TABLE users
    DROP COLUMN IF EXISTS pending_approval,
    DROP COLUMN IF EXISTS pending_approval_since;
