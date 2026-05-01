package core

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- middleware.go ---

type mockUserService struct {
	user *User
	err  error
}

func (m *mockUserService) GetUserByID(_ int) (*User, error) {
	return m.user, m.err
}

func TestGetAuthenticatedUser_Present(t *testing.T) {
	authUser := &AuthenticatedUser{ID: 42, Username: "alice"}
	ctx := context.WithValue(context.Background(), UserContextKey, authUser)
	result := GetAuthenticatedUser(ctx)
	require.NotNil(t, result)
	assert.Equal(t, int32(42), result.ID)
	assert.Equal(t, "alice", result.Username)
}

func TestGetAuthenticatedUser_Absent(t *testing.T) {
	result := GetAuthenticatedUser(context.Background())
	assert.Nil(t, result)
}

func TestGetAuthenticatedUserID_Present(t *testing.T) {
	ctx := context.WithValue(context.Background(), UserIDContextKey, int32(7))
	assert.Equal(t, int32(7), GetAuthenticatedUserID(ctx))
}

func TestGetAuthenticatedUserID_Absent(t *testing.T) {
	assert.Equal(t, int32(0), GetAuthenticatedUserID(context.Background()))
}

func TestGetAuthenticatedUsername_Present(t *testing.T) {
	ctx := context.WithValue(context.Background(), UsernameContextKey, "bob")
	assert.Equal(t, "bob", GetAuthenticatedUsername(ctx))
}

func TestGetAuthenticatedUsername_Absent(t *testing.T) {
	assert.Equal(t, "", GetAuthenticatedUsername(context.Background()))
}

func TestCORSMiddleware_Disabled(t *testing.T) {
	cfg := &Config{App: AppConfig{CORSEnabled: false}}
	reached := false
	handler := CORSMiddleware(cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		reached = true
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("Origin", "http://evil.com")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	assert.True(t, reached)
	assert.Empty(t, rec.Header().Get("Access-Control-Allow-Origin"))
}

func TestCORSMiddleware_AllowedOrigin(t *testing.T) {
	cfg := &Config{App: AppConfig{
		CORSEnabled: true,
		CORSOrigins: []string{"http://localhost:5173"},
	}}
	handler := CORSMiddleware(cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("Origin", "http://localhost:5173")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	assert.Equal(t, "http://localhost:5173", rec.Header().Get("Access-Control-Allow-Origin"))
}

func TestCORSMiddleware_Preflight(t *testing.T) {
	cfg := &Config{App: AppConfig{
		CORSEnabled: true,
		CORSOrigins: []string{"*"},
	}}
	handler := CORSMiddleware(cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("next handler should not be called for OPTIONS")
	}))

	req := httptest.NewRequest("OPTIONS", "/", nil)
	req.Header.Set("Origin", "http://example.com")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
}

func TestCORSMiddleware_WildcardSubdomain(t *testing.T) {
	cfg := &Config{App: AppConfig{
		CORSEnabled: true,
		CORSOrigins: []string{"*.example.com"},
	}}
	handler := CORSMiddleware(cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("Origin", "https://app.example.com")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	assert.Equal(t, "https://app.example.com", rec.Header().Get("Access-Control-Allow-Origin"))
}

func TestContentTypeMiddleware_SkipsGET(t *testing.T) {
	reached := false
	handler := ContentTypeMiddleware("application/json")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		reached = true
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	assert.True(t, reached)
}

func TestContentTypeMiddleware_RejectsWrongType(t *testing.T) {
	handler := ContentTypeMiddleware("application/json")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("POST", "/", strings.NewReader("data"))
	req.Header.Set("Content-Type", "text/plain")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestContentTypeMiddleware_AcceptsCorrectType(t *testing.T) {
	reached := false
	handler := ContentTypeMiddleware("application/json")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		reached = true
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("POST", "/", strings.NewReader(`{}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	assert.True(t, reached)
	assert.Equal(t, http.StatusOK, rec.Code)
}

// --- dashboard.go ---

func TestCalculateDeadlineStatus_Critical(t *testing.T) {
	assert.Equal(t, "critical", CalculateDeadlineStatus(time.Now().Add(3*time.Hour)))
}

func TestCalculateDeadlineStatus_Warning(t *testing.T) {
	assert.Equal(t, "warning", CalculateDeadlineStatus(time.Now().Add(12*time.Hour)))
}

func TestCalculateDeadlineStatus_Normal(t *testing.T) {
	assert.Equal(t, "normal", CalculateDeadlineStatus(time.Now().Add(48*time.Hour)))
}

func TestCalculateDeadlineStatus_Overdue(t *testing.T) {
	// Past deadline: hours remaining is negative, < 6 → critical
	assert.Equal(t, "critical", CalculateDeadlineStatus(time.Now().Add(-1*time.Hour)))
}

func TestIsGameUrgent_NilDeadline(t *testing.T) {
	assert.False(t, IsGameUrgent(true, nil))
}

func TestIsGameUrgent_PendingActionNearDeadline(t *testing.T) {
	deadline := time.Now().Add(3 * time.Hour)
	assert.True(t, IsGameUrgent(true, &deadline))
}

func TestIsGameUrgent_NoPendingAction(t *testing.T) {
	deadline := time.Now().Add(3 * time.Hour)
	assert.False(t, IsGameUrgent(false, &deadline))
}

func TestIsGameUrgent_DeadlineFarOut(t *testing.T) {
	deadline := time.Now().Add(48 * time.Hour)
	assert.False(t, IsGameUrgent(true, &deadline))
}

func TestTruncateContent_ShortContent(t *testing.T) {
	assert.Equal(t, "hello", TruncateContent("hello", 100))
}

func TestTruncateContent_TruncatesAtWordBoundary(t *testing.T) {
	result := TruncateContent("hello world foo bar", 11)
	assert.True(t, strings.HasSuffix(result, "..."))
	assert.True(t, strings.HasPrefix(result, "hello"))
}

// --- config.go ---

func TestGetEnvBool_TrueVariants(t *testing.T) {
	for _, val := range []string{"true", "1", "yes", "on"} {
		t.Setenv("TEST_BOOL_VAR", val)
		assert.True(t, getEnvBool("TEST_BOOL_VAR", false), "expected true for %q", val)
	}
}

func TestGetEnvBool_FalseVariants(t *testing.T) {
	for _, val := range []string{"false", "0", "no", "off"} {
		t.Setenv("TEST_BOOL_VAR", val)
		assert.False(t, getEnvBool("TEST_BOOL_VAR", true), "expected false for %q", val)
	}
}

func TestGetEnvBool_Default(t *testing.T) {
	t.Setenv("TEST_BOOL_VAR", "")
	assert.True(t, getEnvBool("TEST_BOOL_VAR", true))
	assert.False(t, getEnvBool("TEST_BOOL_VAR", false))
}

func TestGetEnvInt_Valid(t *testing.T) {
	t.Setenv("TEST_INT_VAR", "42")
	assert.Equal(t, 42, getEnvInt("TEST_INT_VAR", 0))
}

func TestGetEnvInt_Invalid(t *testing.T) {
	t.Setenv("TEST_INT_VAR", "notanint")
	assert.Equal(t, 99, getEnvInt("TEST_INT_VAR", 99))
}

func TestGetEnvInt_Default(t *testing.T) {
	t.Setenv("TEST_INT_VAR", "")
	assert.Equal(t, 5, getEnvInt("TEST_INT_VAR", 5))
}

func TestGetEnvDuration_Valid(t *testing.T) {
	t.Setenv("TEST_DUR_VAR", "2h30m")
	assert.Equal(t, 2*time.Hour+30*time.Minute, getEnvDuration("TEST_DUR_VAR", time.Second))
}

func TestGetEnvDuration_Invalid(t *testing.T) {
	t.Setenv("TEST_DUR_VAR", "notaduration")
	assert.Equal(t, time.Minute, getEnvDuration("TEST_DUR_VAR", time.Minute))
}

func TestGetEnvDuration_Default(t *testing.T) {
	t.Setenv("TEST_DUR_VAR", "")
	assert.Equal(t, 30*time.Second, getEnvDuration("TEST_DUR_VAR", 30*time.Second))
}

// --- users.go ---

func TestHashPassword_AndCheckPasswordHash(t *testing.T) {
	u := &User{Password: "my-secret-password"}
	require.NoError(t, u.HashPassword())
	assert.NotEqual(t, "my-secret-password", u.Password, "password should be hashed")
	assert.True(t, u.CheckPasswordHash("my-secret-password"))
	assert.False(t, u.CheckPasswordHash("wrong-password"))
}

func TestCheckPasswordHash_WrongPassword(t *testing.T) {
	u := &User{Password: "correct"}
	require.NoError(t, u.HashPassword())
	assert.False(t, u.CheckPasswordHash("incorrect"))
}

// Verify mockUserService satisfies the MiddlewareUserService interface at compile time.
var _ MiddlewareUserService = (*mockUserService)(nil)

func TestMockUserService_ReturnsUser(t *testing.T) {
	svc := &mockUserService{user: &User{ID: 1, Username: "alice"}}
	u, err := svc.GetUserByID(1)
	require.NoError(t, err)
	assert.Equal(t, "alice", u.Username)
}

func TestMockUserService_ReturnsError(t *testing.T) {
	svc := &mockUserService{err: errors.New("not found")}
	u, err := svc.GetUserByID(999)
	assert.Nil(t, u)
	assert.Error(t, err)
}

// --- constants.go ---

func TestIsValidGameState(t *testing.T) {
	for _, s := range ValidGameStates {
		assert.True(t, IsValidGameState(s), "expected %q to be valid", s)
	}
	assert.False(t, IsValidGameState(""), "empty string should be invalid")
	assert.False(t, IsValidGameState("draft"), "unknown state should be invalid")
	assert.False(t, IsValidGameState("IN_PROGRESS"), "case-sensitive: uppercase should be invalid")
}

func TestIsValidStateTransition(t *testing.T) {
	// Valid forward transitions
	assert.True(t, IsValidStateTransition(GameStateSetup, GameStateRecruitment))
	assert.True(t, IsValidStateTransition(GameStateRecruitment, GameStateCharacterCreation))
	assert.True(t, IsValidStateTransition(GameStateCharacterCreation, GameStateInProgress))
	assert.True(t, IsValidStateTransition(GameStateInProgress, GameStatePaused))
	assert.True(t, IsValidStateTransition(GameStatePaused, GameStateInProgress))
	assert.True(t, IsValidStateTransition(GameStateInProgress, GameStateCompleted))

	// Terminal states cannot transition
	assert.False(t, IsValidStateTransition(GameStateCompleted, GameStateInProgress))
	assert.False(t, IsValidStateTransition(GameStateCancelled, GameStateSetup))

	// Skipping states is forbidden
	assert.False(t, IsValidStateTransition(GameStateSetup, GameStateInProgress))
	assert.False(t, IsValidStateTransition(GameStateRecruitment, GameStateCompleted))

	// Unknown current state
	assert.False(t, IsValidStateTransition("nonexistent", GameStateSetup))
}

func TestIsValidParticipantRole(t *testing.T) {
	for _, r := range ValidParticipantRoles {
		assert.True(t, IsValidParticipantRole(r), "expected %q to be valid", r)
	}
	assert.False(t, IsValidParticipantRole(""), "empty string should be invalid")
	assert.False(t, IsValidParticipantRole("admin"), "unknown role should be invalid")
	assert.False(t, IsValidParticipantRole("GM"), "case-sensitive: uppercase should be invalid")
}

func TestIsValidParticipantStatus(t *testing.T) {
	for _, s := range ValidParticipantStatuses {
		assert.True(t, IsValidParticipantStatus(s), "expected %q to be valid", s)
	}
	assert.False(t, IsValidParticipantStatus(""), "empty string should be invalid")
	assert.False(t, IsValidParticipantStatus("suspended"), "unknown status should be invalid")
}

func TestIsValidApplicationStatus(t *testing.T) {
	for _, s := range ValidApplicationStatuses {
		assert.True(t, IsValidApplicationStatus(s), "expected %q to be valid", s)
	}
	assert.False(t, IsValidApplicationStatus(""), "empty string should be invalid")
	assert.False(t, IsValidApplicationStatus("withdrawn"), "unknown status should be invalid")
}

func TestIsValidNotificationType(t *testing.T) {
	for _, typ := range ValidNotificationTypes {
		assert.True(t, IsValidNotificationType(typ), "expected %q to be valid", typ)
	}
	assert.False(t, IsValidNotificationType(""), "empty string should be invalid")
	assert.False(t, IsValidNotificationType("unknown_event"), "unknown type should be invalid")
	assert.False(t, IsValidNotificationType("ACTION_SUBMITTED"), "case-sensitive: uppercase should be invalid")
}

// --- notifications.go ---

func TestCreateNotificationRequest_Validate(t *testing.T) {
	str := func(s string) *string { return &s }

	t.Run("valid request passes", func(t *testing.T) {
		req := &CreateNotificationRequest{
			UserID: 1,
			Type:   NotificationTypeActionResult,
			Title:  "Your action result is ready",
		}
		assert.NoError(t, req.Validate())
	})

	t.Run("invalid notification type fails", func(t *testing.T) {
		req := &CreateNotificationRequest{
			UserID: 1,
			Type:   "not_a_real_type",
			Title:  "Some title",
		}
		assert.Error(t, req.Validate(), "unknown notification type should fail validation")
	})

	t.Run("empty title fails", func(t *testing.T) {
		req := &CreateNotificationRequest{
			UserID: 1,
			Type:   NotificationTypeActionResult,
			Title:  "",
		}
		assert.Error(t, req.Validate(), "empty title should fail validation")
	})

	t.Run("title too long fails", func(t *testing.T) {
		req := &CreateNotificationRequest{
			UserID: 1,
			Type:   NotificationTypeActionResult,
			Title:  string(make([]byte, 256)), // 256 bytes > max 255
		}
		assert.Error(t, req.Validate(), "title exceeding 255 chars should fail")
	})

	t.Run("link URL too long fails", func(t *testing.T) {
		req := &CreateNotificationRequest{
			UserID:  1,
			Type:    NotificationTypeActionResult,
			Title:   "OK",
			LinkURL: str(string(make([]byte, 501))), // 501 > max 500
		}
		assert.Error(t, req.Validate(), "link URL exceeding 500 chars should fail")
	})
}

// --- email_verification_middleware.go ---

func TestRequireEmailVerificationMiddleware_Disabled(t *testing.T) {
	t.Setenv("REQUIRE_EMAIL_VERIFICATION", "false")

	reached := false
	mw := RequireEmailVerificationMiddleware(nil) // pool not used when disabled
	handler := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		reached = true
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	assert.True(t, reached, "handler should be called when verification is disabled")
	assert.Equal(t, http.StatusOK, rec.Code)
}

func TestGetUserEmailVerificationStatus(t *testing.T) {
	if os.Getenv("SKIP_DB_TESTS") == "true" {
		t.Skip("skipping DB test: SKIP_DB_TESTS=true")
	}

	testDB := NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "users")

	user := testDB.CreateTestUser(t, "verifytest", "verifytest@example.com")

	ctx := context.Background()

	// Newly created users are unverified by default
	verified, err := GetUserEmailVerificationStatus(ctx, testDB.Pool, int32(user.ID))
	require.NoError(t, err)
	assert.False(t, verified, "new user should not be email-verified")

	// Mark the user as verified directly
	_, err = testDB.Pool.Exec(ctx, "UPDATE users SET email_verified = true WHERE id = $1", user.ID)
	require.NoError(t, err)

	verified, err = GetUserEmailVerificationStatus(ctx, testDB.Pool, int32(user.ID))
	require.NoError(t, err)
	assert.True(t, verified, "user should be verified after update")
}
