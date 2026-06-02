DROP INDEX IF EXISTS idx_ip_bans_banned_user_id;
DROP INDEX IF EXISTS idx_fingerprint_bans_banned_user_id;

ALTER TABLE ip_bans DROP COLUMN IF EXISTS banned_user_id;
ALTER TABLE fingerprint_bans DROP COLUMN IF EXISTS banned_user_id;
