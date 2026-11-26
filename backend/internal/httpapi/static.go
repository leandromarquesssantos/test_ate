package httpapi

import (
	"mime"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
)

func hasTraversal(rawTarget string) bool {
	pathOnly := strings.SplitN(rawTarget, "?", 2)[0]
	lower := strings.ToLower(pathOnly)
	if strings.Contains(lower, "..") || strings.Contains(lower, "%2e%2e") || strings.Contains(lower, "%00") {
		return true
	}
	decoded, err := url.PathUnescape(pathOnly)
	if err != nil {
		return true
	}
	return strings.Contains(decoded, "..") || strings.ContainsRune(decoded, '\x00')
}

func serveStatic(w http.ResponseWriter, r *http.Request, webRoot string) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Método não permitido."})
		return
	}
	rawPath := strings.SplitN(r.RequestURI, "?", 2)[0]
	if rawPath == "" {
		rawPath = r.URL.Path
	}
	if hasTraversal(rawPath) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "Acesso negado."})
		return
	}
	decoded, err := url.PathUnescape(rawPath)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Caminho inválido."})
		return
	}

	rel := strings.TrimPrefix(decoded, "/")
	if rel == "" {
		rel = "index.html"
	}
	absRoot, err := filepath.Abs(webRoot)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Erro interno inesperado."})
		return
	}
	target := filepath.Join(absRoot, filepath.FromSlash(rel))
	if target != absRoot && !strings.HasPrefix(target, absRoot+string(filepath.Separator)) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "Acesso negado."})
		return
	}
	info, err := os.Stat(target)
	if err != nil || info.IsDir() {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Arquivo não encontrado."})
		return
	}

	ext := strings.ToLower(filepath.Ext(target))
	ct := mime.TypeByExtension(ext)
	if ext == ".mjs" {
		ct = "application/javascript; charset=utf-8"
	}
	if ct != "" {
		w.Header().Set("Content-Type", ct)
	}
	w.Header().Set("X-Content-Type-Options", "nosniff")
	http.ServeFile(w, r, target)
}
