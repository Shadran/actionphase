DROP INDEX IF EXISTS idx_sessions_fingerprint;
DROP INDEX IF EXISTS idx_sessions_ip_address;

ALTER TABLE sessions
    DROP COLUMN IF EXISTS ip_address,
    DROP COLUMN IF EXISTS user_agent,
    DROP COLUMN IF EXISTS fingerprint,
    DROP COLUMN IF EXISTS created_at,
    DROP COLUMN IF EXISTS last_seen_at;
