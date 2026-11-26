# Plano Técnico — REQ-001 (Atelier Fin)

- **Spec de referência:** `./spec.md`
- **Status:** Pending Approval

---

## 1. Arquitetura e Fronteiras

Monorepo leve em **Node 22 ESM** com separação estrita de camadas:

```text
packages/
├── core/     # Domínio puro (dinheiro, validações, transações, orçamentos, resumo, store)
├── api/      # Servidor HTTP REST + static server para packages/web (importa apenas core)
├── cli/      # Interface de linha de comando (importa apenas core)
├── web/      # App Web responsivo + PWA instalável no Android (consome API via fetch)
└── mobile/   # Wrapper Capacitor Android apontando para ../web/src + guia APK
```

### Regras de Dependência
- `packages/core` → **nenhuma** dependência de `api`, `cli`, `web` ou `mobile`.
- `packages/api` → depende apenas de `packages/core` (e serve arquivos estáticos de `packages/web/src`).
- `packages/cli` → depende apenas de `packages/core`.
- `packages/web` → se comunica exclusivamente via HTTP com `packages/api` (URL configurável para suportar app Android apontando para a API na rede local).

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

## 3. Mapa de Arquivos (Respeitando limite <= 220 linhas/arquivo)

| Arquivo | Responsabilidade | Limite Estimado |
| :--- | :--- | :--- |
| `packages/core/src/money.mjs` | Parse/formatação BRL e validação de centavos | ~70 linhas |
| `packages/core/src/store.mjs` | Persistência JSON atômica (`write tmp` + `rename`) | ~85 linhas |
| `packages/core/src/ledger.mjs` | Regras de transações, orçamentos e resumo mensal | ~180 linhas |
| `packages/core/src/index.mjs` | Export público do domínio | ~20 linhas |
| `packages/api/src/http.mjs` | Helpers de JSON body (limite 64 KB), respostas e static safe | ~110 linhas |
| `packages/api/src/server.mjs` | Roteamento REST + factory `createAppServer()` testável | ~160 linhas |
| `packages/api/src/index.mjs` | Entrypoint do servidor (`PORT`, `DATA_FILE`) | ~25 linhas |
| `packages/cli/src/parser.mjs` | Parser simples de argumentos/flags da CLI | ~60 linhas |
| `packages/cli/src/commands.mjs` | Execução e formatação tabular dos comandos CLI | ~150 linhas |
| `packages/cli/src/index.mjs` | Entrypoint CLI | ~25 linhas |
| `packages/web/src/index.html` | Layout mobile-first + metadados PWA | ~120 linhas |
| `packages/web/src/styles.css` | Design system limpo, responsivo (dark/light cards) | ~180 linhas |
| `packages/web/src/api-client.mjs` | Cliente HTTP + suporte a base URL configurável (Android) | ~65 linhas |
| `packages/web/src/app.mjs` | Estado da UI, renderização segura (escape HTML) e eventos | ~185 linhas |
| `packages/web/src/manifest.webmanifest` | Manifesto PWA instalável no Android | ~25 linhas |
| `packages/web/src/sw.js` | Service Worker com cache shell para PWA | ~45 linhas |
| `packages/mobile/capacitor.config.json` | Config Capacitor Android (`webDir: ../web/src`) | ~20 linhas |
| `packages/mobile/package.json` | Scripts de sincronização/build Android via Capacitor | ~25 linhas |
| `packages/mobile/README.md` | Passo a passo para gerar APK Android | ~60 linhas |

---

## 4. Estratégia de Testes (TDD)

| Requisito | Suíte de Teste |
| :--- | :--- |
| `RF-01`, `RF-02`, `RF-03`, `RF-04` | `packages/core/test/ledger.test.mjs` |
| `RF-05` + segurança (payload/path traversal) | `packages/api/test/api.test.mjs` |
| `RF-06` | `packages/cli/test/cli.test.mjs` |
| `RF-07` (integridade PWA/Mobile + assets servidos) | `packages/api/test/api.test.mjs` + `packages/web/test/web.test.mjs` |

---

## 5. Riscos e Trade-offs
- **Concorrência de escrita em JSON:** Mitigado por escrita atômica (arquivo temporário + rename); para multiusuário concorrente no futuro, basta trocar `JsonFileStore` por `SqliteStore` mantendo a mesma interface de repositório.
- **App Android acessando API local:** No emulador Android (`10.0.2.2:3000`) ou rede Wi-Fi, o frontend permite configurar `API_BASE_URL` via `localStorage` sem precisar recompilar o app.
