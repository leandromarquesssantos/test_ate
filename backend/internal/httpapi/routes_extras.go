package httpapi

import (
	"net/http"

	"atelier-fin/backend/internal/domain"
	"atelier-fin/backend/internal/store"
)

func registerExtraRoutes(mux *http.ServeMux, s *store.SQLiteStore) {
	mux.HandleFunc("GET /api/accounts", func(w http.ResponseWriter, r *http.Request) {
		items, err := s.ListAccounts(userFromContext(r).ID)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": items})
	})

	mux.HandleFunc("POST /api/accounts", func(w http.ResponseWriter, r *http.Request) {
		body, err := readJSONMap(w, r)
		if err != nil {
			writeError(w, err)
			return
		}
		name, _ := strField(body, "name")
		accType, _ := strField(body, "type")
		created, err := s.AddAccount(userFromContext(r).ID, name, accType)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusCreated, created)
	})

	mux.HandleFunc("DELETE /api/accounts/{id}", func(w http.ResponseWriter, r *http.Request) {
		removed, err := s.DeleteAccount(userFromContext(r).ID, r.PathValue("id"))
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"removed": removed})
	})

	mux.HandleFunc("POST /api/transfers", func(w http.ResponseWriter, r *http.Request) {
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
		fromID, _ := strField(body, "fromAccountId")
		toID, _ := strField(body, "toAccountId")
		desc, _ := strField(body, "description")
		dateStr, _ := strField(body, "date")
		created, err := s.AddTransfer(userFromContext(r).ID, fromID, toID, amount, desc, dateStr)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusCreated, created)
	})

	mux.HandleFunc("GET /api/recurring", func(w http.ResponseWriter, r *http.Request) {
		items, err := s.ListRecurring(userFromContext(r).ID)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": items})
	})

	mux.HandleFunc("POST /api/recurring", func(w http.ResponseWriter, r *http.Request) {
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
		day, _, err := intField(body, "dayOfMonth")
		if err != nil {
			writeError(w, err)
			return
		}
		txType, _ := strField(body, "type")
		cat, _ := strField(body, "category")
		desc, _ := strField(body, "description")
		accID, _ := strField(body, "accountId")
		created, err := s.AddRecurring(userFromContext(r).ID, txType, amount, cat, desc, day, accID)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusCreated, created)
	})

	mux.HandleFunc("POST /api/recurring/apply", func(w http.ResponseWriter, r *http.Request) {
		body, err := readJSONMap(w, r)
		if err != nil {
			writeError(w, err)
			return
		}
		month, _ := strField(body, "month")
		res, err := s.ApplyRecurring(userFromContext(r).ID, month)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, res)
	})

	mux.HandleFunc("DELETE /api/recurring/{id}", func(w http.ResponseWriter, r *http.Request) {
		removed, err := s.DeleteRecurring(userFromContext(r).ID, r.PathValue("id"))
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"removed": removed})
	})
}
