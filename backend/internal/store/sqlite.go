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

const schemaSQL = `
CREATE TABLE IF NOT EXISTS accounts (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  type TEXT NOT NULL CHECK (type IN ('checking','cash','savings','credit'))
);

CREATE TABLE IF NOT EXISTS transactions (
  id                TEXT PRIMARY KEY,
  type              TEXT NOT NULL CHECK (type IN ('income','expense','transfer')),
  amount_cents      INTEGER NOT NULL CHECK (amount_cents > 0),
  category          TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  date              TEXT NOT NULL,
  account_id        TEXT NOT NULL REFERENCES accounts(id),
  to_account_id     TEXT REFERENCES accounts(id),
  recurring_rule_id TEXT,
  created_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_tx_account ON transactions(account_id);

CREATE TABLE IF NOT EXISTS budgets (
  month       TEXT NOT NULL,
  category    TEXT NOT NULL,
  limit_cents INTEGER NOT NULL CHECK (limit_cents > 0),
  PRIMARY KEY (month, category)
);

CREATE TABLE IF NOT EXISTS recurring_rules (
  id           TEXT PRIMARY KEY,
  type         TEXT NOT NULL CHECK (type IN ('income','expense')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  category     TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  day_of_month INTEGER NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
  account_id   TEXT NOT NULL REFERENCES accounts(id)
);
`

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
	if _, err := db.Exec(schemaSQL); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("init schema: %w", err)
	}

	s := &SQLiteStore{db: db}
	if err := s.ensureDefaultAccount(); err != nil {
		_ = db.Close()
		return nil, err
	}
	return s, nil
}

func (s *SQLiteStore) Close() error {
	return s.db.Close()
}

func (s *SQLiteStore) ensureDefaultAccount() error {
	var count int
	if err := s.db.QueryRow(`SELECT COUNT(*) FROM accounts`).Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	_, err := s.db.Exec(
		`INSERT OR IGNORE INTO accounts (id, name, type) VALUES (?, ?, ?)`,
		domain.DefaultAccountID, "Conta Principal", "checking",
	)
	return err
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
	var existing int
	if err := s.db.QueryRow(`SELECT COUNT(*) FROM transactions`).Scan(&existing); err != nil {
		return err
	}
	if existing > 0 {
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

	for _, a := range data.Accounts {
		if a.ID == "" || a.Name == "" {
			continue
		}
		t := a.Type
		if !domain.ValidAccountType(t) {
			t = "checking"
		}
		_, _ = tx.Exec(`INSERT OR IGNORE INTO accounts (id, name, type) VALUES (?, ?, ?)`, a.ID, a.Name, t)
	}
	for _, b := range data.Budgets {
		if b.LimitCents <= 0 {
			continue
		}
		_, _ = tx.Exec(
			`INSERT OR IGNORE INTO budgets (month, category, limit_cents) VALUES (?, ?, ?)`,
			b.Month, b.Category, int64(b.LimitCents),
		)
	}
	for _, r := range data.Recurring {
		accID := r.AccountID
		if accID == "" {
			accID = domain.DefaultAccountID
		}
		_, _ = tx.Exec(
			`INSERT OR IGNORE INTO recurring_rules (id, type, amount_cents, category, description, day_of_month, account_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
			r.ID, r.Type, int64(r.AmountCents), r.Category, r.Description, r.DayOfMonth, accID,
		)
	}
	for _, item := range data.Transactions {
		accID := item.AccountID
		if accID == "" {
			accID = domain.DefaultAccountID
		}
		_, err := tx.Exec(
			`INSERT OR IGNORE INTO transactions (id, type, amount_cents, category, description, date, account_id, to_account_id, recurring_rule_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			item.ID, item.Type, int64(item.AmountCents), item.Category, item.Description, item.Date, accID, item.ToAccountID, item.RecurringRuleID, item.CreatedAt,
		)
		if err != nil {
			return err
		}
	}
	return tx.Commit()
}
