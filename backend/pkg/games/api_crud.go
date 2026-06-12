package games

import (
	"actionphase/pkg/core"
	db "actionphase/pkg/db/services"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
)

// CreateGame creates a new game
func (h *Handler) CreateGame(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Track the overall operation timing using observability logger
	defer h.App.ObsLogger.LogOperation(ctx, "api_create_game")()

	// Increment business metric
	h.App.Observability.Metrics.IncrementCounter("games_create_requests")

	data := &CreateGameRequest{}
	if err := render.Bind(r, data); err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to bind create game request")
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	// Validate required fields
	if errResp := core.ValidateRequired(data.Title, "title"); errResp != nil {
		h.App.ObsLogger.Warn(ctx, "Game creation rejected: missing title")
		render.Render(w, r, errResp)
		return
	}

	// Get user ID from JWT token
	userService := &db.UserService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	userID, errResp := core.GetUserIDFromJWT(ctx, userService)
	if errResp != nil {
		h.App.ObsLogger.Error(ctx, "Failed to authenticate user from JWT")
		render.Render(w, r, errResp)
		return
	}
	h.App.ObsLogger.Info(ctx, "Authenticated user for game creation", "user_id", userID)

	gameService := &db.GameService{DB: h.App.Pool, Logger: h.App.ObsLogger}

	game, err := gameService.CreateGame(ctx, core.CreateGameRequest{
		Title:                   data.Title,
		Description:             data.Description,
		GMUserID:                userID,
		Genre:                   data.Genre,
		StartDate:               data.StartDate.ToTimePtr(),
		EndDate:                 data.EndDate.ToTimePtr(),
		RecruitmentDeadline:     data.RecruitmentDeadline.ToTimePtr(),
		MaxPlayers:              data.MaxPlayers,
		IsPublic:                true, // All games are now public
		IsAnonymous:             data.IsAnonymous,
		AutoAcceptAudience:      data.AutoAcceptAudience,
		AllowGroupConversations: data.AllowGroupConversations,
		PortraitAvatars:         data.PortraitAvatars,
		BannerURL:               data.BannerURL,
		CommonRoomOpenDay:       data.CommonRoomOpenDay,
		CommonRoomOpenTime:      data.CommonRoomOpenTime,
		CommonRoomCloseDay:      data.CommonRoomCloseDay,
		CommonRoomCloseTime:     data.CommonRoomCloseTime,
		ScheduleTimezone:        data.ScheduleTimezone,
	})

	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to create game",
			"title", data.Title,
			"user_id", userID)
		h.App.Observability.Metrics.IncrementCounter("games_create_errors")
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Record successful game creation
	h.App.ObsLogger.Info(ctx, "Game created successfully",
		"game_id", game.ID,
		"title", game.Title,
		"gm_user_id", game.GmUserID)
	h.App.Observability.Metrics.IncrementCounter("games_created")

	// Convert to response format
	response := &GameResponse{
		ID:                      game.ID,
		Title:                   game.Title,
		Description:             game.Description.String,
		GMUserID:                game.GmUserID,
		State:                   game.State.String,
		IsAnonymous:             game.IsAnonymous,
		AutoAcceptAudience:      game.AutoAcceptAudience,
		AllowGroupConversations: game.AllowGroupConversations,
		PortraitAvatars:         game.PortraitAvatars,
		CreatedAt:               game.CreatedAt.Time,
		UpdatedAt:               game.UpdatedAt.Time,
	}

	if game.Genre.Valid {
		response.Genre = game.Genre.String
	}
	if game.StartDate.Valid {
		response.StartDate = &game.StartDate.Time
	}
	if game.EndDate.Valid {
		response.EndDate = &game.EndDate.Time
	}
	if game.RecruitmentDeadline.Valid {
		response.RecruitmentDeadline = &game.RecruitmentDeadline.Time
	}
	if game.MaxPlayers.Valid {
		response.MaxPlayers = game.MaxPlayers.Int32
	}
	if game.BannerUrl.Valid {
		response.BannerURL = &game.BannerUrl.String
	}
	if game.CommonRoomOpenDay.Valid {
		v := game.CommonRoomOpenDay.Int16
		response.CommonRoomOpenDay = &v
	}
	if game.CommonRoomOpenTime.Valid {
		s := formatPgtypeTime(game.CommonRoomOpenTime)
		response.CommonRoomOpenTime = &s
	}
	if game.CommonRoomCloseDay.Valid {
		v := game.CommonRoomCloseDay.Int16
		response.CommonRoomCloseDay = &v
	}
	if game.CommonRoomCloseTime.Valid {
		s := formatPgtypeTime(game.CommonRoomCloseTime)
		response.CommonRoomCloseTime = &s
	}
	if game.ScheduleTimezone.Valid {
		response.ScheduleTimezone = &game.ScheduleTimezone.String
	}

	render.Status(r, http.StatusCreated)
	render.Render(w, r, response)
}

// GetGame retrieves a single game by ID
func (h *Handler) GetGame(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_get_game")()

	gameIDStr := chi.URLParam(r, "id")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	gameService := &db.GameService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	game, err := gameService.GetGame(ctx, int32(gameID))
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get game", "error", err, "game_id", gameID)
		render.Render(w, r, core.HandleDBErrorWithID(err, "game", gameID))
		return
	}

	// Convert to response format (same as CreateGame)
	response := &GameResponse{
		ID:                      game.ID,
		Title:                   game.Title,
		Description:             game.Description.String,
		GMUserID:                game.GmUserID,
		State:                   game.State.String,
		IsAnonymous:             game.IsAnonymous,
		AutoAcceptAudience:      game.AutoAcceptAudience,
		AllowGroupConversations: game.AllowGroupConversations,
		PortraitAvatars:         game.PortraitAvatars,
		CreatedAt:               game.CreatedAt.Time,
		UpdatedAt:               game.UpdatedAt.Time,
	}

	if game.Genre.Valid {
		response.Genre = game.Genre.String
	}
	if game.StartDate.Valid {
		response.StartDate = &game.StartDate.Time
	}
	if game.EndDate.Valid {
		response.EndDate = &game.EndDate.Time
	}
	if game.RecruitmentDeadline.Valid {
		response.RecruitmentDeadline = &game.RecruitmentDeadline.Time
	}
	if game.MaxPlayers.Valid {
		response.MaxPlayers = game.MaxPlayers.Int32
	}
	if game.BannerUrl.Valid {
		response.BannerURL = &game.BannerUrl.String
	}
	if game.CommonRoomOpenDay.Valid {
		v := game.CommonRoomOpenDay.Int16
		response.CommonRoomOpenDay = &v
	}
	if game.CommonRoomOpenTime.Valid {
		s := formatPgtypeTime(game.CommonRoomOpenTime)
		response.CommonRoomOpenTime = &s
	}
	if game.CommonRoomCloseDay.Valid {
		v := game.CommonRoomCloseDay.Int16
		response.CommonRoomCloseDay = &v
	}
	if game.CommonRoomCloseTime.Valid {
		s := formatPgtypeTime(game.CommonRoomCloseTime)
		response.CommonRoomCloseTime = &s
	}
	if game.ScheduleTimezone.Valid {
		response.ScheduleTimezone = &game.ScheduleTimezone.String
	}

	render.Render(w, r, response)
}

// UpdateGameState updates the state of a game
func (h *Handler) UpdateGameState(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_update_game_state")()

	gameIDStr := chi.URLParam(r, "id")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	data := &UpdateGameStateRequest{}
	if err := render.Bind(r, data); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	// Get authenticated user
	user := core.GetAuthenticatedUser(ctx)
	if user == nil {
		h.App.ObsLogger.Error(ctx, "No authenticated user found")
		render.Render(w, r, core.ErrUnauthorized("authentication required"))
		return
	}

	gameService := &db.GameService{DB: h.App.Pool, Logger: h.App.ObsLogger}

	// Verify user is GM of this game
	game, err := gameService.GetGame(ctx, int32(gameID))
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get game for permission check", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Check GM permissions (considers admin mode)
	if !core.IsUserGameMaster(r, user.ID, user.IsAdmin, *game, h.App.Pool) {
		render.Render(w, r, core.ErrForbidden("only the GM can update this game state"))
		return
	}

	updatedGame, err := gameService.UpdateGameState(ctx, int32(gameID), data.State)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to update game state", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// If transitioning out of recruitment, convert approved applications to participants
	if game.State.String == core.GameStateRecruitment && data.State != core.GameStateRecruitment {
		h.App.ObsLogger.Info(ctx, "Transitioning out of recruitment, converting approved applications", "game_id", gameID)

		applicationService := &db.GameApplicationService{DB: h.App.Pool, Logger: h.App.ObsLogger}
		notificationService := db.NewNotificationService(h.App.Pool, h.App.ObsLogger)

		// Get approved applications before conversion (for notifications)
		approvedApps, err := applicationService.GetApprovedApplicationsForGame(ctx, int32(gameID))
		if err != nil {
			h.App.ObsLogger.Error(ctx, "Failed to get approved applications", "error", err, "game_id", gameID)
		}

		// Auto-reject all pending applications (those not explicitly approved)
		err = applicationService.BulkRejectApplications(ctx, int32(gameID), user.ID)
		if err != nil {
			h.App.ObsLogger.Error(ctx, "Failed to bulk reject pending applications", "error", err, "game_id", gameID)
			// Don't fail the state transition, but log the error
		}

		// Publish application statuses so applicants can see their final status
		err = applicationService.PublishApplicationStatuses(ctx, int32(gameID))
		if err != nil {
			h.App.ObsLogger.Error(ctx, "Failed to publish application statuses", "error", err, "game_id", gameID)
			// Don't fail the state transition, but log the error
		} else {
			h.App.ObsLogger.Info(ctx, "Successfully published application statuses", "game_id", gameID)
		}

		// Convert approved applications to participants
		err = applicationService.ConvertApprovedApplicationsToParticipants(ctx, int32(gameID))
		if err != nil {
			h.App.ObsLogger.Error(ctx, "Failed to convert approved applications to participants", "error", err, "game_id", gameID)
			// Don't fail the state transition, but log the error
		} else {
			h.App.ObsLogger.Info(ctx, "Successfully converted approved applications to participants", "game_id", gameID)
		}

		// Delete all rejected applications now that recruitment is closed
		// Rejected applicants cannot join the game, so no need to keep the application records
		err = applicationService.DeleteRejectedApplications(ctx, int32(gameID))
		if err != nil {
			h.App.ObsLogger.Warn(ctx, "Failed to delete rejected applications", "error", err, "game_id", gameID)
			// Don't fail the state transition, but log the warning
		} else {
			h.App.ObsLogger.Info(ctx, "Successfully deleted rejected applications", "game_id", gameID)
		}

		// Send acceptance notifications to approved applicants (regardless of conversion success)
		// Do this only if we successfully retrieved the approved applications list
		if approvedApps != nil && len(approvedApps) > 0 {
			for _, app := range approvedApps {
				if err := notificationService.NotifyApplicationApproved(ctx, app.UserID, int32(gameID), updatedGame.Title); err != nil {
					h.App.ObsLogger.Warn(ctx, "Failed to create acceptance notification",
						"error", err,
						"game_id", gameID,
						"user_id", app.UserID)
				} else {
					h.App.ObsLogger.Info(ctx, "Sent acceptance notification",
						"game_id", gameID,
						"user_id", app.UserID)
				}
			}
		}
	}

	// Convert to response format (same as GetGame)
	response := &GameResponse{
		ID:          updatedGame.ID,
		Title:       updatedGame.Title,
		Description: updatedGame.Description.String,
		GMUserID:    updatedGame.GmUserID,
		State:       updatedGame.State.String,
		CreatedAt:   updatedGame.CreatedAt.Time,
		UpdatedAt:   updatedGame.UpdatedAt.Time,
	}

	render.Render(w, r, response)
}

// UpdateGame updates game details (GM only)
func (h *Handler) UpdateGame(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_update_game")()

	gameIDStr := chi.URLParam(r, "id")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	data := &UpdateGameRequest{}
	if err := render.Bind(r, data); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	// Get authenticated user
	user := core.GetAuthenticatedUser(ctx)
	if user == nil {
		h.App.ObsLogger.Error(ctx, "No authenticated user found")
		render.Render(w, r, core.ErrUnauthorized("authentication required"))
		return
	}

	gameService := &db.GameService{DB: h.App.Pool, Logger: h.App.ObsLogger}

	// Verify user is GM of this game
	game, err := gameService.GetGame(ctx, int32(gameID))
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get game for permission check", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Check GM permissions (considers admin mode)
	if !core.IsUserGameMaster(r, user.ID, user.IsAdmin, *game, h.App.Pool) {
		render.Render(w, r, core.ErrForbidden("only the GM can update this game"))
		return
	}

	// Update the game
	updatedGame, err := gameService.UpdateGame(ctx, core.UpdateGameRequest{
		ID:                      int32(gameID),
		Title:                   data.Title,
		Description:             data.Description,
		Genre:                   data.Genre,
		StartDate:               data.StartDate,
		EndDate:                 data.EndDate,
		RecruitmentDeadline:     data.RecruitmentDeadline,
		MaxPlayers:              data.MaxPlayers,
		IsPublic:                data.IsPublic,
		IsAnonymous:             data.IsAnonymous,
		AutoAcceptAudience:      data.AutoAcceptAudience,
		AllowGroupConversations: data.AllowGroupConversations,
		PortraitAvatars:         data.PortraitAvatars,
		BannerURL:               data.BannerURL,
		CommonRoomOpenDay:       data.CommonRoomOpenDay,
		CommonRoomOpenTime:      data.CommonRoomOpenTime,
		CommonRoomCloseDay:      data.CommonRoomCloseDay,
		CommonRoomCloseTime:     data.CommonRoomCloseTime,
		ScheduleTimezone:        data.ScheduleTimezone,
	})

	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to update game", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
	response := &GameResponse{
		ID:                      updatedGame.ID,
		Title:                   updatedGame.Title,
		Description:             updatedGame.Description.String,
		GMUserID:                updatedGame.GmUserID,
		State:                   updatedGame.State.String,
		IsAnonymous:             updatedGame.IsAnonymous,
		AutoAcceptAudience:      updatedGame.AutoAcceptAudience,
		AllowGroupConversations: updatedGame.AllowGroupConversations,
		PortraitAvatars:         updatedGame.PortraitAvatars,
		CreatedAt:               updatedGame.CreatedAt.Time,
		UpdatedAt:               updatedGame.UpdatedAt.Time,
	}

	if updatedGame.Genre.Valid {
		response.Genre = updatedGame.Genre.String
	}
	if updatedGame.StartDate.Valid {
		response.StartDate = &updatedGame.StartDate.Time
	}
	if updatedGame.EndDate.Valid {
		response.EndDate = &updatedGame.EndDate.Time
	}
	if updatedGame.RecruitmentDeadline.Valid {
		response.RecruitmentDeadline = &updatedGame.RecruitmentDeadline.Time
	}
	if updatedGame.MaxPlayers.Valid {
		response.MaxPlayers = updatedGame.MaxPlayers.Int32
	}
	if updatedGame.BannerUrl.Valid {
		response.BannerURL = &updatedGame.BannerUrl.String
	}
	if updatedGame.CommonRoomOpenDay.Valid {
		v := updatedGame.CommonRoomOpenDay.Int16
		response.CommonRoomOpenDay = &v
	}
	if updatedGame.CommonRoomOpenTime.Valid {
		s := formatPgtypeTime(updatedGame.CommonRoomOpenTime)
		response.CommonRoomOpenTime = &s
	}
	if updatedGame.CommonRoomCloseDay.Valid {
		v := updatedGame.CommonRoomCloseDay.Int16
		response.CommonRoomCloseDay = &v
	}
	if updatedGame.CommonRoomCloseTime.Valid {
		s := formatPgtypeTime(updatedGame.CommonRoomCloseTime)
		response.CommonRoomCloseTime = &s
	}
	if updatedGame.ScheduleTimezone.Valid {
		response.ScheduleTimezone = &updatedGame.ScheduleTimezone.String
	}

	render.Render(w, r, response)
}

// DeleteGame cancels or deletes a game (GM only)
func (h *Handler) DeleteGame(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_delete_game")()

	gameIDStr := chi.URLParam(r, "id")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	// Get authenticated user
	user := core.GetAuthenticatedUser(ctx)
	if user == nil {
		h.App.ObsLogger.Error(ctx, "No authenticated user found")
		render.Render(w, r, core.ErrUnauthorized("authentication required"))
		return
	}

	gameService := &db.GameService{DB: h.App.Pool, Logger: h.App.ObsLogger}

	// Verify user is GM of this game
	game, err := gameService.GetGame(ctx, int32(gameID))
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get game for permission check", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Check GM permissions (considers admin mode)
	if !core.IsUserGameMaster(r, user.ID, user.IsAdmin, *game, h.App.Pool) {
		render.Render(w, r, core.ErrForbidden("only the GM can delete this game"))
		return
	}

	// Delete the game (pass userID for authorization in service layer)
	err = gameService.DeleteGame(ctx, int32(gameID), int32(user.ID))
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to delete game", "error", err, "game_id", gameID)
		// Check for specific errors and return appropriate HTTP status codes
		errMsg := err.Error()
		switch {
		case errMsg == "game not found":
			render.Render(w, r, core.ErrNotFound(errMsg))
		case errMsg == "only the game master can delete this game":
			render.Render(w, r, core.ErrForbidden(errMsg))
		case errMsg == "only cancelled games can be deleted" ||
			errMsg[:len("only cancelled games can be deleted")] == "only cancelled games can be deleted":
			render.Render(w, r, core.ErrBadRequest(err))
		default:
			render.Render(w, r, core.ErrInternalError(err))
		}
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// GetGameWithDetails retrieves a game with participant count and GM username
func (h *Handler) GetGameWithDetails(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_get_game_with_details")()

	gameIDStr := chi.URLParam(r, "id")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	gameService := &db.GameService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	game, err := gameService.GetGameWithDetails(ctx, int32(gameID))
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get game with details", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
	response := &GameWithDetailsResponse{
		ID:                      game.ID,
		Title:                   game.Title,
		Description:             game.Description.String,
		GMUserID:                game.GmUserID,
		State:                   game.State.String,
		IsAnonymous:             game.IsAnonymous,
		AutoAcceptAudience:      game.AutoAcceptAudience,
		AllowGroupConversations: game.AllowGroupConversations,
		PortraitAvatars:         game.PortraitAvatars,
		CurrentPlayers:          game.CurrentPlayers,
		CreatedAt:               game.CreatedAt.Time,
		UpdatedAt:               game.UpdatedAt.Time,
	}

	if game.GmUsername.Valid {
		response.GMUsername = game.GmUsername.String
	}
	if game.Genre.Valid {
		response.Genre = game.Genre.String
	}
	if game.StartDate.Valid {
		response.StartDate = &game.StartDate.Time
	}
	if game.EndDate.Valid {
		response.EndDate = &game.EndDate.Time
	}
	if game.RecruitmentDeadline.Valid {
		response.RecruitmentDeadline = &game.RecruitmentDeadline.Time
	}
	if game.MaxPlayers.Valid {
		response.MaxPlayers = game.MaxPlayers.Int32
	}
	if game.BannerUrl.Valid {
		response.BannerURL = &game.BannerUrl.String
	}
	if game.CommonRoomOpenDay.Valid {
		v := game.CommonRoomOpenDay.Int16
		response.CommonRoomOpenDay = &v
	}
	if game.CommonRoomOpenTime.Valid {
		s := formatPgtypeTime(game.CommonRoomOpenTime)
		response.CommonRoomOpenTime = &s
	}
	if game.CommonRoomCloseDay.Valid {
		v := game.CommonRoomCloseDay.Int16
		response.CommonRoomCloseDay = &v
	}
	if game.CommonRoomCloseTime.Valid {
		s := formatPgtypeTime(game.CommonRoomCloseTime)
		response.CommonRoomCloseTime = &s
	}
	if game.ScheduleTimezone.Valid {
		response.ScheduleTimezone = &game.ScheduleTimezone.String
	}

	render.Render(w, r, response)
}

// GetRecruitingGames retrieves games currently accepting players
func (h *Handler) GetRecruitingGames(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_get_recruiting_games")()

	gameService := &db.GameService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	games, err := gameService.GetRecruitingGames(ctx)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get recruiting games", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
	var response []map[string]interface{}
	for _, game := range games {
		gameData := map[string]interface{}{
			"id":              game.ID,
			"title":           game.Title,
			"description":     game.Description,
			"gm_user_id":      game.GmUserID,
			"gm_username":     game.GmUsername,
			"state":           game.State,
			"current_players": game.CurrentPlayers,
			"created_at":      game.CreatedAt.Time,
			"updated_at":      game.UpdatedAt.Time,
		}

		if game.Genre.Valid {
			gameData["genre"] = game.Genre.String
		}
		if game.StartDate.Valid {
			gameData["start_date"] = game.StartDate.Time
		}
		if game.EndDate.Valid {
			gameData["end_date"] = game.EndDate.Time
		}
		if game.RecruitmentDeadline.Valid {
			gameData["recruitment_deadline"] = game.RecruitmentDeadline.Time
		}
		if game.MaxPlayers.Valid {
			gameData["max_players"] = game.MaxPlayers.Int32
		}
		if game.CommonRoomOpenDay.Valid {
			v := game.CommonRoomOpenDay.Int16
			gameData["common_room_open_day"] = v
		}
		if game.CommonRoomOpenTime.Valid {
			gameData["common_room_open_time"] = formatPgtypeTime(game.CommonRoomOpenTime)
		}
		if game.CommonRoomCloseDay.Valid {
			v := game.CommonRoomCloseDay.Int16
			gameData["common_room_close_day"] = v
		}
		if game.CommonRoomCloseTime.Valid {
			gameData["common_room_close_time"] = formatPgtypeTime(game.CommonRoomCloseTime)
		}
		if game.ScheduleTimezone.Valid {
			gameData["schedule_timezone"] = game.ScheduleTimezone.String
		}

		response = append(response, gameData)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// GetFilteredGames retrieves games with advanced filtering, sorting, and user enrichment
func (h *Handler) GetFilteredGames(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_get_filtered_games")()

	// Parse query parameters
	queryParams := r.URL.Query()

	// Parse pagination parameters with defaults
	page := 1
	pageSize := 20
	if pageParam := queryParams.Get("page"); pageParam != "" {
		if p, err := strconv.Atoi(pageParam); err == nil && p > 0 {
			page = p
		}
	}
	if pageSizeParam := queryParams.Get("page_size"); pageSizeParam != "" {
		if ps, err := strconv.Atoi(pageSizeParam); err == nil && ps > 0 && ps <= 100 {
			pageSize = ps
		}
	}

	// Build filters from query parameters
	filters := core.GameListingFilters{
		Search:   queryParams.Get("search"),
		SortBy:   queryParams.Get("sort_by"),
		Page:     page,
		PageSize: pageSize,
	}

	// Parse states array (comma-separated)
	if statesParam := queryParams.Get("states"); statesParam != "" {
		filters.States = splitCommaSeparated(statesParam)
	}

	// Parse participation filter
	if participationParam := queryParams.Get("participation"); participationParam != "" {
		filters.ParticipationFilter = &participationParam
	}

	// Parse has_open_spots boolean
	if openSpotsParam := queryParams.Get("has_open_spots"); openSpotsParam != "" {
		if openSpotsParam == "true" {
			hasOpenSpots := true
			filters.HasOpenSpots = &hasOpenSpots
		} else if openSpotsParam == "false" {
			hasOpenSpots := false
			filters.HasOpenSpots = &hasOpenSpots
		}
	}

	// Try to get user ID from JWT (optional - unauthenticated users can browse)
	userService := &db.UserService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	userID, _ := core.GetUserIDFromJWT(ctx, userService)
	if userID != 0 {
		filters.UserID = &userID
	}

	// Parse admin_mode parameter (requires authentication)
	if adminModeParam := queryParams.Get("admin_mode"); adminModeParam == "true" && userID != 0 {
		filters.AdminMode = true
		filters.AdminUserID = &userID
	}

	// Call service
	gameService := &db.GameService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	result, err := gameService.GetFilteredGames(ctx, filters)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get filtered games", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to API response format
	response := &GameListingResponse{
		Games: make([]*EnrichedGameListItemResponse, len(result.Games)),
		Metadata: GameListingMetadataResponse{
			TotalCount:      result.Metadata.TotalCount,
			FilteredCount:   result.Metadata.FilteredCount,
			AvailableStates: result.Metadata.AvailableStates,
			Page:            result.Metadata.Page,
			PageSize:        result.Metadata.PageSize,
			TotalPages:      result.Metadata.TotalPages,
			HasNextPage:     result.Metadata.HasNextPage,
			HasPreviousPage: result.Metadata.HasPreviousPage,
		},
	}

	for i, game := range result.Games {
		response.Games[i] = &EnrichedGameListItemResponse{
			ID:                      game.ID,
			Title:                   game.Title,
			Description:             game.Description,
			GMUserID:                game.GMUserID,
			GMUsername:              game.GMUsername,
			State:                   game.State,
			Genre:                   game.Genre,
			StartDate:               game.StartDate,
			EndDate:                 game.EndDate,
			RecruitmentDeadline:     game.RecruitmentDeadline,
			MaxPlayers:              game.MaxPlayers,
			IsPublic:                game.IsPublic,
			IsAnonymous:             game.IsAnonymous,
			AutoAcceptAudience:      game.AutoAcceptAudience,
			AllowGroupConversations: game.AllowGroupConversations,
			PortraitAvatars:         game.PortraitAvatars,
			BannerURL:               game.BannerURL,
			CreatedAt:               game.CreatedAt,
			UpdatedAt:               game.UpdatedAt,
			CurrentPlayers:          game.CurrentPlayers,
			UserRelationship:        game.UserRelationship,
			CurrentPhaseType:        game.CurrentPhaseType,
			CurrentPhaseDeadline:    game.CurrentPhaseDeadline,
			DeadlineUrgency:         game.DeadlineUrgency,
			HasRecentActivity:       game.HasRecentActivity,
		}
	}

	render.Render(w, r, response)
}

// splitCommaSeparated splits a comma-separated string into a slice
func splitCommaSeparated(s string) []string {
	var result []string
	for _, item := range splitString(s, ",") {
		trimmed := trimString(item)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

// splitString splits a string by delimiter
func splitString(s, delim string) []string {
	// Simple split implementation
	var result []string
	current := ""
	for _, ch := range s {
		if string(ch) == delim {
			result = append(result, current)
			current = ""
		} else {
			current += string(ch)
		}
	}
	if current != "" {
		result = append(result, current)
	}
	return result
}

// trimString removes leading and trailing whitespace
func trimString(s string) string {
	start := 0
	end := len(s)

	// Trim leading whitespace
	for start < end && (s[start] == ' ' || s[start] == '\t' || s[start] == '\n' || s[start] == '\r') {
		start++
	}

	// Trim trailing whitespace
	for end > start && (s[end-1] == ' ' || s[end-1] == '\t' || s[end-1] == '\n' || s[end-1] == '\r') {
		end--
	}

	return s[start:end]
}
