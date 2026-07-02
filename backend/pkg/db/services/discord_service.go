package db

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"actionphase/pkg/core"
	models "actionphase/pkg/db/models"
	"actionphase/pkg/observability"
)

// DiscordAccountService implements core.DiscordAccountServiceInterface.
type DiscordAccountService struct {
	DB     *pgxpool.Pool
	Logger *observability.Logger
}

// Compile-time verification that DiscordAccountService implements the interface.
var _ core.DiscordAccountServiceInterface = (*DiscordAccountService)(nil)

// GetDiscordAccount retrieves a user's linked Discord account.
// Returns nil, nil if the user has no linked account (not an error).
func (s *DiscordAccountService) GetDiscordAccount(ctx context.Context, userID int32) (*core.DiscordAccount, error) {
	queries := models.New(s.DB)

	row, err := queries.GetUserDiscordAccount(ctx, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("get discord account: %w", err)
	}

	return rowToDiscordAccount(row), nil
}

// UpsertDiscordAccount creates or updates a user's Discord account link.
func (s *DiscordAccountService) UpsertDiscordAccount(ctx context.Context, req *core.UpsertDiscordAccountRequest) (*core.DiscordAccount, error) {
	queries := models.New(s.DB)

	params := models.UpsertUserDiscordAccountParams{
		UserID:          req.UserID,
		DiscordUserID:   req.DiscordUserID,
		DiscordUsername: req.DiscordUsername,
		AccessToken:     req.AccessToken,
	}

	if req.RefreshToken != nil {
		params.RefreshToken = pgtype.Text{String: *req.RefreshToken, Valid: true}
	}

	if req.TokenExpiresAt != nil {
		params.TokenExpiresAt = pgtype.Timestamptz{Time: *req.TokenExpiresAt, Valid: true}
	}

	row, err := queries.UpsertUserDiscordAccount(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("upsert discord account: %w", err)
	}

	s.Logger.Info(ctx, "Discord account linked",
		"user_id", req.UserID,
		"discord_id", req.DiscordUserID,
	)

	return rowToDiscordAccount(row), nil
}

// DeleteDiscordAccount removes a user's Discord account link.
func (s *DiscordAccountService) DeleteDiscordAccount(ctx context.Context, userID int32) error {
	queries := models.New(s.DB)

	if err := queries.DeleteUserDiscordAccount(ctx, userID); err != nil {
		return fmt.Errorf("delete discord account: %w", err)
	}

	s.Logger.Info(ctx, "Discord account unlinked",
		"user_id", userID,
	)

	return nil
}

// rowToDiscordAccount converts a sqlc model to a core domain type.
func rowToDiscordAccount(row models.UserDiscordAccount) *core.DiscordAccount {
	acct := &core.DiscordAccount{
		ID:              row.ID,
		UserID:          row.UserID,
		DiscordUserID:   row.DiscordUserID,
		DiscordUsername: row.DiscordUsername,
		AccessToken:     row.AccessToken,
		CreatedAt:       row.CreatedAt.Time,
		UpdatedAt:       row.UpdatedAt.Time,
	}

	if row.RefreshToken.Valid {
		acct.RefreshToken = &row.RefreshToken.String
	}

	if row.TokenExpiresAt.Valid {
		t := row.TokenExpiresAt.Time
		acct.TokenExpiresAt = &t
	}

	return acct
}

