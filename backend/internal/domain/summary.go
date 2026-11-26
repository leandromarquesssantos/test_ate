package domain

import (
	"math"
	"sort"
)

func BuildMonthlySummary(
	month string,
	transactions []Transaction,
	budgets []Budget,
	accounts []Account,
) MonthlySummary {
	var totalIncome Cents
	var totalExpense Cents
	byCat := make(map[string]Cents)

	for _, tx := range transactions {
		switch tx.Type {
		case "income":
			totalIncome += tx.AmountCents
		case "expense":
			totalExpense += tx.AmountCents
			byCat[tx.Category] += tx.AmountCents
		}
	}

	budgetStatuses := make([]BudgetStatus, 0, len(budgets))
	for _, b := range budgets {
		spent := byCat[b.Category]
		pct := int(math.Round((float64(spent) / float64(b.LimitCents)) * 100))
		status := "ok"
		if spent > b.LimitCents {
			status = "exceeded"
		} else if pct >= 80 {
			status = "warning"
		}
		budgetStatuses = append(budgetStatuses, BudgetStatus{
			Category:       b.Category,
			LimitCents:     b.LimitCents,
			SpentCents:     spent,
			RemainingCents: b.LimitCents - spent,
			PercentUsed:    pct,
			Status:         status,
		})
	}

	categories := make([]CategorySpend, 0, len(byCat))
	for cat, spent := range byCat {
		categories = append(categories, CategorySpend{Category: cat, SpentCents: spent})
	}
	sort.Slice(categories, func(i, j int) bool {
		if categories[i].SpentCents != categories[j].SpentCents {
			return categories[i].SpentCents > categories[j].SpentCents
		}
		return categories[i].Category < categories[j].Category
	})

	if accounts == nil {
		accounts = []Account{}
	}

	return MonthlySummary{
		Month:             month,
		TransactionCount:  len(transactions),
		TotalIncomeCents:  totalIncome,
		TotalExpenseCents: totalExpense,
		BalanceCents:      totalIncome - totalExpense,
		Categories:        categories,
		Budgets:           budgetStatuses,
		Accounts:          accounts,
	}
}
