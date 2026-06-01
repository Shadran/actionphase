ALTER TABLE users
    ADD COLUMN pending_approval BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN pending_approval_since TIMESTAMPTZ;

CREATE INDEX idx_users_pending_approval ON users(pending_approval) WHERE pending_approval = TRUE;
