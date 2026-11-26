package httpapi

import (
	"net/http"

	"atelier-fin/backend/internal/domain"
	"atelier-fin/backend/internal/store"
)

func registerLedgerRoutes(mux *http.ServeMux, s *store.SQLiteStore) {
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	mux.HandleFunc("GET /api/transactions", func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		items, err := s.ListTransactions(domain.TxFilter{
			Month:     q.Get("month"),
			Category:  q.Get("category"),
			Type:      q.Get("type"),
			AccountID: q.Get("accountId"),
			Query:     q.Get("q"),
		})
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": items})
	})

	mux.HandleFunc("POST /api/transactions", func(w http.ResponseWriter, r *http.Request) {
		body, err := readJSONMap(w, r)
		if err != nil {
			writeError(w, err)
			return
		}
		amount, provided, err := resolveCents(body, "amountCents", "amount")
		if err != nil {
			writeError(w, err)
			return
		}
		if !provided {
			writeError(w, domain.ValidationErrorf("amountCents ou amount é obrigatório"))
			return
		}
		txType, _ := strField(body, "type")
		cat, _ := strField(body, "category")
		desc, _ := strField(body, "description")
		dateStr, _ := strField(body, "date")
		accID, _ := strField(body, "accountId")
		created, err := s.AddTransaction(txType, amount, cat, desc, dateStr, accID)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusCreated, created)
	})

	mux.HandleFunc("PATCH /api/transactions/{id}", func(w http.ResponseWriter, r *http.Request) {
		body, err := readJSONMap(w, r)
		if err != nil {
			writeError(w, err)
			return
		}
		var patch domain.TxPatch
		if v, ok := strField(body, "type"); ok {
			patch.Type = &v
		}
		if amt, ok, err := resolveCents(body, "amountCents", "amount"); err != nil {
			writeError(w, err)
			return
		} else if ok {
			patch.AmountCents = &amt
		}
		if v, ok := strField(body, "category"); ok {
			patch.Category = &v
		}
		if v, ok := strField(body, "description"); ok {
			patch.Description = &v
		}
		if v, ok := strField(body, "date"); ok {
			patch.Date = &v
		}
		if v, ok := strField(body, "accountId"); ok {
			patch.AccountID = &v
		}
		updated, err := s.UpdateTransaction(r.PathValue("id"), patch)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, updated)
	})

	mux.HandleFunc("DELETE /api/transactions/{id}", func(w http.ResponseWriter, r *http.Request) {
		removed, err := s.DeleteTransaction(r.PathValue("id"))
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"removed": removed})
	})

	mux.HandleFunc("GET /api/budgets", func(w http.ResponseWriter, r *http.Request) {
		items, err := s.ListBudgets(r.URL.Query().Get("month"))
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": items})
	})

	mux.HandleFunc("PUT /api/budgets", func(w http.ResponseWriter, r *http.Request) {
		body, err := readJSONMap(w, r)
		if err != nil {
			writeError(w, err)
			return
		}
		limit, provided, err := resolveCents(body, "limitCents", "limit")
		if err != nil {
			writeError(w, err)
			return
		}
		if !provided {
			writeError(w, domain.ValidationErrorf("limitCents ou limit é obrigatório"))
			return
		}
		month, _ := strField(body, "month")
		cat, _ := strField(body, "category")
		saved, err := s.SetBudget(month, cat, limit)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, saved)
	})

	mux.HandleFunc("DELETE /api/budgets", func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		removed, err := s.DeleteBudget(q.Get("month"), q.Get("category"))
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"removed": removed})
	})

	mux.HandleFunc("GET /api/summary", func(w http.ResponseWriter, r *http.Request) {
		summary, err := s.GetMonthlySummary(r.URL.Query().Get("month"))
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, summary)
	})

	mux.HandleFunc("GET /api/export/csv", func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		month := q.Get("month")
		csvText, err := s.ExportCSV(domain.TxFilter{
			Month:     month,
			Category:  q.Get("category"),
			Type:      q.Get("type"),
			AccountID: q.Get("accountId"),
			Query:     q.Get("q"),
		})
		if err != nil {
			writeError(w, err)
			return
		}
		name := "atelier-fin-all.csv"
		if month != "" {
			name = "atelier-fin-" + month + ".csv"
		}
		writeCSV(w, name, csvText)
	})
}
