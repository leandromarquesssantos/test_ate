package domain

import (
	"errors"
	"fmt"
	"regexp"
	"strings"
)

const LegacyUserID = "__legacy__"

var (
	ErrUnauthorized = errors.New("unauthorized")
	ErrConflict     = errors.New("conflict")
	emailRe         = regexp.MustCompile(`^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$`)
)

type User struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Email     string `json:"email"`
	CreatedAt string `json:"createdAt"`
}

type AuthSession struct {
	User      User   `json:"user"`
	Token     string `json:"token"`
	ExpiresAt string `json:"expiresAt"`
}

func UnauthorizedErrorf(format string, args ...any) error {
	return fmt.Errorf("%w: "+format, append([]any{ErrUnauthorized}, args...)...)
}

func ConflictErrorf(format string, args ...any) error {
	return fmt.Errorf("%w: "+format, append([]any{ErrConflict}, args...)...)
}

func NormalizeUserName(name string) (string, error) {
	s := strings.TrimSpace(name)
	if len([]rune(s)) < 2 {
		return "", ValidationErrorf("nome deve ter pelo menos 2 caracteres")
	}
	runes := []rune(s)
	if len(runes) > 60 {
		s = string(runes[:60])
	}
	return s, nil
}

func NormalizeEmail(email string) (string, error) {
	s := strings.ToLower(strings.TrimSpace(email))
	if !emailRe.MatchString(s) || len(s) > 120 {
		return "", ValidationErrorf("e-mail inválido")
	}
	return s, nil
}

func ValidatePassword(password string) error {
	if len(password) < 8 {
		return ValidationErrorf("senha deve ter pelo menos 8 caracteres")
	}
	if len([]byte(password)) > 72 {
		return ValidationErrorf("senha deve ter no máximo 72 bytes")
	}
	return nil
}
