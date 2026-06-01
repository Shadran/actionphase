ALTER TABLE sessions
    ADD COLUMN ip_address VARCHAR(45),
    ADD COLUMN user_agent TEXT,
    ADD COLUMN fingerprint VARCHAR(255),
    ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX idx_sessions_fingerprint ON sessions(fingerprint) WHERE fingerprint IS NOT NULL;
CREATE INDEX idx_sessions_ip_address ON sessions(ip_address) WHERE ip_address IS NOT NULL;
