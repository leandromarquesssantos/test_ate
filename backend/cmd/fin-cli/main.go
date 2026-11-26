package main

import (
	"fmt"
	"os"
	"path/filepath"

	"atelier-fin/backend/internal/cli"
	"atelier-fin/backend/internal/store"
)

func main() {
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = filepath.Join("data", "atelier-fin.db")
	}
	legacyJSON := os.Getenv("LEGACY_DATA_FILE")
	if legacyJSON == "" {
		legacyJSON = filepath.Join("data", "ledger.json")
	}

	s, err := store.OpenSQLite(dbPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Erro ao abrir SQLite: %v\n", err)
		os.Exit(1)
	}
	defer func() { _ = s.Close() }()
	_ = s.ImportLegacyJSONIfEmpty(legacyJSON)

	out, err := cli.Run(os.Args[1:], s)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Erro: %v\n", err)
		os.Exit(1)
	}
	fmt.Println(out)
}
