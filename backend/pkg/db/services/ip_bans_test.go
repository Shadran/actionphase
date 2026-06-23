package db

import (
	"context"
	"testing"
	"time"

	"actionphase/pkg/core"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestIPBanService_CreateAndList(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "ip_bans", "users")

	app := core.NewTestApp(testDB.Pool)
	svc := &IPBanService{DB: testDB.Pool, Logger: app.ObsLogger}

	admin := testDB.CreateTestUser(t, "ipbansvc_admin", "ipbansvc_admin@example.com")

	t.Run("creates permanent ban and returns it", func(t *testing.T) {
		ban, err := svc.CreateIPBan(context.Background(), "10.0.0.1", "spam", int32(admin.ID), nil, nil)
		require.NoError(t, err)
		require.NotNil(t, ban)
		assert.Equal(t, "10.0.0.1", ban.IPAddress)
		require.NotNil(t, ban.Reason)
		assert.Equal(t, "spam", *ban.Reason)
		assert.Nil(t, ban.ExpiresAt)
		assert.Nil(t, ban.BannedUserID)
	})

	t.Run("creates ban with expiry and user association", func(t *testing.T) {
		target := testDB.CreateTestUser(t, "ipbansvc_target", "ipbansvc_target@example.com")
		targetID := int32(target.ID)
		expires := time.Now().Add(24 * time.Hour)
		ban, err := svc.CreateIPBan(context.Background(), "10.0.0.2", "temp", int32(admin.ID), &expires, &targetID)
		require.NoError(t, err)
		require.NotNil(t, ban.ExpiresAt)
		assert.WithinDuration(t, expires, *ban.ExpiresAt, time.Second)
		require.NotNil(t, ban.BannedUserID)
		assert.Equal(t, targetID, *ban.BannedUserID)
	})

	t.Run("lists created bans", func(t *testing.T) {
		bans, err := svc.ListIPBans(context.Background())
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(bans), 2)
	})
}

// TestIPBanService_IsIPBanned is the critical path: this check gates login.
// If it silently returns false when true, banned IPs can keep accessing the system.
func TestIPBanService_IsIPBanned(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "ip_bans", "users")

	app := core.NewTestApp(testDB.Pool)
	svc := &IPBanService{DB: testDB.Pool, Logger: app.ObsLogger}

	admin := testDB.CreateTestUser(t, "ipcheck_admin", "ipcheck_admin@example.com")

	t.Run("returns false for unknown IP", func(t *testing.T) {
		banned, err := svc.IsIPBanned(context.Background(), "192.168.1.99")
		require.NoError(t, err)
		assert.False(t, banned)
	})

	t.Run("returns true after IP is banned", func(t *testing.T) {
		_, err := svc.CreateIPBan(context.Background(), "192.168.1.100", "test", int32(admin.ID), nil, nil)
		require.NoError(t, err)

		banned, err := svc.IsIPBanned(context.Background(), "192.168.1.100")
		require.NoError(t, err)
		assert.True(t, banned, "IP must be detected as banned after ban is created")
	})

	t.Run("returns false for different IP when a ban exists", func(t *testing.T) {
		banned, err := svc.IsIPBanned(context.Background(), "192.168.1.101")
		require.NoError(t, err)
		assert.False(t, banned, "ban must not bleed across IP addresses")
	})

	t.Run("returns false for expired ban", func(t *testing.T) {
		pastExpiry := time.Now().Add(-1 * time.Hour)
		_, err := svc.CreateIPBan(context.Background(), "192.168.1.200", "expired", int32(admin.ID), &pastExpiry, nil)
		require.NoError(t, err)

		banned, err := svc.IsIPBanned(context.Background(), "192.168.1.200")
		require.NoError(t, err)
		assert.False(t, banned, "expired ban must not block the IP")
	})
}

func TestIPBanService_DeleteBan(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "ip_bans", "users")

	app := core.NewTestApp(testDB.Pool)
	svc := &IPBanService{DB: testDB.Pool, Logger: app.ObsLogger}

	admin := testDB.CreateTestUser(t, "ipdelete_admin", "ipdelete_admin@example.com")

	ban, err := svc.CreateIPBan(context.Background(), "10.1.1.1", "temp", int32(admin.ID), nil, nil)
	require.NoError(t, err)

	t.Run("IP is banned before deletion", func(t *testing.T) {
		banned, err := svc.IsIPBanned(context.Background(), "10.1.1.1")
		require.NoError(t, err)
		assert.True(t, banned)
	})

	t.Run("deletion removes the ban", func(t *testing.T) {
		err := svc.DeleteIPBan(context.Background(), ban.ID)
		require.NoError(t, err)

		banned, err := svc.IsIPBanned(context.Background(), "10.1.1.1")
		require.NoError(t, err)
		assert.False(t, banned, "IP must no longer be banned after deletion")
	})
}

func TestIPBanService_CleanupExpiredIPBans(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "ip_bans", "users")

	app := core.NewTestApp(testDB.Pool)
	svc := &IPBanService{DB: testDB.Pool, Logger: app.ObsLogger}

	admin := testDB.CreateTestUser(t, "ipclean_admin", "ipclean_admin@example.com")

	pastExpiry := time.Now().Add(-1 * time.Hour)
	futureExpiry := time.Now().Add(24 * time.Hour)

	expiredBan, err := svc.CreateIPBan(context.Background(), "10.2.2.1", "expired", int32(admin.ID), &pastExpiry, nil)
	require.NoError(t, err)
	activeBan, err := svc.CreateIPBan(context.Background(), "10.2.2.2", "active", int32(admin.ID), &futureExpiry, nil)
	require.NoError(t, err)
	permanentBan, err := svc.CreateIPBan(context.Background(), "10.2.2.3", "perm", int32(admin.ID), nil, nil)
	require.NoError(t, err)

	err = svc.CleanupExpiredIPBans(context.Background())
	require.NoError(t, err)

	bans, err := svc.ListIPBans(context.Background())
	require.NoError(t, err)

	ids := make([]int32, 0, len(bans))
	for _, b := range bans {
		ids = append(ids, b.ID)
	}

	assert.NotContains(t, ids, expiredBan.ID, "expired ban must be removed by cleanup")
	assert.Contains(t, ids, activeBan.ID, "active ban must survive cleanup")
	assert.Contains(t, ids, permanentBan.ID, "permanent ban must survive cleanup")
}
