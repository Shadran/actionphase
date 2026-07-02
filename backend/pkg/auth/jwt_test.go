package auth

import (
	"actionphase/pkg/core"
	db "actionphase/pkg/db/services"
	"testing"
)

func TestJWTHandler_CreateToken(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	testDB.CleanupTables(t, "sessions", "users")
	defer testDB.CleanupTables(t, "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	handler := &JWTHandler{App: app}

	// Create a test user
	userService := &db.UserService{DB: testDB.Pool, Logger: app.ObsLogger}
	user, err := userService.CreateUser(&core.User{
		Username: "testuser",
		Password: "password123",
		Email:    "test@example.com",
	})
	core.AssertNoError(t, err, "User creation should succeed")

	t.Run("creates_valid_token", func(t *testing.T) {
		token, err := handler.CreateToken(user, SessionMetadata{})
		core.AssertNoError(t, err, "Token creation should succeed")
		core.AssertTrue(t, len(token) > 0, "Token should not be empty")
	})

	t.Run("creates_session", func(t *testing.T) {
		token, err := handler.CreateToken(user, SessionMetadata{})
		core.AssertNoError(t, err, "Token creation should succeed")

		// Verify session was created
		sessionService := &db.SessionService{DB: testDB.Pool, Logger: app.ObsLogger}
		session, err := sessionService.SessionByToken(token)
		core.AssertNoError(t, err, "Session should exist")
		core.AssertNotEqual(t, nil, session, "Session should not be nil")
		core.AssertTrue(t, session.ID > 0, "Session should have valid ID")
	})

}

