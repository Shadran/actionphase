CREATE TABLE fingerprint_bans (
    id SERIAL PRIMARY KEY,
    fingerprint VARCHAR(255) NOT NULL UNIQUE,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason TEXT
);

CREATE INDEX idx_fingerprint_bans_fingerprint ON fingerprint_bans(fingerprint);
