package characters

import (
	"net/http"
	"time"
)

// CharacterResponse represents a character response
type CharacterResponse struct {
	ID            int32     `json:"id"`
	GameID        int32     `json:"game_id"`
	UserID        *int32    `json:"user_id,omitempty"`
	Name          string    `json:"name"`
	CharacterType *string   `json:"character_type,omitempty"`
	Status        string    `json:"status"`
	AvatarURL     *string   `json:"avatar_url,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

func (rd *CharacterResponse) Render(w http.ResponseWriter, r *http.Request) error {
	return nil
}

