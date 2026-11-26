package domain

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"
)

const DefaultAccountID = "acc_default"

var (
	dateRe  = regexp.MustCompile(`^(\d{4})-(\d{2})-(\d{2})$`)
	monthRe = regexp.MustCompile(`^(\d{4})-(\d{2})$`)
)

func NewID(prefix string) string {
	buf := make([]byte, 6)
	_, _ = rand.Read(buf)
	return prefix + "_" + hex.EncodeToString(buf)
}

func ValidTxType(t string) bool {
	return t == "income" || t == "expense"
}

func ValidAllTxType(t string) bool {
	return t == "income" || t == "expense" || t == "transfer"
}

func ValidAccountType(t string) bool {
	return t == "checking" || t == "cash" || t == "savings" || t == "credit"
}

func NormalizeCategory(cat string) (string, error) {
	s := strings.ToLower(strings.TrimSpace(cat))
	if s == "" {
		return "", ValidationErrorf("categoria é obrigatória")
	}
	runes := []rune(s)
	if len(runes) > 40 {
		s = string(runes[:40])
	}
	return s, nil
}

func NormalizeAccountName(name string) (string, error) {
	s := strings.TrimSpace(name)
	if s == "" {
		return "", ValidationErrorf("nome da conta é obrigatório")
	}
	runes := []rune(s)
	if len(runes) > 50 {
		s = string(runes[:50])
	}
	return s, nil
}

func CleanDescription(desc string) string {
	s := strings.TrimSpace(desc)
	runes := []rune(s)
	if len(runes) > 140 {
		return string(runes[:140])
	}
	return s
}

func ValidateDate(s string) (string, error) {
	trimmed := strings.TrimSpace(s)
	if !dateRe.MatchString(trimmed) {
		return "", ValidationErrorf("data deve estar no formato YYYY-MM-DD")
	}
	parsed, err := time.Parse("2006-01-02", trimmed)
	if err != nil || parsed.Format("2006-01-02") != trimmed {
		return "", ValidationErrorf("data de calendário inválida: %q", s)
	}
	return trimmed, nil
}

func ValidateMonth(s string) (string, error) {
	trimmed := strings.TrimSpace(s)
	m := monthRe.FindStringSubmatch(trimmed)
	if m == nil {
		return "", ValidationErrorf("mês deve estar no formato YYYY-MM")
	}
	mon, _ := strconv.Atoi(m[2])
	if mon < 1 || mon > 12 {
		return "", ValidationErrorf("mês inválido: %q", s)
	}
	return trimmed, nil
}

func ValidateDayOfMonth(day int) (int, error) {
	if day < 1 || day > 31 {
		return 0, ValidationErrorf("dayOfMonth deve ser um inteiro entre 1 e 31")
	}
	return day, nil
}

func ResolveDateForMonth(monthStr string, day int) (string, error) {
	validMonth, err := ValidateMonth(monthStr)
	if err != nil {
		return "", err
	}
	validDay, err := ValidateDayOfMonth(day)
	if err != nil {
		return "", err
	}
	year, _ := strconv.Atoi(validMonth[:4])
	mon, _ := strconv.Atoi(validMonth[5:7])
	lastDay := time.Date(year, time.Month(mon)+1, 0, 0, 0, 0, 0, time.UTC).Day()
	if validDay > lastDay {
		validDay = lastDay
	}
	return fmt.Sprintf("%s-%02d", validMonth, validDay), nil
}

func CurrentMonthISO(now time.Time) string {
	return now.UTC().Format("2006-01")
}

func TodayISO(now time.Time) string {
	return now.UTC().Format("2006-01-02")
}
