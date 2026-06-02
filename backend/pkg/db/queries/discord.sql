-- name: GetUserDiscordAccount :one
-- Get a user's Discord account by user ID
SELECT *
FROM user_discord_accounts
WHERE user_id = $1;

-- name: UpsertUserDiscordAccount :one
-- Insert or update a user's Discord account
INSERT INTO user_discord_accounts (
  user_id,
  discord_user_id,
  discord_username,
  access_token,
  refresh_token,
  token_expires_at
)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (user_id)
DO UPDATE SET
  discord_user_id  = EXCLUDED.discord_user_id,
  discord_username = EXCLUDED.discord_username,
  access_token     = EXCLUDED.access_token,
  refresh_token    = EXCLUDED.refresh_token,
  token_expires_at = EXCLUDED.token_expires_at,
  updated_at       = NOW()
RETURNING *;

-- name: DeleteUserDiscordAccount :exec
-- Remove a user's Discord account link
DELETE FROM user_discord_accounts
WHERE user_id = $1;
