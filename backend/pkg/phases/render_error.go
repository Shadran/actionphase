package phases

import (
	"context"
	"net/http"

	"actionphase/pkg/core"

	"github.com/go-chi/render"
)

// renderError logs and renders an error response. It logs at Error level for
// 5xx responses (server errors) and at Warn level for 4xx responses (client
// errors). This centralizes the requirement that every error render also be
// logged with appropriate context.
func (h *Handler) renderError(ctx context.Context, w http.ResponseWriter, r *http.Request, errResp render.Renderer, msg string, args ...any) {
	if resp, ok := errResp.(*core.ErrResponse); ok && resp.HTTPStatusCode >= 500 {
		h.App.ObsLogger.Error(ctx, msg, args...)
	} else {
		h.App.ObsLogger.Warn(ctx, msg, args...)
	}
	render.Render(w, r, errResp)
}
