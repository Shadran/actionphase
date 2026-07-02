package core

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/jwtauth/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func makeTokenForUserID(app *App, userID int32, username string) (string, error) {
	tokenAuth := jwtauth.New("HS256", []byte(app.Config.JWT.Secret), nil)
	_, tokenString, err := tokenAuth.Encode(map[string]interface{}{
		"sub":      fmt.Sprintf("%d", userID),
		"username": username,
		"exp":      time.Now().Add(time.Hour).Unix(),
	})
	return tokenString, err
}

// TestRequireEmailVerificationMiddleware_Enabled_UnverifiedBlocked verifies that when enforcement
// is on, an unverified user receives 403 rather than reaching the handler.
func TestRequireEmailVerificationMiddleware_Enabled_UnverifiedBlocked(t *testing.T) {
	testDB := NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "users")

	app := NewTestApp(testDB.Pool)

	t.Setenv("REQUIRE_EMAIL_VERIFICATION", "true")

	tokenAuth := jwtauth.New("HS256", []byte(app.Config.JWT.Secret), nil)
	r := chi.NewRouter()
	r.Group(func(r chi.Router) {
		r.Use(jwtauth.Verifier(tokenAuth))
		r.Use(jwtauth.Authenticator(tokenAuth))
		r.Use(RequireEmailVerificationMiddleware(testDB.Pool))
		r.Get("/protected", func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		})
	})

	// CreateTestUser does not set email_verified = true by default.
	user := testDB.CreateTestUser(t, "unverified_enforced", "unverified_enforced@example.com")

	// Ensure email_verified is false (default, but be explicit).
	_, err := testDB.Pool.Exec(context.Background(),
		"UPDATE users SET email_verified = FALSE WHERE id = $1", user.ID)
	require.NoError(t, err)

	token, err := makeTokenForUserID(app, int32(user.ID), user.Username)
	require.NoError(t, err)

	req := httptest.NewRequest("GET", "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusForbidden, w.Code,
		"unverified user must be blocked with 403 when enforcement is enabled")
}

// TestRequireEmailVerificationMiddleware_Enabled_VerifiedPasses verifies that a user whose
// email IS verified passes through the middleware to the handler.
func TestRequireEmailVerificationMiddleware_Enabled_VerifiedPasses(t *testing.T) {
	testDB := NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "users")

	app := NewTestApp(testDB.Pool)

	t.Setenv("REQUIRE_EMAIL_VERIFICATION", "true")

	tokenAuth := jwtauth.New("HS256", []byte(app.Config.JWT.Secret), nil)
	r := chi.NewRouter()
	r.Group(func(r chi.Router) {
		r.Use(jwtauth.Verifier(tokenAuth))
		r.Use(jwtauth.Authenticator(tokenAuth))
		r.Use(RequireEmailVerificationMiddleware(testDB.Pool))
		r.Get("/protected", func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		})
	})

	user := testDB.CreateTestUser(t, "verified_enforced", "verified_enforced@example.com")

	// Mark user as verified.
	_, err := testDB.Pool.Exec(context.Background(),
		"UPDATE users SET email_verified = TRUE WHERE id = $1", user.ID)
	require.NoError(t, err)

	token, err := makeTokenForUserID(app, int32(user.ID), user.Username)
	require.NoError(t, err)

	req := httptest.NewRequest("GET", "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code,
		"verified user must pass through the middleware")
}

