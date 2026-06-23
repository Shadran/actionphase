package db

import (
	"context"
	"testing"

	"actionphase/pkg/core"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFingerprintBanService_CreateAndList(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "fingerprint_bans", "users")

	app := core.NewTestApp(testDB.Pool)
	svc := &FingerprintBanService{DB: testDB.Pool, Logger: app.ObsLogger}

	admin := testDB.CreateTestUser(t, "fpbansvc_admin", "fpbansvc_admin@example.com")

	t.Run("creates ban and returns it", func(t *testing.T) {
		ban, err := svc.CreateFingerprintBan(context.Background(), "fp-aabbcc", "bot behavior", int32(admin.ID), nil)
		require.NoError(t, err)
		require.NotNil(t, ban)
		assert.Equal(t, "fp-aabbcc", ban.Fingerprint)
		require.NotNil(t, ban.Reason)
		assert.Equal(t, "bot behavior", *ban.Reason)
		assert.Nil(t, ban.BannedUserID)
		assert.Equal(t, int32(admin.ID), ban.CreatedBy)
	})

	t.Run("creates ban with associated user ID", func(t *testing.T) {
		target := testDB.CreateTestUser(t, "fpbansvc_target", "fpbansvc_target@example.com")
		targetID := int32(target.ID)
		ban, err := svc.CreateFingerprintBan(context.Background(), "fp-ddeeff", "ban evasion", int32(admin.ID), &targetID)
		require.NoError(t, err)
		require.NotNil(t, ban.BannedUserID)
		assert.Equal(t, targetID, *ban.BannedUserID)
	})

	t.Run("lists all created bans", func(t *testing.T) {
		bans, err := svc.ListFingerprintBans(context.Background())
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(bans), 2)
	})
}

// TestFingerprintBanService_IsFingerprintBanned is the critical path: this check gates
// registration. If it silently returns false when true, banned devices can re-register.
func TestFingerprintBanService_IsFingerprintBanned(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "fingerprint_bans", "users")

	app := core.NewTestApp(testDB.Pool)
	svc := &FingerprintBanService{DB: testDB.Pool, Logger: app.ObsLogger}

	admin := testDB.CreateTestUser(t, "fpcheck_admin", "fpcheck_admin@example.com")

	t.Run("returns false for unknown fingerprint", func(t *testing.T) {
		banned, err := svc.IsFingerprintBanned(context.Background(), "fp-unknown-9999")
		require.NoError(t, err)
		assert.False(t, banned)
	})

	t.Run("returns true after fingerprint is banned", func(t *testing.T) {
		_, err := svc.CreateFingerprintBan(context.Background(), "fp-bannedcheck", "test", int32(admin.ID), nil)
		require.NoError(t, err)

		banned, err := svc.IsFingerprintBanned(context.Background(), "fp-bannedcheck")
		require.NoError(t, err)
		assert.True(t, banned, "fingerprint must be detected as banned after ban is created")
	})

	t.Run("returns false for different fingerprint after a ban exists", func(t *testing.T) {
		banned, err := svc.IsFingerprintBanned(context.Background(), "fp-different-device")
		require.NoError(t, err)
		assert.False(t, banned, "ban must not bleed across fingerprints")
	})
}

func TestFingerprintBanService_DeleteBan(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "fingerprint_bans", "users")

	app := core.NewTestApp(testDB.Pool)
	svc := &FingerprintBanService{DB: testDB.Pool, Logger: app.ObsLogger}

	admin := testDB.CreateTestUser(t, "fpdelete_admin", "fpdelete_admin@example.com")

	ban, err := svc.CreateFingerprintBan(context.Background(), "fp-to-delete", "temp ban", int32(admin.ID), nil)
	require.NoError(t, err)

	t.Run("device is banned before deletion", func(t *testing.T) {
		banned, err := svc.IsFingerprintBanned(context.Background(), "fp-to-delete")
		require.NoError(t, err)
		assert.True(t, banned)
	})

	t.Run("deletion removes the ban", func(t *testing.T) {
		err := svc.DeleteFingerprintBan(context.Background(), ban.ID)
		require.NoError(t, err)

		banned, err := svc.IsFingerprintBanned(context.Background(), "fp-to-delete")
		require.NoError(t, err)
		assert.False(t, banned, "fingerprint must no longer be banned after deletion")
	})

	t.Run("list no longer contains deleted ban", func(t *testing.T) {
		bans, err := svc.ListFingerprintBans(context.Background())
		require.NoError(t, err)
		for _, b := range bans {
			assert.NotEqual(t, ban.ID, b.ID)
		}
	})
}
