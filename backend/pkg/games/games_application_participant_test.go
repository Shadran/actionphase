package games

import (
	"actionphase/pkg/core"
	db "actionphase/pkg/db/services"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestGameAPI_ApplicationManagement tests application management endpoints
// Covers: GetMyGameApplication, WithdrawGameApplication
func TestGameAPI_ApplicationManagement(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	testDB.CleanupTables(t, "game_applications", "game_participants", "games", "sessions", "users")
	defer testDB.CleanupTables(t, "game_applications", "game_participants", "games", "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupGameTestRouter(app, testDB)
	fixtures := testDB.SetupFixtures(t)

	// Create GM and player tokens
	gmToken, err := core.CreateTestJWTTokenForUser(app, fixtures.TestUser)
	core.AssertNoError(t, err, "GM token creation should succeed")

	userService := &db.UserService{DB: testDB.Pool, Logger: app.ObsLogger}
	playerUser, err := userService.CreateUser(&core.User{
		Username: "appmanagement_player",
		Password: "testpass123",
		Email:    "appmanagement@example.com",
	})
	core.AssertNoError(t, err, "Player user creation should succeed")

	playerToken, err := core.CreateTestJWTTokenForUser(app, playerUser)
	core.AssertNoError(t, err, "Player token creation should succeed")

	// Create a recruiting game
	gameService := &db.GameService{DB: testDB.Pool, Logger: app.ObsLogger}
	game, err := gameService.CreateGame(context.Background(), core.CreateGameRequest{
		Title:       "Test Game for App Management",
		Description: "Testing application endpoints",
		GMUserID:    int32(fixtures.TestUser.ID),
		IsPublic:    true,
	})
	core.AssertNoError(t, err, "Game creation should succeed")

	_, err = gameService.UpdateGameState(context.Background(), game.ID, "recruitment")
	core.AssertNoError(t, err, "Game state update should succeed")

	// Create an application for testing
	appService := &db.GameApplicationService{DB: testDB.Pool}
	application, err := appService.CreateGameApplication(context.Background(), core.CreateGameApplicationRequest{
		GameID:  game.ID,
		UserID:  int32(playerUser.ID),
		Role:    "player",
		Message: "I want to join!",
	})
	core.AssertNoError(t, err, "Application creation should succeed")

	t.Run("get_my_application_success", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/games/"+strconv.Itoa(int(game.ID))+"/application", nil)
		req.Header.Set("Authorization", "Bearer "+playerToken)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 200, w.Code, "Should return 200 OK")

		var response GameApplicationResponse
		err := json.Unmarshal(w.Body.Bytes(), &response)
		core.AssertNoError(t, err, "Response should be valid JSON")

		core.AssertEqual(t, application.ID, response.ID, "Application ID should match")
		core.AssertEqual(t, game.ID, response.GameID, "Game ID should match")
		core.AssertEqual(t, int32(playerUser.ID), response.UserID, "User ID should match")
		core.AssertEqual(t, "pending", response.Status, "Status should be pending")
	})

	t.Run("get_my_application_no_application", func(t *testing.T) {
		// GM has no application - should return 200 with null body
		req := httptest.NewRequest("GET", "/api/v1/games/"+strconv.Itoa(int(game.ID))+"/application", nil)
		req.Header.Set("Authorization", "Bearer "+gmToken)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 200, w.Code, "Should return 200 OK with null body")
		core.AssertEqual(t, "null\n", w.Body.String(), "Body should be null")
	})

	t.Run("get_my_application_unauthorized", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/games/"+strconv.Itoa(int(game.ID))+"/application", nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 401, w.Code, "Should return 401 Unauthorized")
	})

	t.Run("withdraw_application_success", func(t *testing.T) {
		req := httptest.NewRequest("DELETE", "/api/v1/games/"+strconv.Itoa(int(game.ID))+"/application", nil)
		req.Header.Set("Authorization", "Bearer "+playerToken)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 204, w.Code, "Should return 204 No Content")

		// Verify application is deleted
		getReq := httptest.NewRequest("GET", "/api/v1/games/"+strconv.Itoa(int(game.ID))+"/application", nil)
		getReq.Header.Set("Authorization", "Bearer "+playerToken)
		getW := httptest.NewRecorder()
		router.ServeHTTP(getW, getReq)

		core.AssertEqual(t, 200, getW.Code, "Should return 200 with null after withdrawal")
			core.AssertEqual(t, "null\n", getW.Body.String(), "Body should be null after withdrawal")
	})

	t.Run("withdraw_application_no_application", func(t *testing.T) {
		// Already withdrawn in previous test
		req := httptest.NewRequest("DELETE", "/api/v1/games/"+strconv.Itoa(int(game.ID))+"/application", nil)
		req.Header.Set("Authorization", "Bearer "+playerToken)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 404, w.Code, "Should return 404 Not Found")
	})

	t.Run("withdraw_application_already_approved", func(t *testing.T) {
		// Create new application and approve it via API
		app2, err := appService.CreateGameApplication(context.Background(), core.CreateGameApplicationRequest{
			GameID:  game.ID,
			UserID:  int32(playerUser.ID),
			Role:    "player",
			Message: "New application",
		})
		core.AssertNoError(t, err, "Application creation should succeed")

		// Approve via HTTP endpoint
		approvePayload := map[string]string{"action": "approve"}
		approveBytes, _ := json.Marshal(approvePayload)
		approveReq := httptest.NewRequest("PUT", "/api/v1/games/"+strconv.Itoa(int(game.ID))+"/applications/"+strconv.Itoa(int(app2.ID))+"/review", bytes.NewBuffer(approveBytes))
		approveReq.Header.Set("Content-Type", "application/json")
		approveReq.Header.Set("Authorization", "Bearer "+gmToken)
		approveW := httptest.NewRecorder()
		router.ServeHTTP(approveW, approveReq)
		core.AssertEqual(t, 200, approveW.Code, "Application approval should succeed")

		req := httptest.NewRequest("DELETE", "/api/v1/games/"+strconv.Itoa(int(game.ID))+"/application", nil)
		req.Header.Set("Authorization", "Bearer "+playerToken)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 400, w.Code, "Should return 400 Bad Request")
	})

	t.Run("withdraw_application_unauthorized", func(t *testing.T) {
		req := httptest.NewRequest("DELETE", "/api/v1/games/"+strconv.Itoa(int(game.ID))+"/application", nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 401, w.Code, "Should return 401 Unauthorized")
	})
}

// TestGameAPI_ParticipantManagementAdvanced tests GM participant management
// Covers: AddPlayerDirectly, RemovePlayer
func TestGameAPI_ParticipantManagementAdvanced(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	testDB.CleanupTables(t, "game_participants", "games", "sessions", "users")
	defer testDB.CleanupTables(t, "game_participants", "games", "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupGameTestRouter(app, testDB)
	fixtures := testDB.SetupFixtures(t)

	// Create GM token
	gmToken, err := core.CreateTestJWTTokenForUser(app, fixtures.TestUser)
	core.AssertNoError(t, err, "GM token creation should succeed")

	// Create player users
	userService := &db.UserService{DB: testDB.Pool, Logger: app.ObsLogger}
	player1, err := userService.CreateUser(&core.User{
		Username: "participant1",
		Password: "testpass123",
		Email:    "participant1@example.com",
	})
	core.AssertNoError(t, err, "Player 1 creation should succeed")

	player1Token, err := core.CreateTestJWTTokenForUser(app, player1)
	core.AssertNoError(t, err, "Player 1 token creation should succeed")

	player2, err := userService.CreateUser(&core.User{
		Username: "participant2",
		Password: "testpass123",
		Email:    "participant2@example.com",
	})
	core.AssertNoError(t, err, "Player 2 creation should succeed")

	_, err = core.CreateTestJWTTokenForUser(app, player2)
	core.AssertNoError(t, err, "Player 2 token creation should succeed")

	// Create a game
	gameService := &db.GameService{DB: testDB.Pool, Logger: app.ObsLogger}
	game, err := gameService.CreateGame(context.Background(), core.CreateGameRequest{
		Title:       "Test Game for Participant Mgmt",
		Description: "Testing participant endpoints",
		GMUserID:    int32(fixtures.TestUser.ID),
		IsPublic:    true,
	})
	core.AssertNoError(t, err, "Game creation should succeed")

	t.Run("add_player_directly_as_gm", func(t *testing.T) {
		payload := map[string]int32{
			"user_id": int32(player1.ID),
		}
		payloadBytes, _ := json.Marshal(payload)

		req := httptest.NewRequest("POST", "/api/v1/games/"+strconv.Itoa(int(game.ID))+"/participants", bytes.NewBuffer(payloadBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+gmToken)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 201, w.Code, "Should return 201 Created")

		// Verify player was added
		getReq := httptest.NewRequest("GET", "/api/v1/games/"+strconv.Itoa(int(game.ID))+"/participants", nil)
		getReq.Header.Set("Authorization", "Bearer "+gmToken)
		getW := httptest.NewRecorder()
		router.ServeHTTP(getW, getReq)

		var participants []map[string]interface{}
		json.Unmarshal(getW.Body.Bytes(), &participants)
		core.AssertEqual(t, 1, len(participants), "Should have one participant")
		core.AssertEqual(t, player1.Username, participants[0]["username"].(string), "Username should match")
	})

	t.Run("add_player_directly_as_non_gm", func(t *testing.T) {
		payload := map[string]int32{
			"user_id": int32(player2.ID),
		}
		payloadBytes, _ := json.Marshal(payload)

		req := httptest.NewRequest("POST", "/api/v1/games/"+strconv.Itoa(int(game.ID))+"/participants", bytes.NewBuffer(payloadBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+player1Token)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 403, w.Code, "Should return 403 Forbidden")
	})

	t.Run("add_player_directly_missing_user_id", func(t *testing.T) {
		payload := map[string]string{}
		payloadBytes, _ := json.Marshal(payload)

		req := httptest.NewRequest("POST", "/api/v1/games/"+strconv.Itoa(int(game.ID))+"/participants", bytes.NewBuffer(payloadBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+gmToken)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 400, w.Code, "Should return 400 Bad Request")
	})

	t.Run("add_player_directly_unauthorized", func(t *testing.T) {
		payload := map[string]int32{
			"user_id": int32(player2.ID),
		}
		payloadBytes, _ := json.Marshal(payload)

		req := httptest.NewRequest("POST", "/api/v1/games/"+strconv.Itoa(int(game.ID))+"/participants", bytes.NewBuffer(payloadBytes))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 401, w.Code, "Should return 401 Unauthorized")
	})

	t.Run("remove_player_as_gm", func(t *testing.T) {
		req := httptest.NewRequest("DELETE", "/api/v1/games/"+strconv.Itoa(int(game.ID))+"/participants/"+strconv.Itoa(int(player1.ID)), nil)
		req.Header.Set("Authorization", "Bearer "+gmToken)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 204, w.Code, "Should return 204 No Content")

		// Verify player was removed
		getReq := httptest.NewRequest("GET", "/api/v1/games/"+strconv.Itoa(int(game.ID))+"/participants", nil)
		getReq.Header.Set("Authorization", "Bearer "+gmToken)
		getW := httptest.NewRecorder()
		router.ServeHTTP(getW, getReq)

		var participants []map[string]interface{}
		json.Unmarshal(getW.Body.Bytes(), &participants)
		core.AssertEqual(t, 0, len(participants), "Should have no participants")
	})

	t.Run("remove_player_as_non_gm", func(t *testing.T) {
		// Add player2 first
		_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(player2.ID), "player")
		core.AssertNoError(t, err, "Failed to add player2")

		req := httptest.NewRequest("DELETE", "/api/v1/games/"+strconv.Itoa(int(game.ID))+"/participants/"+strconv.Itoa(int(player2.ID)), nil)
		req.Header.Set("Authorization", "Bearer "+player1Token)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 403, w.Code, "Should return 403 Forbidden")
	})

	t.Run("remove_player_gm_cannot_remove_self", func(t *testing.T) {
		req := httptest.NewRequest("DELETE", "/api/v1/games/"+strconv.Itoa(int(game.ID))+"/participants/"+strconv.Itoa(int(fixtures.TestUser.ID)), nil)
		req.Header.Set("Authorization", "Bearer "+gmToken)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 409, w.Code, "Should return 409 Conflict")
	})

	t.Run("remove_player_unauthorized", func(t *testing.T) {
		req := httptest.NewRequest("DELETE", "/api/v1/games/"+strconv.Itoa(int(game.ID))+"/participants/"+strconv.Itoa(int(player2.ID)), nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 401, w.Code, "Should return 401 Unauthorized")
	})
}

// TestGameAPI_RemovePlayer_DeactivatesCharacters verifies that removing a player
// also deactivates their characters — the transactional side effect of RemovePlayer.
func TestGameAPI_RemovePlayer_DeactivatesCharacters(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "characters", "game_participants", "games", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupGameTestRouter(app, testDB)

	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player := testDB.CreateTestUser(t, "player", "player@example.com")

	gmToken, err := core.CreateTestJWTTokenForUser(app, gm)
	require.NoError(t, err)

	gameService := &db.GameService{DB: testDB.Pool, Logger: app.ObsLogger}
	game, err := gameService.CreateGame(context.Background(), core.CreateGameRequest{
		Title:       "Removal Test Game",
		Description: "Test game for player removal",
		GMUserID:    int32(gm.ID),
		IsPublic:    true,
	})
	require.NoError(t, err)

	_, err = gameService.AddGameParticipant(context.Background(), game.ID, int32(player.ID), "player")
	require.NoError(t, err)

	// Create a character for the player (new characters start as "pending")
	characterService := &db.CharacterService{DB: testDB.Pool, Logger: app.ObsLogger}
	playerID := int32(player.ID)
	char, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        &playerID,
		Name:          "Player's Character",
		CharacterType: "player_character",
	})
	require.NoError(t, err)
	assert.NotEqual(t, "inactive", char.Status.String, "character should not start as inactive")

	// GM removes the player
	req := httptest.NewRequest("DELETE", fmt.Sprintf("/api/v1/games/%d/participants/%d", game.ID, player.ID), nil)
	req.Header.Set("Authorization", "Bearer "+gmToken)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusNoContent, rec.Code)

	// Verify the character was deactivated as part of the transaction
	updated, err := characterService.GetCharacter(context.Background(), char.ID)
	require.NoError(t, err)
	assert.False(t, updated.IsActive, "character should be deactivated (is_active=false) when player is removed")
}

// TestGameAPI_ReviewGameApplication_ApprovesAndRejects verifies both branches of
// application review — status field in response and DB state for each outcome.
func TestGameAPI_ReviewGameApplication_ApprovesAndRejects(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "game_applications", "game_participants", "games", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupGameTestRouter(app, testDB)

	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player1 := testDB.CreateTestUser(t, "player1", "player1@example.com")
	player2 := testDB.CreateTestUser(t, "player2", "player2@example.com")
	player3 := testDB.CreateTestUser(t, "player3", "player3@example.com")

	gmToken, err := core.CreateTestJWTTokenForUser(app, gm)
	require.NoError(t, err)
	playerToken, err := core.CreateTestJWTTokenForUser(app, player1)
	require.NoError(t, err)

	gameService := &db.GameService{DB: testDB.Pool, Logger: app.ObsLogger}
	game, err := gameService.CreateGame(context.Background(), core.CreateGameRequest{
		Title:       "Application Review Game",
		Description: "Test game for application review",
		GMUserID:    int32(gm.ID),
		IsPublic:    true,
	})
	require.NoError(t, err)

	// Game must be in recruitment state to accept applications
	_, err = gameService.UpdateGameState(context.Background(), game.ID, "recruitment")
	require.NoError(t, err)

	appService := &db.GameApplicationService{DB: testDB.Pool}

	t.Run("GM approves application — status becomes approved in response and DB", func(t *testing.T) {
		application, err := appService.CreateGameApplication(context.Background(), core.CreateGameApplicationRequest{
			GameID:  game.ID,
			UserID:  int32(player1.ID),
			Role:    "player",
			Message: "I want to join",
		})
		require.NoError(t, err)

		body := map[string]string{"action": "approve"}
		bodyJSON, _ := json.Marshal(body)
		req := httptest.NewRequest("PUT", fmt.Sprintf("/api/v1/games/%d/applications/%d/review", game.ID, application.ID), bytes.NewBuffer(bodyJSON))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+gmToken)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		var response map[string]interface{}
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &response))
		assert.Equal(t, "approved", response["status"])

		// Verify DB state
		updated, err := appService.GetGameApplication(context.Background(), application.ID)
		require.NoError(t, err)
		assert.Equal(t, "approved", updated.Status.String)
	})

	t.Run("GM rejects application — status becomes rejected in response and DB", func(t *testing.T) {
		application, err := appService.CreateGameApplication(context.Background(), core.CreateGameApplicationRequest{
			GameID:  game.ID,
			UserID:  int32(player2.ID),
			Role:    "player",
			Message: "Please let me in",
		})
		require.NoError(t, err)

		body := map[string]string{"action": "reject"}
		bodyJSON, _ := json.Marshal(body)
		req := httptest.NewRequest("PUT", fmt.Sprintf("/api/v1/games/%d/applications/%d/review", game.ID, application.ID), bytes.NewBuffer(bodyJSON))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+gmToken)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		var response map[string]interface{}
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &response))
		assert.Equal(t, "rejected", response["status"])

		// Verify DB state
		updated, err := appService.GetGameApplication(context.Background(), application.ID)
		require.NoError(t, err)
		assert.Equal(t, "rejected", updated.Status.String)
	})

	t.Run("non-GM player cannot review applications", func(t *testing.T) {
		application, err := appService.CreateGameApplication(context.Background(), core.CreateGameApplicationRequest{
			GameID:  game.ID,
			UserID:  int32(player3.ID),
			Role:    "player",
			Message: "Another try",
		})
		require.NoError(t, err)

		body := map[string]string{"action": "approve"}
		bodyJSON, _ := json.Marshal(body)
		req := httptest.NewRequest("PUT", fmt.Sprintf("/api/v1/games/%d/applications/%d/review", game.ID, application.ID), bytes.NewBuffer(bodyJSON))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+playerToken)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusForbidden, rec.Code)
	})
}
