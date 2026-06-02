package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"actionphase/pkg/core"
	dbsvc "actionphase/pkg/db/services"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/jwtauth/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// setupDiscordTestRouter creates a test router with Discord auth routes.
func setupDiscordTestRouter(app *core.App) *chi.Mux {
	tokenAuth := jwtauth.New("HS256", []byte(app.Config.JWT.Secret), nil)
	userService := &dbsvc.UserService{DB: app.Pool, Logger: app.ObsLogger}

	r := chi.NewRouter()
	handler := &Handler{App: app}

	// Public callback
	r.Get("/api/v1/auth/discord/callback", handler.V1DiscordCallback)

	// Protected routes
	r.Group(func(r chi.Router) {
		r.Use(jwtauth.Verifier(tokenAuth))
		r.Use(jwtauth.Authenticator(tokenAuth))
		r.Use(core.RequireAuthenticationMiddleware(userService))

		r.Get("/api/v1/auth/discord/connect", handler.V1DiscordConnect)
		r.Get("/api/v1/auth/discord/status", handler.V1DiscordStatus)
		r.Delete("/api/v1/auth/discord/disconnect", handler.V1DiscordDisconnect)
	})

	return r
}

// TestDiscordConnect_RequiresAuth verifies the connect endpoint rejects unauthenticated requests.
func TestDiscordConnect_RequiresAuth(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupDiscordTestRouter(app)

	req := httptest.NewRequest("GET", "/api/v1/auth/discord/connect", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

// TestDiscordConnect_ReturnsURL verifies authenticated users get a valid OAuth2 URL.
func TestDiscordConnect_ReturnsURL(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "users")

	app := core.NewTestApp(testDB.Pool)
	// Set test OAuth config
	app.Config.Discord.OAuthClientID = "test-client-id"
	app.Config.Discord.OAuthRedirectURL = "http://localhost:3000/api/v1/auth/discord/callback"

	router := setupDiscordTestRouter(app)

	user := testDB.CreateTestUser(t, "player1", "player1@example.com")
	token, err := core.CreateTestJWTTokenForUser(app, user)
	require.NoError(t, err)

	req := httptest.NewRequest("GET", "/api/v1/auth/discord/connect", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)

	var resp DiscordConnectResponse
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	assert.Contains(t, resp.URL, "discord.com/api/oauth2/authorize")
	assert.Contains(t, resp.URL, "client_id=test-client-id")
	assert.Contains(t, resp.URL, "identify") // scope
	assert.Contains(t, resp.URL, "state=")
}

// TestDiscordCallback_InvalidState verifies the callback rejects tampered state.
func TestDiscordCallback_InvalidState(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupDiscordTestRouter(app)

	req := httptest.NewRequest("GET", "/api/v1/auth/discord/callback?code=somecode&state=invalidddddd", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

// TestDiscordCallback_MissingState verifies missing state returns 400.
func TestDiscordCallback_MissingState(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupDiscordTestRouter(app)

	req := httptest.NewRequest("GET", "/api/v1/auth/discord/callback?code=somecode", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

// TestDiscordStatus_NotLinked verifies status returns {linked: false} when no account linked.
func TestDiscordStatus_NotLinked(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "users", "user_discord_accounts")

	app := core.NewTestApp(testDB.Pool)
	router := setupDiscordTestRouter(app)

	user := testDB.CreateTestUser(t, "player1", "player1@example.com")
	token, err := core.CreateTestJWTTokenForUser(app, user)
	require.NoError(t, err)

	req := httptest.NewRequest("GET", "/api/v1/auth/discord/status", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)

	var resp DiscordStatusResponse
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	assert.False(t, resp.Linked)
	assert.Nil(t, resp.DiscordUsername)
}

// TestDiscordStatus_Linked verifies status returns {linked: true, discord_username} when linked.
func TestDiscordStatus_Linked(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "users", "user_discord_accounts")

	app := core.NewTestApp(testDB.Pool)
	router := setupDiscordTestRouter(app)

	user := testDB.CreateTestUser(t, "player1", "player1@example.com")
	token, err := core.CreateTestJWTTokenForUser(app, user)
	require.NoError(t, err)

	// Pre-link a Discord account
	discordSvc := &dbsvc.DiscordAccountService{DB: testDB.Pool}
	_, err = discordSvc.UpsertDiscordAccount(context.Background(), &core.UpsertDiscordAccountRequest{
		UserID:          int32(user.ID),
		DiscordUserID:   "discord-123",
		DiscordUsername: "testuser#1234",
		AccessToken:     "tok",
	})
	require.NoError(t, err)

	req := httptest.NewRequest("GET", "/api/v1/auth/discord/status", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)

	var resp DiscordStatusResponse
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	assert.True(t, resp.Linked)
	require.NotNil(t, resp.DiscordUsername)
	assert.Equal(t, "testuser#1234", *resp.DiscordUsername)
}

// TestDiscordDisconnect_Success verifies the disconnect endpoint removes the account.
func TestDiscordDisconnect_Success(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "users", "user_discord_accounts")

	app := core.NewTestApp(testDB.Pool)
	router := setupDiscordTestRouter(app)

	user := testDB.CreateTestUser(t, "player1", "player1@example.com")
	token, err := core.CreateTestJWTTokenForUser(app, user)
	require.NoError(t, err)

	// Pre-link a Discord account
	discordSvc := &dbsvc.DiscordAccountService{DB: testDB.Pool}
	_, err = discordSvc.UpsertDiscordAccount(context.Background(), &core.UpsertDiscordAccountRequest{
		UserID:          int32(user.ID),
		DiscordUserID:   "discord-456",
		DiscordUsername: "linked#5678",
		AccessToken:     "tok",
	})
	require.NoError(t, err)

	req := httptest.NewRequest("DELETE", "/api/v1/auth/discord/disconnect", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)

	// Verify account is gone
	acct, err := discordSvc.GetDiscordAccount(context.Background(), int32(user.ID))
	require.NoError(t, err)
	assert.Nil(t, acct)
}

// TestDiscordState_RoundTrip verifies the HMAC state can be built and verified.
func TestDiscordState_RoundTrip(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)
	handler := &Handler{App: app}

	userID := int32(42)
	state := handler.buildDiscordState(userID)

	decoded, err := handler.verifyDiscordState(state)
	require.NoError(t, err)
	assert.Equal(t, userID, decoded)
}

// TestDiscordState_TamperedSignatureFails verifies tampered state is rejected.
func TestDiscordState_TamperedSignatureFails(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)
	handler := &Handler{App: app}

	// Build state then tamper with it
	state := handler.buildDiscordState(99)
	tampered := state[:len(state)-4] + "XXXX"

	_, err := handler.verifyDiscordState(tampered)
	assert.Error(t, err)
}

// TestDiscordConnect_RequiresAuth_Delete verifies the disconnect endpoint rejects unauthenticated requests.
func TestDiscordDisconnect_RequiresAuth(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)
	router := setupDiscordTestRouter(app)

	req := httptest.NewRequest("DELETE", "/api/v1/auth/discord/disconnect", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

// Ensure DiscordAccountService satisfies the interface (compile-time check).
var _ core.DiscordAccountServiceInterface = (*dbsvc.DiscordAccountService)(nil)

// Helper to avoid unused import.
var _ = fmt.Sprintf
