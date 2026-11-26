package httpapi

import (
	"net/http"
	"strings"

	"atelier-fin/backend/internal/store"
)

func NewHandler(s *store.SQLiteStore, webRoot string) http.Handler {
	mux := http.NewServeMux()
	registerLedgerRoutes(mux, s)
	registerExtraRoutes(mux, s)

	mux.HandleFunc("/api/", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Endpoint não encontrado."})
	})

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rawTarget := r.RequestURI
		if rawTarget == "" {
			rawTarget = r.URL.Path
		}
		if strings.HasPrefix(r.URL.Path, "/api/") {
			mux.ServeHTTP(w, r)
			return
		}
		if hasTraversal(rawTarget) {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "Acesso negado."})
			return
		}
		serveStatic(w, r, webRoot)
	})
}
