# Plano Técnico — REQ-001 (Atelier Fin MVP WebApp)

- **Spec de referência:** `./spec.md`
- **Status:** Approved

---

## 1. Arquitetura e Fronteiras

Monorepo leve em **Node 22 ESM** (zero dependências de terceiros, 100% cross-platform):

```text
packages/
├── core/   # Domínio puro (dinheiro, validações, transações, orçamentos, resumo, store JSON atômico)
├── api/    # Servidor HTTP REST + static server seguro para packages/web (importa apenas core)
├── cli/    # Interface de linha de comando (importa apenas core)
└── web/    # WebApp responsivo (consome API via fetch)
```

### Regras de Dependência
- `packages/core` → **nenhuma** dependência de `api`, `cli` ou `web`.
- `packages/api` → depende apenas de `packages/core` (e serve arquivos estáticos de `packages/web/src`).
- `packages/cli` → depende apenas de `packages/core`.
- `packages/web` → comunica exclusivamente via HTTP com `packages/api`.

---

## 2. Contratos de Dados e Interfaces

### Entidades de Domínio
```json
// Transaction
{
  "id": "tx_...",
  "type": "expense",
  "amountCents": 12550,
  "category": "alimentacao",
  "description": "Supermercado",
  "date": "2026-11-26",
  "createdAt": "2026-11-26T18:00:00.000Z"
}

// Budget
{
  "month": "2026-11",
  "category": "alimentacao",
  "limitCents": 150000
}
```

### Endpoints REST (`packages/api`)
- `GET /api/health` → `{ "status": "ok" }`
- `GET /api/transactions?month=YYYY-MM&category=...` → `{ "items": [...] }`
- `POST /api/transactions` → cria transação (`201`) ou erro (`400`)
- `DELETE /api/transactions/:id` → remove (`200`) ou erro (`404`)
- `GET /api/budgets?month=YYYY-MM` → `{ "items": [...] }`
- `PUT /api/budgets` → cria/atualiza orçamento mensal (`200`) ou erro (`400`)
- `GET /api/summary?month=YYYY-MM` → resumo consolidado com status dos orçamentos (`200`)

### Comandos CLI (`packages/cli`)
- `npm run cli -- add --type expense --amount 49.90 --category alimentacao --desc "Almoço" [--date 2026-11-26]`
- `npm run cli -- list [--month 2026-11] [--category alimentacao]`
- `npm run cli -- delete <id>`
- `npm run cli -- budget --month 2026-11 --category alimentacao --limit 1000`
- `npm run cli -- summary [--month 2026-11]`

---

## 3. Mapa de Arquivos (Limite <= 220 linhas/arquivo)

| Arquivo | Responsabilidade | Limite Estimado |
| :--- | :--- | :--- |
| `packages/core/src/money.mjs` | Parse/formatação BRL e validação de centavos | ~75 linhas |
| `packages/core/src/store.mjs` | Persistência JSON atômica (`write tmp` + `rename`) | ~70 linhas |
| `packages/core/src/ledger.mjs` | Regras de transações, orçamentos e resumo mensal | ~185 linhas |
| `packages/core/src/index.mjs` | Export público do domínio | ~20 linhas |
| `packages/api/src/http.mjs` | Helpers de JSON body (64 KB max), respostas e static safe | ~115 linhas |
| `packages/api/src/server.mjs` | Roteamento REST + factory `createAppServer()` testável | ~155 linhas |
| `packages/api/src/index.mjs` | Entrypoint do servidor (`PORT`, `DATA_FILE`) | ~25 linhas |
| `packages/cli/src/parser.mjs` | Parser de argumentos/flags da CLI | ~55 linhas |
| `packages/cli/src/commands.mjs` | Execução e formatação tabular dos comandos CLI | ~155 linhas |
| `packages/cli/src/index.mjs` | Entrypoint CLI | ~25 linhas |
| `packages/web/src/index.html` | Layout responsivo do dashboard financeiro | ~115 linhas |
| `packages/web/src/styles.css` | Design system limpo, responsivo (cards, barras, formulários) | ~185 linhas |
| `packages/web/src/api-client.mjs` | Cliente HTTP desacoplado | ~55 linhas |
| `packages/web/src/app.mjs` | Estado da UI, renderização segura (escape HTML) e eventos | ~185 linhas |

---

## 4. Estratégia de Testes (TDD)

| Requisito | Suíte de Teste |
| :--- | :--- |
| `RF-01`, `RF-02`, `RF-03`, `RF-04` | `packages/core/test/ledger.test.mjs` |
| `RF-05` + segurança (payload/path traversal) | `packages/api/test/api.test.mjs` |
| `RF-06` | `packages/cli/test/cli.test.mjs` |
| `RF-07` (integridade do WebApp e XSS guard) | `packages/web/test/web.test.mjs` |

---

## 5. Riscos e Trade-offs
- **Concorrência de escrita em JSON:** Mitigado por escrita atômica com arquivo temporário único + rename; a interface `Store` permite trocar por SQLite/Postgres em `REQ` futura sem alterar `LedgerService`.
- **Evolução para Mobile (`REQ-002`):** Como toda lógica está em `packages/core` + REST API limpa e o WebApp é responsivo, `REQ-002` poderá empacotar o WebApp (PWA/Capacitor) ou conectar um app nativo consumindo os mesmos endpoints.
