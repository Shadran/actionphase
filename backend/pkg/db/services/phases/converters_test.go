package phases

import (
	"context"
	"testing"
	"time"

	core "actionphase/pkg/core"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPhaseService_CreateAndRetrievePhase(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)
	phaseService := &PhaseService{DB: testDB.Pool, Logger: app.ObsLogger}

	user := testDB.CreateTestUser(t, "testuser", "test@example.com")
	game := testDB.CreateTestGame(t, int32(user.ID), "Test Game")

	t.Run("creates phase with expected fields", func(t *testing.T) {
		now := time.Now()
		phase, err := phaseService.CreatePhase(context.Background(), core.CreatePhaseRequest{
			GameID:      game.ID,
			PhaseType:   "common_room",
			PhaseNumber: 1,
			Title:       "Test Phase",
			Description: "Test description",
			StartTime:   &now,
			EndTime:     func() *time.Time { t := now.Add(24 * time.Hour); return &t }(),
			Deadline:    func() *time.Time { t := now.Add(48 * time.Hour); return &t }(),
		})
		require.NoError(t, err)

		assert.Equal(t, game.ID, phase.GameID)
		assert.Equal(t, "common_room", phase.PhaseType)
		assert.Equal(t, "Test Phase", phase.Title)
		assert.True(t, phase.Description.Valid)
		assert.Equal(t, "Test description", phase.Description.String)
		assert.True(t, phase.StartTime.Valid)
		assert.True(t, phase.EndTime.Valid)
		assert.True(t, phase.Deadline.Valid)
	})
}
