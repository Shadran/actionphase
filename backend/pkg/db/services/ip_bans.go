package db

import (
	"actionphase/pkg/core"
	db "actionphase/pkg/db/models"
	"actionphase/pkg/observability"
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type IPBanService struct {
	DB     *pgxpool.Pool
	Logger *observability.Logger
}

var _ core.IPBanServiceInterface = (*IPBanService)(nil)

func (s *IPBanService) CreateIPBan(ctx context.Context, ipAddress, reason string, createdBy int32, expiresAt *time.Time) (*core.IPBan, error) {
	q := db.New(s.DB)

	params := db.CreateIPBanParams{
		IpAddress: ipAddress,
		CreatedBy: createdBy,
		Reason:    pgtype.Text{String: reason, Valid: reason != ""},
	}
	if expiresAt != nil {
		params.ExpiresAt = pgtype.Timestamptz{Time: *expiresAt, Valid: true}
	}

	row, err := q.CreateIPBan(ctx, params)
	if err != nil {
		s.Logger.LogError(ctx, err, "Failed to create IP ban", "ip_address", ipAddress)
		return nil, err
	}

	s.Logger.Info(ctx, "IP ban created", "ip_address", ipAddress, "created_by", createdBy)
	return ipBanFromDB(row), nil
}

func (s *IPBanService) ListIPBans(ctx context.Context) ([]*core.IPBan, error) {
	q := db.New(s.DB)
	rows, err := q.ListIPBans(ctx)
	if err != nil {
		return nil, err
	}
	bans := make([]*core.IPBan, 0, len(rows))
	for _, row := range rows {
		bans = append(bans, ipBanFromDB(row))
	}
	return bans, nil
}

func (s *IPBanService) DeleteIPBan(ctx context.Context, id int32) error {
	q := db.New(s.DB)
	s.Logger.Info(ctx, "Deleting IP ban", "ban_id", id)
	return q.DeleteIPBan(ctx, id)
}

func (s *IPBanService) IsIPBanned(ctx context.Context, ipAddress string) (bool, error) {
	q := db.New(s.DB)
	banned, err := q.IsIPBanned(ctx, ipAddress)
	if err != nil {
		// Soft-fail: log the error but don't block access on DB errors
		s.Logger.LogError(ctx, err, "IP ban check failed", "ip_address", ipAddress)
		return false, nil
	}
	return banned, nil
}

func (s *IPBanService) CleanupExpiredIPBans(ctx context.Context) error {
	q := db.New(s.DB)
	err := q.DeleteExpiredIPBans(ctx)
	if err != nil {
		s.Logger.LogError(ctx, err, "Failed to clean up expired IP bans")
		return err
	}
	s.Logger.Info(ctx, "Expired IP bans cleaned up")
	return nil
}

func ipBanFromDB(row db.IpBan) *core.IPBan {
	ban := &core.IPBan{
		ID:        row.ID,
		IPAddress: row.IpAddress,
		CreatedBy: row.CreatedBy,
		CreatedAt: row.CreatedAt.Time,
	}
	if row.Reason.Valid {
		ban.Reason = &row.Reason.String
	}
	if row.ExpiresAt.Valid {
		ban.ExpiresAt = &row.ExpiresAt.Time
	}
	return ban
}
