package admin

import (
	"actionphase/pkg/core"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
	"github.com/jackc/pgx/v5/pgconn"
)

// ListFingerprintBans returns all device fingerprint bans.
// GET /admin/fingerprint-bans
func (h *Handler) ListFingerprintBans(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	svc := h.FingerprintBanService

	bans, err := svc.ListFingerprintBans(ctx)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to list fingerprint bans", "error", err)
		return
	}

	render.JSON(w, r, bans)
}

type createFingerprintBanRequest struct {
	Fingerprint  string `json:"fingerprint"`
	Reason       string `json:"reason"`
	BannedUserID *int32 `json:"banned_user_id,omitempty"`
}

// CreateFingerprintBan adds a new device fingerprint ban.
// POST /admin/fingerprint-bans
func (h *Handler) CreateFingerprintBan(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req createFingerprintBanRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.renderError(ctx, w, r, core.ErrInvalidRequest(err), "Invalid create fingerprint ban request", "error", err)
		return
	}

	if req.Fingerprint == "" {
		h.renderError(ctx, w, r, core.ErrInvalidRequest(errors.New("fingerprint is required")), "Invalid create fingerprint ban request")
		return
	}
	if len(req.Fingerprint) > 512 {
		h.renderError(ctx, w, r, core.ErrInvalidRequest(errors.New("fingerprint exceeds maximum length")), "Invalid create fingerprint ban request")
		return
	}

	adminID, err := h.getUserIDFromContext(r)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrUnauthorized("invalid token"), "Unauthorized")
		return
	}

	svc := h.FingerprintBanService
	ban, err := svc.CreateFingerprintBan(ctx, req.Fingerprint, req.Reason, adminID, req.BannedUserID)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			h.renderError(ctx, w, r, core.ErrInvalidRequest(errors.New("this device fingerprint is already banned")), "Invalid create fingerprint ban request")
			return
		}
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to create fingerprint ban", "error", err)
		return
	}

	sessionSvc := h.SessionService
	if err := sessionSvc.InvalidateSessionsByFingerprint(ctx, req.Fingerprint); err != nil {
		h.App.ObsLogger.Warn(ctx, "Failed to invalidate sessions for banned fingerprint", "fingerprint", req.Fingerprint, "error", err)
	}

	render.Status(r, http.StatusCreated)
	render.JSON(w, r, ban)
}

// DeleteFingerprintBan removes a fingerprint ban by ID.
// DELETE /admin/fingerprint-bans/{id}
func (h *Handler) DeleteFingerprintBan(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 32)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInvalidRequest(err), "Invalid delete fingerprint ban request", "error", err)
		return
	}

	svc := h.FingerprintBanService
	if err := svc.DeleteFingerprintBan(ctx, int32(id)); err != nil {
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to delete fingerprint ban", "error", err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
