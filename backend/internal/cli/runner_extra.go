package cli

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"atelier-fin/backend/internal/domain"
	"atelier-fin/backend/internal/store"
)

func runExtra(p parsedArgs, s *store.SQLiteStore) (string, bool, error) {
	switch p.command {
	case "accounts":
		action := "list"
		if len(p.positional) > 0 {
			action = p.positional[0]
		}
		switch action {
		case "list":
			items, err := s.ListAccounts()
			if err != nil {
				return "", true, err
			}
			lines := make([]string, 0, len(items))
			for _, a := range items {
				lines = append(lines, fmt.Sprintf("%s | %s (%s) | Saldo: %s", a.ID, a.Name, a.Type, domain.FormatCentsBRL(a.BalanceCents)))
			}
			return strings.Join(lines, "\n"), true, nil
		case "add":
			acc, err := s.AddAccount(p.flags["name"], p.flags["type"])
			if err != nil {
				return "", true, err
			}
			return fmt.Sprintf("Conta criada: %s | %s (%s)", acc.ID, acc.Name, acc.Type), true, nil
		case "delete":
			id := p.flags["id"]
			if len(p.positional) > 1 {
				id = p.positional[1]
			}
			removed, err := s.DeleteAccount(id)
			if err != nil {
				return "", true, err
			}
			return fmt.Sprintf("Conta removida: %s (%s)", removed.ID, removed.Name), true, nil
		}

	case "transfer":
		amt, err := domain.ParseCurrencyToCents(p.flags["amount"])
		if err != nil {
			return "", true, err
		}
		tx, err := s.AddTransfer(p.flags["from"], p.flags["to"], amt, p.flags["desc"], p.flags["date"])
		if err != nil {
			return "", true, err
		}
		return fmt.Sprintf("Transferência criada: %s | %s -> %s | %s", tx.ID, tx.AccountID, *tx.ToAccountID, domain.FormatCentsBRL(tx.AmountCents)), true, nil

	case "recurring":
		action := "list"
		if len(p.positional) > 0 {
			action = p.positional[0]
		}
		switch action {
		case "list":
			items, err := s.ListRecurring()
			if err != nil {
				return "", true, err
			}
			if len(items) == 0 {
				return "Nenhuma recorrência cadastrada.", true, nil
			}
			lines := make([]string, 0, len(items))
			for _, r := range items {
				lines = append(lines, fmt.Sprintf("%s | Dia %d | %s | %s | %s", r.ID, r.DayOfMonth, r.Type, r.Category, domain.FormatCentsBRL(r.AmountCents)))
			}
			return strings.Join(lines, "\n"), true, nil
		case "add":
			amt, err := domain.ParseCurrencyToCents(p.flags["amount"])
			if err != nil {
				return "", true, err
			}
			day, err := strconv.Atoi(p.flags["day"])
			if err != nil {
				return "", true, domain.ValidationErrorf("day deve ser um inteiro entre 1 e 31")
			}
			rule, err := s.AddRecurring(p.flags["type"], amt, p.flags["category"], p.flags["desc"], day, p.flags["account"])
			if err != nil {
				return "", true, err
			}
			return fmt.Sprintf("Recorrência criada: %s | Dia %d | %s", rule.ID, rule.DayOfMonth, rule.Category), true, nil
		case "delete":
			id := p.flags["id"]
			if len(p.positional) > 1 {
				id = p.positional[1]
			}
			removed, err := s.DeleteRecurring(id)
			if err != nil {
				return "", true, err
			}
			return fmt.Sprintf("Recorrência removida: %s", removed.ID), true, nil
		case "apply":
			month := p.flags["month"]
			if month == "" {
				month = domain.CurrentMonthISO(time.Now())
			}
			res, err := s.ApplyRecurring(month)
			if err != nil {
				return "", true, err
			}
			return fmt.Sprintf("Recorrências (%s): %d criada(s), %d já existente(s).", res.Month, res.CreatedCount, res.SkippedCount), true, nil
		}

	case "export":
		csv, err := s.ExportCSV(domain.TxFilter{
			Month:     p.flags["month"],
			Category:  p.flags["category"],
			Type:      p.flags["type"],
			AccountID: p.flags["account"],
			Query:     p.flags["q"],
		})
		return csv, true, err
	}

	return "", false, nil
}
