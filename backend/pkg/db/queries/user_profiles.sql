-- User Profile Queries
-- These queries support the user profile system, allowing users to view and edit their profiles
-- and view game history with privacy filtering for anonymous games.

-- GetUserProfile retrieves a user's profile information
-- name: GetUserProfile :one
SELECT
    id,
    username,
    email,
    display_name,
    bio,
    avatar_url,
    created_at,
    timezone,
    is_admin
FROM users
WHERE id = $1
LIMIT 1;

-- GetUserGames retrieves all games a user has participated in
-- with privacy filtering for anonymous games (character details hidden)
-- Includes games where user is GM, participant, or both
-- Supports pagination with limit and offset
-- name: GetUserGames :many
SELECT
    g.id as game_id,
    g.title,
    g.state,
    g.is_anonymous,
    g.gm_user_id,
    gm_user.username as gm_username,
    COALESCE(gp.role, 'gm') as user_role,
    g.created_at,
    g.updated_at,
    -- Character details (NULL for anonymous games)
    CASE
        WHEN g.is_anonymous THEN NULL
        ELSE c.id
    END as character_id,
    CASE
        WHEN g.is_anonymous THEN NULL
        ELSE c.name
    END as character_name,
    CASE
        WHEN g.is_anonymous THEN NULL
        ELSE c.avatar_url
    END as character_avatar_url,
    CASE
        WHEN g.is_anonymous THEN NULL
        ELSE c.character_type
    END as character_type
FROM games g
JOIN users gm_user ON g.gm_user_id = gm_user.id
LEFT JOIN game_participants gp ON gp.game_id = g.id AND gp.user_id = $1 AND gp.removed_at IS NULL AND (gp.role != 'audience' OR gp.is_former_player = TRUE)
LEFT JOIN characters c ON c.game_id = g.id AND c.user_id = $1
WHERE g.gm_user_id = $1 OR (gp.user_id = $1 AND gp.removed_at IS NULL AND (gp.role != 'audience' OR gp.is_former_player = TRUE))
ORDER BY
    CASE g.state
        WHEN 'in_progress' THEN 1
        WHEN 'character_creation' THEN 2
        WHEN 'recruitment' THEN 3
        WHEN 'completed' THEN 4
        WHEN 'cancelled' THEN 5
        WHEN 'paused' THEN 6
        ELSE 7
    END,
    g.updated_at DESC
LIMIT $2 OFFSET $3;

-- CountUserProfileGames counts total games a user has participated in (for profile page)
-- name: CountUserProfileGames :one
SELECT COUNT(DISTINCT g.id)
FROM games g
LEFT JOIN game_participants gp ON gp.game_id = g.id AND gp.user_id = $1 AND gp.removed_at IS NULL AND (gp.role != 'audience' OR gp.is_former_player = TRUE)
WHERE g.gm_user_id = $1 OR (gp.user_id = $1 AND gp.removed_at IS NULL AND (gp.role != 'audience' OR gp.is_former_player = TRUE));

-- UpdateUserProfile updates a user's display name and bio
-- name: UpdateUserProfile :exec
UPDATE users
SET
    display_name = COALESCE($2, display_name),
    bio = COALESCE($3, bio)
WHERE id = $1;

-- UpdateUserAvatar updates a user's avatar URL
-- name: UpdateUserAvatar :exec
UPDATE users
SET avatar_url = $2
WHERE id = $1;

-- DeleteUserAvatar removes a user's avatar by setting avatar_url to NULL
-- name: DeleteUserAvatar :exec
UPDATE users
SET avatar_url = NULL
WHERE id = $1;
