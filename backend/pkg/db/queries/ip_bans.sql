-- name: CreateIPBan :one
INSERT INTO ip_bans (
    ip_address, created_by, reason, expires_at
) VALUES (
    $1, $2, $3, $4
)
RETURNING *;

-- name: GetIPBanByAddress :one
SELECT * FROM ip_bans
WHERE ip_address = $1
LIMIT 1;

-- name: ListIPBans :many
SELECT * FROM ip_bans
WHERE expires_at IS NULL OR expires_at > NOW()
ORDER BY created_at DESC;

-- name: DeleteIPBan :exec
DELETE FROM ip_bans
WHERE id = $1;

-- name: DeleteExpiredIPBans :exec
DELETE FROM ip_bans
WHERE expires_at IS NOT NULL AND expires_at < NOW();

-- name: IsIPBanned :one
SELECT EXISTS(
    SELECT 1 FROM ip_bans
    WHERE ip_address = $1
      AND (expires_at IS NULL OR expires_at > NOW())
) AS banned;
