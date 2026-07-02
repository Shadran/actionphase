package admin

import (
	"actionphase/pkg/core"
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
	svc := h.IPBanService

	bans, err := svc.ListIPBans(ctx)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to list i p bans", "error", err)
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
		h.renderError(ctx, w, r, core.ErrInvalidRequest(err), "Invalid create i p ban request", "error", err)
		return
	}

	if req.IPAddress == "" {
		h.renderError(ctx, w, r, core.ErrInvalidRequest(errors.New("ip_address is required")), "Invalid create i p ban request")
		return
	}
	if net.ParseIP(strings.TrimSpace(req.IPAddress)) == nil {
		h.renderError(ctx, w, r, core.ErrInvalidRequest(errors.New("ip_address is not a valid IPv4 or IPv6 address")), "Invalid create i p ban request")
		return
	}

	adminID, err := h.getUserIDFromContext(r)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrUnauthorized("invalid token"), "Unauthorized")
		return
	}

	svc := h.IPBanService
	ban, err := svc.CreateIPBan(ctx, req.IPAddress, req.Reason, adminID, req.ExpiresAt, req.BannedUserID)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			h.renderError(ctx, w, r, core.ErrInvalidRequest(errors.New("this IP address is already banned")), "Invalid create i p ban request")
			return
		}
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to create i p ban", "error", err)
		return
	}

	sessionSvc := h.SessionService
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
		h.renderError(ctx, w, r, core.ErrInvalidRequest(err), "Invalid delete i p ban request", "error", err)
		return
	}

	svc := h.IPBanService
	if err := svc.DeleteIPBan(ctx, int32(id)); err != nil {
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to delete i p ban", "error", err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
