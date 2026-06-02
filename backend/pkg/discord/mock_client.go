package discord

import (
	"context"
	"fmt"

	"actionphase/pkg/observability"
)

// SentMessage records a DM that was dispatched via MockClient.
type SentMessage struct {
	DiscordUserID string
	Message       string
}

// MockClient implements core.DiscordClientInterface for testing and local development.
// When ShouldFail is true, SendDM returns an error instead of sending.
// Sent messages are recorded in SentMessages for assertion in tests.
type MockClient struct {
	SentMessages []SentMessage
	ShouldFail   bool
	Logger       *observability.Logger
}

// SendDM records the DM and logs it to stdout. Useful for local development
// without a real Discord app configured.
func (m *MockClient) SendDM(_ context.Context, discordUserID string, message string) error {
	if m.ShouldFail {
		return fmt.Errorf("discord mock: forced failure")
	}

	m.SentMessages = append(m.SentMessages, SentMessage{
		DiscordUserID: discordUserID,
		Message:       message,
	})

	fmt.Printf("[DISCORD MOCK] DM to %s: %s\n", discordUserID, message)
	return nil
}
