package store

import (
	"database/sql"
	"errors"
	"os"
	"path/filepath"
	"testing"

	"atelier-fin/backend/internal/domain"
	_ "modernc.org/sqlite"
)

func openTestStore(t *testing.T) (*SQLiteStore, string) {
	t.Helper()
	s, err := OpenSQLite(":memory:")
	if err != nil {
		t.Fatalf("OpenSQLite: %v", err)
	}
	t.Cleanup(func() { _ = s.Close() })
	sess, err := s.RegisterUser("Alice", "alice@example.com", "senha1234")
	if err != nil {
		t.Fatalf("RegisterUser: %v", err)
	}
	return s, sess.User.ID
}

func TestSQLiteCRUDTransfersBudgetsAndRecurring(t *testing.T) {
	s, uid := openTestStore(t)

	accs, err := s.ListAccounts(uid)
	if err != nil || len(accs) != 1 {
		t.Fatalf("ListAccounts = (%+v, %v)", accs, err)
	}
	mainAccID := accs[0].ID

	wallet, err := s.AddAccount(uid, "Carteira", "cash")
	if err != nil {
		t.Fatalf("AddAccount: %v", err)
	}
	if _, err := s.AddTransaction(uid, "income", 300000, "Salario", "Mensal", "2026-11-01", ""); err != nil {
		t.Fatalf("AddTransaction income: %v", err)
	}
	exp, err := s.AddTransaction(uid, "expense", 85000, "Alimentacao", "Mercado", "2026-11-05", "")
	if err != nil {
		t.Fatalf("AddTransaction expense: %v", err)
	}

	newAmt := domain.Cents(90000)
	updated, err := s.UpdateTransaction(uid, exp.ID, domain.TxPatch{AmountCents: &newAmt})
	if err != nil || updated.AmountCents != 90000 {
		t.Fatalf("UpdateTransaction = (%+v, %v)", updated, err)
	}

	if _, err := s.AddTransfer(uid, mainAccID, wallet.ID, 50000, "Saque", "2026-11-06"); err != nil {
		t.Fatalf("AddTransfer: %v", err)
	}
	if _, err := s.SetBudget(uid, "2026-11", "alimentacao", 100000); err != nil {
		t.Fatalf("SetBudget: %v", err)
	}

	summary, err := s.GetMonthlySummary(uid, "2026-11")
	if err != nil {
		t.Fatalf("GetMonthlySummary: %v", err)
	}
	if summary.TotalIncomeCents != 300000 || summary.TotalExpenseCents != 90000 || summary.BalanceCents != 210000 {
		t.Fatalf("unexpected summary totals: %+v", summary)
	}

	balByID := map[string]domain.Cents{}
	for _, a := range summary.Accounts {
		balByID[a.ID] = a.BalanceCents
	}
	if balByID[mainAccID] != 160000 || balByID[wallet.ID] != 50000 {
		t.Fatalf("unexpected account balances: %+v", balByID)
	}

	if _, err := s.DeleteAccount(uid, wallet.ID); !errors.Is(err, domain.ErrValidation) {
		t.Fatalf("expected ErrValidation deleting referenced account, got %v", err)
	}

	if _, err := s.AddRecurring(uid, "expense", 180000, "moradia", "Aluguel", 31, ""); err != nil {
		t.Fatalf("AddRecurring: %v", err)
	}
	r1, err := s.ApplyRecurring(uid, "2026-02")
	if err != nil || r1.CreatedCount != 1 || r1.Created[0].Date != "2026-02-28" {
		t.Fatalf("ApplyRecurring 1 = (%+v, %v)", r1, err)
	}
	r2, err := s.ApplyRecurring(uid, "2026-02")
	if err != nil || r2.CreatedCount != 0 || r2.SkippedCount != 1 {
		t.Fatalf("ApplyRecurring 2 = (%+v, %v)", r2, err)
	}
}

func TestAuthMultiUserIsolationAndV1Migration(t *testing.T) {
	// 1) Simula banco SQLite v1 criado na REQ-003 (sem users e sem user_id)
	dbPath := filepath.Join(t.TempDir(), "legacy-v1.db")
	rawDB, err := sql.Open("sqlite", dbPath)
	if err != nil {
		t.Fatalf("open raw v1: %v", err)
	}
	_, err = rawDB.Exec(`
		CREATE TABLE accounts (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE COLLATE NOCASE, type TEXT NOT NULL);
		CREATE TABLE transactions (id TEXT PRIMARY KEY, type TEXT NOT NULL, amount_cents INTEGER NOT NULL, category TEXT NOT NULL, description TEXT NOT NULL, date TEXT NOT NULL, account_id TEXT NOT NULL, to_account_id TEXT, recurring_rule_id TEXT, created_at TEXT NOT NULL);
		CREATE TABLE budgets (month TEXT NOT NULL, category TEXT NOT NULL, limit_cents INTEGER NOT NULL, PRIMARY KEY (month, category));
		CREATE TABLE recurring_rules (id TEXT PRIMARY KEY, type TEXT NOT NULL, amount_cents INTEGER NOT NULL, category TEXT NOT NULL, description TEXT NOT NULL, day_of_month INTEGER NOT NULL, account_id TEXT NOT NULL);
		INSERT INTO accounts VALUES ('acc_default', 'Conta Principal', 'checking');
		INSERT INTO transactions VALUES ('tx_v1', 'income', 75000, 'salario', 'Do v1', '2026-11-01', 'acc_default', NULL, NULL, '2026-11-01T10:00:00Z');
	`)
	if err != nil {
		t.Fatalf("seed v1: %v", err)
	}
	_ = rawDB.Close()

	// 2) Abre com store v2 -> deve migrar sem perder tx_v1
	s, err := OpenSQLite(dbPath)
	if err != nil {
		t.Fatalf("OpenSQLite migrate: %v", err)
	}
	defer func() { _ = s.Close() }()

	alice, err := s.RegisterUser("Alice", "alice@test.com", "segredo123")
	if err != nil {
		t.Fatalf("register alice: %v", err)
	}
	bob, err := s.RegisterUser("Bob", "bob@test.com", "segredo456")
	if err != nil {
		t.Fatalf("register bob: %v", err)
	}

	// Alice (1a usuaria) adotou tx_v1; Bob comeca zerado
	aliceTxs, _ := s.ListTransactions(alice.User.ID, domain.TxFilter{})
	bobTxs, _ := s.ListTransactions(bob.User.ID, domain.TxFilter{})
	if len(aliceTxs) != 1 || aliceTxs[0].ID != "tx_v1" {
		t.Fatalf("alice should inherit tx_v1, got %+v", aliceTxs)
	}
	if len(bobTxs) != 0 {
		t.Fatalf("bob should see 0 txs, got %+v", bobTxs)
	}

	// Anti-IDOR: Bob nao pode editar nem deletar tx_v1 da Alice
	if _, err := s.DeleteTransaction(bob.User.ID, "tx_v1"); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("expected ErrNotFound for cross-user delete, got %v", err)
	}

	// Sessao valida -> revogada -> invalida
	if u, err := s.ValidateSession(alice.Token); err != nil || u.ID != alice.User.ID {
		t.Fatalf("ValidateSession failed: (%+v, %v)", u, err)
	}
	_ = s.RevokeSession(alice.Token)
	if _, err := s.ValidateSession(alice.Token); !errors.Is(err, domain.ErrUnauthorized) {
		t.Fatalf("expected ErrUnauthorized after revoke, got %v", err)
	}

	// Login com senha errada falha com ErrUnauthorized
	if _, err := s.Login("alice@test.com", "errada123"); !errors.Is(err, domain.ErrUnauthorized) {
		t.Fatalf("expected ErrUnauthorized on bad password, got %v", err)
	}
	// Email duplicado retorna ErrConflict
	if _, err := s.RegisterUser("Alice2", "ALICE@test.com", "segredo789"); !errors.Is(err, domain.ErrConflict) {
		t.Fatalf("expected ErrConflict on duplicate email, got %v", err)
	}
}

func TestImportLegacyJSONAdoptedByFirstUser(t *testing.T) {
	s, err := OpenSQLite(":memory:")
	if err != nil {
		t.Fatalf("OpenSQLite: %v", err)
	}
	defer func() { _ = s.Close() }()

	tmp := filepath.Join(t.TempDir(), "ledger.json")
	raw := `{"version":1,"transactions":[{"id":"tx_old","type":"income","amountCents":50000,"category":"salario","description":"Legado","date":"2026-11-01","createdAt":"2026-11-01T10:00:00Z"}]}`
	if err := os.WriteFile(tmp, []byte(raw), 0o644); err != nil {
		t.Fatalf("write legacy: %v", err)
	}
	if err := s.ImportLegacyJSONIfEmpty(tmp); err != nil {
		t.Fatalf("ImportLegacyJSONIfEmpty: %v", err)
	}
	first, err := s.RegisterUser("First", "first@test.com", "senha1234")
	if err != nil {
		t.Fatalf("RegisterUser: %v", err)
	}
	items, err := s.ListTransactions(first.User.ID, domain.TxFilter{Month: "2026-11"})
	if err != nil || len(items) != 1 || items[0].ID != "tx_old" {
		t.Fatalf("expected adopted tx_old, got (%+v, %v)", items, err)
	}
}
