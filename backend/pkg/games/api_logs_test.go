package games

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"actionphase/pkg/core"
	db "actionphase/pkg/db/services"
	phasesvc "actionphase/pkg/db/services/phases"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestGameAPI_Logs tests GET /api/v1/games/{id}/logs
func TestGameAPI_Logs(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "game_participants", "games", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupGameTestRouter(app, testDB)

	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player := testDB.CreateTestUser(t, "player", "player@example.com")

	gmToken, err := core.CreateTestJWTTokenForUser(app, gm)
	require.NoError(t, err)
	playerToken, err := core.CreateTestJWTTokenForUser(app, player)
	require.NoError(t, err)

	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	gameService := &db.GameService{DB: testDB.Pool, Logger: app.ObsLogger}
	_, err = gameService.AddGameParticipant(context.Background(), game.ID, int32(player.ID), "player")
	require.NoError(t, err)

	_, err = gameService.UpdateGameState(context.Background(), game.ID, core.GameStateRecruitment)
	require.NoError(t, err)
	_, err = gameService.UpdateGameState(context.Background(), game.ID, core.GameStateCharacterCreation)
	require.NoError(t, err)
	_, err = gameService.UpdateGameState(context.Background(), game.ID, core.GameStateInProgress)
	require.NoError(t, err)

	phaseService := &phasesvc.PhaseService{DB: testDB.Pool, Logger: app.ObsLogger}
	_, err = phaseService.TransitionToNextPhase(context.Background(), game.ID, int32(gm.ID), core.TransitionPhaseRequest{
		PhaseType: "action",
		Title:     "Action Phase",
	})
	require.NoError(t, err)

	t.Run("GM gets running game logs", func(t *testing.T) {
		req := httptest.NewRequest("GET", fmt.Sprintf("/api/v1/games/%d/logs", game.ID), nil)
		req.Header.Set("Authorization", "Bearer "+gmToken)

		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		var response []map[string]interface{}
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &response))
		assert.Equal(t, len(response), 4)
	})

	t.Run("Player does not get running game logs", func(t *testing.T) {
		req := httptest.NewRequest("GET", fmt.Sprintf("/api/v1/games/%d/logs", game.ID), nil)
		req.Header.Set("Authorization", "Bearer "+playerToken)

		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusForbidden, rec.Code)
	})

	_, err = gameService.UpdateGameState(context.Background(), game.ID, core.GameStateCompleted)
	require.NoError(t, err)

	t.Run("Player gets completed game logs", func(t *testing.T) {
		req := httptest.NewRequest("GET", fmt.Sprintf("/api/v1/games/%d/logs", game.ID), nil)
		req.Header.Set("Authorization", "Bearer "+playerToken)

		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		var response []map[string]interface{}
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &response))
		assert.Equal(t, len(response), 5)
	})
}
