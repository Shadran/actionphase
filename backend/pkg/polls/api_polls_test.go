package polls

import (
	"actionphase/pkg/core"
	db "actionphase/pkg/db/models"
	dbservices "actionphase/pkg/db/services"
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/jwtauth/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// setupPollTestRouter creates a test router with auth middleware
func setupPollTestRouter(app *core.App, testDB *core.TestDatabase) *chi.Mux {
	tokenAuth := jwtauth.New("HS256", []byte(app.Config.JWT.Secret), nil)
	userService := &dbservices.UserService{DB: testDB.Pool, Logger: app.ObsLogger}

	router := chi.NewRouter()

	router.Route("/api/v1", func(r chi.Router) {
		r.Route("/polls/{pollId}/results", func(r chi.Router) {
			r.Use(jwtauth.Verifier(tokenAuth))
			r.Use(jwtauth.Authenticator(tokenAuth))
			r.Use(core.RequireAuthenticationMiddleware(userService))

			handler := &Handler{App: app}
			r.Get("/", handler.GetPollResults)
		})
	})

	return router
}

// TestPollResultsAccess tests the access control for poll results
func TestPollResultsAccess(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "poll_votes", "poll_options", "common_room_polls", "game_audience", "game_participants", "games", "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupPollTestRouter(app, testDB)
	fixtures := testDB.SetupFixtures(t)

	// Create test users
	gmUser := fixtures.TestUser // GM
	playerUser := testDB.CreateTestUser(t, "testplayer", "player@example.com")
	audienceUser := testDB.CreateTestUser(t, "testaudience", "audience@example.com")

	gameService := &dbservices.GameService{DB: testDB.Pool, Logger: app.ObsLogger}
	pollService := &dbservices.PollService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Create a game
	game := testDB.CreateTestGame(t, int32(gmUser.ID), "Test Game")

	// Add player as participant
	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(playerUser.ID), "player")
	core.AssertNoError(t, err, "Adding player to game should succeed")

	// Add audience member directly via SQL
	queries := db.New(testDB.Pool)
	_, err = queries.CreateAudienceApplication(context.Background(), db.CreateAudienceApplicationParams{
		GameID: game.ID,
		UserID: int32(audienceUser.ID),
		Status: pgtype.Text{String: "active", Valid: true},
	})
	core.AssertNoError(t, err, "Adding audience member to game should succeed")

	// Create an active poll (expires in future)
	activePollDeadline := time.Now().Add(24 * time.Hour)
	activePoll, err := pollService.CreatePollWithOptions(context.Background(), core.CreatePollRequest{
		GameID:               game.ID,
		PhaseID:              nil,
		CreatedByUserID:      int32(gmUser.ID),
		CreatedByCharacterID: nil,
		Question:             "Active Poll Question",
		Description:          core.StringPtr("Active poll for testing"),
		Deadline:             activePollDeadline,
		ShowIndividualVotes:  false,
		AllowOtherOption:     false,
		Options: []core.PollOptionInput{
			{Text: "Option A", DisplayOrder: 1},
			{Text: "Option B", DisplayOrder: 2},
		},
	})
	core.AssertNoError(t, err, "Creating active poll should succeed")

	// Create an expired poll (deadline in past)
	expiredPollDeadline := time.Now().Add(-24 * time.Hour)
	expiredPoll, err := pollService.CreatePollWithOptions(context.Background(), core.CreatePollRequest{
		GameID:               game.ID,
		PhaseID:              nil,
		CreatedByUserID:      int32(gmUser.ID),
		CreatedByCharacterID: nil,
		Question:             "Expired Poll Question",
		Description:          core.StringPtr("Expired poll for testing"),
		Deadline:             expiredPollDeadline,
		ShowIndividualVotes:  false,
		AllowOtherOption:     false,
		Options: []core.PollOptionInput{
			{Text: "Option A", DisplayOrder: 1},
			{Text: "Option B", DisplayOrder: 2},
		},
	})
	core.AssertNoError(t, err, "Creating expired poll should succeed")

	// Create tokens
	gmToken, err := core.CreateTestJWTTokenForUser(app, gmUser)
	core.AssertNoError(t, err, "GM token creation should succeed")

	playerToken, err := core.CreateTestJWTTokenForUser(app, playerUser)
	core.AssertNoError(t, err, "Player token creation should succeed")

	audienceToken, err := core.CreateTestJWTTokenForUser(app, audienceUser)
	core.AssertNoError(t, err, "Audience token creation should succeed")

	testCases := []struct {
		name           string
		pollID         int32
		token          string
		expectedStatus int
		description    string
	}{
		{
			name:           "gm_can_view_active_poll_results",
			pollID:         activePoll.Poll.ID,
			token:          gmToken,
			expectedStatus: http.StatusOK,
			description:    "GM should be able to view results of active polls",
		},
		{
			name:           "gm_can_view_expired_poll_results",
			pollID:         expiredPoll.Poll.ID,
			token:          gmToken,
			expectedStatus: http.StatusOK,
			description:    "GM should be able to view results of expired polls",
		},
		{
			name:           "audience_can_view_active_poll_results",
			pollID:         activePoll.Poll.ID,
			token:          audienceToken,
			expectedStatus: http.StatusOK,
			description:    "Audience members should be able to view results of active polls",
		},
		{
			name:           "audience_can_view_expired_poll_results",
			pollID:         expiredPoll.Poll.ID,
			token:          audienceToken,
			expectedStatus: http.StatusOK,
			description:    "Audience members should be able to view results of expired polls",
		},
		{
			name:           "player_cannot_view_active_poll_results",
			pollID:         activePoll.Poll.ID,
			token:          playerToken,
			expectedStatus: http.StatusForbidden,
			description:    "Players should not be able to view results of active polls",
		},
		{
			name:           "player_can_view_expired_poll_results",
			pollID:         expiredPoll.Poll.ID,
			token:          playerToken,
			expectedStatus: http.StatusOK,
			description:    "Players should be able to view results of expired polls",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Create request
			req := httptest.NewRequest(http.MethodGet, "/api/v1/polls/"+strconv.Itoa(int(tc.pollID))+"/results", nil)
			req.Header.Set("Authorization", "Bearer "+tc.token)

			// Set URL parameters
			rctx := chi.NewRouteContext()
			rctx.URLParams.Add("pollId", strconv.Itoa(int(tc.pollID)))
			req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

			// Execute request
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			// Verify status code
			core.AssertEqual(t, tc.expectedStatus, w.Code, tc.description)
		})
	}
}

// TestPollResults_AnonymousGame tests that voter character names are visible in poll results
// (usernames are no longer included in poll voter results at all)
func TestPollResults_AnonymousGame(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "poll_votes", "poll_options", "common_room_polls", "game_participants", "characters", "games", "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupPollTestRouter(app, testDB)

	ctx := context.Background()
	queries := db.New(testDB.Pool)

	gmUser := testDB.CreateTestUser(t, "anon_poll_gm", "anon_poll_gm@example.com")
	voterPlayer := testDB.CreateTestUser(t, "anon_poll_voter", "anon_poll_voter@example.com")
	observerPlayer := testDB.CreateTestUser(t, "anon_poll_observer", "anon_poll_observer@example.com")

	anonGame, err := queries.CreateGame(ctx, db.CreateGameParams{
		Title:       "Anonymous Poll Test Game",
		Description: pgtype.Text{String: "Test", Valid: true},
		GmUserID:    int32(gmUser.ID),
		IsAnonymous: true,
	})
	core.AssertNoError(t, err, "Creating anonymous game should succeed")

	gameService := &dbservices.GameService{DB: testDB.Pool, Logger: app.ObsLogger}
	_, err = gameService.AddGameParticipant(ctx, anonGame.ID, int32(voterPlayer.ID), "player")
	core.AssertNoError(t, err, "Adding voter player should succeed")
	_, err = gameService.AddGameParticipant(ctx, anonGame.ID, int32(observerPlayer.ID), "player")
	core.AssertNoError(t, err, "Adding observer player should succeed")

	// Voter needs an approved character
	factory := core.NewTestDataFactory(testDB, t)
	factory.NewCharacter().ForGame(anonGame.ID).WithUserID(int32(voterPlayer.ID)).PlayerCharacter().Approved().WithName("Voter Hero").Create()

	pollService := &dbservices.PollService{DB: testDB.Pool, Logger: app.ObsLogger}
	expiredDeadline := time.Now().Add(-24 * time.Hour)
	poll, err := pollService.CreatePollWithOptions(ctx, core.CreatePollRequest{
		GameID:              anonGame.ID,
		CreatedByUserID:     int32(gmUser.ID),
		Question:            "Anonymous Poll",
		Deadline:            expiredDeadline,
		ShowIndividualVotes: true,
		AllowOtherOption:    false,
		Options: []core.PollOptionInput{
			{Text: "Option A", DisplayOrder: 1},
		},
	})
	core.AssertNoError(t, err, "Creating poll should succeed")

	// Cast a vote as voterPlayer (directly via service, bypassing API character check)
	optionID := poll.Options[0].ID
	_, err = pollService.SubmitVote(ctx, core.SubmitVoteRequest{
		PollID:           poll.Poll.ID,
		UserID:           int32(voterPlayer.ID),
		SelectedOptionID: &optionID,
	})
	core.AssertNoError(t, err, "Submitting vote should succeed")

	gmToken, err := core.CreateTestJWTTokenForUser(app, gmUser)
	core.AssertNoError(t, err, "GM token creation should succeed")
	observerToken, err := core.CreateTestJWTTokenForUser(app, observerPlayer)
	core.AssertNoError(t, err, "Observer token creation should succeed")

	makeRequest := func(token string) map[string]interface{} {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/polls/"+strconv.Itoa(int(poll.Poll.ID))+"/results", nil)
		req.Header.Set("Authorization", "Bearer "+token)
		rctx := chi.NewRouteContext()
		rctx.URLParams.Add("pollId", strconv.Itoa(int(poll.Poll.ID)))
		req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		var resp map[string]interface{}
		json.NewDecoder(w.Body).Decode(&resp)
		return resp
	}

	t.Run("GM sees voter character name in anonymous game", func(t *testing.T) {
		resp := makeRequest(gmToken)
		optionResults := resp["option_results"].([]interface{})
		voters := optionResults[0].(map[string]interface{})["voters"].([]interface{})
		voter := voters[0].(map[string]interface{})
		if voter["character_name"] == "" {
			t.Error("GM should see voter character name")
		}
		if _, hasUsername := voter["username"]; hasUsername {
			t.Error("Response should not include username field")
		}
	})

	t.Run("player also sees voter character name in anonymous game", func(t *testing.T) {
		resp := makeRequest(observerToken)
		optionResults := resp["option_results"].([]interface{})
		voters := optionResults[0].(map[string]interface{})["voters"].([]interface{})
		voter := voters[0].(map[string]interface{})
		if voter["character_name"] == "" {
			t.Error("Player should see voter character name (character names are not anonymized)")
		}
		if _, hasUsername := voter["username"]; hasUsername {
			t.Error("Response should not include username field")
		}
	})
}

// TestPollResultsAccess_NotInGame tests that users not in the game cannot view poll results
func TestPollResultsAccess_NotInGame(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "poll_votes", "poll_options", "common_room_polls", "game_participants", "games", "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupPollTestRouter(app, testDB)
	fixtures := testDB.SetupFixtures(t)

	// Create test users
	gmUser := fixtures.TestUser // GM
	outsiderUser := testDB.CreateTestUser(t, "outsider", "outsider@example.com")

	pollService := &dbservices.PollService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Create a game
	game := testDB.CreateTestGame(t, int32(gmUser.ID), "Test Game")

	// Create a poll
	pollDeadline := time.Now().Add(24 * time.Hour)
	poll, err := pollService.CreatePollWithOptions(context.Background(), core.CreatePollRequest{
		GameID:               game.ID,
		PhaseID:              nil,
		CreatedByUserID:      int32(gmUser.ID),
		CreatedByCharacterID: nil,
		Question:             "Test Poll Question",
		Description:          core.StringPtr("Test poll"),
		Deadline:             pollDeadline,
		ShowIndividualVotes:  false,
		AllowOtherOption:     false,
		Options: []core.PollOptionInput{
			{Text: "Option A", DisplayOrder: 1},
			{Text: "Option B", DisplayOrder: 2},
		},
	})
	core.AssertNoError(t, err, "Creating poll should succeed")

	// Create token for outsider
	outsiderToken, err := core.CreateTestJWTTokenForUser(app, outsiderUser)
	core.AssertNoError(t, err, "Outsider token creation should succeed")

	// Create request
	req := httptest.NewRequest(http.MethodGet, "/api/v1/polls/"+strconv.Itoa(int(poll.Poll.ID))+"/results", nil)
	req.Header.Set("Authorization", "Bearer "+outsiderToken)

	// Set URL parameters
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("pollId", strconv.Itoa(int(poll.Poll.ID)))
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

	// Execute request
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Verify forbidden status
	core.AssertEqual(t, http.StatusForbidden, w.Code, "Users not in the game should not be able to view poll results")
}

// setupPollVoteTestRouter creates a test router for poll voting
func setupPollVoteTestRouter(app *core.App, testDB *core.TestDatabase) *chi.Mux {
	tokenAuth := jwtauth.New("HS256", []byte(app.Config.JWT.Secret), nil)
	userService := &dbservices.UserService{DB: testDB.Pool, Logger: app.ObsLogger}

	router := chi.NewRouter()

	router.Route("/api/v1", func(r chi.Router) {
		r.Route("/polls/{pollId}/vote", func(r chi.Router) {
			r.Use(jwtauth.Verifier(tokenAuth))
			r.Use(jwtauth.Authenticator(tokenAuth))
			r.Use(core.RequireAuthenticationMiddleware(userService))

			handler := &Handler{App: app}
			r.Post("/", handler.SubmitVote)
		})
	})

	return router
}

// setupGetPollTestRouter creates a test router for getting poll details
func setupGetPollTestRouter(app *core.App, testDB *core.TestDatabase) *chi.Mux {
	tokenAuth := jwtauth.New("HS256", []byte(app.Config.JWT.Secret), nil)
	userService := &dbservices.UserService{DB: testDB.Pool, Logger: app.ObsLogger}

	router := chi.NewRouter()

	router.Route("/api/v1", func(r chi.Router) {
		r.Route("/polls/{pollId}", func(r chi.Router) {
			r.Use(jwtauth.Verifier(tokenAuth))
			r.Use(jwtauth.Authenticator(tokenAuth))
			r.Use(core.RequireAuthenticationMiddleware(userService))

			handler := &Handler{App: app}
			r.Get("/", handler.GetPoll)
		})
	})

	return router
}

// TestGetPoll_ShowsUserVoteOptionID verifies that GetPoll returns user_vote_option_id after voting.
// This is the regression test for the bug where "Your vote" showed "---" instead of the voted option.
func TestGetPoll_ShowsUserVoteOptionID(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "poll_votes", "poll_options", "common_room_polls", "game_participants", "games", "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupGetPollTestRouter(app, testDB)
	fixtures := testDB.SetupFixtures(t)

	gmUser := fixtures.TestUser
	playerUser := testDB.CreateTestUser(t, "testplayer", "player@example.com")

	gameService := &dbservices.GameService{DB: testDB.Pool, Logger: app.ObsLogger}
	pollService := &dbservices.PollService{DB: testDB.Pool, Logger: app.ObsLogger}

	game := testDB.CreateTestGame(t, int32(gmUser.ID), "Test Game")

	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(playerUser.ID), "player")
	core.AssertNoError(t, err, "Adding player to game should succeed")

	poll, err := pollService.CreatePollWithOptions(context.Background(), core.CreatePollRequest{
		GameID:              game.ID,
		CreatedByUserID:     int32(gmUser.ID),
		Question:            "Which option?",
		Deadline:            time.Now().Add(24 * time.Hour),
		ShowIndividualVotes: false,
		AllowOtherOption:    false,
		Options: []core.PollOptionInput{
			{Text: "Option A", DisplayOrder: 1},
			{Text: "Option B", DisplayOrder: 2},
		},
	})
	core.AssertNoError(t, err, "Creating poll should succeed")

	votedOptionID := poll.Options[0].ID
	_, err = pollService.SubmitVote(context.Background(), core.SubmitVoteRequest{
		PollID:           poll.Poll.ID,
		UserID:           int32(playerUser.ID),
		SelectedOptionID: &votedOptionID,
	})
	core.AssertNoError(t, err, "Voting should succeed")

	playerToken, err := core.CreateTestJWTTokenForUser(app, playerUser)
	core.AssertNoError(t, err, "Token creation should succeed")

	req := httptest.NewRequest(http.MethodGet, "/api/v1/polls/"+strconv.Itoa(int(poll.Poll.ID)), nil)
	req.Header.Set("Authorization", "Bearer "+playerToken)
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("pollId", strconv.Itoa(int(poll.Poll.ID)))
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	core.AssertEqual(t, http.StatusOK, w.Code, "GetPoll should return 200 OK")

	body := w.Body.String()
	core.AssertTrue(t, strings.Contains(body, "user_vote_option_id"), "Response should contain user_vote_option_id")
	core.AssertTrue(t, strings.Contains(body, strconv.Itoa(int(votedOptionID))), "Response should contain the voted option ID")
	// has_voted must be true
	core.AssertTrue(t, strings.Contains(body, `"has_voted":true`), "Response should show has_voted: true")
}

// TestPollVoting_GMAndCoGMBlocked tests that GMs and co-GMs cannot vote on polls
func TestPollVoting_GMAndCoGMBlocked(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "poll_votes", "poll_options", "common_room_polls", "co_gms", "game_participants", "characters", "games", "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupPollVoteTestRouter(app, testDB)
	fixtures := testDB.SetupFixtures(t)

	// Create test users
	gmUser := fixtures.TestUser // GM
	coGMUser := testDB.CreateTestUser(t, "cogm", "cogm@example.com")
	playerUser := testDB.CreateTestUser(t, "player", "player@example.com")

	gameService := &dbservices.GameService{DB: testDB.Pool, Logger: app.ObsLogger}
	pollService := &dbservices.PollService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Create a game
	game := testDB.CreateTestGame(t, int32(gmUser.ID), "Test Game")

	// Add co-GM as a participant with co_gm role
	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(coGMUser.ID), "co_gm")
	core.AssertNoError(t, err, "Adding co-GM should succeed")

	// Add player as participant
	_, err = gameService.AddGameParticipant(context.Background(), game.ID, int32(playerUser.ID), "player")
	core.AssertNoError(t, err, "Adding player to game should succeed")

	// Give player an approved character (required to vote)
	factory := core.NewTestDataFactory(testDB, t)
	factory.NewCharacter().ForGame(game.ID).WithUserID(int32(playerUser.ID)).PlayerCharacter().Approved().WithName("Player Hero").Create()

	// Create an active poll
	pollDeadline := time.Now().Add(24 * time.Hour)
	poll, err := pollService.CreatePollWithOptions(context.Background(), core.CreatePollRequest{
		GameID:               game.ID,
		PhaseID:              nil,
		CreatedByUserID:      int32(gmUser.ID),
		CreatedByCharacterID: nil,
		Question:             "Test Poll",
		Description:          core.StringPtr("Test poll for voting"),
		Deadline:             pollDeadline,
		ShowIndividualVotes:  false,
		AllowOtherOption:     false,
		Options: []core.PollOptionInput{
			{Text: "Option A", DisplayOrder: 1},
			{Text: "Option B", DisplayOrder: 2},
		},
	})
	core.AssertNoError(t, err, "Creating poll should succeed")

	// Create tokens
	gmToken, err := core.CreateTestJWTTokenForUser(app, gmUser)
	core.AssertNoError(t, err, "GM token creation should succeed")

	coGMToken, err := core.CreateTestJWTTokenForUser(app, coGMUser)
	core.AssertNoError(t, err, "Co-GM token creation should succeed")

	playerToken, err := core.CreateTestJWTTokenForUser(app, playerUser)
	core.AssertNoError(t, err, "Player token creation should succeed")

	// Test cases
	testCases := []struct {
		name           string
		token          string
		expectedStatus int
		description    string
	}{
		{
			name:           "gm_cannot_vote",
			token:          gmToken,
			expectedStatus: http.StatusForbidden,
			description:    "GMs should not be able to vote on polls",
		},
		{
			name:           "co_gm_cannot_vote",
			token:          coGMToken,
			expectedStatus: http.StatusForbidden,
			description:    "Co-GMs should not be able to vote on polls",
		},
		{
			name:           "player_can_vote",
			token:          playerToken,
			expectedStatus: http.StatusOK,
			description:    "Players should be able to vote on polls",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Create vote request body
			body := `{"selected_option_id":` + strconv.Itoa(int(poll.Options[0].ID)) + `}`

			// Create request
			req := httptest.NewRequest(http.MethodPost, "/api/v1/polls/"+strconv.Itoa(int(poll.Poll.ID))+"/vote",
				io.NopCloser(strings.NewReader(body)))
			req.Header.Set("Authorization", "Bearer "+tc.token)
			req.Header.Set("Content-Type", "application/json")

			// Set URL parameters
			rctx := chi.NewRouteContext()
			rctx.URLParams.Add("pollId", strconv.Itoa(int(poll.Poll.ID)))
			req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

			// Execute request
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			// Verify status code
			core.AssertEqual(t, tc.expectedStatus, w.Code, tc.description)
		})
	}
}

// TestSubmitVote_RequiresApprovedCharacter verifies that a player without an approved character cannot vote
func TestSubmitVote_RequiresApprovedCharacter(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "poll_votes", "poll_options", "common_room_polls", "game_participants", "characters", "games", "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupPollVoteTestRouter(app, testDB)
	fixtures := testDB.SetupFixtures(t)

	gmUser := fixtures.TestUser
	noCharPlayer := testDB.CreateTestUser(t, "nochar_player", "nochar@example.com")
	pendingCharPlayer := testDB.CreateTestUser(t, "pending_player", "pending@example.com")
	approvedCharPlayer := testDB.CreateTestUser(t, "approved_player", "approved@example.com")

	gameService := &dbservices.GameService{DB: testDB.Pool, Logger: app.ObsLogger}
	pollService := &dbservices.PollService{DB: testDB.Pool, Logger: app.ObsLogger}

	game := testDB.CreateTestGame(t, int32(gmUser.ID), "Test Game")

	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(noCharPlayer.ID), "player")
	core.AssertNoError(t, err, "Adding noCharPlayer should succeed")
	_, err = gameService.AddGameParticipant(context.Background(), game.ID, int32(pendingCharPlayer.ID), "player")
	core.AssertNoError(t, err, "Adding pendingCharPlayer should succeed")
	_, err = gameService.AddGameParticipant(context.Background(), game.ID, int32(approvedCharPlayer.ID), "player")
	core.AssertNoError(t, err, "Adding approvedCharPlayer should succeed")

	factory := core.NewTestDataFactory(testDB, t)
	factory.NewCharacter().ForGame(game.ID).WithUserID(int32(pendingCharPlayer.ID)).PlayerCharacter().Pending().WithName("Pending Hero").Create()
	factory.NewCharacter().ForGame(game.ID).WithUserID(int32(approvedCharPlayer.ID)).PlayerCharacter().Approved().WithName("Approved Hero").Create()

	poll, err := pollService.CreatePollWithOptions(context.Background(), core.CreatePollRequest{
		GameID:              game.ID,
		CreatedByUserID:     int32(gmUser.ID),
		Question:            "Vote Test",
		Deadline:            time.Now().Add(24 * time.Hour),
		ShowIndividualVotes: false,
		AllowOtherOption:    false,
		Options: []core.PollOptionInput{
			{Text: "Option A", DisplayOrder: 1},
			{Text: "Option B", DisplayOrder: 2},
		},
	})
	core.AssertNoError(t, err, "Creating poll should succeed")

	noCharToken, err := core.CreateTestJWTTokenForUser(app, noCharPlayer)
	core.AssertNoError(t, err, "noCharPlayer token should succeed")
	pendingToken, err := core.CreateTestJWTTokenForUser(app, pendingCharPlayer)
	core.AssertNoError(t, err, "pendingCharPlayer token should succeed")
	approvedToken, err := core.CreateTestJWTTokenForUser(app, approvedCharPlayer)
	core.AssertNoError(t, err, "approvedCharPlayer token should succeed")

	makeVoteRequest := func(token string) int {
		body := `{"selected_option_id":` + strconv.Itoa(int(poll.Options[0].ID)) + `}`
		req := httptest.NewRequest(http.MethodPost, "/api/v1/polls/"+strconv.Itoa(int(poll.Poll.ID))+"/vote",
			io.NopCloser(strings.NewReader(body)))
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("Content-Type", "application/json")
		rctx := chi.NewRouteContext()
		rctx.URLParams.Add("pollId", strconv.Itoa(int(poll.Poll.ID)))
		req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		return w.Code
	}

	t.Run("player_without_character_cannot_vote", func(t *testing.T) {
		core.AssertEqual(t, http.StatusForbidden, makeVoteRequest(noCharToken),
			"Player with no character should be blocked from voting")
	})

	t.Run("player_with_pending_character_cannot_vote", func(t *testing.T) {
		core.AssertEqual(t, http.StatusForbidden, makeVoteRequest(pendingToken),
			"Player with only a pending character should be blocked from voting")
	})

	t.Run("player_with_approved_character_can_vote", func(t *testing.T) {
		core.AssertEqual(t, http.StatusOK, makeVoteRequest(approvedToken),
			"Player with approved character should be able to vote")
	})
}

// setupListPollsByPhaseTestRouter creates a test router for listing polls by phase
func setupListPollsByPhaseTestRouter(app *core.App, testDB *core.TestDatabase) *chi.Mux {
	tokenAuth := jwtauth.New("HS256", []byte(app.Config.JWT.Secret), nil)
	userService := &dbservices.UserService{DB: testDB.Pool, Logger: app.ObsLogger}

	router := chi.NewRouter()

	router.Route("/api/v1", func(r chi.Router) {
		r.Route("/games/{gameId}/phases/{phaseId}/polls", func(r chi.Router) {
			r.Use(jwtauth.Verifier(tokenAuth))
			r.Use(jwtauth.Authenticator(tokenAuth))
			r.Use(core.RequireAuthenticationMiddleware(userService))

			handler := &Handler{App: app}
			r.Get("/", handler.ListPollsByPhase)
		})
	})

	return router
}

// TestListPollsByPhase tests the ListPollsByPhase handler
func TestListPollsByPhase(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "poll_votes", "poll_options", "common_room_polls", "game_phases", "game_participants", "games", "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupListPollsByPhaseTestRouter(app, testDB)
	fixtures := testDB.SetupFixtures(t)

	// Create test users
	gmUser := fixtures.TestUser // GM
	playerUser := testDB.CreateTestUser(t, "testplayer", "player@example.com")
	outsiderUser := testDB.CreateTestUser(t, "outsider", "outsider@example.com")

	gameService := &dbservices.GameService{DB: testDB.Pool, Logger: app.ObsLogger}
	pollService := &dbservices.PollService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Create a game
	game := testDB.CreateTestGame(t, int32(gmUser.ID), "Test Game")

	factory := core.NewTestDataFactory(testDB, t)
	// Add player as participant
	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(playerUser.ID), "player")
	core.AssertNoError(t, err, "Adding player to game should succeed")

	// Create game phases using TestDataFactory
	phase1 := factory.NewPhase().ForGame(game.ID).WithPhaseNumber(1).CommonRoom().WithTitle("Phase 1").Create()
	phase2 := factory.NewPhase().ForGame(game.ID).WithPhaseNumber(2).ActionPhase().WithTitle("Phase 2").Create()
	phase3 := factory.NewPhase().ForGame(game.ID).WithPhaseNumber(3).CommonRoom().WithTitle("Phase 3 (empty)").Create()

	// Create polls for phase 1
	pollDeadline := time.Now().Add(24 * time.Hour)
	poll1Phase1, err := pollService.CreatePollWithOptions(context.Background(), core.CreatePollRequest{
		GameID:               game.ID,
		PhaseID:              &phase1.ID,
		CreatedByUserID:      int32(gmUser.ID),
		CreatedByCharacterID: nil,
		Question:             "Phase 1 Poll 1",
		Description:          core.StringPtr("First poll in phase 1"),
		Deadline:             pollDeadline,
		ShowIndividualVotes:  false,
		AllowOtherOption:     false,
		Options: []core.PollOptionInput{
			{Text: "Option A", DisplayOrder: 1},
			{Text: "Option B", DisplayOrder: 2},
		},
	})
	core.AssertNoError(t, err, "Creating poll 1 for phase 1 should succeed")

	poll2Phase1, err := pollService.CreatePollWithOptions(context.Background(), core.CreatePollRequest{
		GameID:               game.ID,
		PhaseID:              &phase1.ID,
		CreatedByUserID:      int32(gmUser.ID),
		CreatedByCharacterID: nil,
		Question:             "Phase 1 Poll 2",
		Description:          core.StringPtr("Second poll in phase 1"),
		Deadline:             pollDeadline,
		ShowIndividualVotes:  false,
		AllowOtherOption:     false,
		Options: []core.PollOptionInput{
			{Text: "Option A", DisplayOrder: 1},
			{Text: "Option B", DisplayOrder: 2},
		},
	})
	core.AssertNoError(t, err, "Creating poll 2 for phase 1 should succeed")

	// Create poll for phase 2
	poll1Phase2, err := pollService.CreatePollWithOptions(context.Background(), core.CreatePollRequest{
		GameID:               game.ID,
		PhaseID:              &phase2.ID,
		CreatedByUserID:      int32(gmUser.ID),
		CreatedByCharacterID: nil,
		Question:             "Phase 2 Poll 1",
		Description:          core.StringPtr("Poll in phase 2"),
		Deadline:             pollDeadline,
		ShowIndividualVotes:  false,
		AllowOtherOption:     false,
		Options: []core.PollOptionInput{
			{Text: "Option A", DisplayOrder: 1},
			{Text: "Option B", DisplayOrder: 2},
		},
	})
	core.AssertNoError(t, err, "Creating poll for phase 2 should succeed")

	// Create tokens
	gmToken, err := core.CreateTestJWTTokenForUser(app, gmUser)
	core.AssertNoError(t, err, "GM token creation should succeed")

	playerToken, err := core.CreateTestJWTTokenForUser(app, playerUser)
	core.AssertNoError(t, err, "Player token creation should succeed")

	outsiderToken, err := core.CreateTestJWTTokenForUser(app, outsiderUser)
	core.AssertNoError(t, err, "Outsider token creation should succeed")

	testCases := []struct {
		name              string
		gameID            int32
		phaseID           int32
		token             string
		expectedStatus    int
		expectedPollCount int
		expectedPollIDs   []int32
		description       string
	}{
		{
			name:              "gm_can_list_polls_by_phase",
			gameID:            game.ID,
			phaseID:           phase1.ID,
			token:             gmToken,
			expectedStatus:    http.StatusOK,
			expectedPollCount: 2,
			expectedPollIDs:   []int32{poll1Phase1.Poll.ID, poll2Phase1.Poll.ID},
			description:       "GM should be able to list polls filtered by phase",
		},
		{
			name:              "player_can_list_polls_by_phase",
			gameID:            game.ID,
			phaseID:           phase1.ID,
			token:             playerToken,
			expectedStatus:    http.StatusOK,
			expectedPollCount: 2,
			expectedPollIDs:   []int32{poll1Phase1.Poll.ID, poll2Phase1.Poll.ID},
			description:       "Player should be able to list polls filtered by phase",
		},
		{
			name:              "polls_filtered_by_phase_id",
			gameID:            game.ID,
			phaseID:           phase2.ID,
			token:             gmToken,
			expectedStatus:    http.StatusOK,
			expectedPollCount: 1,
			expectedPollIDs:   []int32{poll1Phase2.Poll.ID},
			description:       "Should only return polls for the specific phase",
		},
		{
			name:              "empty_phase_returns_empty_array",
			gameID:            game.ID,
			phaseID:           phase3.ID,
			token:             gmToken,
			expectedStatus:    http.StatusOK,
			expectedPollCount: 0,
			expectedPollIDs:   []int32{},
			description:       "Phase with no polls should return empty array",
		},
		{
			name:              "outsider_cannot_access",
			gameID:            game.ID,
			phaseID:           phase1.ID,
			token:             outsiderToken,
			expectedStatus:    http.StatusForbidden,
			expectedPollCount: 0,
			expectedPollIDs:   nil,
			description:       "User not in game should get 403 Forbidden",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Create request
			url := "/api/v1/games/" + strconv.Itoa(int(tc.gameID)) + "/phases/" + strconv.Itoa(int(tc.phaseID)) + "/polls"
			req := httptest.NewRequest(http.MethodGet, url, nil)
			req.Header.Set("Authorization", "Bearer "+tc.token)

			// Set URL parameters
			rctx := chi.NewRouteContext()
			rctx.URLParams.Add("gameId", strconv.Itoa(int(tc.gameID)))
			rctx.URLParams.Add("phaseId", strconv.Itoa(int(tc.phaseID)))
			req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

			// Execute request
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			// Verify status code
			core.AssertEqual(t, tc.expectedStatus, w.Code, tc.description)

			// For successful requests, verify response content
			if tc.expectedStatus == http.StatusOK {
				body := w.Body.String()

				// Verify poll count
				if tc.expectedPollCount == 0 {
					core.AssertEqual(t, "[]", strings.TrimSpace(body), "Empty phase should return empty array")
				} else {
					// Verify each expected poll ID is in the response
					for _, pollID := range tc.expectedPollIDs {
						pollIDStr := `"id":` + strconv.Itoa(int(pollID))
						core.AssertTrue(t, strings.Contains(body, pollIDStr), "Response should contain poll ID: "+strconv.Itoa(int(pollID)))
					}

					// Verify phase_id is in the response
					phaseIDStr := `"phase_id":` + strconv.Itoa(int(tc.phaseID))
					core.AssertTrue(t, strings.Contains(body, phaseIDStr), "Response should contain correct phase_id: "+strconv.Itoa(int(tc.phaseID)))

					// Verify user_has_voted field is present
					core.AssertTrue(t, strings.Contains(body, "user_has_voted"), "Response should contain user_has_voted field")
				}
			}
		})
	}
}

// TestCreatePoll_ValidationErrors tests validation error scenarios for poll creation
func TestCreatePoll_ValidationErrors(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "common_room_polls", "games", "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	fixtures := testDB.SetupFixtures(t)

	// Create GM token
	gmToken, err := core.CreateTestJWTTokenForUser(app, fixtures.TestUser)
	core.AssertNoError(t, err, "GM token creation should succeed")

	// Future deadline for valid tests
	futureDeadline := time.Now().Add(24 * time.Hour)
	pastDeadline := time.Now().Add(-24 * time.Hour)

	testCases := []struct {
		name           string
		payload        CreatePollRequest
		expectedStatus int
		expectedError  string
		description    string
	}{
		{
			name: "empty_question",
			payload: CreatePollRequest{
				Question: "",
				Deadline: futureDeadline,
				Options: []PollOptionRequest{
					{Text: "Option 1", DisplayOrder: 1},
					{Text: "Option 2", DisplayOrder: 2},
				},
			},
			expectedStatus: 400,
			expectedError:  "question is required",
			description:    "Should reject empty question",
		},
		{
			name: "past_deadline",
			payload: CreatePollRequest{
				Question: "Valid Question",
				Deadline: pastDeadline,
				Options: []PollOptionRequest{
					{Text: "Option 1", DisplayOrder: 1},
					{Text: "Option 2", DisplayOrder: 2},
				},
			},
			expectedStatus: 400,
			expectedError:  "deadline must be in the future",
			description:    "Should reject past deadline",
		},
		{
			name: "no_options",
			payload: CreatePollRequest{
				Question: "Valid Question",
				Deadline: futureDeadline,
				Options:  []PollOptionRequest{},
			},
			expectedStatus: 400,
			expectedError:  "at least 2 options are required",
			description:    "Should reject poll with no options",
		},
		{
			name: "only_one_option",
			payload: CreatePollRequest{
				Question: "Valid Question",
				Deadline: futureDeadline,
				Options: []PollOptionRequest{
					{Text: "Only Option", DisplayOrder: 1},
				},
			},
			expectedStatus: 400,
			expectedError:  "at least 2 options are required",
			description:    "Should reject poll with only one option",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			payload, _ := json.Marshal(tc.payload)
			req := httptest.NewRequest("POST", "/api/v1/games/"+strconv.Itoa(int(fixtures.TestGame.ID))+"/polls", bytes.NewBuffer(payload))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", "Bearer "+gmToken)

			// Note: This test focuses on request binding validation
			// Actual route testing would require full router setup
			// For now, testing the Bind() method directly
			var testReq CreatePollRequest
			json.Unmarshal(payload, &testReq)
			err := testReq.Bind(req)

			if tc.expectedStatus == 400 {
				core.AssertNotEqual(t, nil, err, tc.description)
				if err != nil {
					core.AssertTrue(t, strings.Contains(err.Error(), tc.expectedError), "Error should contain: "+tc.expectedError)
				}
			} else {
				core.AssertEqual(t, nil, err, tc.description)
			}
		})
	}
}

// TestUpdatePoll_ValidationErrors tests validation error scenarios for poll updates
func TestUpdatePoll_ValidationErrors(t *testing.T) {
	futureDeadline := time.Now().Add(24 * time.Hour)
	pastDeadline := time.Now().Add(-24 * time.Hour)

	testCases := []struct {
		name           string
		payload        UpdatePollRequest
		expectedStatus int
		expectedError  string
		description    string
	}{
		{
			name: "empty_question",
			payload: UpdatePollRequest{
				Question: "",
				Deadline: futureDeadline,
			},
			expectedStatus: 400,
			expectedError:  "question is required",
			description:    "Should reject empty question",
		},
		{
			name: "past_deadline",
			payload: UpdatePollRequest{
				Question: "Valid Question",
				Deadline: pastDeadline,
			},
			expectedStatus: 400,
			expectedError:  "deadline must be in the future",
			description:    "Should reject past deadline",
		},
		{
			name: "valid_update",
			payload: UpdatePollRequest{
				Question: "Updated Question",
				Deadline: futureDeadline,
			},
			expectedStatus: 200,
			description:    "Should accept valid update",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest("PATCH", "/api/v1/polls/1", nil)
			err := tc.payload.Bind(req)

			if tc.expectedStatus == 400 {
				core.AssertNotEqual(t, nil, err, tc.description)
				if err != nil {
					core.AssertTrue(t, strings.Contains(err.Error(), tc.expectedError), "Error should contain: "+tc.expectedError)
				}
			} else {
				core.AssertEqual(t, nil, err, tc.description)
			}
		})
	}
}

// TestSubmitVote_ValidationErrors tests validation error scenarios for vote submission
func TestSubmitVote_ValidationErrors(t *testing.T) {
	optionID := int32(1)
	otherText := "Other response"

	testCases := []struct {
		name           string
		payload        SubmitVoteRequest
		expectedStatus int
		expectedError  string
		description    string
	}{
		{
			name: "no_selection",
			payload: SubmitVoteRequest{
				SelectedOptionID: nil,
				OtherResponse:    nil,
			},
			expectedStatus: 400,
			expectedError:  "either selected_option_id or other_response is required",
			description:    "Should reject vote with no selection",
		},
		{
			name: "valid_option_selection",
			payload: SubmitVoteRequest{
				SelectedOptionID: &optionID,
			},
			expectedStatus: 200,
			description:    "Should accept vote with option selected",
		},
		{
			name: "valid_other_response",
			payload: SubmitVoteRequest{
				OtherResponse: &otherText,
			},
			expectedStatus: 200,
			description:    "Should accept vote with other response",
		},
		{
			name: "both_option_and_other",
			payload: SubmitVoteRequest{
				SelectedOptionID: &optionID,
				OtherResponse:    &otherText,
			},
			expectedStatus: 200,
			description:    "Should accept vote with both (implementation may choose one)",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest("POST", "/api/v1/polls/1/vote", nil)
			err := tc.payload.Bind(req)

			if tc.expectedStatus == 400 {
				core.AssertNotEqual(t, nil, err, tc.description)
				if err != nil {
					core.AssertTrue(t, strings.Contains(err.Error(), tc.expectedError), "Error should contain: "+tc.expectedError)
				}
			} else {
				core.AssertEqual(t, nil, err, tc.description)
			}
		})
	}
}
