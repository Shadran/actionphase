-- name: CreateFingerprintBan :one
INSERT INTO fingerprint_bans (
    fingerprint, created_by, reason, banned_user_id
) VALUES (
    $1, $2, $3, $4
)
RETURNING *;

-- name: ListFingerprintBans :many
SELECT
    b.*,
    u.username AS banned_username
FROM fingerprint_bans b
LEFT JOIN users u ON u.id = b.banned_user_id
ORDER BY b.created_at DESC;

-- name: DeleteFingerprintBan :exec
DELETE FROM fingerprint_bans
WHERE id = $1;

-- name: IsFingerprintBanned :one
SELECT EXISTS(
    SELECT 1 FROM fingerprint_bans
    WHERE fingerprint = $1
) AS banned;
