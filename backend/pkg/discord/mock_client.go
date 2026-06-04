package discord

import (
	"context"
	"fmt"
	"sync"

	"actionphase/pkg/core"
	"actionphase/pkg/observability"
)

// SentMessage records a DM that was dispatched via MockClient.
type SentMessage struct {
	DiscordUserID string
	Embed         core.DiscordEmbed
}

// MockClient implements core.DiscordClientInterface for testing and local development.
// When ShouldFail is true, SendDM returns an error instead of sending.
// Sent messages are recorded in sentMessages for assertion in tests; use Messages() to read them safely.
type MockClient struct {
	mu           sync.Mutex
	sentMessages []SentMessage
	ShouldFail   bool
	Logger       *observability.Logger
}

// SendDM records the embed and logs it to stdout. Useful for local development
// without a real Discord app configured.
func (m *MockClient) SendDM(_ context.Context, discordUserID string, embed core.DiscordEmbed) error {
	if m.ShouldFail {
		return fmt.Errorf("discord mock: forced failure")
	}

	m.mu.Lock()
	m.sentMessages = append(m.sentMessages, SentMessage{
		DiscordUserID: discordUserID,
		Embed:         embed,
	})
	m.mu.Unlock()

	fmt.Printf("[DISCORD MOCK] DM to %s: %s — %s\n", discordUserID, embed.Title, embed.URL)
	return nil
}

// Messages returns a copy of all sent messages. Safe for concurrent use.
func (m *MockClient) Messages() []SentMessage {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]SentMessage, len(m.sentMessages))
	copy(out, m.sentMessages)
	return out
}
