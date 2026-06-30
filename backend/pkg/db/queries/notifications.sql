-- name: CreateNotification :one
INSERT INTO notifications (user_id, game_id, type, title, content, related_type, related_id, link_url)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: GetUserNotifications :many
SELECT n.*, g.title as game_title
FROM notifications n
LEFT JOIN games g ON n.game_id = g.id
WHERE n.user_id = $1
ORDER BY n.created_at DESC
LIMIT $2 OFFSET $3;

-- name: GetUnreadNotifications :many
SELECT n.*, g.title as game_title
FROM notifications n
LEFT JOIN games g ON n.game_id = g.id
WHERE n.user_id = $1 AND n.is_read = false
ORDER BY n.created_at DESC;

-- name: GetUnreadNotificationCount :one
SELECT COUNT(*) FROM notifications
WHERE user_id = $1 AND is_read = false;

-- name: MarkNotificationRead :one
UPDATE notifications
SET is_read = true, read_at = NOW()
WHERE id = $1 AND user_id = $2
RETURNING *;

-- name: MarkNotificationUnread :one
UPDATE notifications
SET is_read = false, read_at = NULL
WHERE id = $1 AND user_id = $2
RETURNING *;

-- name: MarkAllNotificationsRead :exec
UPDATE notifications
SET is_read = true, read_at = NOW()
WHERE user_id = $1 AND is_read = FALSE;

-- name: MarkGameNotificationsRead :exec
UPDATE notifications
SET is_read = true, read_at = NOW()
WHERE user_id = $1 AND game_id = $2 AND is_read = FALSE;

-- name: DeleteNotification :exec
DELETE FROM notifications
WHERE id = $1 AND user_id = $2;

-- name: DeleteOldNotifications :exec
DELETE FROM notifications
WHERE created_at < NOW() - INTERVAL '30 days';

-- name: GetGameNotifications :many
SELECT n.*, u.username
FROM notifications n
JOIN users u ON n.user_id = u.id
WHERE n.game_id = $1
ORDER BY n.created_at DESC
LIMIT $2 OFFSET $3;

-- Helper queries for creating notifications
-- name: NotifyGameParticipants :exec
INSERT INTO notifications (user_id, game_id, type, title, content, related_type, related_id, link_url)
SELECT gp.user_id, $1, $2, $3, $4, $5, $6, $7
FROM game_participants gp
WHERE gp.game_id = $1 AND gp.status = 'active' AND gp.user_id != $8;

-- name: NotifyGM :exec
INSERT INTO notifications (user_id, game_id, type, title, content, related_type, related_id, link_url)
SELECT g.gm_user_id, $1, $2, $3, $4, $5, $6, $7
FROM games g
WHERE g.id = $1 AND g.gm_user_id != $8;

-- name: NotifyAudienceMembers :exec
INSERT INTO notifications (user_id, game_id, type, title, content, related_type, related_id, link_url)
SELECT gp.user_id, $1, $2, $3, $4, $5, $6, $7
FROM game_participants gp
WHERE gp.game_id = $1 AND gp.role = 'audience' AND gp.status = 'active' AND gp.user_id != $8;
