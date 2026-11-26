package store

import (
	"database/sql"
	"strings"
	"time"

	"atelier-fin/backend/internal/domain"
)

func (s *SQLiteStore) ListRecurring() ([]domain.RecurringRule, error) {
	rows, err := s.db.Query(
		`SELECT id, type, amount_cents, category, description, day_of_month, account_id
		 FROM recurring_rules ORDER BY day_of_month ASC, category ASC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []domain.RecurringRule{}
	for rows.Next() {
		var r domain.RecurringRule
		var amount int64
		if err := rows.Scan(&r.ID, &r.Type, &amount, &r.Category, &r.Description, &r.DayOfMonth, &r.AccountID); err != nil {
			return nil, err
		}
		r.AmountCents = domain.Cents(amount)
		items = append(items, r)
	}
	return items, rows.Err()
}

func (s *SQLiteStore) AddRecurring(
	txType string,
	amount domain.Cents,
	category, description string,
	dayOfMonth int,
	accountID string,
) (domain.RecurringRule, error) {
	if !domain.ValidTxType(txType) {
		return domain.RecurringRule{}, domain.ValidationErrorf(`tipo recorrente inválido. Use "income" ou "expense"`)
	}
	validAmount, err := domain.AssertPositiveCents(int64(amount), "amountCents")
	if err != nil {
		return domain.RecurringRule{}, err
	}
	validCat, err := domain.NormalizeCategory(category)
	if err != nil {
		return domain.RecurringRule{}, err
	}
	validDay, err := domain.ValidateDayOfMonth(dayOfMonth)
	if err != nil {
		return domain.RecurringRule{}, err
	}
	if strings.TrimSpace(accountID) == "" {
		accountID = domain.DefaultAccountID
	}
	if err := s.ensureAccountExists(accountID); err != nil {
		return domain.RecurringRule{}, err
	}

	rule := domain.RecurringRule{
		ID:          domain.NewID("rec"),
		Type:        txType,
		AmountCents: validAmount,
		Category:    validCat,
		Description: domain.CleanDescription(description),
		DayOfMonth:  validDay,
		AccountID:   accountID,
	}
	_, err = s.db.Exec(
		`INSERT INTO recurring_rules (id, type, amount_cents, category, description, day_of_month, account_id)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		rule.ID, rule.Type, int64(rule.AmountCents), rule.Category, rule.Description, rule.DayOfMonth, rule.AccountID,
	)
	return rule, err
}

func (s *SQLiteStore) DeleteRecurring(id string) (domain.RecurringRule, error) {
	trimmed := strings.TrimSpace(id)
	if trimmed == "" {
		return domain.RecurringRule{}, domain.ValidationErrorf("ID da recorrência é obrigatório")
	}
	var r domain.RecurringRule
	var amount int64
	err := s.db.QueryRow(
		`SELECT id, type, amount_cents, category, description, day_of_month, account_id
		 FROM recurring_rules WHERE id = ?`, trimmed,
	).Scan(&r.ID, &r.Type, &amount, &r.Category, &r.Description, &r.DayOfMonth, &r.AccountID)
	if err == sql.ErrNoRows {
		return domain.RecurringRule{}, domain.NotFoundErrorf("recorrência não encontrada: %q", id)
	}
	if err != nil {
		return domain.RecurringRule{}, err
	}
	r.AmountCents = domain.Cents(amount)
	_, err = s.db.Exec(`DELETE FROM recurring_rules WHERE id = ?`, r.ID)
	return r, err
}

func (s *SQLiteStore) ApplyRecurring(month string) (domain.ApplyRecurringResult, error) {
	if strings.TrimSpace(month) == "" {
		month = domain.CurrentMonthISO(time.Now())
	}
	validMonth, err := domain.ValidateMonth(month)
	if err != nil {
		return domain.ApplyRecurringResult{}, err
	}
	rules, err := s.ListRecurring()
	if err != nil {
		return domain.ApplyRecurringResult{}, err
	}

	sqlTx, err := s.db.Begin()
	if err != nil {
		return domain.ApplyRecurringResult{}, err
	}
	defer func() { _ = sqlTx.Rollback() }()

	created := []domain.Transaction{}
	skipped := 0
	for _, rule := range rules {
		var exists int
		err := sqlTx.QueryRow(
			`SELECT COUNT(*) FROM transactions WHERE recurring_rule_id = ? AND date LIKE ?`,
			rule.ID, validMonth+"-%",
		).Scan(&exists)
		if err != nil {
			return domain.ApplyRecurringResult{}, err
		}
		if exists > 0 {
			skipped++
			continue
		}
		txDate, err := domain.ResolveDateForMonth(validMonth, rule.DayOfMonth)
		if err != nil {
			return domain.ApplyRecurringResult{}, err
		}
		ruleID := rule.ID
		item := domain.Transaction{
			ID:              domain.NewID("tx"),
			Type:            rule.Type,
			AmountCents:     rule.AmountCents,
			Category:        rule.Category,
			Description:     rule.Description,
			Date:            txDate,
			AccountID:       rule.AccountID,
			RecurringRuleID: &ruleID,
			CreatedAt:       time.Now().UTC().Format(time.RFC3339Nano),
		}
		_, err = sqlTx.Exec(
			`INSERT INTO transactions (id, type, amount_cents, category, description, date, account_id, to_account_id, recurring_rule_id, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
			item.ID, item.Type, int64(item.AmountCents), item.Category, item.Description,
			item.Date, item.AccountID, rule.ID, item.CreatedAt,
		)
		if err != nil {
			return domain.ApplyRecurringResult{}, err
		}
		created = append(created, item)
	}

	if err := sqlTx.Commit(); err != nil {
		return domain.ApplyRecurringResult{}, err
	}
	return domain.ApplyRecurringResult{
		Month:        validMonth,
		CreatedCount: len(created),
		SkippedCount: skipped,
		Created:      created,
	}, nil
}
