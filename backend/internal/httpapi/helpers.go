package httpapi

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"regexp"
	"strings"

	"atelier-fin/backend/internal/domain"
)

const maxBodyBytes = 64 * 1024

var safeFilenameRe = regexp.MustCompile(`[^a-zA-Z0-9._-]`)

type httpStatusError struct {
	status int
	msg    string
	code   string
}

func (e *httpStatusError) Error() string { return e.msg }

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func writeCSV(w http.ResponseWriter, filename, csvText string) {
	safe := safeFilenameRe.ReplaceAllString(filename, "_")
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="`+safe+`"`)
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusOK)
	_, _ = io.WriteString(w, csvText)
}

func readJSONMap(w http.ResponseWriter, r *http.Request) (map[string]any, error) {
	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
	raw, err := io.ReadAll(r.Body)
	if err != nil {
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) {
			return nil, &httpStatusError{http.StatusRequestEntityTooLarge, "Payload excede o limite de 64 KB.", "PAYLOAD_TOO_LARGE"}
		}
		return nil, &httpStatusError{http.StatusBadRequest, "Falha ao ler corpo da requisição.", "INVALID_BODY"}
	}
	trimmed := strings.TrimSpace(string(raw))
	if trimmed == "" {
		return map[string]any{}, nil
	}
	dec := json.NewDecoder(strings.NewReader(trimmed))
	dec.UseNumber()
	var out map[string]any
	if err := dec.Decode(&out); err != nil || out == nil {
		return nil, &httpStatusError{http.StatusBadRequest, "Corpo JSON inválido.", "INVALID_JSON"}
	}
	return out, nil
}

func resolveCents(body map[string]any, centsKey, currencyKey string) (domain.Cents, bool, error) {
	if raw, ok := body[centsKey]; ok && raw != nil {
		num, ok := raw.(json.Number)
		if !ok {
			return 0, true, domain.ValidationErrorf("%s deve ser um inteiro positivo em centavos", centsKey)
		}
		v, err := num.Int64()
		if err != nil {
			return 0, true, domain.ValidationErrorf("%s deve ser um inteiro positivo em centavos", centsKey)
		}
		c, err := domain.AssertPositiveCents(v, centsKey)
		return c, true, err
	}
	if raw, ok := body[currencyKey]; ok && raw != nil {
		switch val := raw.(type) {
		case string:
			c, err := domain.ParseCurrencyToCents(val)
			return c, true, err
		case json.Number:
			f, err := val.Float64()
			if err != nil {
				return 0, true, domain.ValidationErrorf("valor monetário inválido")
			}
			c, err := domain.ParseFloatToCents(f)
			return c, true, err
		default:
			return 0, true, domain.ValidationErrorf("valor monetário inválido")
		}
	}
	return 0, false, nil
}

func strField(body map[string]any, key string) (string, bool) {
	raw, ok := body[key]
	if !ok || raw == nil {
		return "", false
	}
	s, ok := raw.(string)
	return s, ok
}

func intField(body map[string]any, key string) (int, bool, error) {
	raw, ok := body[key]
	if !ok || raw == nil {
		return 0, false, nil
	}
	num, ok := raw.(json.Number)
	if !ok {
		return 0, true, domain.ValidationErrorf("%s deve ser um inteiro", key)
	}
	v, err := num.Int64()
	if err != nil {
		return 0, true, domain.ValidationErrorf("%s deve ser um inteiro", key)
	}
	return int(v), true, nil
}

func writeError(w http.ResponseWriter, err error) {
	var statusErr *httpStatusError
	if errors.As(err, &statusErr) {
		writeJSON(w, statusErr.status, map[string]string{"error": statusErr.msg, "code": statusErr.code})
		return
	}
	if errors.Is(err, domain.ErrUnauthorized) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": err.Error(), "code": "UNAUTHORIZED"})
		return
	}
	if errors.Is(err, domain.ErrConflict) {
		writeJSON(w, http.StatusConflict, map[string]string{"error": err.Error(), "code": "CONFLICT"})
		return
	}
	if errors.Is(err, domain.ErrValidation) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error(), "code": "VALIDATION_ERROR"})
		return
	}
	if errors.Is(err, domain.ErrNotFound) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error(), "code": "NOT_FOUND"})
		return
	}
	writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Erro interno inesperado."})
}
