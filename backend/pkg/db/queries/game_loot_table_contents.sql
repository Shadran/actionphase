-- name: DeleteLootTableContents :exec
DELETE FROM game_loot_table_contents WHERE loot_table_id = $1;

-- name: AddLootTableContent :one
INSERT INTO game_loot_table_contents (
    loot_table_id, name, description
) VALUES (
    $1, $2, $3
) RETURNING id, loot_table_id, name, description;


-- name: DeleteLootTableContent :exec
DELETE FROM game_loot_table_contents WHERE id = $1;