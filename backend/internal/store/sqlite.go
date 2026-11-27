package store

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"atelier-fin/backend/internal/domain"
	_ "modernc.org/sqlite"
)

type SQLiteStore struct {
	db *sql.DB
}

func OpenSQLite(dbPath string) (*SQLiteStore, error) {
	if dbPath != ":memory:" {
		if err := os.MkdirAll(filepath.Dir(dbPath), 0o755); err != nil {
			return nil, fmt.Errorf("create db dir: %w", err)
		}
	}
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}
	db.SetMaxOpenConns(1)

	pragmas := []string{
		"PRAGMA foreign_keys = ON;",
		"PRAGMA busy_timeout = 5000;",
	}
	if dbPath != ":memory:" {
		pragmas = append(pragmas, "PRAGMA journal_mode = WAL;")
	}
	for _, p := range pragmas {
		if _, err := db.Exec(p); err != nil {
			_ = db.Close()
			return nil, fmt.Errorf("pragma %s: %w", p, err)
		}
	}
	if err := initOrMigrateSchema(db); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("init schema: %w", err)
	}
	return &SQLiteStore{db: db}, nil
}

func (s *SQLiteStore) Close() error {
	return s.db.Close()
}

type legacyLedger struct {
	Accounts     []domain.Account       `json:"accounts"`
	Transactions []domain.Transaction   `json:"transactions"`
	Budgets      []domain.Budget        `json:"budgets"`
	Recurring    []domain.RecurringRule `json:"recurring"`
}

func (s *SQLiteStore) ImportLegacyJSONIfEmpty(jsonPath string) error {
	raw, err := os.ReadFile(jsonPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	var existingTx, existingUsers int
	_ = s.db.QueryRow(`SELECT COUNT(*) FROM transactions`).Scan(&existingTx)
	_ = s.db.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&existingUsers)
	if existingTx > 0 || existingUsers > 0 {
		return nil
	}

	var data legacyLedger
	if err := json.Unmarshal(raw, &data); err != nil {
		return fmt.Errorf("parse legacy json: %w", err)
	}
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	legacy := domain.LegacyUserID
	_, _ = tx.Exec(
		`INSERT OR IGNORE INTO accounts (id, user_id, name, type) VALUES (?, ?, ?, ?)`,
		domain.DefaultAccountID, legacy, "Conta Principal", "checking",
	)
	for _, a := range data.Accounts {
		if a.ID == "" || a.Name == "" {
			continue
		}
		t := a.Type
		if !domain.ValidAccountType(t) {
			t = "checking"
		}
		_, _ = tx.Exec(`INSERT OR IGNORE INTO accounts (id, user_id, name, type) VALUES (?, ?, ?, ?)`, a.ID, legacy, a.Name, t)
	}
	for _, b := range data.Budgets {
		if b.LimitCents <= 0 {
			continue
		}
		_, _ = tx.Exec(
			`INSERT OR IGNORE INTO budgets (user_id, month, category, limit_cents) VALUES (?, ?, ?, ?)`,
			legacy, b.Month, b.Category, int64(b.LimitCents),
		)
	}
	for _, r := range data.Recurring {
		accID := r.AccountID
		if accID == "" {
			accID = domain.DefaultAccountID
		}
		_, _ = tx.Exec(
			`INSERT OR IGNORE INTO recurring_rules (id, user_id, type, amount_cents, category, description, day_of_month, account_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			r.ID, legacy, r.Type, int64(r.AmountCents), r.Category, r.Description, r.DayOfMonth, accID,
		)
	}
	for _, item := range data.Transactions {
		accID := item.AccountID
		if accID == "" {
			accID = domain.DefaultAccountID
		}
		_, err := tx.Exec(
			`INSERT OR IGNORE INTO transactions (id, user_id, type, amount_cents, category, description, date, account_id, to_account_id, recurring_rule_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			item.ID, legacy, item.Type, int64(item.AmountCents), item.Category, item.Description, item.Date, accID, item.ToAccountID, item.RecurringRuleID, item.CreatedAt,
		)
		if err != nil {
			return err
		}
	}
	return tx.Commit()
}
