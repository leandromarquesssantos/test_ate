package domain

type Account struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Type         string `json:"type"`
	BalanceCents Cents  `json:"balanceCents"`
}

type Transaction struct {
	ID              string  `json:"id"`
	Type            string  `json:"type"`
	AmountCents     Cents   `json:"amountCents"`
	Category        string  `json:"category"`
	Description     string  `json:"description"`
	Date            string  `json:"date"`
	AccountID       string  `json:"accountId"`
	ToAccountID     *string `json:"toAccountId"`
	RecurringRuleID *string `json:"recurringRuleId"`
	CreatedAt       string  `json:"createdAt"`
}

type Budget struct {
	Month      string `json:"month"`
	Category   string `json:"category"`
	LimitCents Cents  `json:"limitCents"`
}

type RecurringRule struct {
	ID          string `json:"id"`
	Type        string `json:"type"`
	AmountCents Cents  `json:"amountCents"`
	Category    string `json:"category"`
	Description string `json:"description"`
	DayOfMonth  int    `json:"dayOfMonth"`
	AccountID   string `json:"accountId"`
}

type CategorySpend struct {
	Category   string `json:"category"`
	SpentCents Cents  `json:"spentCents"`
}

type BudgetStatus struct {
	Category       string `json:"category"`
	LimitCents     Cents  `json:"limitCents"`
	SpentCents     Cents  `json:"spentCents"`
	RemainingCents Cents  `json:"remainingCents"`
	PercentUsed    int    `json:"percentUsed"`
	Status         string `json:"status"`
}

type MonthlySummary struct {
	Month             string          `json:"month"`
	TransactionCount  int             `json:"transactionCount"`
	TotalIncomeCents  Cents           `json:"totalIncomeCents"`
	TotalExpenseCents Cents           `json:"totalExpenseCents"`
	BalanceCents      Cents           `json:"balanceCents"`
	Categories        []CategorySpend `json:"categories"`
	Budgets           []BudgetStatus  `json:"budgets"`
	Accounts          []Account       `json:"accounts"`
}

type ApplyRecurringResult struct {
	Month        string        `json:"month"`
	CreatedCount int           `json:"createdCount"`
	SkippedCount int           `json:"skippedCount"`
	Created      []Transaction `json:"created"`
}

type TxFilter struct {
	Month     string
	Category  string
	Type      string
	AccountID string
	Query     string
}

type TxPatch struct {
	Type        *string
	AmountCents *Cents
	Category    *string
	Description *string
	Date        *string
	AccountID   *string
}
