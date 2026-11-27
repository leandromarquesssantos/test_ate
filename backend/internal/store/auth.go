package store

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"strings"
	"time"

	"atelier-fin/backend/internal/domain"
	"golang.org/x/crypto/bcrypt"
)

const sessionTTL = 7 * 24 * time.Hour

func hashSessionToken(rawToken string) string {
	sum := sha256.Sum256([]byte(rawToken))
	return hex.EncodeToString(sum[:])
}

func newRawSessionToken() string {
	buf := make([]byte, 32)
	_, _ = rand.Read(buf)
	return hex.EncodeToString(buf)
}

func (s *SQLiteStore) RegisterUser(name, email, password string) (domain.AuthSession, error) {
	cleanName, err := domain.NormalizeUserName(name)
	if err != nil {
		return domain.AuthSession{}, err
	}
	cleanEmail, err := domain.NormalizeEmail(email)
	if err != nil {
		return domain.AuthSession{}, err
	}
	if err := domain.ValidatePassword(password); err != nil {
		return domain.AuthSession{}, err
	}

	var exists int
	if err := s.db.QueryRow(`SELECT COUNT(*) FROM users WHERE LOWER(email) = LOWER(?)`, cleanEmail).Scan(&exists); err != nil {
		return domain.AuthSession{}, err
	}
	if exists > 0 {
		return domain.AuthSession{}, domain.ConflictErrorf("já existe uma conta cadastrada com este e-mail")
	}

	pwHash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return domain.AuthSession{}, err
	}

	tx, err := s.db.Begin()
	if err != nil {
		return domain.AuthSession{}, err
	}
	defer func() { _ = tx.Rollback() }()

	var userCount int
	_ = tx.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&userCount)

	now := time.Now().UTC()
	user := domain.User{
		ID:        domain.NewID("usr"),
		Name:      cleanName,
		Email:     cleanEmail,
		CreatedAt: now.Format(time.RFC3339Nano),
	}
	if _, err := tx.Exec(
		`INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)`,
		user.ID, user.Name, user.Email, string(pwHash), user.CreatedAt,
	); err != nil {
		return domain.AuthSession{}, err
	}

	adopted := false
	if userCount == 0 {
		var legacyAccounts int
		_ = tx.QueryRow(`SELECT COUNT(*) FROM accounts WHERE user_id = ?`, domain.LegacyUserID).Scan(&legacyAccounts)
		if legacyAccounts > 0 {
			for _, tbl := range []string{"accounts", "transactions", "budgets", "recurring_rules"} {
				if _, err := tx.Exec(`UPDATE `+tbl+` SET user_id = ? WHERE user_id = ?`, user.ID, domain.LegacyUserID); err != nil {
					return domain.AuthSession{}, err
				}
			}
			adopted = true
		}
	}
	if !adopted {
		if _, err := tx.Exec(
			`INSERT INTO accounts (id, user_id, name, type) VALUES (?, ?, ?, ?)`,
			domain.NewID("acc"), user.ID, "Conta Principal", "checking",
		); err != nil {
			return domain.AuthSession{}, err
		}
	}

	rawToken := newRawSessionToken()
	expiresAt := now.Add(sessionTTL).Format(time.RFC3339)
	if _, err := tx.Exec(
		`INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`,
		hashSessionToken(rawToken), user.ID, expiresAt, now.Format(time.RFC3339),
	); err != nil {
		return domain.AuthSession{}, err
	}

	if err := tx.Commit(); err != nil {
		return domain.AuthSession{}, err
	}
	return domain.AuthSession{User: user, Token: rawToken, ExpiresAt: expiresAt}, nil
}

func (s *SQLiteStore) Login(email, password string) (domain.AuthSession, error) {
	cleanEmail := strings.ToLower(strings.TrimSpace(email))
	if cleanEmail == "" || password == "" {
		return domain.AuthSession{}, domain.UnauthorizedErrorf("credenciais inválidas")
	}

	var user domain.User
	var pwHash string
	err := s.db.QueryRow(
		`SELECT id, name, email, password_hash, created_at FROM users WHERE LOWER(email) = LOWER(?)`,
		cleanEmail,
	).Scan(&user.ID, &user.Name, &user.Email, &pwHash, &user.CreatedAt)
	if err == sql.ErrNoRows {
		return domain.AuthSession{}, domain.UnauthorizedErrorf("credenciais inválidas")
	}
	if err != nil {
		return domain.AuthSession{}, err
	}
	if err := bcrypt.CompareHashAndPassword([]byte(pwHash), []byte(password)); err != nil {
		return domain.AuthSession{}, domain.UnauthorizedErrorf("credenciais inválidas")
	}

	now := time.Now().UTC()
	rawToken := newRawSessionToken()
	expiresAt := now.Add(sessionTTL).Format(time.RFC3339)
	_, err = s.db.Exec(
		`INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`,
		hashSessionToken(rawToken), user.ID, expiresAt, now.Format(time.RFC3339),
	)
	if err != nil {
		return domain.AuthSession{}, err
	}
	return domain.AuthSession{User: user, Token: rawToken, ExpiresAt: expiresAt}, nil
}

func (s *SQLiteStore) ValidateSession(rawToken string) (domain.User, error) {
	trimmed := strings.TrimSpace(rawToken)
	if trimmed == "" {
		return domain.User{}, domain.UnauthorizedErrorf("sessão ausente")
	}
	tokenHash := hashSessionToken(trimmed)
	var user domain.User
	var expiresStr string
	err := s.db.QueryRow(
		`SELECT u.id, u.name, u.email, u.created_at, s.expires_at
		 FROM sessions s JOIN users u ON u.id = s.user_id
		 WHERE s.token_hash = ?`, tokenHash,
	).Scan(&user.ID, &user.Name, &user.Email, &user.CreatedAt, &expiresStr)
	if err == sql.ErrNoRows {
		return domain.User{}, domain.UnauthorizedErrorf("sessão inválida")
	}
	if err != nil {
		return domain.User{}, err
	}
	expiresAt, parseErr := time.Parse(time.RFC3339, expiresStr)
	if parseErr != nil || time.Now().UTC().After(expiresAt) {
		_, _ = s.db.Exec(`DELETE FROM sessions WHERE token_hash = ?`, tokenHash)
		return domain.User{}, domain.UnauthorizedErrorf("sessão expirada")
	}
	return user, nil
}

func (s *SQLiteStore) RevokeSession(rawToken string) error {
	trimmed := strings.TrimSpace(rawToken)
	if trimmed == "" {
		return nil
	}
	_, err := s.db.Exec(`DELETE FROM sessions WHERE token_hash = ?`, hashSessionToken(trimmed))
	return err
}

func (s *SQLiteStore) ListUsers() ([]domain.User, error) {
	rows, err := s.db.Query(`SELECT id, name, email, created_at FROM users ORDER BY rowid ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []domain.User{}
	for rows.Next() {
		var u domain.User
		if err := rows.Scan(&u.ID, &u.Name, &u.Email, &u.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, u)
	}
	return items, rows.Err()
}

func (s *SQLiteStore) FindUserByEmail(email string) (domain.User, error) {
	var u domain.User
	err := s.db.QueryRow(
		`SELECT id, name, email, created_at FROM users WHERE LOWER(email) = LOWER(?)`,
		strings.TrimSpace(email),
	).Scan(&u.ID, &u.Name, &u.Email, &u.CreatedAt)
	if err == sql.ErrNoRows {
		return domain.User{}, domain.NotFoundErrorf("usuário não encontrado: %q", email)
	}
	return u, err
}
