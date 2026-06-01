CREATE TABLE ip_bans (
    id SERIAL PRIMARY KEY,
    ip_address VARCHAR(45) NOT NULL UNIQUE,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason TEXT,
    expires_at TIMESTAMPTZ
);

CREATE INDEX idx_ip_bans_ip_address ON ip_bans(ip_address);
CREATE INDEX idx_ip_bans_expires_at ON ip_bans(expires_at) WHERE expires_at IS NOT NULL;
