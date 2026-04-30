package db

import (
	"actionphase/pkg/core"
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUserService_CreateUser(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)
	service := &UserService{DB: testDB.Pool, Logger: app.ObsLogger}

	t.Run("creates user successfully", func(t *testing.T) {
		defer testDB.CleanupTables(t, "users")

		user := &core.User{
			Username: "testuser",
			Password: "password123",
			Email:    "test@example.com",
		}

		created, err := service.CreateUser(user)
		require.NoError(t, err)
		require.NotNil(t, created)

		assert.Greater(t, created.ID, 0)
		assert.Equal(t, "testuser", created.Username)
		assert.Equal(t, "test@example.com", created.Email)
		assert.NotNil(t, created.CreatedAt)

		// Password should be hashed (not the original password)
		assert.NotEqual(t, "password123", user.Password)
		assert.NotEmpty(t, user.Password) // Should contain bcrypt hash
	})

	t.Run("hashes password before storing", func(t *testing.T) {
		defer testDB.CleanupTables(t, "users")

		plainPassword := "password123"
		user := &core.User{
			Username: "hashtest",
			Password: plainPassword,
			Email:    "hash@example.com",
		}

		created, err := service.CreateUser(user)
		require.NoError(t, err)
		assert.NotNil(t, created)

		// The original password in the user object should be hashed
		assert.NotEqual(t, plainPassword, user.Password)
		assert.Greater(t, len(user.Password), 50) // Bcrypt hashes are 60 chars

		// Verify we can retrieve the user and password is hashed
		retrieved, err := service.UserByUsername("hashtest")
		require.NoError(t, err)
		assert.NotEqual(t, plainPassword, retrieved.Password)
		assert.Equal(t, user.Password, retrieved.Password) // Should match the hashed version
	})

	t.Run("returns error for duplicate username", func(t *testing.T) {
		defer testDB.CleanupTables(t, "users")

		user1 := &core.User{
			Username: "duplicate",
			Password: "password123",
			Email:    "user1@example.com",
		}

		_, err := service.CreateUser(user1)
		require.NoError(t, err)

		// Try to create another user with same username
		user2 := &core.User{
			Username: "duplicate",
			Password: "password456",
			Email:    "user2@example.com",
		}

		_, err = service.CreateUser(user2)
		require.Error(t, err)
		// Should contain unique constraint violation message
		assert.Contains(t, err.Error(), "unique constraint")
	})

	t.Run("returns error for duplicate email", func(t *testing.T) {
		defer testDB.CleanupTables(t, "users")

		user1 := &core.User{
			Username: "user1",
			Password: "password123",
			Email:    "duplicate@example.com",
		}

		_, err := service.CreateUser(user1)
		require.NoError(t, err)

		// Try to create another user with same email
		user2 := &core.User{
			Username: "user2",
			Password: "password456",
			Email:    "duplicate@example.com",
		}

		_, err = service.CreateUser(user2)
		require.Error(t, err)
		// Should contain unique constraint violation message
		assert.Contains(t, err.Error(), "unique constraint")
	})
}

func TestUserService_UserByUsername(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)
	service := &UserService{DB: testDB.Pool, Logger: app.ObsLogger}

	t.Run("retrieves user by username", func(t *testing.T) {
		defer testDB.CleanupTables(t, "users")

		// Create a user
		created := &core.User{
			Username: "findme",
			Password: "password123",
			Email:    "findme@example.com",
		}

		_, err := service.CreateUser(created)
		require.NoError(t, err)

		// Retrieve by username
		retrieved, err := service.UserByUsername("findme")
		require.NoError(t, err)
		require.NotNil(t, retrieved)

		assert.Equal(t, "findme", retrieved.Username)
		assert.Equal(t, "findme@example.com", retrieved.Email)
		assert.NotEmpty(t, retrieved.Password) // Should have hashed password
		assert.NotNil(t, retrieved.CreatedAt)
	})

	t.Run("returns error for non-existent username", func(t *testing.T) {
		defer testDB.CleanupTables(t, "users")

		user, err := service.UserByUsername("doesnotexist")
		assert.Error(t, err)
		assert.Nil(t, user)
	})

	t.Run("username lookup is case-insensitive but stores original casing", func(t *testing.T) {
		defer testDB.CleanupTables(t, "users")

		// Create a user with mixed casing
		created := &core.User{
			Username: "CaseSensitive",
			Password: "password123",
			Email:    "case@example.com",
		}

		_, err := service.CreateUser(created)
		require.NoError(t, err)

		// Should find with exact case
		found, err := service.UserByUsername("CaseSensitive")
		require.NoError(t, err)
		assert.Equal(t, "CaseSensitive", found.Username) // stored casing preserved

		// Should also find with all-lowercase
		foundLower, err := service.UserByUsername("casesensitive")
		require.NoError(t, err)
		assert.Equal(t, "CaseSensitive", foundLower.Username) // stored casing returned

		// Should also find with all-uppercase
		foundUpper, err := service.UserByUsername("CASESENSITIVE")
		require.NoError(t, err)
		assert.Equal(t, "CaseSensitive", foundUpper.Username)
	})

	t.Run("email lookup is case-insensitive", func(t *testing.T) {
		defer testDB.CleanupTables(t, "users")

		created := &core.User{
			Username: "emailtest",
			Password: "password123",
			Email:    "User@Example.COM",
		}

		_, err := service.CreateUser(created)
		require.NoError(t, err)

		// Should find with any email casing
		found, err := service.UserByEmail("user@example.com")
		require.NoError(t, err)
		assert.Equal(t, "emailtest", found.Username)

		found2, err := service.UserByEmail("USER@EXAMPLE.COM")
		require.NoError(t, err)
		assert.Equal(t, "emailtest", found2.Username)
	})

	t.Run("email is stored normalized to lowercase", func(t *testing.T) {
		defer testDB.CleanupTables(t, "users")

		created := &core.User{
			Username: "normtest",
			Password: "password123",
			Email:    "Mixed@Example.COM",
		}

		result, err := service.CreateUser(created)
		require.NoError(t, err)
		assert.Equal(t, "mixed@example.com", result.Email)
	})
}

func TestUserService_User(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)
	service := &UserService{DB: testDB.Pool, Logger: app.ObsLogger}

	t.Run("returns error for non-existent user", func(t *testing.T) {
		defer testDB.CleanupTables(t, "users")

		// Try to get a non-existent user
		user, err := service.User(99999)
		assert.Nil(t, user)
		assert.Error(t, err) // Should return "no rows in result set" error
	})
}

func TestUserService_Users(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)
	service := &UserService{DB: testDB.Pool, Logger: app.ObsLogger}

	t.Run("stub implementation returns nil", func(t *testing.T) {
		// This function is currently a stub that returns nil, nil
		users, err := service.Users()
		assert.Nil(t, users)
		assert.Nil(t, err)
	})
}

func TestUserService_DeleteUser(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)
	service := &UserService{DB: testDB.Pool, Logger: app.ObsLogger}

	t.Run("stub implementation returns nil", func(t *testing.T) {
		// This function is currently a stub that returns nil
		err := service.DeleteUser(1)
		assert.Nil(t, err)
	})
}

func TestUserService_IntegrationWorkflow(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)
	service := &UserService{DB: testDB.Pool, Logger: app.ObsLogger}

	t.Run("complete user lifecycle", func(t *testing.T) {
		defer testDB.CleanupTables(t, "users")

		// Create multiple users
		users := []*core.User{
			{
				Username: "alice",
				Password: "alicepass",
				Email:    "alice@example.com",
			},
			{
				Username: "bob",
				Password: "bobpass",
				Email:    "bob@example.com",
			},
			{
				Username: "charlie",
				Password: "charliepass",
				Email:    "charlie@example.com",
			},
		}

		for _, u := range users {
			created, err := service.CreateUser(u)
			require.NoError(t, err)
			assert.Greater(t, created.ID, 0)
		}

		// Retrieve each user by username
		alice, err := service.UserByUsername("alice")
		require.NoError(t, err)
		assert.Equal(t, "alice@example.com", alice.Email)

		bob, err := service.UserByUsername("bob")
		require.NoError(t, err)
		assert.Equal(t, "bob@example.com", bob.Email)

		charlie, err := service.UserByUsername("charlie")
		require.NoError(t, err)
		assert.Equal(t, "charlie@example.com", charlie.Email)

		// Verify all have different IDs
		assert.NotEqual(t, alice.ID, bob.ID)
		assert.NotEqual(t, bob.ID, charlie.ID)
		assert.NotEqual(t, alice.ID, charlie.ID)

		// Verify all passwords are hashed and different
		assert.NotEqual(t, alice.Password, bob.Password)
		assert.NotEqual(t, bob.Password, charlie.Password)
	})
}

func TestUserService_SetAdminStatus(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)
	service := &UserService{DB: testDB.Pool, Logger: app.ObsLogger}

	t.Run("grants admin status successfully", func(t *testing.T) {
		defer testDB.CleanupTables(t, "users")

		// Create an admin user
		admin := &core.User{
			Username: "admin",
			Password: "adminpass",
			Email:    "admin@example.com",
		}
		createdAdmin, err := service.CreateUser(admin)
		require.NoError(t, err)

		// Make them admin manually in the database (bootstrap scenario)
		ctx := context.Background()
		_, err = testDB.Pool.Exec(ctx, "UPDATE users SET is_admin = TRUE WHERE id = $1", createdAdmin.ID)
		require.NoError(t, err)

		// Create a regular user
		user := &core.User{
			Username: "regular",
			Password: "password123",
			Email:    "regular@example.com",
		}
		createdUser, err := service.CreateUser(user)
		require.NoError(t, err)

		// Grant admin status
		err = service.SetAdminStatus(ctx, int32(createdUser.ID), true, int32(createdAdmin.ID))
		require.NoError(t, err)

		// Verify user is now admin
		admins, err := service.ListAdmins(ctx)
		require.NoError(t, err)
		assert.Len(t, admins, 2)
	})

	t.Run("revokes admin status successfully", func(t *testing.T) {
		defer testDB.CleanupTables(t, "users")

		// Create an admin user
		admin := &core.User{
			Username: "admin",
			Password: "adminpass",
			Email:    "admin@example.com",
		}
		createdAdmin, err := service.CreateUser(admin)
		require.NoError(t, err)

		// Make them admin manually in the database (bootstrap scenario)
		ctx := context.Background()
		_, err = testDB.Pool.Exec(ctx, "UPDATE users SET is_admin = TRUE WHERE id = $1", createdAdmin.ID)
		require.NoError(t, err)

		// Verify admin status was granted
		admins, err := service.ListAdmins(ctx)
		require.NoError(t, err)
		assert.Len(t, admins, 1)

		// Revoke admin status
		err = service.SetAdminStatus(ctx, int32(createdAdmin.ID), false, int32(createdAdmin.ID))
		require.NoError(t, err)

		// Verify admin status was revoked
		admins, err = service.ListAdmins(ctx)
		require.NoError(t, err)
		assert.Len(t, admins, 0)
	})

	t.Run("rejects non-admin attempting to grant admin status", func(t *testing.T) {
		defer testDB.CleanupTables(t, "users")

		// Create two regular users
		user1 := &core.User{
			Username: "user1",
			Password: "password123",
			Email:    "user1@example.com",
		}
		createdUser1, err := service.CreateUser(user1)
		require.NoError(t, err)

		user2 := &core.User{
			Username: "user2",
			Password: "password456",
			Email:    "user2@example.com",
		}
		createdUser2, err := service.CreateUser(user2)
		require.NoError(t, err)

		// Try to grant admin status without being admin
		ctx := context.Background()
		err = service.SetAdminStatus(ctx, int32(createdUser2.ID), true, int32(createdUser1.ID))
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "Unauthorized")
	})
}

func TestUserService_ListAdmins(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)
	service := &UserService{DB: testDB.Pool, Logger: app.ObsLogger}

	t.Run("lists all admin users", func(t *testing.T) {
		defer testDB.CleanupTables(t, "users")

		ctx := context.Background()

		// Create multiple users
		admin1 := &core.User{
			Username: "admin1",
			Password: "password123",
			Email:    "admin1@example.com",
		}
		createdAdmin1, err := service.CreateUser(admin1)
		require.NoError(t, err)

		admin2 := &core.User{
			Username: "admin2",
			Password: "password123",
			Email:    "admin2@example.com",
		}
		createdAdmin2, err := service.CreateUser(admin2)
		require.NoError(t, err)

		regularUser := &core.User{
			Username: "regular",
			Password: "password123",
			Email:    "regular@example.com",
		}
		_, err = service.CreateUser(regularUser)
		require.NoError(t, err)

		// Make first user admin manually in the database (bootstrap scenario)
		_, err = testDB.Pool.Exec(ctx, "UPDATE users SET is_admin = TRUE WHERE id = $1", createdAdmin1.ID)
		require.NoError(t, err)

		// Grant admin status to second user using the service
		err = service.SetAdminStatus(ctx, int32(createdAdmin2.ID), true, int32(createdAdmin1.ID))
		require.NoError(t, err)

		// List admins
		admins, err := service.ListAdmins(ctx)
		require.NoError(t, err)
		assert.Len(t, admins, 2)

		// Verify correct users are in the list
		usernames := []string{admins[0].Username, admins[1].Username}
		assert.Contains(t, usernames, "admin1")
		assert.Contains(t, usernames, "admin2")
	})

	t.Run("returns empty list when no admins exist", func(t *testing.T) {
		defer testDB.CleanupTables(t, "users")

		// Create a regular user
		user := &core.User{
			Username: "regular",
			Password: "password123",
			Email:    "regular@example.com",
		}
		_, err := service.CreateUser(user)
		require.NoError(t, err)

		ctx := context.Background()
		admins, err := service.ListAdmins(ctx)
		require.NoError(t, err)
		assert.Len(t, admins, 0)
	})
}

func TestUserService_BanUser(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)
	service := &UserService{DB: testDB.Pool, Logger: app.ObsLogger}

	t.Run("bans user successfully", func(t *testing.T) {
		defer testDB.CleanupTables(t, "users")

		ctx := context.Background()

		// Create admin user
		admin := &core.User{
			Username: "admin",
			Password: "adminpass",
			Email:    "admin@example.com",
		}
		createdAdmin, err := service.CreateUser(admin)
		require.NoError(t, err)

		// Create regular user
		user := &core.User{
			Username: "regular",
			Password: "password123",
			Email:    "regular@example.com",
		}
		createdUser, err := service.CreateUser(user)
		require.NoError(t, err)

		// Ban the user
		err = service.BanUser(ctx, int32(createdUser.ID), int32(createdAdmin.ID))
		require.NoError(t, err)

		// Verify user is banned
		banned, err := service.CheckUserBanned(ctx, int32(createdUser.ID))
		require.NoError(t, err)
		assert.True(t, banned)

		// Verify user appears in banned list
		bannedUsers, err := service.ListBannedUsers(ctx)
		require.NoError(t, err)
		assert.Len(t, bannedUsers, 1)
		assert.Equal(t, "regular", bannedUsers[0].Username)
		assert.Equal(t, int32(createdAdmin.ID), bannedUsers[0].BannedByUserID)
	})

	t.Run("rejects admin banning themselves", func(t *testing.T) {
		defer testDB.CleanupTables(t, "users")

		ctx := context.Background()

		// Create admin user
		admin := &core.User{
			Username: "admin",
			Password: "adminpass",
			Email:    "admin@example.com",
		}
		createdAdmin, err := service.CreateUser(admin)
		require.NoError(t, err)

		// Try to ban themselves
		err = service.BanUser(ctx, int32(createdAdmin.ID), int32(createdAdmin.ID))
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "Cannot ban yourself")
	})
}

func TestUserService_UnbanUser(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)
	service := &UserService{DB: testDB.Pool, Logger: app.ObsLogger}

	t.Run("unbans user successfully", func(t *testing.T) {
		defer testDB.CleanupTables(t, "users")

		ctx := context.Background()

		// Create admin and user
		admin := &core.User{
			Username: "admin",
			Password: "adminpass",
			Email:    "admin@example.com",
		}
		createdAdmin, err := service.CreateUser(admin)
		require.NoError(t, err)

		user := &core.User{
			Username: "regular",
			Password: "password123",
			Email:    "regular@example.com",
		}
		createdUser, err := service.CreateUser(user)
		require.NoError(t, err)

		// Ban the user
		err = service.BanUser(ctx, int32(createdUser.ID), int32(createdAdmin.ID))
		require.NoError(t, err)

		// Verify user is banned
		banned, err := service.CheckUserBanned(ctx, int32(createdUser.ID))
		require.NoError(t, err)
		assert.True(t, banned)

		// Unban the user
		err = service.UnbanUser(ctx, int32(createdUser.ID))
		require.NoError(t, err)

		// Verify user is no longer banned
		banned, err = service.CheckUserBanned(ctx, int32(createdUser.ID))
		require.NoError(t, err)
		assert.False(t, banned)

		// Verify user no longer in banned list
		bannedUsers, err := service.ListBannedUsers(ctx)
		require.NoError(t, err)
		assert.Len(t, bannedUsers, 0)
	})
}

func TestUserService_CheckUserBanned(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)
	service := &UserService{DB: testDB.Pool, Logger: app.ObsLogger}

	t.Run("returns false for non-banned user", func(t *testing.T) {
		defer testDB.CleanupTables(t, "users")

		user := &core.User{
			Username: "regular",
			Password: "password123",
			Email:    "regular@example.com",
		}
		createdUser, err := service.CreateUser(user)
		require.NoError(t, err)

		ctx := context.Background()
		banned, err := service.CheckUserBanned(ctx, int32(createdUser.ID))
		require.NoError(t, err)
		assert.False(t, banned)
	})

	t.Run("returns true for banned user", func(t *testing.T) {
		defer testDB.CleanupTables(t, "users")

		ctx := context.Background()

		admin := &core.User{
			Username: "admin",
			Password: "adminpass",
			Email:    "admin@example.com",
		}
		createdAdmin, err := service.CreateUser(admin)
		require.NoError(t, err)

		user := &core.User{
			Username: "regular",
			Password: "password123",
			Email:    "regular@example.com",
		}
		createdUser, err := service.CreateUser(user)
		require.NoError(t, err)

		err = service.BanUser(ctx, int32(createdUser.ID), int32(createdAdmin.ID))
		require.NoError(t, err)

		banned, err := service.CheckUserBanned(ctx, int32(createdUser.ID))
		require.NoError(t, err)
		assert.True(t, banned)
	})
}

// TestUserService_SearchUsers verifies that the case-insensitive partial-match search
// returns matching users and excludes non-matching ones. Silent failure here means
// GM/admin user-search flows return empty results.
func TestUserService_SearchUsers(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "users")

	ctx := context.Background()
	app := core.NewTestApp(testDB.Pool)
	service := &UserService{DB: testDB.Pool, Logger: app.ObsLogger}

	_, err := service.CreateUser(&core.User{Username: "alice_gamer", Password: "pass", Email: "alice@example.com"})
	require.NoError(t, err)
	_, err = service.CreateUser(&core.User{Username: "bob_plays", Password: "pass", Email: "bob@example.com"})
	require.NoError(t, err)
	_, err = service.CreateUser(&core.User{Username: "charlie", Password: "pass", Email: "charlie@example.com"})
	require.NoError(t, err)

	t.Run("returns matching users for partial query", func(t *testing.T) {
		results, err := service.SearchUsers(ctx, "gamer")
		require.NoError(t, err)
		require.Len(t, results, 1)
		assert.Equal(t, "alice_gamer", results[0].Username)
	})

	t.Run("search is case-insensitive", func(t *testing.T) {
		results, err := service.SearchUsers(ctx, "ALICE")
		require.NoError(t, err)
		require.Len(t, results, 1)
		assert.Equal(t, "alice_gamer", results[0].Username)
	})

	t.Run("returns empty slice when no match", func(t *testing.T) {
		results, err := service.SearchUsers(ctx, "zzznomatch")
		require.NoError(t, err)
		assert.Len(t, results, 0)
	})

	t.Run("returns all matching users for broad query", func(t *testing.T) {
		results, err := service.SearchUsers(ctx, "a")
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(results), 2, "should match alice_gamer and charlie at minimum")
	})
}
