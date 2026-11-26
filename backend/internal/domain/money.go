package domain

import (
	"errors"
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"
)

var (
	ErrValidation = errors.New("validation error")
	ErrNotFound   = errors.New("not found")
)

type Cents int64

var currencyRe = regexp.MustCompile(`^\d+(\.\d{1,2})?$`)

func ValidationErrorf(format string, args ...any) error {
	return fmt.Errorf("%w: "+format, append([]any{ErrValidation}, args...)...)
}

func NotFoundErrorf(format string, args ...any) error {
	return fmt.Errorf("%w: "+format, append([]any{ErrNotFound}, args...)...)
}

func AssertPositiveCents(v int64, field string) (Cents, error) {
	if v <= 0 {
		return 0, ValidationErrorf("%s deve ser um inteiro positivo em centavos", field)
	}
	return Cents(v), nil
}

func ParseCurrencyToCents(input string) (Cents, error) {
	s := strings.TrimSpace(input)
	if len(s) >= 2 && strings.EqualFold(s[:2], "R$") {
		s = strings.TrimSpace(s[2:])
	}
	s = strings.ReplaceAll(s, " ", "")
	if s == "" {
		return 0, ValidationErrorf("valor monetário vazio")
	}

	if strings.Contains(s, ",") && strings.Contains(s, ".") {
		s = strings.ReplaceAll(s, ".", "")
		s = strings.ReplaceAll(s, ",", ".")
	} else if strings.Contains(s, ",") {
		s = strings.ReplaceAll(s, ",", ".")
	}

	if !currencyRe.MatchString(s) {
		return 0, ValidationErrorf("formato monetário inválido: %q", input)
	}

	parts := strings.SplitN(s, ".", 2)
	whole, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		return 0, ValidationErrorf("valor monetário inválido: %q", input)
	}
	var frac int64
	if len(parts) == 2 {
		f := parts[1]
		if len(f) == 1 {
			f += "0"
		}
		frac, err = strconv.ParseInt(f, 10, 64)
		if err != nil {
			return 0, ValidationErrorf("centavos inválidos: %q", input)
		}
	}

	return AssertPositiveCents(whole*100+frac, "amount")
}

func ParseFloatToCents(v float64) (Cents, error) {
	if math.IsNaN(v) || math.IsInf(v, 0) || v <= 0 {
		return 0, ValidationErrorf("valor monetário deve ser maior que zero")
	}
	return AssertPositiveCents(int64(math.Round(v*100)), "amount")
}

func FormatCentsBRL(c Cents) string {
	sign := ""
	abs := int64(c)
	if abs < 0 {
		sign = "-"
		abs = -abs
	}
	whole := strconv.FormatInt(abs/100, 10)
	frac := fmt.Sprintf("%02d", abs%100)

	var b strings.Builder
	rem := len(whole) % 3
	if rem == 0 {
		rem = 3
	}
	b.WriteString(whole[:rem])
	for i := rem; i < len(whole); i += 3 {
		b.WriteByte('.')
		b.WriteString(whole[i : i+3])
	}
	return fmt.Sprintf("%sR$ %s,%s", sign, b.String(), frac)
}
