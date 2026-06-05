package messages

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"

	"actionphase/pkg/core"
	models "actionphase/pkg/db/models"
	messagesvc "actionphase/pkg/db/services/messages"
	"actionphase/pkg/validation"
)

// GetDraftPost retrieves the draft post for a pending phase.
// Returns 404 if no draft exists.
// GET /api/v1/phases/{id}/draft-post
func (h *Handler) GetDraftPost(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_get_draft_post")()

	phaseID, err := parsePhaseID(r)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	userID, err := getUserIDFromToken(r, h.App)
	if err != nil {
		render.Render(w, r, core.ErrUnauthorized(err.Error()))
		return
	}

	if err := requireGMForPhase(ctx, h.App, phaseID, userID); err != nil {
		render.Render(w, r, err)
		return
	}

	messageService := &messagesvc.MessageService{DB: h.App.Pool, Logger: h.App.ObsLogger, Metrics: h.App.Observability.OTELMetrics}
	draft, err := messageService.GetDraftPostForPhase(ctx, phaseID)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get draft post", "error", err, "phase_id", phaseID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	if draft == nil {
		render.Render(w, r, core.ErrNotFound("no draft post for this phase"))
		return
	}

	render.Render(w, r, messageWithDetailsToResponse(draft))
}

// CreateDraftPost creates a draft post for a pending phase.
// Returns 409 if a draft already exists.
// POST /api/v1/phases/{id}/draft-post
func (h *Handler) CreateDraftPost(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_create_draft_post")()

	phaseID, err := parsePhaseID(r)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	data := &CreateDraftPostRequest{}
	if err := render.Bind(r, data); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	userID, err := getUserIDFromToken(r, h.App)
	if err != nil {
		render.Render(w, r, core.ErrUnauthorized(err.Error()))
		return
	}

	// Validate content length
	if err := validation.ValidatePost(data.Content); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	if err := requireGMForPhase(ctx, h.App, phaseID, userID); err != nil {
		render.Render(w, r, err)
		return
	}

	gameID, err := getGameIDForPhase(ctx, h.App, phaseID)
	if err != nil {
		render.Render(w, r, core.ErrNotFound("phase not found"))
		return
	}

	messageService := &messagesvc.MessageService{DB: h.App.Pool, Logger: h.App.ObsLogger, Metrics: h.App.Observability.OTELMetrics}
	draft, err := messageService.CreateDraftPost(ctx, core.CreatePostRequest{
		GameID:      gameID,
		PhaseID:     &phaseID,
		AuthorID:    userID,
		CharacterID: data.CharacterID,
		Content:     data.Content,
		Visibility:  "game",
	})
	if err != nil {
		if errors.Is(err, core.ErrDraftPostExists) {
			render.Render(w, r, core.ErrConflict("a draft post already exists for this phase"))
			return
		}
		if core.IsArchivedGameError(err) {
			render.Render(w, r, core.ErrGameArchived())
			return
		}
		h.App.ObsLogger.Error(ctx, "Failed to create draft post", "error", err, "phase_id", phaseID, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.ObsLogger.Info(ctx, "Draft post created", "phase_id", phaseID, "post_id", draft.ID, "author_id", userID)

	render.Status(r, http.StatusCreated)
	render.Render(w, r, messageWithDetailsToResponse(draft))
}

// UpdateDraftPost replaces the content of an existing draft post.
// PUT /api/v1/phases/{id}/draft-post
func (h *Handler) UpdateDraftPost(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_update_draft_post")()

	phaseID, err := parsePhaseID(r)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	data := &UpdateDraftPostRequest{}
	if err := render.Bind(r, data); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	if err := validation.ValidatePost(data.Content); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	userID, err := getUserIDFromToken(r, h.App)
	if err != nil {
		render.Render(w, r, core.ErrUnauthorized(err.Error()))
		return
	}

	if err := requireGMForPhase(ctx, h.App, phaseID, userID); err != nil {
		render.Render(w, r, err)
		return
	}

	messageService := &messagesvc.MessageService{DB: h.App.Pool, Logger: h.App.ObsLogger, Metrics: h.App.Observability.OTELMetrics}

	// Find existing draft to get its ID
	existing, err := messageService.GetDraftPostForPhase(ctx, phaseID)
	if err != nil {
		render.Render(w, r, core.ErrInternalError(err))
		return
	}
	if existing == nil {
		render.Render(w, r, core.ErrNotFound("no draft post for this phase"))
		return
	}

	updated, err := messageService.UpdateDraftPost(ctx, existing.ID, data.Content)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to update draft post", "error", err, "phase_id", phaseID, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.ObsLogger.Info(ctx, "Draft post updated", "phase_id", phaseID, "post_id", existing.ID, "user_id", userID)

	render.Render(w, r, messageWithDetailsToResponse(updated))
}

// DeleteDraftPost hard-deletes a draft post.
// DELETE /api/v1/phases/{id}/draft-post
func (h *Handler) DeleteDraftPost(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_delete_draft_post")()

	phaseID, err := parsePhaseID(r)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	userID, err := getUserIDFromToken(r, h.App)
	if err != nil {
		render.Render(w, r, core.ErrUnauthorized(err.Error()))
		return
	}

	if err := requireGMForPhase(ctx, h.App, phaseID, userID); err != nil {
		render.Render(w, r, err)
		return
	}

	messageService := &messagesvc.MessageService{DB: h.App.Pool, Logger: h.App.ObsLogger, Metrics: h.App.Observability.OTELMetrics}

	existing, err := messageService.GetDraftPostForPhase(ctx, phaseID)
	if err != nil {
		render.Render(w, r, core.ErrInternalError(err))
		return
	}
	if existing == nil {
		render.Render(w, r, core.ErrNotFound("no draft post for this phase"))
		return
	}

	if err := messageService.DeleteDraftPost(ctx, existing.ID); err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to delete draft post", "error", err, "phase_id", phaseID, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.ObsLogger.Info(ctx, "Draft post deleted", "phase_id", phaseID, "user_id", userID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Draft post deleted successfully",
	})
}

// --- helpers ---

func parsePhaseID(r *http.Request) (int32, error) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 32)
	if err != nil {
		return 0, fmt.Errorf("invalid phase ID")
	}
	return int32(id), nil
}

func getGameIDForPhase(ctx context.Context, app *core.App, phaseID int32) (int32, error) {
	queries := models.New(app.Pool)
	phase, err := queries.GetPhase(ctx, phaseID)
	if err != nil {
		return 0, err
	}
	return phase.GameID, nil
}

func requireGMOrCoGM(ctx context.Context, app *core.App, gameID, userID int32) render.Renderer {
	queries := models.New(app.Pool)
	game, err := queries.GetGame(ctx, gameID)
	if err != nil {
		return core.ErrInternalError(err)
	}
	if game.GmUserID != userID && !core.IsUserCoGM(ctx, app.Pool, gameID, userID) {
		return core.ErrForbidden("only the Game Master or co-GM can manage draft posts")
	}
	return nil
}

func requireGMForPhase(ctx context.Context, app *core.App, phaseID, userID int32) render.Renderer {
	gameID, err := getGameIDForPhase(ctx, app, phaseID)
	if err != nil {
		return core.ErrNotFound("phase not found")
	}
	return requireGMOrCoGM(ctx, app, gameID, userID)
}
