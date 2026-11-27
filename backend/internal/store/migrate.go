package store

import (
	"database/sql"
	"fmt"

	"atelier-fin/backend/internal/domain"
)

const schemaV2SQL = `
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS accounts (
  id      TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name    TEXT NOT NULL,
  type    TEXT NOT NULL CHECK (type IN ('checking','cash','savings','credit')),
  UNIQUE (user_id, name COLLATE NOCASE)
);
CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);

CREATE TABLE IF NOT EXISTS transactions (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_tx_user_date ON transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_tx_account ON transactions(account_id);

CREATE TABLE IF NOT EXISTS budgets (
  user_id     TEXT NOT NULL,
  month       TEXT NOT NULL,
  category    TEXT NOT NULL,
  limit_cents INTEGER NOT NULL CHECK (limit_cents > 0),
  PRIMARY KEY (user_id, month, category)
);

CREATE TABLE IF NOT EXISTS recurring_rules (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('income','expense')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  category     TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  day_of_month INTEGER NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
  account_id   TEXT NOT NULL REFERENCES accounts(id)
);
CREATE INDEX IF NOT EXISTS idx_rec_user ON recurring_rules(user_id);
`

func initOrMigrateSchema(db *sql.DB) error {
	var tableName string
	err := db.QueryRow(`SELECT name FROM sqlite_master WHERE type='table' AND name='accounts'`).Scan(&tableName)
	if err == sql.ErrNoRows {
		_, err = db.Exec(schemaV2SQL)
		return err
	}
	if err != nil {
		return err
	}

	hasUserID, err := tableHasColumn(db, "accounts", "user_id")
	if err != nil {
		return err
	}
	if hasUserID {
		_, err = db.Exec(schemaV2SQL)
		return err
	}
	return migrateV1ToV2(db)
}

func tableHasColumn(db *sql.DB, table, column string) (bool, error) {
	rows, err := db.Query(`PRAGMA table_info(` + table + `)`)
	if err != nil {
		return false, err
	}
	defer rows.Close()
	for rows.Next() {
		var cid int
		var name, ctype string
		var notnull, pk int
		var dflt sql.NullString
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk); err != nil {
			return false, err
		}
		if name == column {
			return true, nil
		}
	}
	return false, rows.Err()
}

func migrateV1ToV2(db *sql.DB) error {
	if _, err := db.Exec(`PRAGMA foreign_keys = OFF;`); err != nil {
		return err
	}
	defer func() { _, _ = db.Exec(`PRAGMA foreign_keys = ON;`) }()

	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	renames := []string{
		`ALTER TABLE accounts RENAME TO accounts_v1`,
		`ALTER TABLE transactions RENAME TO transactions_v1`,
		`ALTER TABLE budgets RENAME TO budgets_v1`,
		`ALTER TABLE recurring_rules RENAME TO recurring_rules_v1`,
	}
	for _, stmt := range renames {
		if _, err := tx.Exec(stmt); err != nil {
			return fmt.Errorf("rename v1: %w", err)
		}
	}
	if _, err := tx.Exec(schemaV2SQL); err != nil {
		return fmt.Errorf("create v2: %w", err)
	}

	legacy := domain.LegacyUserID
	copies := []struct {
		sql string
		arg string
	}{
		{`INSERT INTO accounts (id, user_id, name, type) SELECT id, ?, name, type FROM accounts_v1`, legacy},
		{`INSERT INTO transactions (id, user_id, type, amount_cents, category, description, date, account_id, to_account_id, recurring_rule_id, created_at)
		  SELECT id, ?, type, amount_cents, category, description, date, account_id, to_account_id, recurring_rule_id, created_at FROM transactions_v1`, legacy},
		{`INSERT INTO budgets (user_id, month, category, limit_cents) SELECT ?, month, category, limit_cents FROM budgets_v1`, legacy},
		{`INSERT INTO recurring_rules (id, user_id, type, amount_cents, category, description, day_of_month, account_id)
		  SELECT id, ?, type, amount_cents, category, description, day_of_month, account_id FROM recurring_rules_v1`, legacy},
	}
	for _, c := range copies {
		if _, err := tx.Exec(c.sql, c.arg); err != nil {
			return fmt.Errorf("copy v1->v2: %w", err)
		}
	}
	for _, drop := range []string{`DROP TABLE transactions_v1`, `DROP TABLE recurring_rules_v1`, `DROP TABLE budgets_v1`, `DROP TABLE accounts_v1`} {
		if _, err := tx.Exec(drop); err != nil {
			return err
		}
	}
	return tx.Commit()
}
