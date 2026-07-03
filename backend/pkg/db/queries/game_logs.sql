-- name: CreateLog :one
INSERT INTO game_logs (
    game_id, type, message
) VALUES (
    $1, $2, $3
) RETURNING id, game_id, type, message, created_at;

-- name: GetGameLogs :many
SELECT
    id, game_id, type, message, created_at
FROM game_logs
WHERE game_id = $1
ORDER BY created_at ASC;