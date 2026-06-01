-- name: GetSession :one
SELECT * FROM sessions
WHERE id = $1 LIMIT 1;

-- name: GetSessionByToken :one
SELECT * FROM sessions
WHERE data = $1 LIMIT 1;

-- name: GetSessionsByUser :many
SELECT * FROM sessions
WHERE user_id = $1 AND expires > NOW();

-- name: DeleteExpiredSessions :exec
DELETE FROM sessions
WHERE expires <= NOW();

-- name: CreateSession :one
INSERT INTO sessions (
    user_id, data, expires, ip_address, user_agent, fingerprint
) VALUES (
    $1, $2, $3, $4, $5, $6
)
RETURNING *;

-- name: DeleteSession :exec
DELETE FROM sessions
WHERE id = $1;

-- name: DeleteSessionByToken :exec
DELETE FROM sessions
WHERE data = $1;

-- name: DeleteUserSessions :exec
-- Invalidate all sessions for a user (used when banning)
DELETE FROM sessions
WHERE user_id = $1;

-- name: DeleteSessionsByIP :exec
DELETE FROM sessions
WHERE ip_address = $1;

-- name: DeleteSessionsByFingerprint :exec
DELETE FROM sessions
WHERE fingerprint = $1;

-- name: UpdateSessionToken :exec
UPDATE sessions
SET data = $2
WHERE id = $1;

-- name: UpdateSessionMetadata :exec
UPDATE sessions
SET ip_address = $2, user_agent = $3, fingerprint = $4
WHERE id = $1;

-- name: UpdateSessionLastSeen :exec
UPDATE sessions
SET last_seen_at = NOW()
WHERE id = $1;

-- name: GetUserSessionsWithDetails :many
SELECT id, ip_address, user_agent, fingerprint, created_at, last_seen_at, expires
FROM sessions
WHERE user_id = $1 AND expires > NOW()
ORDER BY last_seen_at DESC;
