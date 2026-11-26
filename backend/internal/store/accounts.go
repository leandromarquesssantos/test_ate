package store

import (
	"database/sql"
	"strings"

	"atelier-fin/backend/internal/domain"
)

func (s *SQLiteStore) ensureAccountExists(accountID string) error {
	var id string
	err := s.db.QueryRow(`SELECT id FROM accounts WHERE id = ?`, accountID).Scan(&id)
	if err == sql.ErrNoRows {
		return domain.NotFoundErrorf("conta não encontrada: %q", accountID)
	}
	return err
}

func (s *SQLiteStore) ListAccounts() ([]domain.Account, error) {
	rows, err := s.db.Query(`
		SELECT a.id, a.name, a.type,
		  COALESCE((
		    SELECT SUM(
		      CASE
		        WHEN t.type = 'income'   AND t.account_id = a.id    THEN t.amount_cents
		        WHEN t.type = 'expense'  AND t.account_id = a.id    THEN -t.amount_cents
		        WHEN t.type = 'transfer' AND t.account_id = a.id    THEN -t.amount_cents
		        WHEN t.type = 'transfer' AND t.to_account_id = a.id THEN t.amount_cents
		        ELSE 0
		      END
		    ) FROM transactions t WHERE t.account_id = a.id OR t.to_account_id = a.id
		  ), 0) AS balance_cents
		FROM accounts a ORDER BY a.rowid ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []domain.Account{}
	for rows.Next() {
		var acc domain.Account
		var bal int64
		if err := rows.Scan(&acc.ID, &acc.Name, &acc.Type, &bal); err != nil {
			return nil, err
		}
		acc.BalanceCents = domain.Cents(bal)
		items = append(items, acc)
	}
	return items, rows.Err()
}

func (s *SQLiteStore) AddAccount(name, accType string) (domain.Account, error) {
	cleanName, err := domain.NormalizeAccountName(name)
	if err != nil {
		return domain.Account{}, err
	}
	if accType == "" {
		accType = "checking"
	}
	if !domain.ValidAccountType(accType) {
		return domain.Account{}, domain.ValidationErrorf(`tipo de conta inválido. Use "checking", "cash", "savings" ou "credit"`)
	}
	var dup int
	if err := s.db.QueryRow(`SELECT COUNT(*) FROM accounts WHERE LOWER(name) = LOWER(?)`, cleanName).Scan(&dup); err != nil {
		return domain.Account{}, err
	}
	if dup > 0 {
		return domain.Account{}, domain.ValidationErrorf("já existe uma conta chamada %q", cleanName)
	}

	acc := domain.Account{ID: domain.NewID("acc"), Name: cleanName, Type: accType}
	_, err = s.db.Exec(`INSERT INTO accounts (id, name, type) VALUES (?, ?, ?)`, acc.ID, acc.Name, acc.Type)
	return acc, err
}

func (s *SQLiteStore) DeleteAccount(id string) (domain.Account, error) {
	trimmed := strings.TrimSpace(id)
	if trimmed == "" {
		return domain.Account{}, domain.ValidationErrorf("ID da conta é obrigatório")
	}
	var acc domain.Account
	err := s.db.QueryRow(`SELECT id, name, type FROM accounts WHERE id = ?`, trimmed).Scan(&acc.ID, &acc.Name, &acc.Type)
	if err == sql.ErrNoRows {
		return domain.Account{}, domain.NotFoundErrorf("conta não encontrada: %q", id)
	}
	if err != nil {
		return domain.Account{}, err
	}

	var totalAcc int
	_ = s.db.QueryRow(`SELECT COUNT(*) FROM accounts`).Scan(&totalAcc)
	if totalAcc <= 1 {
		return domain.Account{}, domain.ValidationErrorf("não é possível remover a única conta existente")
	}

	var txRefs, recRefs int
	_ = s.db.QueryRow(`SELECT COUNT(*) FROM transactions WHERE account_id = ? OR to_account_id = ?`, acc.ID, acc.ID).Scan(&txRefs)
	_ = s.db.QueryRow(`SELECT COUNT(*) FROM recurring_rules WHERE account_id = ?`, acc.ID).Scan(&recRefs)
	if txRefs > 0 || recRefs > 0 {
		return domain.Account{}, domain.ValidationErrorf("não é possível remover conta com transações ou recorrências vinculadas")
	}

	_, err = s.db.Exec(`DELETE FROM accounts WHERE id = ?`, acc.ID)
	return acc, err
}
