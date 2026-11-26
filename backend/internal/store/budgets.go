package store

import (
	"database/sql"
	"strings"
	"time"

	"atelier-fin/backend/internal/domain"
)

func (s *SQLiteStore) SetBudget(month, category string, limit domain.Cents) (domain.Budget, error) {
	if strings.TrimSpace(month) == "" {
		month = domain.CurrentMonthISO(time.Now())
	}
	validMonth, err := domain.ValidateMonth(month)
	if err != nil {
		return domain.Budget{}, err
	}
	validCat, err := domain.NormalizeCategory(category)
	if err != nil {
		return domain.Budget{}, err
	}
	validLimit, err := domain.AssertPositiveCents(int64(limit), "limitCents")
	if err != nil {
		return domain.Budget{}, err
	}
	_, err = s.db.Exec(
		`INSERT INTO budgets (month, category, limit_cents) VALUES (?, ?, ?)
		 ON CONFLICT(month, category) DO UPDATE SET limit_cents = excluded.limit_cents`,
		validMonth, validCat, int64(validLimit),
	)
	return domain.Budget{Month: validMonth, Category: validCat, LimitCents: validLimit}, err
}

func (s *SQLiteStore) DeleteBudget(month, category string) (domain.Budget, error) {
	if strings.TrimSpace(month) == "" {
		month = domain.CurrentMonthISO(time.Now())
	}
	validMonth, err := domain.ValidateMonth(month)
	if err != nil {
		return domain.Budget{}, err
	}
	validCat, err := domain.NormalizeCategory(category)
	if err != nil {
		return domain.Budget{}, err
	}
	var b domain.Budget
	var limit int64
	err = s.db.QueryRow(`SELECT month, category, limit_cents FROM budgets WHERE month = ? AND category = ?`, validMonth, validCat).
		Scan(&b.Month, &b.Category, &limit)
	if err == sql.ErrNoRows {
		return domain.Budget{}, domain.NotFoundErrorf("orçamento não encontrado: %s/%s", validMonth, validCat)
	}
	if err != nil {
		return domain.Budget{}, err
	}
	b.LimitCents = domain.Cents(limit)
	_, err = s.db.Exec(`DELETE FROM budgets WHERE month = ? AND category = ?`, validMonth, validCat)
	return b, err
}

func (s *SQLiteStore) ListBudgets(month string) ([]domain.Budget, error) {
	var rows *sql.Rows
	var err error
	if strings.TrimSpace(month) != "" {
		validMonth, verr := domain.ValidateMonth(month)
		if verr != nil {
			return nil, verr
		}
		rows, err = s.db.Query(`SELECT month, category, limit_cents FROM budgets WHERE month = ? ORDER BY category ASC`, validMonth)
	} else {
		rows, err = s.db.Query(`SELECT month, category, limit_cents FROM budgets ORDER BY month DESC, category ASC`)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []domain.Budget{}
	for rows.Next() {
		var b domain.Budget
		var limit int64
		if err := rows.Scan(&b.Month, &b.Category, &limit); err != nil {
			return nil, err
		}
		b.LimitCents = domain.Cents(limit)
		items = append(items, b)
	}
	return items, rows.Err()
}

func (s *SQLiteStore) GetMonthlySummary(month string) (domain.MonthlySummary, error) {
	if strings.TrimSpace(month) == "" {
		month = domain.CurrentMonthISO(time.Now())
	}
	validMonth, err := domain.ValidateMonth(month)
	if err != nil {
		return domain.MonthlySummary{}, err
	}
	txs, err := s.ListTransactions(domain.TxFilter{Month: validMonth})
	if err != nil {
		return domain.MonthlySummary{}, err
	}
	budgets, err := s.ListBudgets(validMonth)
	if err != nil {
		return domain.MonthlySummary{}, err
	}
	accounts, err := s.ListAccounts()
	if err != nil {
		return domain.MonthlySummary{}, err
	}
	return domain.BuildMonthlySummary(validMonth, txs, budgets, accounts), nil
}

func (s *SQLiteStore) ExportCSV(filter domain.TxFilter) (string, error) {
	txs, err := s.ListTransactions(filter)
	if err != nil {
		return "", err
	}
	accounts, err := s.ListAccounts()
	if err != nil {
		return "", err
	}
	return domain.TransactionsToCSV(txs, accounts), nil
}
