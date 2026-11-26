package domain

import (
	"errors"
	"strings"
	"testing"
)

func TestMoneyParsingAndFormatting(t *testing.T) {
	cases := map[string]Cents{
		"49.90":    4990,
		"49,90":    4990,
		"1.250,50": 125050,
		"R$ 19,99": 1999,
		"100":      10000,
	}
	for raw, want := range cases {
		got, err := ParseCurrencyToCents(raw)
		if err != nil || got != want {
			t.Fatalf("ParseCurrencyToCents(%q) = (%d, %v), want %d", raw, got, err, want)
		}
	}

	for _, bad := range []string{"0", "-10", "abc", ""} {
		if _, err := ParseCurrencyToCents(bad); !errors.Is(err, ErrValidation) {
			t.Fatalf("expected ErrValidation for %q, got %v", bad, err)
		}
	}

	if got := FormatCentsBRL(125050); got != "R$ 1.250,50" {
		t.Fatalf("FormatCentsBRL(125050) = %q", got)
	}
	if got := FormatCentsBRL(-3500); got != "-R$ 35,00" {
		t.Fatalf("FormatCentsBRL(-3500) = %q", got)
	}
}

func TestDateAndRecurrenceClamping(t *testing.T) {
	if _, err := ValidateDate("2026-02-31"); !errors.Is(err, ErrValidation) {
		t.Fatalf("expected invalid calendar date error, got %v", err)
	}
	got, err := ResolveDateForMonth("2026-02", 31)
	if err != nil || got != "2026-02-28" {
		t.Fatalf("ResolveDateForMonth = (%q, %v), want 2026-02-28", got, err)
	}
	leap, err := ResolveDateForMonth("2024-02", 31)
	if err != nil || leap != "2024-02-29" {
		t.Fatalf("ResolveDateForMonth leap = (%q, %v), want 2024-02-29", leap, err)
	}
}

func TestCSVFormulaInjectionProtection(t *testing.T) {
	txs := []Transaction{{
		ID:          "tx_1",
		Date:        "2026-11-26",
		Type:        "expense",
		Category:    "teste",
		Description: `=SUM(A1:A2), "aspas"`,
		AccountID:   DefaultAccountID,
		AmountCents: 1500,
	}}
	accs := []Account{{ID: DefaultAccountID, Name: "Conta Principal"}}
	csv := TransactionsToCSV(txs, accs)
	if !strings.Contains(csv, `"'=SUM(A1:A2), ""aspas"""`) {
		t.Fatalf("CSV did not neutralize/escape formula: %s", csv)
	}
}
