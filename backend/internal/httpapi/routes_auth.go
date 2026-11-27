package httpapi

import (
	"net/http"
	"os"
	"strings"
	"time"

	"atelier-fin/backend/internal/store"
)

type ServerOptions struct {
	CookieSecure      bool
	AllowRegistration bool
	AuthRateLimit     int
}

func DefaultServerOptions() ServerOptions {
	allowReg := !strings.EqualFold(os.Getenv("ALLOW_REGISTRATION"), "false")
	cookieSecure := strings.EqualFold(os.Getenv("COOKIE_SECURE"), "true")
	return ServerOptions{
		CookieSecure:      cookieSecure,
		AllowRegistration: allowReg,
		AuthRateLimit:     10,
	}
}

func registerAuthRoutes(mux *http.ServeMux, s *store.SQLiteStore, opts ServerOptions) {
	limit := opts.AuthRateLimit
	if limit <= 0 {
		limit = 10
	}
	limiter := newIPRateLimiter(limit, time.Minute)

	mux.HandleFunc("POST /api/auth/register", func(w http.ResponseWriter, r *http.Request) {
		if !opts.AllowRegistration {
			writeJSON(w, http.StatusForbidden, map[string]string{
				"error": "Cadastro de novos usuários desabilitado neste servidor.",
				"code":  "REGISTRATION_DISABLED",
			})
			return
		}
		if !limiter.allow(r.RemoteAddr) {
			writeJSON(w, http.StatusTooManyRequests, map[string]string{
				"error": "Muitas tentativas. Aguarde um minuto.",
				"code":  "RATE_LIMITED",
			})
			return
		}
		body, err := readJSONMap(w, r)
		if err != nil {
			writeError(w, err)
			return
		}
		name, _ := strField(body, "name")
		email, _ := strField(body, "email")
		password, _ := strField(body, "password")
		sess, err := s.RegisterUser(name, email, password)
		if err != nil {
			writeError(w, err)
			return
		}
		setSessionCookie(w, sess.Token, opts.CookieSecure)
		writeJSON(w, http.StatusCreated, sess)
	})

	mux.HandleFunc("POST /api/auth/login", func(w http.ResponseWriter, r *http.Request) {
		if !limiter.allow(r.RemoteAddr) {
			writeJSON(w, http.StatusTooManyRequests, map[string]string{
				"error": "Muitas tentativas. Aguarde um minuto.",
				"code":  "RATE_LIMITED",
			})
			return
		}
		body, err := readJSONMap(w, r)
		if err != nil {
			writeError(w, err)
			return
		}
		email, _ := strField(body, "email")
		password, _ := strField(body, "password")
		sess, err := s.Login(email, password)
		if err != nil {
			writeError(w, err)
			return
		}
		setSessionCookie(w, sess.Token, opts.CookieSecure)
		writeJSON(w, http.StatusOK, sess)
	})

	mux.HandleFunc("POST /api/auth/logout", func(w http.ResponseWriter, r *http.Request) {
		_ = s.RevokeSession(extractToken(r))
		clearSessionCookie(w, opts.CookieSecure)
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	})

	mux.HandleFunc("GET /api/auth/me", func(w http.ResponseWriter, r *http.Request) {
		user, err := s.ValidateSession(extractToken(r))
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"user": user})
	})
}
