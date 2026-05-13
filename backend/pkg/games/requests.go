package games

import (
	"actionphase/pkg/core"
	"net/http"
	"time"
)

// CreateGameRequest represents the request to create a new game
type CreateGameRequest struct {
	Title                   string              `json:"title" validate:"required,min=3,max=255"`
	Description             string              `json:"description" validate:"required,min=10"`
	Genre                   string              `json:"genre,omitempty"`
	StartDate               *core.LocalDateTime `json:"start_date,omitempty"`
	EndDate                 *core.LocalDateTime `json:"end_date,omitempty"`
	RecruitmentDeadline     *core.LocalDateTime `json:"recruitment_deadline,omitempty"`
	MaxPlayers              int32               `json:"max_players,omitempty"`
	IsAnonymous             bool                `json:"is_anonymous"`
	AutoAcceptAudience      bool                `json:"auto_accept_audience"`
	AllowGroupConversations bool                `json:"allow_group_conversations"`
	PortraitAvatars         bool                `json:"portrait_avatars"`
	BannerURL               *string             `json:"banner_url,omitempty"`
}

func (r *CreateGameRequest) Bind(req *http.Request) error {
	return nil
}

// UpdateGameStateRequest represents the request to update a game's state
type UpdateGameStateRequest struct {
	State string `json:"state" validate:"required"`
}

func (r *UpdateGameStateRequest) Bind(req *http.Request) error {
	return nil
}

// UpdateGameRequest represents the request to update game details
type UpdateGameRequest struct {
	Title                   string     `json:"title" validate:"required,min=3,max=255"`
	Description             string     `json:"description" validate:"required,min=10"`
	Genre                   string     `json:"genre,omitempty"`
	StartDate               *time.Time `json:"start_date,omitempty"`
	EndDate                 *time.Time `json:"end_date,omitempty"`
	RecruitmentDeadline     *time.Time `json:"recruitment_deadline,omitempty"`
	MaxPlayers              int32      `json:"max_players,omitempty"`
	IsPublic                bool       `json:"is_public"`
	IsAnonymous             bool       `json:"is_anonymous"`
	AutoAcceptAudience      bool       `json:"auto_accept_audience"`
	AllowGroupConversations bool       `json:"allow_group_conversations"`
	PortraitAvatars         bool       `json:"portrait_avatars"`
	BannerURL               *string    `json:"banner_url,omitempty"`
}

func (r *UpdateGameRequest) Bind(req *http.Request) error {
	return nil
}

// ApplyToGameRequest represents the request to apply to join a game
type ApplyToGameRequest struct {
	Role    string `json:"role" validate:"required"`
	Message string `json:"message,omitempty"`
}

func (r *ApplyToGameRequest) Bind(req *http.Request) error {
	return nil
}

// ReviewApplicationRequest represents the request to review a game application
type ReviewApplicationRequest struct {
	Action string `json:"action" validate:"required"` // "approve" or "reject"
}

func (r *ReviewApplicationRequest) Bind(req *http.Request) error {
	return nil
}
