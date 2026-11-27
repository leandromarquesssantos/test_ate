package httpapi

import (
	"net/http"
	"strings"

	"atelier-fin/backend/internal/store"
)

func NewHandler(s *store.SQLiteStore, webRoot string) http.Handler {
	return NewHandlerWithOptions(s, webRoot, DefaultServerOptions())
}

func NewHandlerWithOptions(s *store.SQLiteStore, webRoot string, opts ServerOptions) http.Handler {
	publicMux := http.NewServeMux()
	publicMux.HandleFunc("GET /api/health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	registerAuthRoutes(publicMux, s, opts)

	protectedMux := http.NewServeMux()
	registerLedgerRoutes(protectedMux, s)
	registerExtraRoutes(protectedMux, s)
	protectedMux.HandleFunc("/api/", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Endpoint não encontrado."})
	})
	protected := withAuth(s, protectedMux)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rawTarget := r.RequestURI
		if rawTarget == "" {
			rawTarget = r.URL.Path
		}
		if r.URL.Path == "/api/health" || strings.HasPrefix(r.URL.Path, "/api/auth/") {
			publicMux.ServeHTTP(w, r)
			return
		}
		if strings.HasPrefix(r.URL.Path, "/api/") {
			protected.ServeHTTP(w, r)
			return
		}
		if hasTraversal(rawTarget) {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "Acesso negado."})
			return
		}
		serveStatic(w, r, webRoot)
	})
}
