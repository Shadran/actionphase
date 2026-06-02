ALTER TABLE ip_bans
    ADD COLUMN banned_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE fingerprint_bans
    ADD COLUMN banned_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX idx_ip_bans_banned_user_id ON ip_bans(banned_user_id) WHERE banned_user_id IS NOT NULL;
CREATE INDEX idx_fingerprint_bans_banned_user_id ON fingerprint_bans(banned_user_id) WHERE banned_user_id IS NOT NULL;
