package auth

import (
	"actionphase/pkg/core"
	db "actionphase/pkg/db/services"
	"bytes"
	"context"
	"encoding/json"
	"net/http/httptest"
	"testing"
	"time"
)

// TestSecurityChecks_IPBanBlocksLogin verifies that a banned IP cannot log in.
func TestSecurityChecks_IPBanBlocksLogin(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "ip_bans", "fingerprint_bans", "registration_attempts", "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupAuthAPITestRouter(app, testDB)

	userService := &db.UserService{DB: testDB.Pool, Logger: app.ObsLogger}
	user := &core.User{Username: "ipbanned", Email: "ipbanned@example.com", Password: "testpassword123"}
	_, err := userService.CreateUser(user)
	core.AssertNoError(t, err, "Should create user")

	// Insert an IP ban for the test client IP (httptest uses 192.0.2.1 via X-Real-IP; actual is "")
	// The handler uses core.GetClientIP which falls back to RemoteAddr "192.0.2.1:1234"
	ctx := context.Background()
	_, err = testDB.Pool.Exec(ctx,
		"INSERT INTO ip_bans (ip_address, created_by, reason) VALUES ($1, (SELECT id FROM users LIMIT 1), 'test ban')",
		"192.0.2.1")
	core.AssertNoError(t, err, "Should insert IP ban")

	payload, _ := json.Marshal(map[string]interface{}{
		"username": "ipbanned",
		"password": "testpassword123",
	})
	req := httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewBuffer(payload))
	req.Header.Set("Content-Type", "application/json")
	req.RemoteAddr = "192.0.2.1:1234"
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	core.AssertEqual(t, 403, w.Code, "Banned IP should receive 403")
}

// TestSecurityChecks_ExpiredIPBanDoesNotBlock verifies that an expired IP ban is not enforced.
func TestSecurityChecks_ExpiredIPBanDoesNotBlock(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "ip_bans", "fingerprint_bans", "registration_attempts", "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupAuthAPITestRouter(app, testDB)

	userService := &db.UserService{DB: testDB.Pool, Logger: app.ObsLogger}
	user := &core.User{Username: "expiredban", Email: "expiredban@example.com", Password: "testpassword123"}
	_, err := userService.CreateUser(user)
	core.AssertNoError(t, err, "Should create user")

	ctx := context.Background()
	expiredAt := time.Now().Add(-1 * time.Hour)
	_, err = testDB.Pool.Exec(ctx,
		"INSERT INTO ip_bans (ip_address, created_by, reason, expires_at) VALUES ($1, (SELECT id FROM users LIMIT 1), 'expired ban', $2)",
		"192.0.2.1", expiredAt)
	core.AssertNoError(t, err, "Should insert expired IP ban")

	payload, _ := json.Marshal(map[string]interface{}{
		"username": "expiredban",
		"password": "testpassword123",
	})
	req := httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewBuffer(payload))
	req.Header.Set("Content-Type", "application/json")
	req.RemoteAddr = "192.0.2.1:1234"
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	core.AssertEqual(t, 200, w.Code, "Expired IP ban should not block login")
}

// TestSecurityChecks_FingerprintBanBlocksLogin verifies that a banned fingerprint cannot log in.
func TestSecurityChecks_FingerprintBanBlocksLogin(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "ip_bans", "fingerprint_bans", "registration_attempts", "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupAuthAPITestRouter(app, testDB)

	userService := &db.UserService{DB: testDB.Pool, Logger: app.ObsLogger}
	user := &core.User{Username: "fpbanned", Email: "fpbanned@example.com", Password: "testpassword123"}
	_, err := userService.CreateUser(user)
	core.AssertNoError(t, err, "Should create user")

	ctx := context.Background()
	bannedFP := "abc123fingerprint"
	_, err = testDB.Pool.Exec(ctx,
		"INSERT INTO fingerprint_bans (fingerprint, created_by, reason) VALUES ($1, (SELECT id FROM users LIMIT 1), 'test ban')",
		bannedFP)
	core.AssertNoError(t, err, "Should insert fingerprint ban")

	payload, _ := json.Marshal(map[string]interface{}{
		"username":    "fpbanned",
		"password":    "testpassword123",
		"fingerprint": bannedFP,
	})
	req := httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewBuffer(payload))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	core.AssertEqual(t, 403, w.Code, "Banned fingerprint should receive 403")
}

// TestSecurityChecks_PendingApprovalBlocksLogin verifies that a pending-approval user cannot log in.
func TestSecurityChecks_PendingApprovalBlocksLogin(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "ip_bans", "fingerprint_bans", "registration_attempts", "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupAuthAPITestRouter(app, testDB)

	userService := &db.UserService{DB: testDB.Pool, Logger: app.ObsLogger}
	user := &core.User{Username: "pendinguser", Email: "pending@example.com", Password: "testpassword123"}
	createdUser, err := userService.CreateUser(user)
	core.AssertNoError(t, err, "Should create user")

	ctx := context.Background()
	err = userService.SetPendingApproval(ctx, int32(createdUser.ID))
	core.AssertNoError(t, err, "Should set pending approval")

	payload, _ := json.Marshal(map[string]interface{}{
		"username": "pendinguser",
		"password": "testpassword123",
	})
	req := httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewBuffer(payload))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	core.AssertEqual(t, 403, w.Code, "Pending-approval user should receive 403")
}

// TestSecurityChecks_ApprovedUserCanLogin verifies that an approved user can log in.
func TestSecurityChecks_ApprovedUserCanLogin(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "ip_bans", "fingerprint_bans", "registration_attempts", "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupAuthAPITestRouter(app, testDB)

	userService := &db.UserService{DB: testDB.Pool, Logger: app.ObsLogger}
	user := &core.User{Username: "approveduser", Email: "approved@example.com", Password: "testpassword123"}
	createdUser, err := userService.CreateUser(user)
	core.AssertNoError(t, err, "Should create user")

	ctx := context.Background()
	err = userService.SetPendingApproval(ctx, int32(createdUser.ID))
	core.AssertNoError(t, err, "Should set pending approval")
	err = userService.ApproveUser(ctx, int32(createdUser.ID))
	core.AssertNoError(t, err, "Should approve user")

	payload, _ := json.Marshal(map[string]interface{}{
		"username": "approveduser",
		"password": "testpassword123",
	})
	req := httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewBuffer(payload))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	core.AssertEqual(t, 200, w.Code, "Approved user should be able to log in")
}

// TestSecurityChecks_RegistrationApprovalMode verifies that registration returns 202 when
// RequireRegistrationApproval is enabled, and the user cannot log in until approved.
func TestSecurityChecks_RegistrationApprovalMode(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "ip_bans", "fingerprint_bans", "registration_attempts", "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	app.Config.App.RequireRegistrationApproval = true
	router := setupAuthAPITestRouter(app, testDB)

	// Register a new user
	payload, _ := json.Marshal(map[string]interface{}{
		"username": "newpendinguser",
		"email":    "newpending@example.com",
		"password": "testpassword123",
	})
	req := httptest.NewRequest("POST", "/api/v1/auth/register", bytes.NewBuffer(payload))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	core.AssertEqual(t, 202, w.Code, "Registration should return 202 Accepted in approval mode")

	// Verify no token is returned
	var regResponse map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &regResponse)
	core.AssertNoError(t, err, "Response should be valid JSON")
	token, hasToken := regResponse["Token"]
	if hasToken && token != "" && token != nil {
		t.Errorf("No token should be issued for pending user, got: %v", token)
	}

	// Verify login is blocked
	loginPayload, _ := json.Marshal(map[string]interface{}{
		"username": "newpendinguser",
		"password": "testpassword123",
	})
	req2 := httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewBuffer(loginPayload))
	req2.Header.Set("Content-Type", "application/json")
	w2 := httptest.NewRecorder()
	router.ServeHTTP(w2, req2)

	core.AssertEqual(t, 403, w2.Code, "Pending user should not be able to log in")
}

// TestSecurityChecks_FingerprintBanBlocksRegistration verifies that a banned fingerprint cannot register.
func TestSecurityChecks_FingerprintBanBlocksRegistration(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "ip_bans", "fingerprint_bans", "registration_attempts", "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupAuthAPITestRouter(app, testDB)

	ctx := context.Background()
	bannedFP := "registrationblockedfingerprint"
	_, err := testDB.Pool.Exec(ctx,
		"INSERT INTO fingerprint_bans (fingerprint, created_by, reason) VALUES ($1, (SELECT id FROM users LIMIT 1), 'test ban')",
		bannedFP)
	// If there's no user with id=1, insert one first
	if err != nil {
		_, _ = testDB.Pool.Exec(ctx, "INSERT INTO users (username, email, password) VALUES ('admin', 'admin@example.com', 'x') ON CONFLICT DO NOTHING")
		_, err = testDB.Pool.Exec(ctx,
			"INSERT INTO fingerprint_bans (fingerprint, created_by, reason) VALUES ($1, (SELECT id FROM users LIMIT 1), 'test ban')",
			bannedFP)
		core.AssertNoError(t, err, "Should insert fingerprint ban")
	}

	payload, _ := json.Marshal(map[string]interface{}{
		"username":    "bannedregfpuser",
		"email":       "bannedregfp@example.com",
		"password":    "testpassword123",
		"fingerprint": bannedFP,
	})
	req := httptest.NewRequest("POST", "/api/v1/auth/register", bytes.NewBuffer(payload))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	core.AssertEqual(t, 403, w.Code, "Banned fingerprint should receive 403 on registration")
}

// TestSecurityChecks_IPBanBlocksRegistration verifies that a banned IP cannot register.
func TestSecurityChecks_IPBanBlocksRegistration(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "ip_bans", "fingerprint_bans", "registration_attempts", "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupAuthAPITestRouter(app, testDB)

	ctx := context.Background()
	_, err := testDB.Pool.Exec(ctx,
		"INSERT INTO ip_bans (ip_address, created_by, reason) VALUES ($1, 1, 'test ban')",
		"192.0.2.1")
	// If there's no user with id=1, insert one first
	if err != nil {
		_, _ = testDB.Pool.Exec(ctx, "INSERT INTO users (username, email, password) VALUES ('admin', 'admin@example.com', 'x') ON CONFLICT DO NOTHING")
		_, err = testDB.Pool.Exec(ctx,
			"INSERT INTO ip_bans (ip_address, created_by, reason) VALUES ($1, (SELECT id FROM users LIMIT 1), 'test ban')",
			"192.0.2.1")
		core.AssertNoError(t, err, "Should insert IP ban")
	}

	payload, _ := json.Marshal(map[string]interface{}{
		"username": "bannedreguser",
		"email":    "bannedreguser@example.com",
		"password": "testpassword123",
	})
	req := httptest.NewRequest("POST", "/api/v1/auth/register", bytes.NewBuffer(payload))
	req.Header.Set("Content-Type", "application/json")
	req.RemoteAddr = "192.0.2.1:1234"
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	core.AssertEqual(t, 403, w.Code, "Banned IP should receive 403 on registration")
}
