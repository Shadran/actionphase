package admin

import (
	"actionphase/pkg/core"
	db "actionphase/pkg/db/services"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
	"github.com/jackc/pgx/v5/pgconn"
)

// ListIPBans returns all IP bans.
// GET /admin/ip-bans
func (h *Handler) ListIPBans(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	svc := &db.IPBanService{DB: h.App.Pool, Logger: h.App.ObsLogger}

	bans, err := svc.ListIPBans(ctx)
	if err != nil {
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	render.JSON(w, r, bans)
}

type createIPBanRequest struct {
	IPAddress    string     `json:"ip_address"`
	Reason       string     `json:"reason"`
	ExpiresAt    *time.Time `json:"expires_at,omitempty"`
	BannedUserID *int32     `json:"banned_user_id,omitempty"`
}

// CreateIPBan adds a new IP ban.
// POST /admin/ip-bans
func (h *Handler) CreateIPBan(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req createIPBanRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	if req.IPAddress == "" {
		render.Render(w, r, core.ErrInvalidRequest(errors.New("ip_address is required")))
		return
	}
	if net.ParseIP(strings.TrimSpace(req.IPAddress)) == nil {
		render.Render(w, r, core.ErrInvalidRequest(errors.New("ip_address is not a valid IPv4 or IPv6 address")))
		return
	}

	adminID, err := h.getUserIDFromContext(r)
	if err != nil {
		render.Render(w, r, core.ErrUnauthorized("invalid token"))
		return
	}

	svc := &db.IPBanService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	ban, err := svc.CreateIPBan(ctx, req.IPAddress, req.Reason, adminID, req.ExpiresAt, req.BannedUserID)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			render.Render(w, r, core.ErrInvalidRequest(errors.New("this IP address is already banned")))
			return
		}
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	sessionSvc := &db.SessionService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	if err := sessionSvc.InvalidateSessionsByIP(ctx, req.IPAddress); err != nil {
		h.App.ObsLogger.Warn(ctx, "Failed to invalidate sessions for banned IP", "ip_address", req.IPAddress, "error", err)
	}

	render.Status(r, http.StatusCreated)
	render.JSON(w, r, ban)
}

// DeleteIPBan removes an IP ban by ID.
// DELETE /admin/ip-bans/{id}
func (h *Handler) DeleteIPBan(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	svc := &db.IPBanService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	if err := svc.DeleteIPBan(ctx, int32(id)); err != nil {
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
