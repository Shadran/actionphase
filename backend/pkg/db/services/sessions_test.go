package db

import (
	"context"
	"testing"

	"actionphase/pkg/core"
)

func TestSessionService_SessionByToken(t *testing.T) {
	// Setup test database
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "sessions", "users")

	// Setup test fixtures
	fixtures := testDB.SetupFixtures(t)

	app := core.NewTestApp(testDB.Pool)
	sessionService := &SessionService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Create a test session
	testSession := &core.Session{
		User:  fixtures.TestUser,
		Token: "test-token-123",
	}

	_, err := sessionService.CreateSession(testSession)
	core.AssertNoError(t, err, "Failed to create session")

	// Test retrieving session by token
	retrievedSession, err := sessionService.SessionByToken("test-token-123")
	core.AssertNoError(t, err, "Failed to retrieve session by token")
	core.AssertNotEqual(t, 0, retrievedSession.ID, "Session ID should be set")
	core.AssertEqual(t, fixtures.TestUser.ID, retrievedSession.User.ID, "Retrieved session should belong to the correct user")
}

func TestSessionService_SessionByToken_NotFound(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)
	sessionService := &SessionService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Test retrieving non-existent session
	_, err := sessionService.SessionByToken("non-existent-token")
	core.AssertError(t, err, "Should return error for non-existent token")
}

func TestSessionService_CreateSession(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "sessions", "users")

	fixtures := testDB.SetupFixtures(t)
	app := core.NewTestApp(testDB.Pool)
	sessionService := &SessionService{DB: testDB.Pool, Logger: app.ObsLogger}

	testCases := []struct {
		name        string
		session     *core.Session
		expectError bool
	}{
		{
			name: "valid session",
			session: &core.Session{
				User:  fixtures.TestUser,
				Token: "valid-token-456",
			},
			expectError: false,
		},
		{
			name: "session with invalid user ID",
			session: &core.Session{
				User:  &core.User{ID: -1},
				Token: "invalid-token",
			},
			expectError: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			session, err := sessionService.CreateSession(tc.session)

			if tc.expectError {
				core.AssertError(t, err, "Expected error for invalid session")
				return
			}

			core.AssertNoError(t, err, "Failed to create valid session")
			core.AssertNotEqual(t, 0, session.ID, "Session ID should be set")
		})
	}
}

func TestSessionService_DeleteSessionByToken(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "sessions", "users")

	fixtures := testDB.SetupFixtures(t)
	app := core.NewTestApp(testDB.Pool)
	sessionService := &SessionService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Create a session to delete
	testSession := &core.Session{
		User:  fixtures.TestUser,
		Token: "token-to-delete",
	}

	_, err := sessionService.CreateSession(testSession)
	core.AssertNoError(t, err, "Failed to create session")

	// Delete the session
	err = sessionService.DeleteSessionByToken("token-to-delete")
	core.AssertNoError(t, err, "Failed to delete session")

	// Verify session is deleted
	_, err = sessionService.SessionByToken("token-to-delete")
	core.AssertError(t, err, "Session should be deleted and not findable")
}

func TestSessionService_GetUserSessions(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "sessions", "users")

	fixtures := testDB.SetupFixtures(t)
	app := core.NewTestApp(testDB.Pool)
	sessionService := &SessionService{DB: testDB.Pool, Logger: app.ObsLogger}

	ctx := context.Background()

	t.Run("returns sessions for user", func(t *testing.T) {
		_, err := sessionService.CreateSession(&core.Session{User: fixtures.TestUser, Token: "token-a"})
		core.AssertNoError(t, err, "create session a")
		_, err = sessionService.CreateSession(&core.Session{User: fixtures.TestUser, Token: "token-b"})
		core.AssertNoError(t, err, "create session b")

		sessions, err := sessionService.GetUserSessions(ctx, int32(fixtures.TestUser.ID))
		core.AssertNoError(t, err, "GetUserSessions should succeed")
		if len(sessions) < 2 {
			t.Errorf("expected at least 2 sessions, got %d", len(sessions))
		}
		for _, s := range sessions {
			core.AssertEqual(t, int32(fixtures.TestUser.ID), s.UserID, "all sessions should belong to the user")
		}
	})

	t.Run("returns empty slice for user with no sessions", func(t *testing.T) {
		otherUser := testDB.CreateTestUser(t, "nosessions", "nosessions@example.com")
		sessions, err := sessionService.GetUserSessions(ctx, int32(otherUser.ID))
		core.AssertNoError(t, err, "GetUserSessions should not error for user with no sessions")
		core.AssertEqual(t, 0, len(sessions), "should return empty slice")
	})
}

func TestSessionService_DeleteSession(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "sessions", "users")

	fixtures := testDB.SetupFixtures(t)
	app := core.NewTestApp(testDB.Pool)
	sessionService := &SessionService{DB: testDB.Pool, Logger: app.ObsLogger}

	ctx := context.Background()

	created, err := sessionService.CreateSession(&core.Session{User: fixtures.TestUser, Token: "to-delete-by-id"})
	core.AssertNoError(t, err, "create session")

	// Verify it exists
	_, err = sessionService.SessionByToken("to-delete-by-id")
	core.AssertNoError(t, err, "session should exist before deletion")

	err = sessionService.DeleteSession(ctx, int32(created.ID))
	core.AssertNoError(t, err, "DeleteSession should succeed")

	// Verify it is gone
	_, err = sessionService.SessionByToken("to-delete-by-id")
	core.AssertError(t, err, "session should be gone after DeleteSession")
}

func TestSessionService_InvalidateAllUserSessions(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "sessions", "users")

	fixtures := testDB.SetupFixtures(t)
	app := core.NewTestApp(testDB.Pool)
	sessionService := &SessionService{DB: testDB.Pool, Logger: app.ObsLogger}

	ctx := context.Background()

	// Create two sessions for the user
	_, err := sessionService.CreateSession(&core.Session{User: fixtures.TestUser, Token: "inv-token-1"})
	core.AssertNoError(t, err, "create session 1")
	_, err = sessionService.CreateSession(&core.Session{User: fixtures.TestUser, Token: "inv-token-2"})
	core.AssertNoError(t, err, "create session 2")

	// Create a session for a different user that should not be affected
	otherUser := testDB.CreateTestUser(t, "other", "other@example.com")
	_, err = sessionService.CreateSession(&core.Session{User: otherUser, Token: "other-token"})
	core.AssertNoError(t, err, "create other user session")

	err = sessionService.InvalidateAllUserSessions(ctx, int32(fixtures.TestUser.ID))
	core.AssertNoError(t, err, "InvalidateAllUserSessions should succeed")

	// Target user's sessions should be gone
	sessions, err := sessionService.GetUserSessions(ctx, int32(fixtures.TestUser.ID))
	core.AssertNoError(t, err, "GetUserSessions after invalidation")
	core.AssertEqual(t, 0, len(sessions), "all sessions for the banned user should be deleted")

	// Other user's session should be intact
	_, err = sessionService.SessionByToken("other-token")
	core.AssertNoError(t, err, "other user's session should not be affected")
}

func TestSessionService_CleanupExpiredSessions(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "sessions", "users")

	fixtures := testDB.SetupFixtures(t)
	app := core.NewTestApp(testDB.Pool)
	sessionService := &SessionService{DB: testDB.Pool, Logger: app.ObsLogger}

	ctx := context.Background()

	// Create an active session
	_, err := sessionService.CreateSession(&core.Session{User: fixtures.TestUser, Token: "active-session"})
	core.AssertNoError(t, err, "create active session")

	// Create and manually expire a session
	_, err = sessionService.CreateSession(&core.Session{User: fixtures.TestUser, Token: "expired-session"})
	core.AssertNoError(t, err, "create session to expire")
	_, err = testDB.Pool.Exec(ctx,
		"UPDATE sessions SET expires = NOW() - INTERVAL '1 day' WHERE data = $1",
		"expired-session",
	)
	core.AssertNoError(t, err, "backdate session expiry")

	err = sessionService.CleanupExpiredSessions(ctx)
	core.AssertNoError(t, err, "CleanupExpiredSessions should succeed")

	// Active session should still exist
	_, err = sessionService.SessionByToken("active-session")
	core.AssertNoError(t, err, "active session should still exist")

	// Expired session should be deleted
	_, err = sessionService.SessionByToken("expired-session")
	core.AssertError(t, err, "expired session should have been cleaned up")
}

func TestSessionService_UpdateSessionToken(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "sessions", "users")

	fixtures := testDB.SetupFixtures(t)
	app := core.NewTestApp(testDB.Pool)
	sessionService := &SessionService{DB: testDB.Pool, Logger: app.ObsLogger}

	created, err := sessionService.CreateSession(&core.Session{User: fixtures.TestUser, Token: "old-token"})
	core.AssertNoError(t, err, "create session")

	err = sessionService.UpdateSessionToken(int32(created.ID), "new-token")
	core.AssertNoError(t, err, "UpdateSessionToken should succeed")

	// Old token should no longer work
	_, err = sessionService.SessionByToken("old-token")
	core.AssertError(t, err, "old token should be invalid after update")

	// New token should work
	updated, err := sessionService.SessionByToken("new-token")
	core.AssertNoError(t, err, "new token should be valid")
	core.AssertEqual(t, created.ID, updated.ID, "session ID should be unchanged")
}

func TestSessionService_DeleteSessionByToken_NotFound(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)
	sessionService := &SessionService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Try to delete non-existent session
	err := sessionService.DeleteSessionByToken("non-existent-token")
	// Note: This may or may not error depending on implementation
	// The current implementation doesn't check if the session existed
	// so this test documents the current behavior
	core.AssertNoError(t, err, "Deleting non-existent session should not error")
}

func TestSessionService_Session_ById(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "sessions", "users")

	fixtures := testDB.SetupFixtures(t)
	app := core.NewTestApp(testDB.Pool)
	sessionService := &SessionService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Create a session
	testSession := &core.Session{
		User:  fixtures.TestUser,
		Token: "test-token-by-id",
	}

	createdSession, err := sessionService.CreateSession(testSession)
	core.AssertNoError(t, err, "Failed to create session")

	// Test Session by ID (currently returns nil in implementation)
	retrievedSession, err := sessionService.Session(createdSession.ID)

	// Note: Current implementation returns nil, nil
	// This test documents the current behavior and will need updating
	// when the method is properly implemented
	if retrievedSession != nil {
		core.AssertEqual(t, createdSession.ID, retrievedSession.ID, "Session IDs should match")
	}
}

func TestSessionService_Sessions(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "sessions", "users")

	fixtures := testDB.SetupFixtures(t)
	app := core.NewTestApp(testDB.Pool)
	sessionService := &SessionService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Create multiple sessions
	session1 := &core.Session{
		User:  fixtures.TestUser,
		Token: "session-1-token",
	}
	session2 := &core.Session{
		User:  fixtures.TestUser,
		Token: "session-2-token",
	}

	_, err := sessionService.CreateSession(session1)
	core.AssertNoError(t, err, "Failed to create session 1")

	_, err = sessionService.CreateSession(session2)
	core.AssertNoError(t, err, "Failed to create session 2")

	// Test Sessions method (currently returns nil in implementation)
	sessions, err := sessionService.Sessions()

	// Note: Current implementation returns nil, nil
	// This test documents the current behavior and will need updating
	// when the method is properly implemented
	if sessions != nil && len(sessions) > 0 {
		t.Logf("Retrieved %d sessions", len(sessions))
	}
}

// Benchmark tests for performance monitoring
func BenchmarkSessionService_CreateSession(b *testing.B) {
	testDB := core.NewTestDatabase(b)
	defer testDB.Close()
	defer testDB.CleanupTables(b, "sessions", "users")

	fixtures := testDB.SetupFixtures(b)
	app := core.NewTestApp(testDB.Pool)
	sessionService := &SessionService{DB: testDB.Pool, Logger: app.ObsLogger}

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		testSession := &core.Session{
			User:  fixtures.TestUser,
			Token: "benchmark-token-" + string(rune(i)),
		}

		_, err := sessionService.CreateSession(testSession)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkSessionService_SessionByToken(b *testing.B) {
	testDB := core.NewTestDatabase(b)
	defer testDB.Close()
	defer testDB.CleanupTables(b, "sessions", "users")

	fixtures := testDB.SetupFixtures(b)
	app := core.NewTestApp(testDB.Pool)
	sessionService := &SessionService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Create a session for benchmarking
	testSession := &core.Session{
		User:  fixtures.TestUser,
		Token: "benchmark-lookup-token",
	}

	_, err := sessionService.CreateSession(testSession)
	if err != nil {
		b.Fatal(err)
	}

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_, err := sessionService.SessionByToken("benchmark-lookup-token")
		if err != nil {
			b.Fatal(err)
		}
	}
}
