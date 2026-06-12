package games

import (
	"fmt"

	"github.com/jackc/pgx/v5/pgtype"
)

// formatPgtypeTime converts a pgtype.Time (microseconds since midnight) to "HH:MM" string.
func formatPgtypeTime(t pgtype.Time) string {
	total := t.Microseconds / 1e6
	h := total / 3600
	m := (total % 3600) / 60
	return fmt.Sprintf("%02d:%02d", h, m)
}
