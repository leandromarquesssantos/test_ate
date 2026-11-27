package httpapi

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"atelier-fin/backend/internal/domain"
	"atelier-fin/backend/internal/store"
)

func newTestServer(t *testing.T, opts ...ServerOptions) *httptest.Server {
	t.Helper()
	s, err := store.OpenSQLite(":memory:")
	if err != nil {
		t.Fatalf("OpenSQLite: %v", err)
	}
	t.Cleanup(func() { _ = s.Close() })
	webRoot := filepath.Join("..", "..", "..", "packages", "web", "src")
	opt := DefaultServerOptions()
	if len(opts) > 0 {
		opt = opts[0]
	}
	srv := httptest.NewServer(NewHandlerWithOptions(s, webRoot, opt))
	t.Cleanup(srv.Close)
	return srv
}

func doJSONAuth(t *testing.T, method, url, token string, payload any) (*http.Response, []byte) {
	t.Helper()
	var body io.Reader
	if payload != nil {
		b, _ := json.Marshal(payload)
		body = bytes.NewReader(b)
	}
	req, err := http.NewRequest(method, url, body)
	if err != nil {
		t.Fatalf("NewRequest: %v", err)
	}
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("Do: %v", err)
	}
	raw, _ := io.ReadAll(res.Body)
	_ = res.Body.Close()
	return res, raw
}

func registerAndGetToken(t *testing.T, baseURL, name, email, password string) (string, *http.Response) {
	t.Helper()
	res, raw := doJSONAuth(t, "POST", baseURL+"/api/auth/register", "", map[string]any{
		"name": name, "email": email, "password": password,
	})
	if res.StatusCode != 201 {
		t.Fatalf("register %s = %d %s", email, res.StatusCode, raw)
	}
	var sess domain.AuthSession
	_ = json.Unmarshal(raw, &sess)
	return sess.Token, res
}

func TestRESTContractParityAuthenticated(t *testing.T) {
	srv := newTestServer(t)
	tok, regRes := registerAndGetToken(t, srv.URL, "Alice", "alice@test.com", "senha1234")

	// Verifica cookie HttpOnly definido no register
	var foundCookie bool
	for _, c := range regRes.Cookies() {
		if c.Name == sessionCookieName && c.HttpOnly {
			foundCookie = true
		}
	}
	if !foundCookie {
		t.Fatalf("expected HttpOnly %s cookie", sessionCookieName)
	}

	res, raw := doJSONAuth(t, "GET", srv.URL+"/api/accounts", tok, nil)
	var accList struct {
		Items []domain.Account `json:"items"`
	}
	_ = json.Unmarshal(raw, &accList)
	mainAccID := accList.Items[0].ID

	res, raw = doJSONAuth(t, "POST", srv.URL+"/api/accounts", tok, map[string]any{"name": "Carteira", "type": "cash"})
	if res.StatusCode != 201 {
		t.Fatalf("create account = %d %s", res.StatusCode, raw)
	}
	var wallet domain.Account
	_ = json.Unmarshal(raw, &wallet)

	res, raw = doJSONAuth(t, "POST", srv.URL+"/api/transactions", tok, map[string]any{
		"type": "expense", "amount": "120,50", "category": "alimentacao",
		"description": "Mercado Central", "date": "2026-11-15",
	})
	if res.StatusCode != 201 {
		t.Fatalf("create tx = %d %s", res.StatusCode, raw)
	}
	var created domain.Transaction
	_ = json.Unmarshal(raw, &created)

	res, raw = doJSONAuth(t, "PATCH", srv.URL+"/api/transactions/"+created.ID, tok, map[string]any{
		"amount": "130,00", "description": "Mercado Bairro",
	})
	if res.StatusCode != 200 || !strings.Contains(string(raw), `"amountCents":13000`) {
		t.Fatalf("patch tx = %d %s", res.StatusCode, raw)
	}

	res, _ = doJSONAuth(t, "POST", srv.URL+"/api/transfers", tok, map[string]any{
		"fromAccountId": mainAccID, "toAccountId": wallet.ID,
		"amount": "50,00", "date": "2026-11-16",
	})
	if res.StatusCode != 201 {
		t.Fatalf("transfer = %d", res.StatusCode)
	}

	res, _ = doJSONAuth(t, "POST", srv.URL+"/api/recurring", tok, map[string]any{
		"type": "expense", "amount": "100,00", "category": "internet",
		"description": "Fibra", "dayOfMonth": 10,
	})
	if res.StatusCode != 201 {
		t.Fatalf("recurring = %d", res.StatusCode)
	}
	res, raw = doJSONAuth(t, "POST", srv.URL+"/api/recurring/apply", tok, map[string]any{"month": "2026-11"})
	if res.StatusCode != 200 || !strings.Contains(string(raw), `"createdCount":1`) {
		t.Fatalf("apply = %d %s", res.StatusCode, raw)
	}

	res, _ = doJSONAuth(t, "PUT", srv.URL+"/api/budgets", tok, map[string]any{
		"month": "2026-11", "category": "alimentacao", "limitCents": 15000,
	})
	if res.StatusCode != 200 {
		t.Fatalf("put budget = %d", res.StatusCode)
	}
	res, _ = doJSONAuth(t, "DELETE", srv.URL+"/api/budgets?month=2026-11&category=alimentacao", tok, nil)
	if res.StatusCode != 200 {
		t.Fatalf("delete budget = %d", res.StatusCode)
	}

	res, raw = doJSONAuth(t, "GET", srv.URL+"/api/export/csv?month=2026-11", tok, nil)
	if res.StatusCode != 200 || !strings.Contains(string(raw), "Mercado Bairro") {
		t.Fatalf("csv = %d %s", res.StatusCode, raw)
	}
}

func TestAuthSecurityAntiIDORAndRateLimit(t *testing.T) {
	srv := newTestServer(t, ServerOptions{AllowRegistration: true, AuthRateLimit: 4})

	// Sem sessao -> 401 nas rotas protegidas; 200 em /api/health e /
	if res, _ := doJSONAuth(t, "GET", srv.URL+"/api/transactions", "", nil); res.StatusCode != 401 {
		t.Fatalf("unauth /api/transactions = %d, want 401", res.StatusCode)
	}
	if res, _ := doJSONAuth(t, "GET", srv.URL+"/api/health", "", nil); res.StatusCode != 200 {
		t.Fatalf("/api/health = %d, want 200", res.StatusCode)
	}

	tokA, _ := registerAndGetToken(t, srv.URL, "Alice", "alice@iso.com", "senha1234")
	tokB, _ := registerAndGetToken(t, srv.URL, "Bob", "bob@iso.com", "senha5678")

	// Alice cria tx; Bob nao enxerga nem consegue deletar (404 anti-IDOR)
	_, raw := doJSONAuth(t, "POST", srv.URL+"/api/transactions", tokA, map[string]any{
		"type": "expense", "amount": "50,00", "category": "cafe", "date": "2026-11-26",
	})
	var txA domain.Transaction
	_ = json.Unmarshal(raw, &txA)

	res, _ := doJSONAuth(t, "DELETE", srv.URL+"/api/transactions/"+txA.ID, tokB, nil)
	if res.StatusCode != 404 {
		t.Fatalf("Bob delete Alice tx = %d, want 404", res.StatusCode)
	}

	// Logout revoga sessao
	_, _ = doJSONAuth(t, "POST", srv.URL+"/api/auth/logout", tokA, nil)
	if res, _ := doJSONAuth(t, "GET", srv.URL+"/api/auth/me", tokA, nil); res.StatusCode != 401 {
		t.Fatalf("after logout /api/auth/me = %d, want 401", res.StatusCode)
	}

	// Seguranca: path traversal (403) + payload > 64KB (413)
	if res, _ := doJSONAuth(t, "GET", srv.URL+"/..%2f..%2fpackage.json", "", nil); res.StatusCode != 403 {
		t.Fatalf("traversal = %d, want 403", res.StatusCode)
	}
	if res, _ := doJSONAuth(t, "POST", srv.URL+"/api/transactions", tokB, map[string]any{
		"type": "expense", "amountCents": 100, "category": "x", "description": strings.Repeat("a", 70*1024),
	}); res.StatusCode != 413 {
		t.Fatalf("huge payload = %d, want 413", res.StatusCode)
	}

	// Rate limit (limite 4/min; ja usamos 2 registros; mais 3 logins estouram com 429)
	var got429 bool
	for i := 0; i < 4; i++ {
		res, _ := doJSONAuth(t, "POST", srv.URL+"/api/auth/login", "", map[string]any{
			"email": "alice@iso.com", "password": "wrongpassword",
		})
		if res.StatusCode == 429 {
			got429 = true
			break
		}
	}
	if !got429 {
		t.Fatalf("expected 429 Too Many Requests from auth rate limiter")
	}
}
