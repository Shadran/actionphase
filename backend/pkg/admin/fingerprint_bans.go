package admin

import (
	"actionphase/pkg/core"
	db "actionphase/pkg/db/services"
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
	svc := &db.FingerprintBanService{DB: h.App.Pool, Logger: h.App.ObsLogger}

	bans, err := svc.ListFingerprintBans(ctx)
	if err != nil {
		render.Render(w, r, core.ErrInternalError(err))
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
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	if req.Fingerprint == "" {
		render.Render(w, r, core.ErrInvalidRequest(errors.New("fingerprint is required")))
		return
	}
	if len(req.Fingerprint) > 512 {
		render.Render(w, r, core.ErrInvalidRequest(errors.New("fingerprint exceeds maximum length")))
		return
	}

	adminID, err := h.getUserIDFromContext(r)
	if err != nil {
		render.Render(w, r, core.ErrUnauthorized("invalid token"))
		return
	}

	svc := &db.FingerprintBanService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	ban, err := svc.CreateFingerprintBan(ctx, req.Fingerprint, req.Reason, adminID, req.BannedUserID)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			render.Render(w, r, core.ErrInvalidRequest(errors.New("this device fingerprint is already banned")))
			return
		}
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	sessionSvc := &db.SessionService{DB: h.App.Pool, Logger: h.App.ObsLogger}
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
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	svc := &db.FingerprintBanService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	if err := svc.DeleteFingerprintBan(ctx, int32(id)); err != nil {
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
