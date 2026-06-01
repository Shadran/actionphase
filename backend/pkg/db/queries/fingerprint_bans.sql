-- name: CreateFingerprintBan :one
INSERT INTO fingerprint_bans (
    fingerprint, created_by, reason
) VALUES (
    $1, $2, $3
)
RETURNING *;

-- name: ListFingerprintBans :many
SELECT * FROM fingerprint_bans
ORDER BY created_at DESC;

-- name: DeleteFingerprintBan :exec
DELETE FROM fingerprint_bans
WHERE id = $1;

-- name: IsFingerprintBanned :one
SELECT EXISTS(
    SELECT 1 FROM fingerprint_bans
    WHERE fingerprint = $1
) AS banned;
