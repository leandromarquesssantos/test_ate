package main

import (
	"fmt"
	"os"
	"path/filepath"

	"atelier-fin/backend/internal/cli"
	"atelier-fin/backend/internal/store"
)

func resolveRepoRoot() string {
	if _, err := os.Stat(filepath.Join("packages", "web", "src")); err == nil {
		return "."
	}
	if _, err := os.Stat(filepath.Join("..", "packages", "web", "src")); err == nil {
		return ".."
	}
	return "."
}

func main() {
	root := resolveRepoRoot()
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = filepath.Join(root, "data", "atelier-fin.db")
	}
	legacyJSON := os.Getenv("LEGACY_DATA_FILE")
	if legacyJSON == "" {
		legacyJSON = filepath.Join(root, "data", "ledger.json")
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
