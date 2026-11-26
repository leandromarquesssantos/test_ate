# Plano Técnico — REQ-003 (Backend/CLI em Go + SQLite + CI)

- **Spec de referência:** `./spec.md`
- **Status:** Pending Approval

---

## 1. Arquitetura Go (Clean & Modular, <= 220 linhas/arquivo)

```text
backend/
├── go.mod
├── cmd/
│   ├── fin-server/main.go         # Entrypoint HTTP server (PORT, DB_PATH, WEB_DIR)
│   └── fin-cli/main.go            # Entrypoint CLI
└── internal/
    ├── domain/                    # 100% puro (stdlib apenas)
    │   ├── money.go               # Cents (int64), ParseBRL, FormatBRL, erros de domínio
    │   ├── validation.go          # Datas, meses, categorias, contas, ClampDay
    │   ├── models.go              # Structs JSON compatíveis com REQ-001/REQ-002
    │   ├── summary.go             # Cálculo de resumo mensal e alertas de orçamento
    │   ├── csv.go                 # Exportador CSV RFC-4180 + anti formula-injection
    │   └── domain_test.go
    ├── store/                     # SQLite ACID via modernc.org/sqlite (sem CGO)
    │   ├── sqlite.go              # Conexão, PRAGMA WAL/FK, schema migrations, legacy JSON import
    │   ├── transactions.go        # CRUD transações + filtros combinados + transferências
    │   ├── accounts_budgets.go    # Contas com saldo SQL/agregado + orçamentos
    │   ├── recurring.go           # Regras recorrentes + apply idempotente em transação SQL
    │   └── store_test.go
    ├── httpapi/                   # API REST + Static server seguro (net/http stdlib)
    │   ├── helpers.go             # JSON read (64 KB max), write JSON/CSV, mapeamento de erros
    │   ├── static.go              # Servidor estático protegido contra path traversal
    │   ├── routes_ledger.go       # /api/health, /transactions, /budgets, /summary, /export/csv
    │   ├── routes_extras.go       # /accounts, /transfers, /recurring, /recurring/apply
    │   ├── server.go              # Mux Go 1.22+ (`GET /api/...`, `PATCH /api/transactions/{id}`)
    │   └── api_test.go
    └── cli/
        ├── runner.go              # Dispatch de comandos CLI (add, edit, list, delete, budget, summary)
        ├── runner_extra.go        # accounts, transfer, recurring, export
        └── cli_test.go

.github/workflows/atelier-gate.yml # CI rodando Go + Node Web tests + Quality Gate
```

---

## 2. Schema SQLite (`data/atelier-fin.db`)

```sql
CREATE TABLE IF NOT EXISTS accounts (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  type TEXT NOT NULL CHECK (type IN ('checking','cash','savings','credit'))
);

CREATE TABLE IF NOT EXISTS transactions (
  id                TEXT PRIMARY KEY,
  type              TEXT NOT NULL CHECK (type IN ('income','expense','transfer')),
  amount_cents      INTEGER NOT NULL CHECK (amount_cents > 0),
  category          TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  date              TEXT NOT NULL,
  account_id        TEXT NOT NULL REFERENCES accounts(id),
  to_account_id     TEXT REFERENCES accounts(id),
  recurring_rule_id TEXT,
  created_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_tx_account ON transactions(account_id);

CREATE TABLE IF NOT EXISTS budgets (
  month       TEXT NOT NULL,
  category    TEXT NOT NULL,
  limit_cents INTEGER NOT NULL CHECK (limit_cents > 0),
  PRIMARY KEY (month, category)
);

CREATE TABLE IF NOT EXISTS recurring_rules (
  id           TEXT PRIMARY KEY,
  type         TEXT NOT NULL CHECK (type IN ('income','expense')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  category     TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  day_of_month INTEGER NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
  account_id   TEXT NOT NULL REFERENCES accounts(id)
);
```

---

## 3. Estratégia de Testes e Quality Gate

1. **Testes unitários de domínio (`domain_test.go`):** centavos/BRL, datas inválidas, dia 31 em fevereiro, CSV formula injection.
2. **Testes de persistência (`store_test.go`):** SQLite em `:memory:`/temp file, ACID, foreign keys, saldos de contas + transferências, idempotência de recorrentes e migração de `ledger.json`.
3. **Testes HTTP de contrato (`api_test.go`):** `httptest.NewServer` validando todos os endpoints REST, `400`/`403`/`404`/`413`, CSV e serving de `packages/web/src`.
4. **Testes CLI (`cli_test.go`):** ciclo completo de comandos.
5. **Testes Web (`packages/web/test/web.test.mjs`):** mantidos ativos no gate!
6. **GitHub Actions CI:** roda `npm run gate` em `ubuntu-latest` com `setup-go` + `setup-node`.
