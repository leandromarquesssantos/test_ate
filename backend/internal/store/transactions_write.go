package store

import (
	"strings"
	"time"

	"atelier-fin/backend/internal/domain"
)

func (s *SQLiteStore) AddTransaction(
	userID, txType string,
	amount domain.Cents,
	category, description, dateStr, accountID string,
) (domain.Transaction, error) {
	if !domain.ValidTxType(txType) {
		return domain.Transaction{}, domain.ValidationErrorf(`tipo inválido. Use "income" ou "expense"`)
	}
	validAmount, err := domain.AssertPositiveCents(int64(amount), "amountCents")
	if err != nil {
		return domain.Transaction{}, err
	}
	validCat, err := domain.NormalizeCategory(category)
	if err != nil {
		return domain.Transaction{}, err
	}
	if strings.TrimSpace(dateStr) == "" {
		dateStr = domain.TodayISO(time.Now())
	}
	validDate, err := domain.ValidateDate(dateStr)
	if err != nil {
		return domain.Transaction{}, err
	}
	if strings.TrimSpace(accountID) == "" {
		accountID, err = s.defaultAccountForUser(userID)
		if err != nil {
			return domain.Transaction{}, err
		}
	} else if err := s.ensureAccountExists(userID, accountID); err != nil {
		return domain.Transaction{}, err
	}

	tx := domain.Transaction{
		ID:          domain.NewID("tx"),
		Type:        txType,
		AmountCents: validAmount,
		Category:    validCat,
		Description: domain.CleanDescription(description),
		Date:        validDate,
		AccountID:   accountID,
		CreatedAt:   time.Now().UTC().Format(time.RFC3339Nano),
	}
	_, err = s.db.Exec(
		`INSERT INTO transactions (id, user_id, type, amount_cents, category, description, date, account_id, to_account_id, recurring_rule_id, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)`,
		tx.ID, userID, tx.Type, int64(tx.AmountCents), tx.Category, tx.Description, tx.Date, tx.AccountID, tx.CreatedAt,
	)
	return tx, err
}

func (s *SQLiteStore) AddTransfer(
	userID, fromAccountID, toAccountID string,
	amount domain.Cents,
	description, dateStr string,
) (domain.Transaction, error) {
	if err := s.ensureAccountExists(userID, fromAccountID); err != nil {
		return domain.Transaction{}, err
	}
	if err := s.ensureAccountExists(userID, toAccountID); err != nil {
		return domain.Transaction{}, err
	}
	if fromAccountID == toAccountID {
		return domain.Transaction{}, domain.ValidationErrorf("conta de origem e destino devem ser diferentes")
	}
	validAmount, err := domain.AssertPositiveCents(int64(amount), "amountCents")
	if err != nil {
		return domain.Transaction{}, err
	}
	if strings.TrimSpace(dateStr) == "" {
		dateStr = domain.TodayISO(time.Now())
	}
	validDate, err := domain.ValidateDate(dateStr)
	if err != nil {
		return domain.Transaction{}, err
	}

	toID := toAccountID
	tx := domain.Transaction{
		ID:          domain.NewID("tx"),
		Type:        "transfer",
		AmountCents: validAmount,
		Category:    "transferencia",
		Description: domain.CleanDescription(description),
		Date:        validDate,
		AccountID:   fromAccountID,
		ToAccountID: &toID,
		CreatedAt:   time.Now().UTC().Format(time.RFC3339Nano),
	}
	_, err = s.db.Exec(
		`INSERT INTO transactions (id, user_id, type, amount_cents, category, description, date, account_id, to_account_id, recurring_rule_id, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
		tx.ID, userID, tx.Type, int64(tx.AmountCents), tx.Category, tx.Description, tx.Date, tx.AccountID, toID, tx.CreatedAt,
	)
	return tx, err
}

func (s *SQLiteStore) UpdateTransaction(userID, id string, patch domain.TxPatch) (domain.Transaction, error) {
	tx, err := s.getTransactionByID(userID, strings.TrimSpace(id))
	if err != nil {
		return domain.Transaction{}, err
	}
	if patch.Type != nil {
		if tx.Type == "transfer" || !domain.ValidTxType(*patch.Type) {
			return domain.Transaction{}, domain.ValidationErrorf(`tipo inválido para edição. Use "income" ou "expense"`)
		}
		tx.Type = *patch.Type
	}
	if patch.AmountCents != nil {
		v, err := domain.AssertPositiveCents(int64(*patch.AmountCents), "amountCents")
		if err != nil {
			return domain.Transaction{}, err
		}
		tx.AmountCents = v
	}
	if patch.Category != nil {
		cat, err := domain.NormalizeCategory(*patch.Category)
		if err != nil {
			return domain.Transaction{}, err
		}
		tx.Category = cat
	}
	if patch.Description != nil {
		tx.Description = domain.CleanDescription(*patch.Description)
	}
	if patch.Date != nil {
		d, err := domain.ValidateDate(*patch.Date)
		if err != nil {
			return domain.Transaction{}, err
		}
		tx.Date = d
	}
	if patch.AccountID != nil {
		if err := s.ensureAccountExists(userID, *patch.AccountID); err != nil {
			return domain.Transaction{}, err
		}
		if tx.Type == "transfer" && tx.ToAccountID != nil && *tx.ToAccountID == *patch.AccountID {
			return domain.Transaction{}, domain.ValidationErrorf("conta de origem e destino devem ser diferentes")
		}
		tx.AccountID = *patch.AccountID
	}

	_, err = s.db.Exec(
		`UPDATE transactions SET type=?, amount_cents=?, category=?, description=?, date=?, account_id=?
		 WHERE id=? AND user_id=?`,
		tx.Type, int64(tx.AmountCents), tx.Category, tx.Description, tx.Date, tx.AccountID, tx.ID, userID,
	)
	return tx, err
}

func (s *SQLiteStore) DeleteTransaction(userID, id string) (domain.Transaction, error) {
	tx, err := s.getTransactionByID(userID, strings.TrimSpace(id))
	if err != nil {
		return domain.Transaction{}, err
	}
	_, err = s.db.Exec(`DELETE FROM transactions WHERE id = ? AND user_id = ?`, tx.ID, userID)
	return tx, err
}
