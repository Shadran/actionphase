-- name: CreateLootTable :one
INSERT INTO game_loot_tables (
    game_id, name
) VALUES (
    $1, $2
) RETURNING id, game_id, name, created_at;

-- name: GetLootTables :many
SELECT
    id, game_id, name, created_at
FROM game_loot_tables
WHERE game_id = $1
ORDER BY created_at ASC;


-- name: DeleteLootTable :exec
DELETE FROM game_loot_tables WHERE id = $1;

