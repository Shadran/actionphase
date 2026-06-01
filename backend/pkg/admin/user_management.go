package admin

import (
	"actionphase/pkg/core"
	db "actionphase/pkg/db/services"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
)

type userListResponse struct {
	Users    []*core.User `json:"users"`
	Total    int64        `json:"total"`
	Page     int          `json:"page"`
	PageSize int          `json:"page_size"`
}

// ListUsers returns a paginated, searchable list of all users.
// GET /admin/users?page=1&limit=25&search=
func (h *Handler) ListUsers(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if pageSize < 1 || pageSize > 100 {
		pageSize = 25
	}
	search := r.URL.Query().Get("search")

	userService := &db.UserService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	users, total, err := userService.ListAllUsers(ctx, page, pageSize, search)
	if err != nil {
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	render.JSON(w, r, userListResponse{
		Users:    users,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	})
}

// ListPendingApprovalUsers returns all accounts awaiting admin approval.
// GET /admin/users/pending
func (h *Handler) ListPendingApprovalUsers(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userService := &db.UserService{DB: h.App.Pool, Logger: h.App.ObsLogger}

	users, err := userService.ListPendingApprovalUsers(ctx)
	if err != nil {
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	render.JSON(w, r, users)
}

// ApproveUser approves a pending account, allowing the user to login.
// POST /admin/users/{id}/approve
func (h *Handler) ApproveUser(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	userService := &db.UserService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	user, err := userService.GetUserByID(int(id))
	if err != nil {
		render.Render(w, r, core.ErrNotFound("user not found"))
		return
	}
	if !user.PendingApproval {
		render.Render(w, r, core.ErrInvalidRequest(errMsg("user is not pending approval")))
		return
	}

	if err := userService.ApproveUser(ctx, int32(id)); err != nil {
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.Logger.Info("User approved", "user_id", id)
	w.WriteHeader(http.StatusNoContent)
}

// GetUserSessions returns session details for a user (admin view).
// GET /admin/users/{id}/sessions
func (h *Handler) GetUserSessions(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	sessionService := &db.SessionService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	sessions, err := sessionService.GetUserSessionsWithDetails(ctx, int32(id))
	if err != nil {
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	render.JSON(w, r, sessions)
}

// errMsg wraps a string as an error for ErrInvalidRequest
func errMsg(msg string) error {
	return errors.New(msg)
}
