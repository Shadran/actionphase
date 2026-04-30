package http

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestWalkRoutes_CollectsRoutes(t *testing.T) {
	r := chi.NewRouter()
	r.Get("/foo", func(w http.ResponseWriter, r *http.Request) {})
	r.Post("/bar", func(w http.ResponseWriter, r *http.Request) {})
	r.Put("/baz/{id}", func(w http.ResponseWriter, r *http.Request) {})

	routes := WalkRoutes(r)

	paths := make(map[string]string)
	for _, rt := range routes {
		paths[rt.Path] = rt.Method
	}

	assert.Equal(t, "GET", paths["/foo"])
	assert.Equal(t, "POST", paths["/bar"])
	assert.Equal(t, "PUT", paths["/baz/{id}"])
}

func TestWalkRoutes_SkipsWildcards(t *testing.T) {
	r := chi.NewRouter()
	r.Get("/api/*", func(w http.ResponseWriter, r *http.Request) {})
	r.Get("/normal", func(w http.ResponseWriter, r *http.Request) {})

	routes := WalkRoutes(r)

	for _, rt := range routes {
		assert.NotContains(t, rt.Path, "/*", "wildcard route should be excluded")
	}
	require.Len(t, routes, 1)
	assert.Equal(t, "/normal", routes[0].Path)
}

func TestWalkRoutes_IsSorted(t *testing.T) {
	r := chi.NewRouter()
	r.Get("/zoo", func(w http.ResponseWriter, r *http.Request) {})
	r.Get("/alpha", func(w http.ResponseWriter, r *http.Request) {})
	r.Get("/middle", func(w http.ResponseWriter, r *http.Request) {})

	routes := WalkRoutes(r)

	require.Len(t, routes, 3)
	assert.Equal(t, "/alpha", routes[0].Path)
	assert.Equal(t, "/middle", routes[1].Path)
	assert.Equal(t, "/zoo", routes[2].Path)
}

func TestWalkRoutes_SamePathSortsByMethod(t *testing.T) {
	r := chi.NewRouter()
	r.Post("/resource", func(w http.ResponseWriter, r *http.Request) {})
	r.Get("/resource", func(w http.ResponseWriter, r *http.Request) {})

	routes := WalkRoutes(r)

	require.Len(t, routes, 2)
	assert.Equal(t, "GET", routes[0].Method)
	assert.Equal(t, "POST", routes[1].Method)
}

func TestWalkRoutes_EmptyRouter(t *testing.T) {
	r := chi.NewRouter()
	routes := WalkRoutes(r)
	assert.Empty(t, routes)
}

func TestDebugHandler_ListRoutes(t *testing.T) {
	outer := chi.NewRouter()
	outer.Get("/hello", func(w http.ResponseWriter, r *http.Request) {})
	outer.Post("/world", func(w http.ResponseWriter, r *http.Request) {})

	debugHandler := &DebugHandler{}
	outer.Route("/debug", func(r chi.Router) {
		debugHandler.RegisterRoutes(r)
	})

	req := httptest.NewRequest("GET", "/debug/routes", nil)
	rec := httptest.NewRecorder()
	outer.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "application/json", rec.Header().Get("Content-Type"))

	var routes []Route
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &routes))
	assert.NotEmpty(t, routes)

	paths := make(map[string]bool)
	for _, rt := range routes {
		paths[rt.Path] = true
	}
	assert.True(t, paths["/hello"])
	assert.True(t, paths["/world"])
}

// TestWalkRoutes_RootPath verifies the empty-string normalization: a route
// registered at "/" would produce an empty string after TrimSuffix, which
// must be converted back to "/" rather than stored as an empty path.
func TestWalkRoutes_RootPath(t *testing.T) {
	r := chi.NewRouter()
	r.Get("/", func(w http.ResponseWriter, r *http.Request) {})

	routes := WalkRoutes(r)

	require.Len(t, routes, 1)
	assert.Equal(t, "/", routes[0].Path, "root path should remain '/' not become empty string")
}

// TestDebugHandler_ListRoutes_NoRouteContext verifies the nil-context guard in
// listRoutes. Without it, a nil deref would panic when the handler is invoked
// outside of a proper chi router context.
func TestDebugHandler_ListRoutes_NoRouteContext(t *testing.T) {
	// Invoke listRoutes directly via a plain http.ServeMux (no chi context)
	handler := &DebugHandler{}

	// Register on a plain mux — chi.RouteContext will be nil for this request
	mux := http.NewServeMux()
	mux.HandleFunc("/routes", handler.listRoutes)

	req := httptest.NewRequest("GET", "/routes", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusInternalServerError, rec.Code)
}
