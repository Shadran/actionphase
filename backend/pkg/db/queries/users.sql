-- name: GetUser :one
SELECT * FROM users
WHERE id = $1 LIMIT 1;

-- name: GetUserByUsername :one
SELECT * FROM users
WHERE LOWER(username) = LOWER($1) LIMIT 1;

-- name: ListAllUsers :many
SELECT * FROM users
WHERE (
    $1::text = '' OR username ILIKE '%' || $1 || '%' OR email ILIKE '%' || $1 || '%'
)
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: ListAllUsersAdmin :many
SELECT u.*, da.discord_username
FROM users u
LEFT JOIN user_discord_accounts da ON da.user_id = u.id
WHERE (
    $1::text = '' OR u.username ILIKE '%' || $1 || '%' OR u.email ILIKE '%' || $1 || '%'
)
ORDER BY u.created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountAllUsers :one
SELECT COUNT(*) FROM users
WHERE (
    $1::text = '' OR username ILIKE '%' || $1 || '%' OR email ILIKE '%' || $1 || '%'
);

-- name: ListPendingApprovalUsers :many
SELECT * FROM users
WHERE pending_approval = TRUE
ORDER BY created_at ASC;

-- name: SetPendingApproval :exec
UPDATE users
SET pending_approval = TRUE,
    pending_approval_since = NOW()
WHERE id = $1;

-- name: ApprovePendingUser :exec
UPDATE users
SET pending_approval = FALSE,
    pending_approval_since = NULL
WHERE id = $1;

-- name: CreateUser :one
INSERT INTO users (
    username, password, email
) VALUES (
             $1, $2, $3
         )
RETURNING *;

-- name: UpdateUser :exec
UPDATE users
set username = $2,
    password = $3,
    email = $4
WHERE id = $1;

-- name: DeleteUser :exec
DELETE FROM users
WHERE id = $1;

-- Admin management queries

-- name: UpdateUserAdminStatus :exec
UPDATE users
SET is_admin = $2
WHERE id = $1;

-- name: ListAdmins :many
SELECT id, username, email, created_at
FROM users
WHERE is_admin = TRUE
ORDER BY created_at ASC;

-- User banning queries

-- name: BanUser :exec
UPDATE users
SET is_banned = TRUE,
    banned_at = NOW(),
    banned_by_user_id = $2
WHERE id = $1;

-- name: UnbanUser :exec
UPDATE users
SET is_banned = FALSE,
    banned_at = NULL,
    banned_by_user_id = NULL
WHERE id = $1;

-- name: ListBannedUsers :many
SELECT u.id, u.username, u.email, u.banned_at, u.banned_by_user_id, u.created_at,
       admin.username as banned_by_username
FROM users u
LEFT JOIN users admin ON u.banned_by_user_id = admin.id
WHERE u.is_banned = TRUE
ORDER BY u.banned_at DESC;

-- User search queries

-- name: SearchUsers :many
SELECT id, username, email, created_at
FROM users
WHERE username ILIKE '%' || $1 || '%'
  AND is_banned = FALSE
ORDER BY username
LIMIT 20;

-- Password Management

-- name: UpdateUserPassword :exec
UPDATE users
SET password = $2,
    password_changed_at = NOW()
WHERE id = $1;

-- name: GetUserByEmail :one
SELECT * FROM users
WHERE LOWER(email) = LOWER($1) LIMIT 1;

-- Password Reset Tokens

-- name: CreatePasswordResetToken :one
INSERT INTO password_reset_tokens (
    user_id, token, expires_at
) VALUES (
    $1, $2, $3
)
RETURNING *;

-- name: GetPasswordResetToken :one
SELECT * FROM password_reset_tokens
WHERE token = $1
  AND used_at IS NULL
  AND expires_at > NOW()
LIMIT 1;

-- name: MarkPasswordResetTokenUsed :exec
UPDATE password_reset_tokens
SET used_at = NOW()
WHERE id = $1;

-- name: DeleteExpiredPasswordResetTokens :exec
DELETE FROM password_reset_tokens
WHERE expires_at < NOW()
  OR used_at IS NOT NULL;

-- Email Verification Tokens

-- name: CreateEmailVerificationToken :one
INSERT INTO email_verification_tokens (
    user_id, email, token, expires_at
) VALUES (
    $1, $2, $3, $4
)
RETURNING *;

-- name: GetEmailVerificationToken :one
SELECT * FROM email_verification_tokens
WHERE token = $1
  AND used_at IS NULL
  AND expires_at > NOW()
LIMIT 1;

-- name: MarkEmailVerificationTokenUsed :exec
UPDATE email_verification_tokens
SET used_at = NOW()
WHERE id = $1;

-- name: MarkUserEmailVerified :exec
UPDATE users
SET email_verified = TRUE
WHERE id = $1;

-- name: UpdateUserEmail :exec
UPDATE users
SET email = $2,
    email_verified = TRUE,
    email_change_pending = NULL
WHERE id = $1;

-- name: SetEmailChangePending :exec
UPDATE users
SET email_change_pending = $2
WHERE id = $1;

-- name: DeleteExpiredEmailVerificationTokens :exec
DELETE FROM email_verification_tokens
WHERE expires_at < NOW()
  OR used_at IS NOT NULL;

-- name: UpdateUserUsername :exec
UPDATE users
SET username = $2,
    username_changed_at = NOW()
WHERE id = $1;

-- Account Deletion (Soft Delete with 30-day recovery)

-- name: SoftDeleteUser :exec
UPDATE users
SET deleted_at = NOW()
WHERE id = $1;

-- name: RestoreDeletedUser :exec
UPDATE users
SET deleted_at = NULL
WHERE id = $1;

-- name: GetDeletedUser :one
SELECT * FROM users
WHERE id = $1
  AND deleted_at IS NOT NULL
LIMIT 1;

-- name: PermanentlyDeleteUser :exec
DELETE FROM users
WHERE id = $1
  AND deleted_at IS NOT NULL
  AND deleted_at < NOW() - INTERVAL '30 days';
