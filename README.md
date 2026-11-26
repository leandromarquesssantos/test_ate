# Atelier Fin — Gestão Financeira (Go + SQLite + WebApp)

Projeto construído com a metodologia **Atelier** (*Spec-Driven Development* + *Laws, Not Vibes* + *Git Worktrees* + *CI*).

## Arquitetura Atual

- **`backend/` (Go + SQLite sem CGO via `modernc.org/sqlite`)**:
  - `internal/domain`: domínio financeiro puro em stdlib (`Cents` como `int64`, validações, resumo mensal, CSV seguro).
  - `internal/store`: persistência SQLite ACID (`WAL`, foreign keys, migração automática de `data/ledger.json`).
  - `internal/httpapi` + `cmd/fin-server`: API REST `net/http` + servidor estático seguro.
  - `internal/cli` + `cmd/fin-cli`: CLI nativo em Go.
- **`packages/web/`**: WebApp responsivo consumindo a API REST Go.
- **`.github/workflows/atelier-gate.yml`**: CI rodando `npm run gate` (`gofmt`, `go vet`, `go test`, testes WebApp e leis arquiteturais).

## Histórico de Entregas (`docs/specs/`)

- `REQ-001` — MVP inicial (transações em centavos, orçamentos com alertas, resumo mensal).
- `REQ-002` — Uso diário completo (edição inline, busca/filtros, contas/transferências, recorrências idempotentes, CSV seguro).
- `REQ-003` — Migração de Core, API e CLI para **Go + SQLite Pure Go** + Quality Gate Go + CI no GitHub Actions.

## Como executar

### 1. Rodar Quality Gate completo (leis + Go + WebApp)
```bash
npm run gate
```

### 2. Iniciar o servidor Go + WebApp (`http://127.0.0.1:3000`)
```bash
npm run api
```

### 3. Usar o CLI Go (mesmo banco `data/atelier-fin.db`)
```bash
npm run cli -- add --type income --amount 5000 --category salario --desc "Salário"
npm run cli -- accounts add --name "Carteira" --type cash
npm run cli -- transfer --from acc_default --to <id_carteira> --amount 300
npm run cli -- recurring add --type expense --amount 1800 --category moradia --desc "Aluguel" --day 5
npm run cli -- recurring apply --month 2026-11
npm run cli -- summary
```
