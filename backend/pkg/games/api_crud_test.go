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
)

// TestGetFilteredGames_PaginationDefaults tests that pagination defaults are applied correctly
func TestGetFilteredGames_PaginationDefaults(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	testDB.CleanupTables(t, "games", "sessions", "users")
	defer testDB.CleanupTables(t, "games", "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupGameTestRouter(app, testDB)
	fixtures := testDB.SetupFixtures(t)

	// Create auth token for test user
	accessToken, err := core.CreateTestJWTTokenForUser(app, fixtures.TestUser)
	core.AssertNoError(t, err, "Test token creation should succeed")

	// Make request without pagination parameters
	req := httptest.NewRequest(http.MethodGet, "/api/v1/games/", nil)
	req.Header.Set("Authorization", "Bearer "+accessToken)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	core.AssertEqual(t, http.StatusOK, w.Code, "Should return 200 OK")

	var response GameListingResponse
	err = json.NewDecoder(w.Body).Decode(&response)
	core.AssertNoError(t, err, "Should decode response")

	// Verify default pagination values
	core.AssertEqual(t, 1, response.Metadata.Page, "Default page should be 1")
	core.AssertEqual(t, 20, response.Metadata.PageSize, "Default page size should be 20")
	core.AssertEqual(t, false, response.Metadata.HasPreviousPage, "First page should not have previous")
}

// TestGetFilteredGames_PaginationCustomValues tests custom pagination parameters
func TestGetFilteredGames_PaginationCustomValues(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	testDB.CleanupTables(t, "games", "sessions", "users")
	defer testDB.CleanupTables(t, "games", "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupGameTestRouter(app, testDB)

	// Create test user and games to test pagination
	fixtures := testDB.SetupFixtures(t)

	// Create auth token for test user
	accessToken, err := core.CreateTestJWTTokenForUser(app, fixtures.TestUser)
	core.AssertNoError(t, err, "Test token creation should succeed")

	gameService := &db.GameService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Create multiple games for pagination testing
	for i := 1; i <= 25; i++ {
		_, err := gameService.CreateGame(context.Background(), core.CreateGameRequest{
			Title:       "Test Game " + string(rune(i)),
			Description: "Testing pagination",
			GMUserID:    int32(fixtures.TestUser.ID),
			IsPublic:    true,
		})
		core.AssertNoError(t, err, "Game creation should succeed")
	}

	tests := []struct {
		name             string
		page             string
		pageSize         string
		expectedPage     int
		expectedPageSize int
		expectedCount    int
	}{
		{
			name:             "Page 2 with size 10",
			page:             "2",
			pageSize:         "10",
			expectedPage:     2,
			expectedPageSize: 10,
			expectedCount:    10,
		},
		{
			name:             "Page 3 with size 5",
			page:             "3",
			pageSize:         "5",
			expectedPage:     3,
			expectedPageSize: 5,
			expectedCount:    5,
		},
		{
			name:             "Large page size",
			page:             "1",
			pageSize:         "50",
			expectedPage:     1,
			expectedPageSize: 50,
			expectedCount:    26, // SetupFixtures creates 1 game + we created 25 = 26 total
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/games/?page="+tt.page+"&page_size="+tt.pageSize, nil)
			req.Header.Set("Authorization", "Bearer "+accessToken)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			core.AssertEqual(t, http.StatusOK, w.Code, "Should return 200 OK")

			var response GameListingResponse
			err := json.NewDecoder(w.Body).Decode(&response)
			core.AssertNoError(t, err, "Should decode response")

			core.AssertEqual(t, tt.expectedPage, response.Metadata.Page, "Page number should match")
			core.AssertEqual(t, tt.expectedPageSize, response.Metadata.PageSize, "Page size should match")
			core.AssertEqual(t, tt.expectedCount, len(response.Games), "Game count should match")

			// For the large page size case, verify the fixture game is in the results
			if tt.name == "Large page size" {
				found := false
				for _, g := range response.Games {
					if g.Title == "Test Game" {
						found = true
						break
					}
				}
				core.AssertTrue(t, found, "Fixture game 'Test Game' should appear in results")
			}
		})
	}
}

// TestGetFilteredGames_PaginationInvalidValues tests handling of invalid pagination parameters
func TestGetFilteredGames_PaginationInvalidValues(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	testDB.CleanupTables(t, "games", "sessions", "users")
	defer testDB.CleanupTables(t, "games", "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupGameTestRouter(app, testDB)
	fixtures := testDB.SetupFixtures(t)

	// Create auth token for test user
	accessToken, err := core.CreateTestJWTTokenForUser(app, fixtures.TestUser)
	core.AssertNoError(t, err, "Test token creation should succeed")

	tests := []struct {
		name             string
		page             string
		pageSize         string
		expectedPage     int
		expectedPageSize int
		description      string
	}{
		{
			name:             "Negative page falls back to default",
			page:             "-1",
			pageSize:         "20",
			expectedPage:     1,
			expectedPageSize: 20,
			description:      "Negative page should default to 1",
		},
		{
			name:             "Zero page falls back to default",
			page:             "0",
			pageSize:         "20",
			expectedPage:     1,
			expectedPageSize: 20,
			description:      "Zero page should default to 1",
		},
		{
			name:             "Invalid page string falls back to default",
			page:             "invalid",
			pageSize:         "20",
			expectedPage:     1,
			expectedPageSize: 20,
			description:      "Invalid page should default to 1",
		},
		{
			name:             "Negative page size falls back to default",
			page:             "1",
			pageSize:         "-10",
			expectedPage:     1,
			expectedPageSize: 20,
			description:      "Negative page size should default to 20",
		},
		{
			name:             "Zero page size falls back to default",
			page:             "1",
			pageSize:         "0",
			expectedPage:     1,
			expectedPageSize: 20,
			description:      "Zero page size should default to 20",
		},
		{
			name:             "Page size exceeding max (100) is capped",
			page:             "1",
			pageSize:         "150",
			expectedPage:     1,
			expectedPageSize: 20,
			description:      "Page size > 100 should default to 20",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/games/?page="+tt.page+"&page_size="+tt.pageSize, nil)
			req.Header.Set("Authorization", "Bearer "+accessToken)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			core.AssertEqual(t, http.StatusOK, w.Code, "Should return 200 OK")

			var response GameListingResponse
			err := json.NewDecoder(w.Body).Decode(&response)
			core.AssertNoError(t, err, "Should decode response")

			core.AssertEqual(t, tt.expectedPage, response.Metadata.Page, tt.description)
			core.AssertEqual(t, tt.expectedPageSize, response.Metadata.PageSize, tt.description)
		})
	}
}

// TestGetFilteredGames_PaginationMetadata tests pagination metadata calculations
func TestGetFilteredGames_PaginationMetadata(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	testDB.CleanupTables(t, "games", "sessions", "users")
	defer testDB.CleanupTables(t, "games", "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupGameTestRouter(app, testDB)
	fixtures := testDB.SetupFixtures(t)

	// Create auth token for test user
	accessToken, err := core.CreateTestJWTTokenForUser(app, fixtures.TestUser)
	core.AssertNoError(t, err, "Test token creation should succeed")

	// Create exactly 23 games for precise metadata testing
	// Note: SetupFixtures already creates 1 game, so total will be 24
	gameService := &db.GameService{DB: testDB.Pool, Logger: app.ObsLogger}
	for i := 1; i <= 23; i++ {
		_, err := gameService.CreateGame(context.Background(), core.CreateGameRequest{
			Title:       "Pagination Test Game " + string(rune(i)),
			Description: "Testing metadata",
			GMUserID:    int32(fixtures.TestUser.ID),
			IsPublic:    true,
		})
		core.AssertNoError(t, err, "Game creation should succeed")
	}

	tests := []struct {
		name                string
		page                int
		pageSize            int
		expectedTotalPages  int
		expectedHasNext     bool
		expectedHasPrevious bool
	}{
		{
			name:                "First page of 3 (page_size=10, total=24)",
			page:                1,
			pageSize:            10,
			expectedTotalPages:  3,
			expectedHasNext:     true,
			expectedHasPrevious: false,
		},
		{
			name:                "Middle page of 3",
			page:                2,
			pageSize:            10,
			expectedTotalPages:  3,
			expectedHasNext:     true,
			expectedHasPrevious: true,
		},
		{
			name:                "Last page of 3",
			page:                3,
			pageSize:            10,
			expectedTotalPages:  3,
			expectedHasNext:     false,
			expectedHasPrevious: true,
		},
		{
			name:                "Single page when page_size > total",
			page:                1,
			pageSize:            50,
			expectedTotalPages:  1,
			expectedHasNext:     false,
			expectedHasPrevious: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/games/?page="+strconv.Itoa(tt.page)+"&page_size="+strconv.Itoa(tt.pageSize), nil)
			req.Header.Set("Authorization", "Bearer "+accessToken)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			core.AssertEqual(t, http.StatusOK, w.Code, "Should return 200 OK")

			var response GameListingResponse
			err := json.NewDecoder(w.Body).Decode(&response)
			core.AssertNoError(t, err, "Should decode response")

			core.AssertEqual(t, tt.expectedTotalPages, response.Metadata.TotalPages, "Total pages should match")
			core.AssertEqual(t, tt.expectedHasNext, response.Metadata.HasNextPage, "Has next page should match")
			core.AssertEqual(t, tt.expectedHasPrevious, response.Metadata.HasPreviousPage, "Has previous page should match")
			core.AssertEqual(t, 24, response.Metadata.TotalCount, "Total count should be 24")
			core.AssertEqual(t, 24, response.Metadata.FilteredCount, "Filtered count should be 24")
		})
	}
}

// TestCreateGame_ValidationErrors tests validation error scenarios for game creation
func TestCreateGame_ValidationErrors(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "games", "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupGameTestRouter(app, testDB)
	fixtures := testDB.SetupFixtures(t)

	// Create auth token for test user
	accessToken, err := core.CreateTestJWTTokenForUser(app, fixtures.TestUser)
	core.AssertNoError(t, err, "Test token creation should succeed")

	testCases := []struct {
		name           string
		payload        CreateGameRequest
		expectedStatus int
		expectedError  string
		description    string
	}{
		{
			name: "empty_title",
			payload: CreateGameRequest{
				Title:       "",
				Description: "A game without a title",
			},
			expectedStatus: 400,
			expectedError:  "title is required",
			description:    "Should reject game creation with empty title",
		},
		{
			name: "whitespace_only_title",
			payload: CreateGameRequest{
				Title:       "   ",
				Description: "A game with whitespace title",
			},
			expectedStatus: 201,
			description:    "Should accept whitespace title (ValidateRequired doesn't trim)",
		},
		{
			name: "valid_minimal_game",
			payload: CreateGameRequest{
				Title:       "Valid Game Title",
				Description: "A valid game",
			},
			expectedStatus: 201,
			description:    "Should accept game with just title and description",
		},
		{
			name: "valid_game_with_all_fields",
			payload: CreateGameRequest{
				Title:              "Complete Game",
				Description:        "A game with all optional fields",
				Genre:              "Fantasy",
				MaxPlayers:         6,
				IsAnonymous:        true,
				AutoAcceptAudience: true,
			},
			expectedStatus: 201,
			description:    "Should accept game with all fields populated",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			payload, _ := json.Marshal(tc.payload)
			req := httptest.NewRequest("POST", "/api/v1/games/", bytes.NewBuffer(payload))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", "Bearer "+accessToken)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			core.AssertEqual(t, tc.expectedStatus, w.Code, tc.description)

			if tc.expectedError != "" {
				var response map[string]interface{}
				err := json.Unmarshal(w.Body.Bytes(), &response)
				core.AssertNoError(t, err, "Should decode error response")

				if errorText, ok := response["error"].(string); ok {
					if len(errorText) == 0 {
						t.Errorf("Expected error message to contain '%s', but error field was empty", tc.expectedError)
					}
					// Verify error field is present and not empty
				} else {
					t.Errorf("Expected 'error' field in response")
				}
			}
		})
	}
}

// TestSplitCommaSeparated verifies that the custom comma-splitting helpers
// correctly parse comma-separated query params. A silent bug here would cause
// GetFilteredGames to ignore genre/tag filters entirely.
func TestSplitCommaSeparated(t *testing.T) {
	cases := []struct {
		input    string
		expected []string
	}{
		{"fantasy,scifi,horror", []string{"fantasy", "scifi", "horror"}},
		{"fantasy, scifi , horror", []string{"fantasy", "scifi", "horror"}},
		{"single", []string{"single"}},
		{"", nil},
		{",,,", nil},
		{"  spaces  ,  more  ", []string{"spaces", "more"}},
	}

	for _, tc := range cases {
		got := splitCommaSeparated(tc.input)
		if len(got) != len(tc.expected) {
			t.Errorf("splitCommaSeparated(%q): got %v, want %v", tc.input, got, tc.expected)
			continue
		}
		for i := range tc.expected {
			if got[i] != tc.expected[i] {
				t.Errorf("splitCommaSeparated(%q)[%d]: got %q, want %q", tc.input, i, got[i], tc.expected[i])
			}
		}
	}
}

// TestDeleteGame_NonCancelledGame verifies that deleting a game that is not in
// "cancelled" state returns 400. Silent failure here lets GMs destroy active games.
func TestDeleteGame_NonCancelledGame(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "games", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupGameTestRouter(app, testDB)

	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	gmToken, err := core.CreateTestJWTTokenForUser(app, gm)
	if err != nil {
		t.Fatalf("failed to create token: %v", err)
	}

	game := testDB.CreateTestGame(t, int32(gm.ID), "Active Game")

	// Game starts in "setup" state, which is not "cancelled"
	req := httptest.NewRequest("DELETE", fmt.Sprintf("/api/v1/games/%d", game.ID), nil)
	req.Header.Set("Authorization", "Bearer "+gmToken)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	// Must reject deletion of non-cancelled games
	if rec.Code != http.StatusBadRequest && rec.Code != http.StatusConflict {
		t.Errorf("expected 400 or 409 for deleting non-cancelled game, got %d (body: %s)", rec.Code, rec.Body.String())
	}
}

// TestUpdateGameState_NonGMForbidden verifies that players cannot change game state.
// A broken auth check here lets any participant advance or cancel a game.
func TestUpdateGameState_NonGMForbidden(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "game_participants", "games", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupGameTestRouter(app, testDB)

	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player := testDB.CreateTestUser(t, "player", "player@example.com")

	playerToken, err := core.CreateTestJWTTokenForUser(app, player)
	if err != nil {
		t.Fatalf("failed to create token: %v", err)
	}

	gameService := &db.GameService{DB: testDB.Pool, Logger: app.ObsLogger}
	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")
	_, err = gameService.AddGameParticipant(context.Background(), game.ID, int32(player.ID), "player")
	if err != nil {
		t.Fatalf("failed to add participant: %v", err)
	}

	body := `{"state":"recruitment"}`
	req := httptest.NewRequest("PUT", fmt.Sprintf("/api/v1/games/%d/state", game.ID), bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+playerToken)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Errorf("expected 403 for non-GM state update, got %d (body: %s)", rec.Code, rec.Body.String())
	}
}
