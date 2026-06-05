package scheduler

import (
	"context"
	"sync/atomic"
	"testing"
	"time"

	"actionphase/pkg/observability"

	"github.com/stretchr/testify/assert"
)

// mockPhaseService records calls to RunScheduledActivations.
type mockPhaseService struct {
	callCount atomic.Int32
	returnErr error
}

func (m *mockPhaseService) RunScheduledActivations(_ context.Context) (int, int, error) {
	m.callCount.Add(1)
	if m.returnErr != nil {
		return 0, 0, m.returnErr
	}
	return 1, 1, nil
}

func newTestLogger() *observability.Logger {
	return observability.NewLogger("test", "error")
}

func TestScheduler_ActivatesOnStartup(t *testing.T) {
	mock := &mockPhaseService{}
	s := New(mock, newTestLogger(), 10*time.Second)

	ctx := context.Background()
	cancel := s.Start(ctx)
	defer cancel()

	// Give the goroutine time to run the startup activation
	assert.Eventually(t, func() bool {
		return mock.callCount.Load() >= 1
	}, 2*time.Second, 10*time.Millisecond, "scheduler should call RunScheduledActivations on startup")
}

func TestScheduler_GracefulShutdown(t *testing.T) {
	mock := &mockPhaseService{}
	s := New(mock, newTestLogger(), 5*time.Minute) // long interval so ticker never fires

	ctx := context.Background()
	cancel := s.Start(ctx)

	// Wait for startup activation
	assert.Eventually(t, func() bool {
		return mock.callCount.Load() >= 1
	}, 2*time.Second, 10*time.Millisecond)

	countBefore := mock.callCount.Load()

	// Cancel should stop the loop
	cancel()

	// Wait briefly then verify no more calls
	time.Sleep(50 * time.Millisecond)
	assert.Equal(t, countBefore, mock.callCount.Load(), "no activations should run after cancel")
}

func TestScheduler_TickerFiresActivations(t *testing.T) {
	mock := &mockPhaseService{}
	s := New(mock, newTestLogger(), 50*time.Millisecond) // short interval for testing

	ctx := context.Background()
	cancel := s.Start(ctx)
	defer cancel()

	// Should have at least 3 calls: startup + 2 ticks
	assert.Eventually(t, func() bool {
		return mock.callCount.Load() >= 3
	}, 2*time.Second, 10*time.Millisecond, "scheduler should fire on ticker interval")
}
