package store

import (
	"errors"
	"os"
	"path/filepath"
	"testing"

	"atelier-fin/backend/internal/domain"
)

func openTestStore(t *testing.T) *SQLiteStore {
	t.Helper()
	s, err := OpenSQLite(":memory:")
	if err != nil {
		t.Fatalf("OpenSQLite: %v", err)
	}
	t.Cleanup(func() { _ = s.Close() })
	return s
}

func TestSQLiteCRUDTransfersBudgetsAndRecurring(t *testing.T) {
	s := openTestStore(t)

	wallet, err := s.AddAccount("Carteira", "cash")
	if err != nil {
		t.Fatalf("AddAccount: %v", err)
	}
	if _, err := s.AddTransaction("income", 300000, "Salario", "Mensal", "2026-11-01", ""); err != nil {
		t.Fatalf("AddTransaction income: %v", err)
	}
	exp, err := s.AddTransaction("expense", 85000, "Alimentacao", "Mercado", "2026-11-05", "")
	if err != nil {
		t.Fatalf("AddTransaction expense: %v", err)
	}

	newAmt := domain.Cents(90000)
	updated, err := s.UpdateTransaction(exp.ID, domain.TxPatch{AmountCents: &newAmt})
	if err != nil || updated.AmountCents != 90000 {
		t.Fatalf("UpdateTransaction = (%+v, %v)", updated, err)
	}

	if _, err := s.AddTransfer(domain.DefaultAccountID, wallet.ID, 50000, "Saque", "2026-11-06"); err != nil {
		t.Fatalf("AddTransfer: %v", err)
	}
	if _, err := s.SetBudget("2026-11", "alimentacao", 100000); err != nil {
		t.Fatalf("SetBudget: %v", err)
	}

	summary, err := s.GetMonthlySummary("2026-11")
	if err != nil {
		t.Fatalf("GetMonthlySummary: %v", err)
	}
	if summary.TotalIncomeCents != 300000 || summary.TotalExpenseCents != 90000 || summary.BalanceCents != 210000 {
		t.Fatalf("unexpected summary totals: %+v", summary)
	}
	if len(summary.Budgets) != 1 || summary.Budgets[0].Status != "warning" {
		t.Fatalf("unexpected budgets: %+v", summary.Budgets)
	}

	balByID := map[string]domain.Cents{}
	for _, a := range summary.Accounts {
		balByID[a.ID] = a.BalanceCents
	}
	if balByID[domain.DefaultAccountID] != 160000 || balByID[wallet.ID] != 50000 {
		t.Fatalf("unexpected account balances: %+v", balByID)
	}

	if _, err := s.DeleteAccount(wallet.ID); !errors.Is(err, domain.ErrValidation) {
		t.Fatalf("expected ErrValidation deleting referenced account, got %v", err)
	}

	if _, err := s.AddRecurring("expense", 180000, "moradia", "Aluguel", 31, ""); err != nil {
		t.Fatalf("AddRecurring: %v", err)
	}
	r1, err := s.ApplyRecurring("2026-02")
	if err != nil || r1.CreatedCount != 1 || r1.Created[0].Date != "2026-02-28" {
		t.Fatalf("ApplyRecurring 1 = (%+v, %v)", r1, err)
	}
	r2, err := s.ApplyRecurring("2026-02")
	if err != nil || r2.CreatedCount != 0 || r2.SkippedCount != 1 {
		t.Fatalf("ApplyRecurring 2 = (%+v, %v)", r2, err)
	}
}

func TestImportLegacyJSON(t *testing.T) {
	s := openTestStore(t)
	tmp := filepath.Join(t.TempDir(), "ledger.json")
	raw := `{"version":1,"transactions":[{"id":"tx_old","type":"income","amountCents":50000,"category":"salario","description":"Legado","date":"2026-11-01","createdAt":"2026-11-01T10:00:00Z"}]}`
	if err := os.WriteFile(tmp, []byte(raw), 0o644); err != nil {
		t.Fatalf("write legacy: %v", err)
	}
	if err := s.ImportLegacyJSONIfEmpty(tmp); err != nil {
		t.Fatalf("ImportLegacyJSONIfEmpty: %v", err)
	}
	items, err := s.ListTransactions(domain.TxFilter{Month: "2026-11"})
	if err != nil || len(items) != 1 || items[0].ID != "tx_old" {
		t.Fatalf("expected imported tx_old, got (%+v, %v)", items, err)
	}
}
