package db

import (
	"actionphase/pkg/core"
	db "actionphase/pkg/db/models"
	"actionphase/pkg/observability"
	"context"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type FingerprintBanService struct {
	DB     *pgxpool.Pool
	Logger *observability.Logger
}

var _ core.FingerprintBanServiceInterface = (*FingerprintBanService)(nil)

func (s *FingerprintBanService) CreateFingerprintBan(ctx context.Context, fingerprint, reason string, createdBy int32) (*core.FingerprintBan, error) {
	q := db.New(s.DB)

	row, err := q.CreateFingerprintBan(ctx, db.CreateFingerprintBanParams{
		Fingerprint: fingerprint,
		CreatedBy:   createdBy,
		Reason:      pgtype.Text{String: reason, Valid: reason != ""},
	})
	if err != nil {
		s.Logger.LogError(ctx, err, "Failed to create fingerprint ban", "fingerprint", fingerprint)
		return nil, err
	}

	s.Logger.Info(ctx, "Fingerprint ban created", "fingerprint", fingerprint, "created_by", createdBy)
	return fingerprintBanFromDB(row), nil
}

func (s *FingerprintBanService) ListFingerprintBans(ctx context.Context) ([]*core.FingerprintBan, error) {
	q := db.New(s.DB)
	rows, err := q.ListFingerprintBans(ctx)
	if err != nil {
		return nil, err
	}
	bans := make([]*core.FingerprintBan, 0, len(rows))
	for _, row := range rows {
		bans = append(bans, fingerprintBanFromDB(row))
	}
	return bans, nil
}

func (s *FingerprintBanService) DeleteFingerprintBan(ctx context.Context, id int32) error {
	q := db.New(s.DB)
	s.Logger.Info(ctx, "Deleting fingerprint ban", "ban_id", id)
	return q.DeleteFingerprintBan(ctx, id)
}

func (s *FingerprintBanService) IsFingerprintBanned(ctx context.Context, fingerprint string) (bool, error) {
	q := db.New(s.DB)
	banned, err := q.IsFingerprintBanned(ctx, fingerprint)
	if err != nil {
		// Soft-fail: log but don't block auth on DB errors
		s.Logger.LogError(ctx, err, "Fingerprint ban check failed", "fingerprint", fingerprint)
		return false, nil
	}
	return banned, nil
}

func fingerprintBanFromDB(row db.FingerprintBan) *core.FingerprintBan {
	ban := &core.FingerprintBan{
		ID:          row.ID,
		Fingerprint: row.Fingerprint,
		CreatedBy:   row.CreatedBy,
		CreatedAt:   row.CreatedAt.Time,
	}
	if row.Reason.Valid {
		ban.Reason = &row.Reason.String
	}
	return ban
}
