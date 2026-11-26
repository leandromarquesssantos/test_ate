package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"atelier-fin/backend/internal/httpapi"
	"atelier-fin/backend/internal/store"
)

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func main() {
	host := envOr("HOST", "127.0.0.1")
	port := envOr("PORT", "3000")
	dbPath := envOr("DB_PATH", filepath.Join("data", "atelier-fin.db"))
	legacyJSON := envOr("LEGACY_DATA_FILE", filepath.Join("data", "ledger.json"))
	webRoot := envOr("WEB_ROOT", filepath.Join("packages", "web", "src"))

	s, err := store.OpenSQLite(dbPath)
	if err != nil {
		log.Fatalf("erro ao abrir SQLite: %v", err)
	}
	defer func() { _ = s.Close() }()

	if err := s.ImportLegacyJSONIfEmpty(legacyJSON); err != nil {
		log.Printf("aviso ao importar JSON legado: %v", err)
	}

	addr := fmt.Sprintf("%s:%s", host, port)
	srv := &http.Server{
		Addr:              addr,
		Handler:           httpapi.NewHandler(s, webRoot),
		ReadHeaderTimeout: 5 * time.Second,
	}
	log.Printf("Atelier Fin (Go + SQLite) rodando em http://%s", addr)
	log.Printf("SQLite DB: %s", dbPath)
	if err := srv.ListenAndServe(); err != nil {
		log.Fatalf("servidor encerrado: %v", err)
	}
}
