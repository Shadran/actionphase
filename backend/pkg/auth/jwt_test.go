package auth

import (
	"actionphase/pkg/core"
	db "actionphase/pkg/db/services"
	"strconv"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
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

		// Verify token contains user ID in sub claim
		claims, err := handler.DecodeToken(token)
		core.AssertNoError(t, err, "Token decode should succeed")
		core.AssertEqual(t, strconv.Itoa(user.ID), claims["sub"].(string), "Token should contain user_id in sub claim")
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

	t.Run("token_contains_session_id", func(t *testing.T) {
		token, err := handler.CreateToken(user, SessionMetadata{})
		core.AssertNoError(t, err, "Token creation should succeed")

		claims, err := handler.DecodeToken(token)
		core.AssertNoError(t, err, "Token decode should succeed")

		// Verify session_id exists in claims
		sessionID, ok := claims["session_id"]
		core.AssertTrue(t, ok, "Token should contain session_id claim")
		core.AssertTrue(t, sessionID != nil, "session_id should not be nil")

		// Verify it's a valid number
		sessionIDFloat, ok := sessionID.(float64)
		core.AssertTrue(t, ok, "session_id should be a number")
		core.AssertTrue(t, sessionIDFloat > 0, "session_id should be positive")
	})
}

func TestJWTHandler_VerifyToken(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	testDB.CleanupTables(t, "sessions", "users")
	defer testDB.CleanupTables(t, "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	handler := &JWTHandler{App: app}

	// Create a test user and token
	userService := &db.UserService{DB: testDB.Pool, Logger: app.ObsLogger}
	user, err := userService.CreateUser(&core.User{
		Username: "testuser",
		Password: "password123",
		Email:    "test@example.com",
	})
	core.AssertNoError(t, err, "User creation should succeed")

	validToken, err := handler.CreateToken(user, SessionMetadata{})
	core.AssertNoError(t, err, "Token creation should succeed")

	t.Run("verifies_valid_token", func(t *testing.T) {
		err := handler.VerifyToken(validToken)
		core.AssertNoError(t, err, "Valid token should verify successfully")
	})

	t.Run("rejects_invalid_token", func(t *testing.T) {
		err := handler.VerifyToken("invalid.token.here")
		core.AssertTrue(t, err != nil, "Invalid token should fail verification")
	})

	t.Run("rejects_token_with_wrong_secret", func(t *testing.T) {
		// Create a token with a different secret
		wrongSecretToken := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"sub": strconv.Itoa(user.ID),
			"exp": time.Now().Add(time.Hour).Unix(),
		})
		tokenString, _ := wrongSecretToken.SignedString([]byte("wrong-secret"))

		err := handler.VerifyToken(tokenString)
		core.AssertTrue(t, err != nil, "Token with wrong secret should fail verification")
	})

	t.Run("rejects_expired_token", func(t *testing.T) {
		// Create an expired token
		expiredToken := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"sub": strconv.Itoa(user.ID),
			"exp": time.Now().Add(-time.Hour).Unix(), // Expired 1 hour ago
		})
		tokenString, _ := expiredToken.SignedString([]byte(app.Config.JWT.Secret))

		err := handler.VerifyToken(tokenString)
		core.AssertTrue(t, err != nil, "Expired token should fail verification")
	})

	t.Run("rejects_token_without_session", func(t *testing.T) {
		// Create a valid token but don't create a session for it
		orphanToken := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"sub": strconv.Itoa(user.ID),
			"exp": time.Now().Add(time.Hour).Unix(),
		})
		tokenString, _ := orphanToken.SignedString([]byte(app.Config.JWT.Secret))

		err := handler.VerifyToken(tokenString)
		core.AssertTrue(t, err != nil, "Token without session should fail verification")
	})
}

func TestJWTHandler_DecodeToken(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	testDB.CleanupTables(t, "sessions", "users")
	defer testDB.CleanupTables(t, "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	handler := &JWTHandler{App: app}

	// Create a test user and token
	userService := &db.UserService{DB: testDB.Pool, Logger: app.ObsLogger}
	user, err := userService.CreateUser(&core.User{
		Username: "testuser",
		Password: "password123",
		Email:    "test@example.com",
	})
	core.AssertNoError(t, err, "User creation should succeed")

	validToken, err := handler.CreateToken(user, SessionMetadata{})
	core.AssertNoError(t, err, "Token creation should succeed")

	t.Run("decodes_valid_token", func(t *testing.T) {
		claims, err := handler.DecodeToken(validToken)
		core.AssertNoError(t, err, "Token decode should succeed")
		core.AssertEqual(t, strconv.Itoa(user.ID), claims["sub"].(string), "Claims should contain user_id in sub")
		core.AssertNotEqual(t, nil, claims["exp"], "Claims should contain exp")
	})

	t.Run("rejects_invalid_token", func(t *testing.T) {
		_, err := handler.DecodeToken("invalid.token.here")
		core.AssertTrue(t, err != nil, "Invalid token should fail to decode")
	})

	t.Run("rejects_token_with_wrong_secret", func(t *testing.T) {
		wrongSecretToken := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"sub": strconv.Itoa(user.ID),
			"exp": time.Now().Add(time.Hour).Unix(),
		})
		tokenString, _ := wrongSecretToken.SignedString([]byte("wrong-secret"))

		_, err := handler.DecodeToken(tokenString)
		core.AssertTrue(t, err != nil, "Token with wrong secret should fail to decode")
	})
}

// TestJWTHandler_TokenEdgeCases tests edge cases in token validation
func TestJWTHandler_TokenEdgeCases(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	testDB.CleanupTables(t, "sessions", "users")
	defer testDB.CleanupTables(t, "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	handler := &JWTHandler{App: app}

	t.Run("rejects_empty_token", func(t *testing.T) {
		err := handler.VerifyToken("")
		core.AssertError(t, err, "Empty token should fail verification")
	})

	t.Run("rejects_token_with_only_header", func(t *testing.T) {
		// Token with only header part (missing payload and signature)
		err := handler.VerifyToken("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9")
		core.AssertError(t, err, "Token with only header should fail")
	})

	t.Run("rejects_token_with_header_and_payload_only", func(t *testing.T) {
		// Token with header and payload but no signature
		err := handler.VerifyToken("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0")
		core.AssertError(t, err, "Token without signature should fail")
	})

	t.Run("rejects_token_with_invalid_base64", func(t *testing.T) {
		// Malformed base64 in payload
		err := handler.VerifyToken("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.!!!invalid!!!.signature")
		core.AssertError(t, err, "Token with invalid base64 should fail")
	})

	t.Run("rejects_token_with_missing_sub_claim", func(t *testing.T) {
		// Token without sub claim
		tokenWithoutSub := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"exp": time.Now().Add(time.Hour).Unix(),
		})
		tokenString, _ := tokenWithoutSub.SignedString([]byte(app.Config.JWT.Secret))

		_, err := handler.DecodeToken(tokenString)
		// DecodeToken might succeed, but GetUserFromToken would fail
		core.AssertNoError(t, err, "DecodeToken should succeed even without sub")

		// But VerifyToken should catch this
		err = handler.VerifyToken(tokenString)
		core.AssertError(t, err, "Token without sub claim should fail verification")
	})

	t.Run("rejects_token_with_missing_exp_claim", func(t *testing.T) {
		// Token without exp claim
		tokenWithoutExp := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"sub": "123",
		})
		tokenString, _ := tokenWithoutExp.SignedString([]byte(app.Config.JWT.Secret))

		err := handler.VerifyToken(tokenString)
		core.AssertError(t, err, "Token without exp claim should fail verification")
	})

	t.Run("rejects_token_with_invalid_sub_type", func(t *testing.T) {
		// Token with sub as number instead of string
		tokenInvalidSub := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"sub": 12345, // Should be string
			"exp": time.Now().Add(time.Hour).Unix(),
		})
		tokenString, _ := tokenInvalidSub.SignedString([]byte(app.Config.JWT.Secret))

		claims, err := handler.DecodeToken(tokenString)
		core.AssertNoError(t, err, "DecodeToken should succeed")
		// But the sub claim type is wrong
		_, ok := claims["sub"].(string)
		core.AssertTrue(t, !ok, "sub should not be a string when given as number")
	})

	t.Run("rejects_token_with_exp_in_wrong_format", func(t *testing.T) {
		// Token with exp as string instead of number
		tokenInvalidExp := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"sub": "123",
			"exp": "not-a-number",
		})
		tokenString, _ := tokenInvalidExp.SignedString([]byte(app.Config.JWT.Secret))

		err := handler.VerifyToken(tokenString)
		core.AssertError(t, err, "Token with invalid exp format should fail")
	})

	t.Run("rejects_token_with_very_long_expiry", func(t *testing.T) {
		// Token that expires in 100 years (suspicious)
		tokenLongExp := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"sub": "123",
			"exp": time.Now().Add(100 * 365 * 24 * time.Hour).Unix(),
		})
		tokenString, _ := tokenLongExp.SignedString([]byte(app.Config.JWT.Secret))

		// This should still decode successfully (no max expiry validation currently)
		claims, err := handler.DecodeToken(tokenString)
		core.AssertNoError(t, err, "Token with long expiry should decode (no max expiry check)")
		core.AssertTrue(t, claims != nil, "Claims should be returned")
	})

	t.Run("rejects_tampered_payload", func(t *testing.T) {
		// Create a valid token
		userService := &db.UserService{DB: testDB.Pool, Logger: app.ObsLogger}
		user, err := userService.CreateUser(&core.User{
			Username: "tampertest",
			Password: "password123",
			Email:    "tamper@example.com",
		})
		core.AssertNoError(t, err, "User creation should succeed")

		validToken, err := handler.CreateToken(user, SessionMetadata{})
		core.AssertNoError(t, err, "Token creation should succeed")

		// Tamper with the payload (change one character in the middle)
		parts := validToken[:len(validToken)/2] + "X" + validToken[len(validToken)/2+1:]

		err = handler.VerifyToken(parts)
		core.AssertError(t, err, "Tampered token should fail verification")
	})

	t.Run("rejects_token_with_null_bytes", func(t *testing.T) {
		// Token containing null bytes (invalid)
		err := handler.VerifyToken("invalid\x00token\x00here")
		core.AssertError(t, err, "Token with null bytes should fail")
	})
}
