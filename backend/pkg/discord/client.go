// Package discord provides Discord API integration for ActionPhase.
// It supports sending DMs via a bot token and mocking for local development.
package discord

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"actionphase/pkg/observability"
)

const discordAPIBase = "https://discord.com/api/v10"

// BotClient implements core.DiscordClientInterface using a Discord bot token.
// It opens a DM channel with the user and sends a message.
type BotClient struct {
	BotToken   string
	Logger     *observability.Logger
	httpClient *http.Client
}

// Compile-time check: BotClient must not diverge from the interface
// (checked implicitly; the interface lives in core, which imports discord would cause a cycle —
//  the compile-time assertion is placed in discord_service.go which imports both)

func (c *BotClient) getHTTPClient() *http.Client {
	if c.httpClient != nil {
		return c.httpClient
	}
	return http.DefaultClient
}

// SendDM sends a Discord DM to a user identified by their Discord user ID.
// It first creates (or retrieves) a DM channel, then posts the message.
func (c *BotClient) SendDM(ctx context.Context, discordUserID string, message string) error {
	// Step 1: Create/get DM channel
	channelID, err := c.openDMChannel(ctx, discordUserID)
	if err != nil {
		return fmt.Errorf("discord: open DM channel: %w", err)
	}

	// Step 2: Send message
	return c.sendMessage(ctx, channelID, message)
}

func (c *BotClient) openDMChannel(ctx context.Context, recipientID string) (string, error) {
	body, err := json.Marshal(map[string]string{"recipient_id": recipientID})
	if err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		discordAPIBase+"/users/@me/channels", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bot "+c.BotToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.getHTTPClient().Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("discord API error %d: %s", resp.StatusCode, string(respBody))
	}

	var channel struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&channel); err != nil {
		return "", fmt.Errorf("decode channel response: %w", err)
	}
	if channel.ID == "" {
		return "", fmt.Errorf("discord: empty channel ID in response")
	}

	return channel.ID, nil
}

func (c *BotClient) sendMessage(ctx context.Context, channelID, content string) error {
	body, err := json.Marshal(map[string]string{"content": content})
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		discordAPIBase+"/channels/"+channelID+"/messages", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bot "+c.BotToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.getHTTPClient().Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("discord API error %d: %s", resp.StatusCode, string(respBody))
	}

	return nil
}
