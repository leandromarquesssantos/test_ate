package cli

import (
	"fmt"
	"strings"
	"time"

	"atelier-fin/backend/internal/domain"
	"atelier-fin/backend/internal/store"
)

const helpText = `Atelier Fin CLI (Go + SQLite) — Uso:
  add --type <income|expense> --amount <valor> --category <cat> [--account <id>] [--desc <texto>] [--date YYYY-MM-DD]
  edit <id> [--amount <valor>] [--category <cat>] [--desc <texto>] [--date YYYY-MM-DD]
  list [--month YYYY-MM] [--category <cat>] [--type <tipo>] [--account <id>] [--q <busca>]
  delete <id>
  budget --category <cat> --limit <valor> [--month YYYY-MM]
  summary [--month YYYY-MM]
  accounts [list | add --name <nome> --type <tipo> | delete <id>]
  transfer --from <id> --to <id> --amount <valor> [--desc <texto>]
  recurring [list | add --type <tipo> --amount <valor> --category <cat> --day <1-31> | apply --month YYYY-MM]
  export [--month YYYY-MM]`

type parsedArgs struct {
	command    string
	flags      map[string]string
	positional []string
}

func parseArgs(argv []string) parsedArgs {
	if len(argv) == 0 {
		return parsedArgs{command: "help", flags: map[string]string{}}
	}
	res := parsedArgs{command: argv[0], flags: map[string]string{}}
	rest := argv[1:]
	for i := 0; i < len(rest); i++ {
		tok := rest[i]
		if strings.HasPrefix(tok, "--") {
			key := tok[2:]
			if i+1 < len(rest) && !strings.HasPrefix(rest[i+1], "--") {
				res.flags[key] = rest[i+1]
				i++
			} else {
				res.flags[key] = "true"
			}
		} else {
			res.positional = append(res.positional, tok)
		}
	}
	return res
}

func Run(argv []string, s *store.SQLiteStore) (string, error) {
	p := parseArgs(argv)
	if p.command == "help" || p.flags["help"] != "" {
		return helpText, nil
	}

	switch p.command {
	case "add":
		amt, err := domain.ParseCurrencyToCents(p.flags["amount"])
		if err != nil {
			return "", err
		}
		desc := p.flags["desc"]
		if desc == "" {
			desc = p.flags["description"]
		}
		tx, err := s.AddTransaction(p.flags["type"], amt, p.flags["category"], desc, p.flags["date"], p.flags["account"])
		if err != nil {
			return "", err
		}
		sign := "-"
		if tx.Type == "income" {
			sign = "+"
		}
		return fmt.Sprintf("Transação criada: %s | %s | %s | %s%s", tx.ID, tx.Date, tx.Category, sign, domain.FormatCentsBRL(tx.AmountCents)), nil

	case "edit":
		id := firstPosOrFlag(p.positional, p.flags, "id")
		var patch domain.TxPatch
		if v := p.flags["type"]; v != "" {
			patch.Type = &v
		}
		if v := p.flags["amount"]; v != "" {
			amt, err := domain.ParseCurrencyToCents(v)
			if err != nil {
				return "", err
			}
			patch.AmountCents = &amt
		}
		if v := p.flags["category"]; v != "" {
			patch.Category = &v
		}
		if v, ok := p.flags["desc"]; ok {
			patch.Description = &v
		}
		if v := p.flags["date"]; v != "" {
			patch.Date = &v
		}
		if v := p.flags["account"]; v != "" {
			patch.AccountID = &v
		}
		updated, err := s.UpdateTransaction(id, patch)
		if err != nil {
			return "", err
		}
		return fmt.Sprintf("Transação atualizada: %s | %s | %s", updated.ID, updated.Category, domain.FormatCentsBRL(updated.AmountCents)), nil

	case "list":
		items, err := s.ListTransactions(domain.TxFilter{
			Month:     p.flags["month"],
			Category:  p.flags["category"],
			Type:      p.flags["type"],
			AccountID: p.flags["account"],
			Query:     p.flags["q"],
		})
		if err != nil {
			return "", err
		}
		if len(items) == 0 {
			return "Nenhuma transação encontrada.", nil
		}
		lines := make([]string, 0, len(items))
		for _, tx := range items {
			sign := "-"
			if tx.Type == "income" {
				sign = "+"
			} else if tx.Type == "transfer" {
				sign = "⇄"
			}
			desc := ""
			if tx.Description != "" {
				desc = " (" + tx.Description + ")"
			}
			lines = append(lines, fmt.Sprintf("%s | %s | %-14s | %s%s%s", tx.ID, tx.Date, tx.Category, sign, domain.FormatCentsBRL(tx.AmountCents), desc))
		}
		return strings.Join(lines, "\n"), nil

	case "delete":
		removed, err := s.DeleteTransaction(firstPosOrFlag(p.positional, p.flags, "id"))
		if err != nil {
			return "", err
		}
		return fmt.Sprintf("Transação removida: %s (%s)", removed.ID, removed.Category), nil

	case "budget":
		limit, err := domain.ParseCurrencyToCents(p.flags["limit"])
		if err != nil {
			return "", err
		}
		month := p.flags["month"]
		if month == "" {
			month = domain.CurrentMonthISO(time.Now())
		}
		saved, err := s.SetBudget(month, p.flags["category"], limit)
		if err != nil {
			return "", err
		}
		return fmt.Sprintf("Orçamento definido: %s | %s -> %s", saved.Month, saved.Category, domain.FormatCentsBRL(saved.LimitCents)), nil

	case "summary":
		summary, err := s.GetMonthlySummary(p.flags["month"])
		if err != nil {
			return "", err
		}
		lines := []string{
			fmt.Sprintf("Resumo Financeiro (%s)", summary.Month),
			fmt.Sprintf("  Receitas: %s", domain.FormatCentsBRL(summary.TotalIncomeCents)),
			fmt.Sprintf("  Despesas: %s", domain.FormatCentsBRL(summary.TotalExpenseCents)),
			fmt.Sprintf("  Saldo:    %s", domain.FormatCentsBRL(summary.BalanceCents)),
		}
		if len(summary.Budgets) > 0 {
			lines = append(lines, "  Orçamentos:")
			for _, b := range summary.Budgets {
				lines = append(lines, fmt.Sprintf("    - %s: %s / %s (%d%% - %s)",
					b.Category, domain.FormatCentsBRL(b.SpentCents), domain.FormatCentsBRL(b.LimitCents),
					b.PercentUsed, strings.ToUpper(b.Status)))
			}
		}
		return strings.Join(lines, "\n"), nil
	}

	out, handled, err := runExtra(p, s)
	if handled {
		return out, err
	}
	return "", fmt.Errorf(`comando desconhecido: %q. Use "help" para ver opções`, p.command)
}

func firstPosOrFlag(pos []string, flags map[string]string, key string) string {
	if len(pos) > 0 {
		return pos[0]
	}
	return flags[key]
}
