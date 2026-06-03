package db

import (
	"actionphase/pkg/core"
	db "actionphase/pkg/db/models"
	"actionphase/pkg/observability"
	"context"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type UserService struct {
	DB     *pgxpool.Pool
	Logger *observability.Logger
}

// Ensure UserService implements the interface
var _ core.UserServiceInterface = (*UserService)(nil)

// GetUserByID retrieves a user by their ID (primary key lookup)
func (s *UserService) GetUserByID(userID int) (*core.User, error) {
	ctx := context.Background()
	q := db.New(s.DB)
	dbUser, err := q.GetUser(ctx, int32(userID))
	if err != nil {
		return nil, err
	}

	// Convert ban fields
	var bannedAt *time.Time
	if dbUser.BannedAt.Valid {
		bannedAt = &dbUser.BannedAt.Time
	}

	var bannedByUserID *int32
	if dbUser.BannedByUserID.Valid {
		bannedByUserID = &dbUser.BannedByUserID.Int32
	}

	// Convert bio
	var bio *string
	if dbUser.Bio.Valid {
		bio = &dbUser.Bio.String
	}

	// Convert avatar URL
	var avatarURL *string
	if dbUser.AvatarUrl.Valid {
		avatarURL = &dbUser.AvatarUrl.String
	}

	return &core.User{
		ID:              int(dbUser.ID),
		Username:        dbUser.Username,
		Password:        dbUser.Password,
		Email:           dbUser.Email,
		EmailVerified:   dbUser.EmailVerified,
		Bio:             bio,
		AvatarURL:       avatarURL,
		IsAdmin:         dbUser.IsAdmin.Bool,
		IsBanned:        dbUser.IsBanned,
		BannedAt:        bannedAt,
		BannedByUserID:  bannedByUserID,
		CreatedAt:       &dbUser.CreatedAt.Time,
		PendingApproval: dbUser.PendingApproval,
	}, nil
}

func (s *UserService) UserByUsername(username string) (*core.User, error) {
	ctx := context.Background()
	q := db.New(s.DB)
	dbUser, err := q.GetUserByUsername(ctx, username)
	if err != nil {
		return nil, err
	}

	// Convert ban fields
	var bannedAt *time.Time
	if dbUser.BannedAt.Valid {
		bannedAt = &dbUser.BannedAt.Time
	}

	var bannedByUserID *int32
	if dbUser.BannedByUserID.Valid {
		bannedByUserID = &dbUser.BannedByUserID.Int32
	}

	// Convert bio
	var bio *string
	if dbUser.Bio.Valid {
		bio = &dbUser.Bio.String
	}

	// Convert avatar URL
	var avatarURL *string
	if dbUser.AvatarUrl.Valid {
		avatarURL = &dbUser.AvatarUrl.String
	}

	return &core.User{
		ID:              int(dbUser.ID),
		Username:        dbUser.Username,
		Password:        dbUser.Password,
		Email:           dbUser.Email,
		EmailVerified:   dbUser.EmailVerified,
		Bio:             bio,
		AvatarURL:       avatarURL,
		IsAdmin:         dbUser.IsAdmin.Bool,
		IsBanned:        dbUser.IsBanned,
		BannedAt:        bannedAt,
		BannedByUserID:  bannedByUserID,
		CreatedAt:       &dbUser.CreatedAt.Time,
		PendingApproval: dbUser.PendingApproval,
	}, nil
}

func (s *UserService) UserByEmail(email string) (*core.User, error) {
	ctx := context.Background()
	q := db.New(s.DB)
	dbUser, err := q.GetUserByEmail(ctx, strings.ToLower(email))
	if err != nil {
		return nil, err
	}

	// Convert ban fields
	var bannedAt *time.Time
	if dbUser.BannedAt.Valid {
		bannedAt = &dbUser.BannedAt.Time
	}

	var bannedByUserID *int32
	if dbUser.BannedByUserID.Valid {
		bannedByUserID = &dbUser.BannedByUserID.Int32
	}

	// Convert bio
	var bio *string
	if dbUser.Bio.Valid {
		bio = &dbUser.Bio.String
	}

	// Convert avatar URL
	var avatarURL *string
	if dbUser.AvatarUrl.Valid {
		avatarURL = &dbUser.AvatarUrl.String
	}

	return &core.User{
		ID:              int(dbUser.ID),
		Username:        dbUser.Username,
		Password:        dbUser.Password,
		Email:           dbUser.Email,
		EmailVerified:   dbUser.EmailVerified,
		Bio:             bio,
		AvatarURL:       avatarURL,
		IsAdmin:         dbUser.IsAdmin.Bool,
		IsBanned:        dbUser.IsBanned,
		BannedAt:        bannedAt,
		BannedByUserID:  bannedByUserID,
		CreatedAt:       &dbUser.CreatedAt.Time,
		PendingApproval: dbUser.PendingApproval,
	}, nil
}

func (s *UserService) Users() ([]*core.User, error) {
	return nil, nil
}

func (s *UserService) CreateUser(u *core.User) (*core.User, error) {
	ctx := context.Background()

	s.Logger.Info(ctx, "Creating new user account",
		"username", u.Username,
		"email", u.Email,
	)

	u.HashPassword()
	q := db.New(s.DB)
	dbUser, err := q.CreateUser(ctx, db.CreateUserParams{
		Username: u.Username,
		Password: u.Password,
		Email:    strings.ToLower(u.Email),
	})

	if err != nil {
		s.Logger.LogError(ctx, err, "Failed to create user account",
			"username", u.Username,
			"email", u.Email,
		)
		return nil, err
	}

	s.Logger.Info(ctx, "User account created successfully",
		"user_id", dbUser.ID,
		"username", dbUser.Username,
		"email", dbUser.Email,
		"email_verified", dbUser.EmailVerified,
	)

	return &core.User{
		ID:            int(dbUser.ID),
		Username:      dbUser.Username,
		Email:         dbUser.Email,
		EmailVerified: dbUser.EmailVerified,
		CreatedAt:     &dbUser.CreatedAt.Time,
	}, nil
}

func (s *UserService) DeleteUser(id int) error {
	return nil
}

// SetAdminStatus grants or revokes admin privileges for a user
func (s *UserService) SetAdminStatus(ctx context.Context, userID int32, isAdmin bool, requesterID int32) error {
	action := "revoke"
	if isAdmin {
		action = "grant"
	}

	s.Logger.Info(ctx, "Admin privilege modification attempt",
		"action", action,
		"target_user_id", userID,
		"requester_id", requesterID,
	)

	q := db.New(s.DB)

	// Check if requester is admin
	requester, err := q.GetUser(ctx, requesterID)
	if err != nil {
		s.Logger.LogError(ctx, err, "Failed to get requester user",
			"requester_id", requesterID,
		)
		return err
	}

	if !requester.IsAdmin.Bool {
		s.Logger.Warn(ctx, "Unauthorized admin privilege modification attempt",
			"requester_id", requesterID,
			"requester_username", requester.Username,
			"target_user_id", userID,
		)
		return errors.New("Unauthorized: admin privileges required")
	}

	// Update admin status
	err = q.UpdateUserAdminStatus(ctx, db.UpdateUserAdminStatusParams{
		ID:      userID,
		IsAdmin: pgtype.Bool{Bool: isAdmin, Valid: true},
	})

	if err != nil {
		s.Logger.LogError(ctx, err, "Failed to update admin status",
			"action", action,
			"target_user_id", userID,
			"requester_id", requesterID,
		)
		return err
	}

	s.Logger.Warn(ctx, "Admin privilege modified - security event",
		"action", action,
		"target_user_id", userID,
		"requester_id", requesterID,
		"requester_username", requester.Username,
	)

	return nil
}

// ListAdmins returns all users with admin privileges
func (s *UserService) ListAdmins(ctx context.Context) ([]*core.User, error) {
	q := db.New(s.DB)

	dbAdmins, err := q.ListAdmins(ctx)
	if err != nil {
		return nil, err
	}

	admins := make([]*core.User, 0, len(dbAdmins))
	for _, dbAdmin := range dbAdmins {
		admins = append(admins, &core.User{
			ID:        int(dbAdmin.ID),
			Username:  dbAdmin.Username,
			Email:     dbAdmin.Email,
			CreatedAt: &dbAdmin.CreatedAt.Time,
		})
	}

	return admins, nil
}

// BanUser bans a user from the platform
func (s *UserService) BanUser(ctx context.Context, userID int32, adminID int32) error {
	s.Logger.Info(ctx, "User ban attempt",
		"target_user_id", userID,
		"admin_id", adminID,
	)

	// Prevent admin from banning themselves
	if userID == adminID {
		s.Logger.Warn(ctx, "Admin attempted to ban themselves",
			"admin_id", adminID,
		)
		return errors.New("Cannot ban yourself")
	}

	q := db.New(s.DB)

	// Get target user for logging
	targetUser, err := q.GetUser(ctx, userID)
	if err != nil {
		s.Logger.LogError(ctx, err, "Failed to get target user for ban",
			"target_user_id", userID,
		)
		return err
	}

	// Ban the user
	err = q.BanUser(ctx, db.BanUserParams{
		ID:             userID,
		BannedByUserID: pgtype.Int4{Int32: adminID, Valid: true},
	})
	if err != nil {
		s.Logger.LogError(ctx, err, "Failed to ban user",
			"target_user_id", userID,
			"target_username", targetUser.Username,
			"admin_id", adminID,
		)
		return err
	}

	s.Logger.Warn(ctx, "User banned - critical security event",
		"target_user_id", userID,
		"target_username", targetUser.Username,
		"target_email", targetUser.Email,
		"admin_id", adminID,
	)

	// Invalidate all sessions for the banned user
	// This will be handled by SessionService
	return nil
}

// UnbanUser removes ban from a user
func (s *UserService) UnbanUser(ctx context.Context, userID int32) error {
	s.Logger.Info(ctx, "User unban attempt",
		"target_user_id", userID,
	)

	q := db.New(s.DB)

	// Get target user for logging
	targetUser, err := q.GetUser(ctx, userID)
	if err != nil {
		s.Logger.LogError(ctx, err, "Failed to get target user for unban",
			"target_user_id", userID,
		)
		return err
	}

	err = q.UnbanUser(ctx, userID)
	if err != nil {
		s.Logger.LogError(ctx, err, "Failed to unban user",
			"target_user_id", userID,
			"target_username", targetUser.Username,
		)
		return err
	}

	s.Logger.Warn(ctx, "User unbanned - security event",
		"target_user_id", userID,
		"target_username", targetUser.Username,
		"target_email", targetUser.Email,
	)

	return nil
}

// ListBannedUsers returns all banned users with ban details
func (s *UserService) ListBannedUsers(ctx context.Context) ([]*core.BannedUser, error) {
	q := db.New(s.DB)

	dbBannedUsers, err := q.ListBannedUsers(ctx)
	if err != nil {
		return nil, err
	}

	bannedUsers := make([]*core.BannedUser, 0, len(dbBannedUsers))
	for _, dbUser := range dbBannedUsers {
		bannedUsers = append(bannedUsers, &core.BannedUser{
			ID:               int(dbUser.ID),
			Username:         dbUser.Username,
			Email:            dbUser.Email,
			BannedAt:         dbUser.BannedAt.Time,
			BannedByUserID:   dbUser.BannedByUserID.Int32,
			BannedByUsername: dbUser.BannedByUsername.String,
			CreatedAt:        dbUser.CreatedAt.Time,
		})
	}

	return bannedUsers, nil
}

// CheckUserBanned checks if a user is currently banned
func (s *UserService) CheckUserBanned(ctx context.Context, userID int32) (bool, error) {
	q := db.New(s.DB)

	user, err := q.GetUser(ctx, userID)
	if err != nil {
		return false, err
	}

	return user.IsBanned, nil
}

// SearchUsers searches for users by username (case-insensitive partial match)
// Returns only non-banned users, limited to 20 results
func (s *UserService) SearchUsers(ctx context.Context, query string) ([]db.SearchUsersRow, error) {
	q := db.New(s.DB)
	return q.SearchUsers(ctx, pgtype.Text{String: query, Valid: true})
}

// ListAllUsers returns a paginated, searchable list of all users.
func (s *UserService) ListAllUsers(ctx context.Context, page, pageSize int, search string) ([]*core.User, int64, error) {
	q := db.New(s.DB)

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 25
	}
	offset := int32((page - 1) * pageSize)

	dbUsers, err := q.ListAllUsers(ctx, db.ListAllUsersParams{
		Column1: search,
		Limit:   int32(pageSize),
		Offset:  offset,
	})
	if err != nil {
		return nil, 0, err
	}

	total, err := q.CountAllUsers(ctx, search)
	if err != nil {
		return nil, 0, err
	}

	users := make([]*core.User, 0, len(dbUsers))
	for _, dbUser := range dbUsers {
		u := &core.User{
			ID:              int(dbUser.ID),
			Username:        dbUser.Username,
			Email:           dbUser.Email,
			EmailVerified:   dbUser.EmailVerified,
			IsAdmin:         dbUser.IsAdmin.Bool,
			IsBanned:        dbUser.IsBanned,
			CreatedAt:       &dbUser.CreatedAt.Time,
			PendingApproval: dbUser.PendingApproval,
		}
		users = append(users, u)
	}

	return users, total, nil
}

// ListAllUsersAdmin returns a paginated list of all users with Discord username included.
// Only for use by admin handlers — includes PII (email, ban status, Discord account).
func (s *UserService) ListAllUsersAdmin(ctx context.Context, page, pageSize int, search string) ([]*core.User, int64, error) {
	q := db.New(s.DB)

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 25
	}
	offset := int32((page - 1) * pageSize)

	dbUsers, err := q.ListAllUsersAdmin(ctx, db.ListAllUsersAdminParams{
		Column1: search,
		Limit:   int32(pageSize),
		Offset:  offset,
	})
	if err != nil {
		return nil, 0, err
	}

	total, err := q.CountAllUsers(ctx, search)
	if err != nil {
		return nil, 0, err
	}

	users := make([]*core.User, 0, len(dbUsers))
	for _, dbUser := range dbUsers {
		u := &core.User{
			ID:              int(dbUser.ID),
			Username:        dbUser.Username,
			Email:           dbUser.Email,
			EmailVerified:   dbUser.EmailVerified,
			IsAdmin:         dbUser.IsAdmin.Bool,
			IsBanned:        dbUser.IsBanned,
			CreatedAt:       &dbUser.CreatedAt.Time,
			PendingApproval: dbUser.PendingApproval,
		}
		if dbUser.DiscordUsername.Valid {
			u.DiscordUsername = &dbUser.DiscordUsername.String
		}
		users = append(users, u)
	}

	return users, total, nil
}

// ListPendingApprovalUsers returns all users awaiting admin approval.
func (s *UserService) ListPendingApprovalUsers(ctx context.Context) ([]*core.User, error) {
	q := db.New(s.DB)
	dbUsers, err := q.ListPendingApprovalUsers(ctx)
	if err != nil {
		return nil, err
	}
	users := make([]*core.User, 0, len(dbUsers))
	for _, dbUser := range dbUsers {
		u := &core.User{
			ID:              int(dbUser.ID),
			Username:        dbUser.Username,
			Email:           dbUser.Email,
			CreatedAt:       &dbUser.CreatedAt.Time,
			PendingApproval: dbUser.PendingApproval,
		}
		if dbUser.PendingApprovalSince.Valid {
			t := dbUser.PendingApprovalSince.Time
			u.PendingApprovalSince = &t
		}
		users = append(users, u)
	}
	return users, nil
}

// ApproveUser clears the pending approval flag on a user, allowing them to login.
func (s *UserService) ApproveUser(ctx context.Context, userID int32) error {
	q := db.New(s.DB)
	s.Logger.Info(ctx, "Approving pending user", "user_id", userID)
	return q.ApprovePendingUser(ctx, userID)
}

// RejectUser deletes a pending registration, removing the account entirely.
func (s *UserService) RejectUser(ctx context.Context, userID int32) error {
	s.Logger.Info(ctx, "Rejecting pending user", "user_id", userID)
	q := db.New(s.DB)
	return q.DeleteUser(ctx, userID)
}

// SetPendingApproval places a user in the pending approval state.
func (s *UserService) SetPendingApproval(ctx context.Context, userID int32) error {
	q := db.New(s.DB)
	return q.SetPendingApproval(ctx, userID)
}
