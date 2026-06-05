package phases

import (
	"context"
	"testing"
	"time"

	core "actionphase/pkg/core"
	models "actionphase/pkg/db/models"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPhaseService_RunScheduledActivations_ActivatesPastPhase(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)
	phaseService := &PhaseService{DB: testDB.Pool, Logger: app.ObsLogger}
	queries := models.New(testDB.Pool)

	gm := testDB.CreateTestUser(t, "sched_gm1", "sched_gm1@example.com")
	game := testDB.CreateTestGameWithState(t, int32(gm.ID), "Scheduler Game 1", "in_progress")

	past := time.Now().Add(-5 * time.Minute)
	phase, err := queries.CreateGamePhase(context.Background(), models.CreateGamePhaseParams{
		GameID:      game.ID,
		PhaseType:   "common_room",
		PhaseNumber: 1,
		Title:       "Scheduled Phase",
		StartTime:   pgtype.Timestamptz{Time: past, Valid: true},
	})
	require.NoError(t, err)
	assert.False(t, phase.IsActive.Bool)

	_, activated, err := phaseService.RunScheduledActivations(context.Background())
	require.NoError(t, err)
	assert.GreaterOrEqual(t, activated, 1)

	active, err := queries.GetActivePhase(context.Background(), game.ID)
	require.NoError(t, err)
	assert.Equal(t, phase.ID, active.ID)
	assert.True(t, active.IsActive.Bool)
}

func TestPhaseService_RunScheduledActivations_SkipsFuturePhase(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)
	phaseService := &PhaseService{DB: testDB.Pool, Logger: app.ObsLogger}
	queries := models.New(testDB.Pool)

	gm := testDB.CreateTestUser(t, "sched_gm2", "sched_gm2@example.com")
	game := testDB.CreateTestGameWithState(t, int32(gm.ID), "Scheduler Game 2", "in_progress")

	future := time.Now().Add(10 * time.Minute)
	_, err := queries.CreateGamePhase(context.Background(), models.CreateGamePhaseParams{
		GameID:      game.ID,
		PhaseType:   "common_room",
		PhaseNumber: 1,
		Title:       "Future Phase",
		StartTime:   pgtype.Timestamptz{Time: future, Valid: true},
	})
	require.NoError(t, err)

	// Verify this game's phase is not activated
	_, activated, err := phaseService.RunScheduledActivations(context.Background())
	require.NoError(t, err)

	// No active phase for this game
	_, err = queries.GetActivePhase(context.Background(), game.ID)
	assert.Error(t, err, "future phase should not be activated")
	_ = activated // global count may include other games
}

func TestPhaseService_RunScheduledActivations_SkipsNonInProgressGame(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)
	phaseService := &PhaseService{DB: testDB.Pool, Logger: app.ObsLogger}
	queries := models.New(testDB.Pool)

	gm := testDB.CreateTestUser(t, "sched_gm3", "sched_gm3@example.com")
	game := testDB.CreateTestGameWithState(t, int32(gm.ID), "Setup Game", "setup")

	past := time.Now().Add(-5 * time.Minute)
	_, err := queries.CreateGamePhase(context.Background(), models.CreateGamePhaseParams{
		GameID:      game.ID,
		PhaseType:   "common_room",
		PhaseNumber: 1,
		Title:       "Phase in Setup Game",
		StartTime:   pgtype.Timestamptz{Time: past, Valid: true},
	})
	require.NoError(t, err)

	_, _, err = phaseService.RunScheduledActivations(context.Background())
	require.NoError(t, err)

	// Should have no active phase in this game
	_, err = queries.GetActivePhase(context.Background(), game.ID)
	assert.Error(t, err, "setup game phases should not be auto-activated")
}

func TestPhaseService_RunScheduledActivations_DeactivatesCurrentPhase(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)
	phaseService := &PhaseService{DB: testDB.Pool, Logger: app.ObsLogger}
	queries := models.New(testDB.Pool)

	gm := testDB.CreateTestUser(t, "sched_gm4", "sched_gm4@example.com")
	game := testDB.CreateTestGameWithState(t, int32(gm.ID), "Scheduler Game 4", "in_progress")

	// Create and activate the current phase — simulating it was activated 1 hour ago
	currentPhase, err := queries.CreateGamePhase(context.Background(), models.CreateGamePhaseParams{
		GameID:      game.ID,
		PhaseType:   "action",
		PhaseNumber: 1,
		Title:       "Current Phase",
		StartTime:   pgtype.Timestamptz{Time: time.Now().Add(-1 * time.Hour), Valid: true},
	})
	require.NoError(t, err)
	_, err = queries.ActivatePhase(context.Background(), currentPhase.ID)
	require.NoError(t, err)
	// Backdate activated_at so the scheduler guard sees this as a pre-scheduled activation
	_, err = testDB.Pool.Exec(context.Background(),
		"UPDATE game_phases SET activated_at = $1 WHERE id = $2",
		time.Now().Add(-1*time.Hour), currentPhase.ID,
	)
	require.NoError(t, err)

	// Create a scheduled next phase with start_time after currentPhase was activated
	nextPhase, err := queries.CreateGamePhase(context.Background(), models.CreateGamePhaseParams{
		GameID:      game.ID,
		PhaseType:   "common_room",
		PhaseNumber: 2,
		Title:       "Next Phase",
		StartTime:   pgtype.Timestamptz{Time: time.Now().Add(-2 * time.Minute), Valid: true},
	})
	require.NoError(t, err)

	_, _, err = phaseService.RunScheduledActivations(context.Background())
	require.NoError(t, err)

	// Next phase is now active
	active, err := queries.GetActivePhase(context.Background(), game.ID)
	require.NoError(t, err)
	assert.Equal(t, nextPhase.ID, active.ID)

	// Current phase is deactivated
	deactivated, err := queries.GetPhase(context.Background(), currentPhase.ID)
	require.NoError(t, err)
	assert.False(t, deactivated.IsActive.Bool)
}

func TestPhaseService_RunScheduledActivations_OnlyEarliestPerGame(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)
	phaseService := &PhaseService{DB: testDB.Pool, Logger: app.ObsLogger}
	queries := models.New(testDB.Pool)

	gm := testDB.CreateTestUser(t, "sched_gm5", "sched_gm5@example.com")
	game := testDB.CreateTestGameWithState(t, int32(gm.ID), "Scheduler Game 5", "in_progress")

	earlier := time.Now().Add(-10 * time.Minute)
	later := time.Now().Add(-2 * time.Minute)

	phase1, err := queries.CreateGamePhase(context.Background(), models.CreateGamePhaseParams{
		GameID:      game.ID,
		PhaseType:   "common_room",
		PhaseNumber: 1,
		Title:       "Earlier Phase",
		StartTime:   pgtype.Timestamptz{Time: earlier, Valid: true},
	})
	require.NoError(t, err)

	_, err = queries.CreateGamePhase(context.Background(), models.CreateGamePhaseParams{
		GameID:      game.ID,
		PhaseType:   "action",
		PhaseNumber: 2,
		Title:       "Later Phase",
		StartTime:   pgtype.Timestamptz{Time: later, Valid: true},
	})
	require.NoError(t, err)

	_, _, err = phaseService.RunScheduledActivations(context.Background())
	require.NoError(t, err)

	// Only the earliest should be active
	active, err := queries.GetActivePhase(context.Background(), game.ID)
	require.NoError(t, err)
	assert.Equal(t, phase1.ID, active.ID, "earliest scheduled phase should activate")
}

func TestPhaseService_ActivatePhase_ClearsStaleScheduledStartTimes(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)
	phaseService := &PhaseService{DB: testDB.Pool, Logger: app.ObsLogger}
	queries := models.New(testDB.Pool)

	gm := testDB.CreateTestUser(t, "sched_gm6", "sched_gm6@example.com")
	game := testDB.CreateTestGameWithState(t, int32(gm.ID), "Stale Cleanup Game", "in_progress")

	past := time.Now().Add(-5 * time.Minute)
	future := time.Now().Add(2 * time.Hour)

	// Phase 1: overdue scheduled (start_time in the past, never activated)
	stalePhase, err := queries.CreateGamePhase(context.Background(), models.CreateGamePhaseParams{
		GameID:      game.ID,
		PhaseType:   "common_room",
		PhaseNumber: 1,
		Title:       "Stale Phase",
		StartTime:   pgtype.Timestamptz{Time: past, Valid: true},
	})
	require.NoError(t, err)

	// Phase 2: future scheduled
	futurePhase, err := queries.CreateGamePhase(context.Background(), models.CreateGamePhaseParams{
		GameID:      game.ID,
		PhaseType:   "action",
		PhaseNumber: 2,
		Title:       "Future Phase",
		StartTime:   pgtype.Timestamptz{Time: future, Valid: true},
	})
	require.NoError(t, err)

	// Phase 3: the one being manually activated (no start_time)
	manualPhase, err := queries.CreateGamePhase(context.Background(), models.CreateGamePhaseParams{
		GameID:      game.ID,
		PhaseType:   "common_room",
		PhaseNumber: 3,
		Title:       "Manual Phase",
	})
	require.NoError(t, err)

	// Manually activate phase 3
	_, err = phaseService.activatePhaseInternal(context.Background(), manualPhase.ID)
	require.NoError(t, err)

	// Stale phase's start_time should be cleared
	staleAfter, err := queries.GetPhase(context.Background(), stalePhase.ID)
	require.NoError(t, err)
	assert.False(t, staleAfter.StartTime.Valid, "overdue scheduled start_time should be cleared on manual activation")

	// Future phase's start_time should be untouched
	futureAfter, err := queries.GetPhase(context.Background(), futurePhase.ID)
	require.NoError(t, err)
	assert.True(t, futureAfter.StartTime.Valid, "future scheduled start_time should not be cleared")
	assert.WithinDuration(t, future, futureAfter.StartTime.Time, time.Second)
}

func TestPhaseService_RunScheduledActivations_DoesNotOverrideManualActivation(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)
	phaseService := &PhaseService{DB: testDB.Pool, Logger: app.ObsLogger}
	queries := models.New(testDB.Pool)

	gm := testDB.CreateTestUser(t, "sched_gm7", "sched_gm7@example.com")
	game := testDB.CreateTestGameWithState(t, int32(gm.ID), "Manual Override Game", "in_progress")

	// Scheduled phase whose start_time is in the past (would normally be activated)
	scheduledStart := time.Now().Add(-2 * time.Minute)
	scheduledPhase, err := queries.CreateGamePhase(context.Background(), models.CreateGamePhaseParams{
		GameID:      game.ID,
		PhaseType:   "common_room",
		PhaseNumber: 1,
		Title:       "Scheduled Phase",
		StartTime:   pgtype.Timestamptz{Time: scheduledStart, Valid: true},
	})
	require.NoError(t, err)

	// GM manually activates a different phase AFTER the scheduled start_time
	manualPhase, err := queries.CreateGamePhase(context.Background(), models.CreateGamePhaseParams{
		GameID:      game.ID,
		PhaseType:   "action",
		PhaseNumber: 2,
		Title:       "Manual Phase",
	})
	require.NoError(t, err)

	_, err = phaseService.activatePhaseInternal(context.Background(), manualPhase.ID)
	require.NoError(t, err)

	// Confirm manual phase is active and has activated_at set after scheduledStart
	active, err := queries.GetActivePhase(context.Background(), game.ID)
	require.NoError(t, err)
	assert.Equal(t, manualPhase.ID, active.ID)
	assert.True(t, active.ActivatedAt.Valid)
	assert.True(t, active.ActivatedAt.Time.After(scheduledStart))

	// Run scheduler — it should NOT override the manual activation
	_, activated, err := phaseService.RunScheduledActivations(context.Background())
	require.NoError(t, err)
	assert.Equal(t, 0, activated)

	// Manual phase should still be active
	stillActive, err := queries.GetActivePhase(context.Background(), game.ID)
	require.NoError(t, err)
	assert.Equal(t, manualPhase.ID, stillActive.ID, "scheduler should not override manual activation")

	// Scheduled phase should remain inactive
	scheduled, err := queries.GetPhase(context.Background(), scheduledPhase.ID)
	require.NoError(t, err)
	assert.False(t, scheduled.IsActive.Bool, "scheduled phase should not have been activated")
}

func TestPhaseService_RunScheduledActivations_SkipsCompletedHistoricalPhase(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)
	phaseService := &PhaseService{DB: testDB.Pool, Logger: app.ObsLogger}
	queries := models.New(testDB.Pool)

	gm := testDB.CreateTestUser(t, "sched_gm_hist", "sched_gm_hist@example.com")
	game := testDB.CreateTestGameWithState(t, int32(gm.ID), "Historical Phase Game", "in_progress")

	past := time.Now().Add(-10 * 24 * time.Hour)
	ended := time.Now().Add(-2 * 24 * time.Hour)

	// Historical/completed phase: start_time AND end_time in the past, is_active = false
	// (matches the fixture pattern — these should never be re-activated by the scheduler)
	_, err := queries.CreateGamePhase(context.Background(), models.CreateGamePhaseParams{
		GameID:      game.ID,
		PhaseType:   "action",
		PhaseNumber: 1,
		Title:       "Historical Action Phase",
		StartTime:   pgtype.Timestamptz{Time: past, Valid: true},
		EndTime:     pgtype.Timestamptz{Time: ended, Valid: true},
	})
	require.NoError(t, err)

	// Add an active common_room phase as the current phase (no start_time, as is typical post-fixture)
	currentPhase, err := queries.CreateGamePhase(context.Background(), models.CreateGamePhaseParams{
		GameID:      game.ID,
		PhaseType:   "common_room",
		PhaseNumber: 2,
		Title:       "Current Discussion Phase",
	})
	require.NoError(t, err)
	_, err = queries.ActivatePhase(context.Background(), currentPhase.ID)
	require.NoError(t, err)

	// Scheduler should NOT pick up the historical phase (it has end_time set)
	_, activated, err := phaseService.RunScheduledActivations(context.Background())
	require.NoError(t, err)
	assert.Equal(t, 0, activated, "historical phase with end_time should not be re-activated")

	// Common room phase should still be active
	active, err := queries.GetActivePhase(context.Background(), game.ID)
	require.NoError(t, err)
	assert.Equal(t, currentPhase.ID, active.ID, "current phase should remain active")
}

func TestPhaseService_RunScheduledActivations_SkipsAlreadyActivePhase(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)
	phaseService := &PhaseService{DB: testDB.Pool, Logger: app.ObsLogger}
	queries := models.New(testDB.Pool)

	gm := testDB.CreateTestUser(t, "sched_gm8", "sched_gm8@example.com")
	game := testDB.CreateTestGameWithState(t, int32(gm.ID), "Active Phase Game", "in_progress")

	// Create a phase with a past start_time and immediately activate it
	past := time.Now().Add(-5 * time.Minute)
	phase, err := queries.CreateGamePhase(context.Background(), models.CreateGamePhaseParams{
		GameID:      game.ID,
		PhaseType:   "common_room",
		PhaseNumber: 1,
		Title:       "Already Active Phase",
		StartTime:   pgtype.Timestamptz{Time: past, Valid: true},
	})
	require.NoError(t, err)
	_, err = queries.ActivatePhase(context.Background(), phase.ID)
	require.NoError(t, err)

	// Scheduler should not blow up or double-activate this phase
	_, activated, err := phaseService.RunScheduledActivations(context.Background())
	require.NoError(t, err)
	assert.Equal(t, 0, activated, "already-active phase should not be counted as a new activation")

	// Phase should still be active and be the same phase
	active, err := queries.GetActivePhase(context.Background(), game.ID)
	require.NoError(t, err)
	assert.Equal(t, phase.ID, active.ID)
}

// Regression test: phases created without an explicit auto-activate time must never
// be activated by the scheduler — even though they were previously assigned start_time=NOW()
// as a default at creation, causing the scheduler to pick them up instead of the intended phase.
func TestPhaseService_RunScheduledActivations_OnlyActivatesScheduledPhase(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)
	phaseService := &PhaseService{DB: testDB.Pool, Logger: app.ObsLogger}
	queries := models.New(testDB.Pool)

	gm := testDB.CreateTestUser(t, "sched_regression_gm", "sched_regression_gm@example.com")
	game := testDB.CreateTestGameWithState(t, int32(gm.ID), "Regression Game", "in_progress")

	// Phase A: explicitly scheduled to auto-activate (start_time set to a future time that has now passed)
	scheduledStart := time.Now().Add(-1 * time.Minute)
	phaseA, err := queries.CreateGamePhase(context.Background(), models.CreateGamePhaseParams{
		GameID:      game.ID,
		PhaseType:   "action",
		PhaseNumber: 1,
		Title:       "Phase A - Scheduled",
		StartTime:   pgtype.Timestamptz{Time: scheduledStart, Valid: true},
	})
	require.NoError(t, err)

	// Phase B: created with no auto-activate time (start_time = NULL, as the fixed code produces)
	phaseB, err := queries.CreateGamePhase(context.Background(), models.CreateGamePhaseParams{
		GameID:      game.ID,
		PhaseType:   "common_room",
		PhaseNumber: 2,
		Title:       "Phase B - No Schedule",
		// StartTime intentionally omitted — NULL
	})
	require.NoError(t, err)
	assert.False(t, phaseB.StartTime.Valid, "phase B should have NULL start_time")

	_, activated, err := phaseService.RunScheduledActivations(context.Background())
	require.NoError(t, err)
	assert.Equal(t, 1, activated)

	active, err := queries.GetActivePhase(context.Background(), game.ID)
	require.NoError(t, err)
	assert.Equal(t, phaseA.ID, active.ID, "phase A (scheduled) should be active")
	assert.NotEqual(t, phaseB.ID, active.ID, "phase B (no schedule) must not be activated by the scheduler")
}

func TestPhaseService_RunScheduledActivations_ActivatesAcrossMultipleGames(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)
	phaseService := &PhaseService{DB: testDB.Pool, Logger: app.ObsLogger}
	queries := models.New(testDB.Pool)

	past := time.Now().Add(-3 * time.Minute)

	// Set up two independent games, each with a past-due scheduled phase
	gm1 := testDB.CreateTestUser(t, "sched_gm9", "sched_gm9@example.com")
	game1 := testDB.CreateTestGameWithState(t, int32(gm1.ID), "Multi-Game Test 1", "in_progress")

	gm2 := testDB.CreateTestUser(t, "sched_gm10", "sched_gm10@example.com")
	game2 := testDB.CreateTestGameWithState(t, int32(gm2.ID), "Multi-Game Test 2", "in_progress")

	phase1, err := queries.CreateGamePhase(context.Background(), models.CreateGamePhaseParams{
		GameID:      game1.ID,
		PhaseType:   "common_room",
		PhaseNumber: 1,
		Title:       "Phase for Game 1",
		StartTime:   pgtype.Timestamptz{Time: past, Valid: true},
	})
	require.NoError(t, err)

	phase2, err := queries.CreateGamePhase(context.Background(), models.CreateGamePhaseParams{
		GameID:      game2.ID,
		PhaseType:   "action",
		PhaseNumber: 1,
		Title:       "Phase for Game 2",
		StartTime:   pgtype.Timestamptz{Time: past, Valid: true},
	})
	require.NoError(t, err)

	_, activated, err := phaseService.RunScheduledActivations(context.Background())
	require.NoError(t, err)
	assert.GreaterOrEqual(t, activated, 2, "should activate one phase per game")

	active1, err := queries.GetActivePhase(context.Background(), game1.ID)
	require.NoError(t, err)
	assert.Equal(t, phase1.ID, active1.ID)

	active2, err := queries.GetActivePhase(context.Background(), game2.ID)
	require.NoError(t, err)
	assert.Equal(t, phase2.ID, active2.ID)
}
