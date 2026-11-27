package store

import (
	"database/sql"
	"strings"

	"atelier-fin/backend/internal/domain"
)

func (s *SQLiteStore) ListTransactions(userID string, filter domain.TxFilter) ([]domain.Transaction, error) {
	conds := []string{"user_id = ?"}
	args := []any{userID}

	if filter.Month != "" {
		m, err := domain.ValidateMonth(filter.Month)
		if err != nil {
			return nil, err
		}
		conds = append(conds, "date LIKE ?")
		args = append(args, m+"-%")
	}
	if filter.Category != "" {
		c, err := domain.NormalizeCategory(filter.Category)
		if err != nil {
			return nil, err
		}
		conds = append(conds, "category = ?")
		args = append(args, c)
	}
	if filter.Type != "" {
		if !domain.ValidAllTxType(filter.Type) {
			return nil, domain.ValidationErrorf(`tipo inválido. Use "income", "expense" ou "transfer"`)
		}
		conds = append(conds, "type = ?")
		args = append(args, filter.Type)
	}
	if filter.AccountID != "" {
		conds = append(conds, "(account_id = ? OR to_account_id = ?)")
		args = append(args, filter.AccountID, filter.AccountID)
	}
	if q := strings.ToLower(strings.TrimSpace(filter.Query)); q != "" {
		conds = append(conds, "(LOWER(category) LIKE ? OR LOWER(description) LIKE ?)")
		pattern := "%" + q + "%"
		args = append(args, pattern, pattern)
	}

	query := `SELECT id, type, amount_cents, category, description, date, account_id, to_account_id, recurring_rule_id, created_at
		FROM transactions WHERE ` + strings.Join(conds, " AND ") + ` ORDER BY date DESC, created_at DESC`
	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []domain.Transaction{}
	for rows.Next() {
		tx, err := scanTransaction(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, tx)
	}
	return items, rows.Err()
}

func (s *SQLiteStore) getTransactionByID(userID, id string) (domain.Transaction, error) {
	if id == "" {
		return domain.Transaction{}, domain.ValidationErrorf("ID da transação é obrigatório")
	}
	row := s.db.QueryRow(
		`SELECT id, type, amount_cents, category, description, date, account_id, to_account_id, recurring_rule_id, created_at
		 FROM transactions WHERE id = ? AND user_id = ?`, id, userID,
	)
	tx, err := scanTransaction(row)
	if err == sql.ErrNoRows {
		return domain.Transaction{}, domain.NotFoundErrorf("transação não encontrada: %q", id)
	}
	return tx, err
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanTransaction(r rowScanner) (domain.Transaction, error) {
	var tx domain.Transaction
	var amount int64
	var toAcc, recID sql.NullString
	err := r.Scan(
		&tx.ID, &tx.Type, &amount, &tx.Category, &tx.Description,
		&tx.Date, &tx.AccountID, &toAcc, &recID, &tx.CreatedAt,
	)
	if err != nil {
		return domain.Transaction{}, err
	}
	tx.AmountCents = domain.Cents(amount)
	if toAcc.Valid {
		v := toAcc.String
		tx.ToAccountID = &v
	}
	if recID.Valid {
		v := recID.String
		tx.RecurringRuleID = &v
	}
	return tx, nil
}
