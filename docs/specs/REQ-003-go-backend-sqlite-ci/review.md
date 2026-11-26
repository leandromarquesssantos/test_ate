# Code Review Multi-Perspectiva — REQ-003 (Go + SQLite + CI)

- **Data:** 2026-11-26
- **Branch/Worktree:** `feat/req-003` (isolado em `../test_ate-req-003`)
- **Veredito:** APROVADO (todos os achados resolvidos e validados por `npm run gate`)

---

## 1. Lente de Arquitetura
- **[OK]** `backend/internal/domain` usa 100% stdlib Go (zero imports de `database/sql`, `net/http` ou `store`), validado automaticamente pelo `atelier-gate.mjs`.
- **[OK]** Divisão preventiva em `store/` (`accounts.go`, `budgets.go`, `transactions_write.go`, `transactions_query.go`, `recurring.go`, `sqlite.go`) manteve todos os 26 arquivos de produção (20 Go + 6 Web) abaixo de 220 linhas.
- **[OK]** Backend Node legado (`packages/core`, `packages/api`, `packages/cli`) removido conforme decisão do Principal Engineer, mantendo uma única fonte de verdade (`backend/` em Go + `packages/web/`).
- **[OK]** `plan.md` atualizado para refletir os arquivos finais de `store/` (zero *spec drift*).

## 2. Lente de Segurança
- **[WARNING -> RESOLVIDO]** Em `backend/cmd/fin-server/main.go`, substituído `http.ListenAndServe` por `http.Server` com `ReadHeaderTimeout: 5 * time.Second` para mitigar ataques *Slowloris*.
- **[OK]** Todas as consultas SQL usam parâmetros posicionais `?` (zero concatenação de input do usuário).
- **[OK]** Limite de body de 64 KB via `http.MaxBytesReader` validado (`413`), proteção contra path traversal aplicada antes do `http.ServeMux` (`403`) e CSV anti-*formula injection* validado.

## 3. Lente de Corretude
- **[OK]** `modernc.org/sqlite` (Pure Go, sem CGO) compilou e rodou todos os testes sem GCC/MSVC no Windows, com `PRAGMA foreign_keys = ON`, `WAL mode` e `SetMaxOpenConns(1)`.
- **[OK]** Migração automática de `data/ledger.json` legado validada em `TestImportLegacyJSON`.
- **[OK]** Paridade completa dos contratos REST da `REQ-001` e `REQ-002` verificada em `TestRESTContractParity`, incluindo slices JSON não nulos (`[]`).
- **[OK]** Workflow CI `.github/workflows/atelier-gate.yml` configurado com `go-version-file: backend/go.mod` para evitar desalinhamento de versão.

## 4. Lente de Simplicidade (Crítico Obrigatório)
- **[OK]** Zero frameworks HTTP de terceiros (`net/http` nativo com roteamento Go 1.22+); única dependência externa no backend é `modernc.org/sqlite`.
- **[OK]** `gofmt` limpo e `go vet ./...` sem avisos.

---

## Evidências de Verificação
- Comando: `npm run gate` (`node scripts/atelier-gate.mjs --with-tests`)
- Resultado: `gofmt` OK, `go vet ./...` OK, 100% testes Go (`domain`, `store`, `httpapi`, `cli`) + testes WebApp passando com 0 violações.
