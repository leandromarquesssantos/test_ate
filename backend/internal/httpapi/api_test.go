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

func newTestServer(t *testing.T) *httptest.Server {
	t.Helper()
	s, err := store.OpenSQLite(":memory:")
	if err != nil {
		t.Fatalf("OpenSQLite: %v", err)
	}
	t.Cleanup(func() { _ = s.Close() })
	webRoot := filepath.Join("..", "..", "..", "packages", "web", "src")
	srv := httptest.NewServer(NewHandler(s, webRoot))
	t.Cleanup(srv.Close)
	return srv
}

func doJSON(t *testing.T, method, url string, payload any) (*http.Response, []byte) {
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
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("Do: %v", err)
	}
	raw, _ := io.ReadAll(res.Body)
	_ = res.Body.Close()
	return res, raw
}

func TestRESTContractParity(t *testing.T) {
	srv := newTestServer(t)

	res, raw := doJSON(t, "GET", srv.URL+"/api/health", nil)
	if res.StatusCode != 200 || !strings.Contains(string(raw), `"ok"`) {
		t.Fatalf("health = %d %s", res.StatusCode, raw)
	}

	res, raw = doJSON(t, "POST", srv.URL+"/api/accounts", map[string]any{"name": "Carteira", "type": "cash"})
	if res.StatusCode != 201 {
		t.Fatalf("create account = %d %s", res.StatusCode, raw)
	}
	var wallet domain.Account
	_ = json.Unmarshal(raw, &wallet)

	res, raw = doJSON(t, "POST", srv.URL+"/api/transactions", map[string]any{
		"type": "expense", "amount": "120,50", "category": "alimentacao",
		"description": "Mercado Central", "date": "2026-11-15",
	})
	if res.StatusCode != 201 {
		t.Fatalf("create tx = %d %s", res.StatusCode, raw)
	}
	var created domain.Transaction
	_ = json.Unmarshal(raw, &created)
	if created.AmountCents != 12050 {
		t.Fatalf("amountCents = %d, want 12050", created.AmountCents)
	}

	res, raw = doJSON(t, "PATCH", srv.URL+"/api/transactions/"+created.ID, map[string]any{
		"amount": "130,00", "description": "Mercado Bairro",
	})
	if res.StatusCode != 200 || !strings.Contains(string(raw), `"amountCents":13000`) {
		t.Fatalf("patch tx = %d %s", res.StatusCode, raw)
	}

	res, raw = doJSON(t, "POST", srv.URL+"/api/transfers", map[string]any{
		"fromAccountId": domain.DefaultAccountID, "toAccountId": wallet.ID,
		"amount": "50,00", "date": "2026-11-16",
	})
	if res.StatusCode != 201 {
		t.Fatalf("transfer = %d %s", res.StatusCode, raw)
	}

	res, _ = doJSON(t, "POST", srv.URL+"/api/recurring", map[string]any{
		"type": "expense", "amount": "100,00", "category": "internet",
		"description": "Fibra", "dayOfMonth": 10,
	})
	if res.StatusCode != 201 {
		t.Fatalf("recurring = %d", res.StatusCode)
	}
	res, raw = doJSON(t, "POST", srv.URL+"/api/recurring/apply", map[string]any{"month": "2026-11"})
	if res.StatusCode != 200 || !strings.Contains(string(raw), `"createdCount":1`) {
		t.Fatalf("apply 1 = %d %s", res.StatusCode, raw)
	}
	res, raw = doJSON(t, "POST", srv.URL+"/api/recurring/apply", map[string]any{"month": "2026-11"})
	if res.StatusCode != 200 || !strings.Contains(string(raw), `"createdCount":0`) {
		t.Fatalf("apply 2 = %d %s", res.StatusCode, raw)
	}

	res, _ = doJSON(t, "PUT", srv.URL+"/api/budgets", map[string]any{
		"month": "2026-11", "category": "alimentacao", "limitCents": 15000,
	})
	if res.StatusCode != 200 {
		t.Fatalf("put budget = %d", res.StatusCode)
	}
	res, _ = doJSON(t, "DELETE", srv.URL+"/api/budgets?month=2026-11&category=alimentacao", nil)
	if res.StatusCode != 200 {
		t.Fatalf("delete budget = %d", res.StatusCode)
	}

	res, raw = doJSON(t, "GET", srv.URL+"/api/export/csv?month=2026-11", nil)
	if res.StatusCode != 200 || !strings.Contains(res.Header.Get("Content-Type"), "text/csv") {
		t.Fatalf("csv = %d %s", res.StatusCode, res.Header.Get("Content-Type"))
	}
	if !strings.Contains(string(raw), "Mercado Bairro") || !strings.Contains(string(raw), "Fibra") {
		t.Fatalf("csv content missing rows: %s", raw)
	}
}

func TestAPISecurityAndStaticServing(t *testing.T) {
	srv := newTestServer(t)

	res, _ := doJSON(t, "POST", srv.URL+"/api/transactions", map[string]any{
		"type": "expense", "amountCents": -10, "category": "x",
	})
	if res.StatusCode != 400 {
		t.Fatalf("invalid amount = %d, want 400", res.StatusCode)
	}

	res, _ = doJSON(t, "GET", srv.URL+"/..%2f..%2fpackage.json", nil)
	if res.StatusCode != 403 {
		t.Fatalf("traversal = %d, want 403", res.StatusCode)
	}

	res, _ = doJSON(t, "POST", srv.URL+"/api/transactions", map[string]any{
		"type": "expense", "amountCents": 100, "category": "x",
		"description": strings.Repeat("a", 70*1024),
	})
	if res.StatusCode != 413 {
		t.Fatalf("huge payload = %d, want 413", res.StatusCode)
	}

	res, raw := doJSON(t, "GET", srv.URL+"/", nil)
	if res.StatusCode != 200 || !strings.Contains(string(raw), "Atelier Fin") {
		t.Fatalf("index.html = %d", res.StatusCode)
	}
}
