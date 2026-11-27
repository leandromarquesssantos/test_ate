package cli

import (
	"regexp"
	"strings"
	"testing"

	"atelier-fin/backend/internal/store"
)

func TestCLIEndToEnd(t *testing.T) {
	s, err := store.OpenSQLite(":memory:")
	if err != nil {
		t.Fatalf("OpenSQLite: %v", err)
	}
	defer func() { _ = s.Close() }()

	regOut, err := Run([]string{"users", "register", "--name", "Alice", "--email", "alice@cli.test", "--password", "senha1234"}, s)
	if err != nil || !strings.Contains(regOut, "Usuário criado: usr_") {
		t.Fatalf("users register = (%q, %v)", regOut, err)
	}

	accListOut, err := Run([]string{"accounts", "list"}, s)
	if err != nil {
		t.Fatalf("accounts list: %v", err)
	}
	mainAccID := regexp.MustCompile(`acc_[a-f0-9]+`).FindString(accListOut)

	out, err := Run([]string{"add", "--type", "income", "--amount", "4500,00", "--category", "salario", "--desc", "Mensal", "--date", "2026-11-01"}, s)
	if err != nil || !strings.Contains(out, "Transação criada: tx_") {
		t.Fatalf("add income = (%q, %v)", out, err)
	}

	expOut, err := Run([]string{"add", "--type", "expense", "--amount", "900.00", "--category", "alimentacao", "--desc", "Compras", "--date", "2026-11-12"}, s)
	if err != nil {
		t.Fatalf("add expense: %v", err)
	}
	txID := regexp.MustCompile(`tx_[a-f0-9]+`).FindString(expOut)

	editOut, err := Run([]string{"edit", txID, "--amount", "950,00", "--desc", "Supermercado"}, s)
	if err != nil || !strings.Contains(editOut, "R$ 950,00") {
		t.Fatalf("edit = (%q, %v)", editOut, err)
	}

	accOut, err := Run([]string{"accounts", "add", "--name", "Carteira", "--type", "cash"}, s)
	if err != nil {
		t.Fatalf("accounts add: %v", err)
	}
	walletID := regexp.MustCompile(`acc_[a-f0-9]+`).FindString(accOut)

	trOut, err := Run([]string{"transfer", "--from", mainAccID, "--to", walletID, "--amount", "200"}, s)
	if err != nil || !strings.Contains(trOut, "Transferência criada") {
		t.Fatalf("transfer = (%q, %v)", trOut, err)
	}

	if _, err := Run([]string{"recurring", "add", "--type", "expense", "--amount", "120", "--category", "internet", "--day", "15"}, s); err != nil {
		t.Fatalf("recurring add: %v", err)
	}
	appOut, err := Run([]string{"recurring", "apply", "--month", "2026-11"}, s)
	if err != nil || !strings.Contains(appOut, "1 criada(s)") {
		t.Fatalf("recurring apply = (%q, %v)", appOut, err)
	}

	if _, err := Run([]string{"budget", "--month", "2026-11", "--category", "alimentacao", "--limit", "1000"}, s); err != nil {
		t.Fatalf("budget: %v", err)
	}
	sumOut, err := Run([]string{"summary", "--month", "2026-11"}, s)
	if err != nil || !strings.Contains(sumOut, "95% - WARNING") {
		t.Fatalf("summary = (%q, %v)", sumOut, err)
	}

	csvOut, err := Run([]string{"export", "--month", "2026-11"}, s)
	if err != nil || !strings.Contains(csvOut, "Supermercado") {
		t.Fatalf("export = (%q, %v)", csvOut, err)
	}

	delOut, err := Run([]string{"delete", txID}, s)
	if err != nil || !strings.Contains(delOut, "Transação removida") {
		t.Fatalf("delete = (%q, %v)", delOut, err)
	}
}
