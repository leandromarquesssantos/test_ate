package domain

import (
	"strconv"
	"strings"
)

func SanitizeCSVText(value string) string {
	if value == "" {
		return ""
	}
	switch value[0] {
	case '=', '+', '-', '@', '\t', '\r':
		return "'" + value
	default:
		return value
	}
}

func EscapeCSVCell(value string, neutralizeFormula bool) string {
	text := value
	if neutralizeFormula {
		text = SanitizeCSVText(text)
	}
	if strings.ContainsAny(text, "\",\r\n") {
		return `"` + strings.ReplaceAll(text, `"`, `""`) + `"`
	}
	return text
}

func TransactionsToCSV(transactions []Transaction, accounts []Account) string {
	accName := make(map[string]string, len(accounts))
	for _, a := range accounts {
		accName[a.ID] = a.Name
	}

	lines := make([]string, 0, len(transactions)+1)
	lines = append(lines, "id,date,type,category,description,account,toAccount,amountBRL,amountCents")

	for _, tx := range transactions {
		fromName := accName[tx.AccountID]
		if fromName == "" {
			fromName = tx.AccountID
		}
		toName := ""
		if tx.ToAccountID != nil && *tx.ToAccountID != "" {
			toName = accName[*tx.ToAccountID]
			if toName == "" {
				toName = *tx.ToAccountID
			}
		}
		row := []string{
			EscapeCSVCell(tx.ID, false),
			EscapeCSVCell(tx.Date, false),
			EscapeCSVCell(tx.Type, false),
			EscapeCSVCell(tx.Category, true),
			EscapeCSVCell(tx.Description, true),
			EscapeCSVCell(fromName, true),
			EscapeCSVCell(toName, true),
			EscapeCSVCell(FormatCentsBRL(tx.AmountCents), false),
			EscapeCSVCell(strconv.FormatInt(int64(tx.AmountCents), 10), false),
		}
		lines = append(lines, strings.Join(row, ","))
	}

	return strings.Join(lines, "\r\n") + "\r\n"
}
