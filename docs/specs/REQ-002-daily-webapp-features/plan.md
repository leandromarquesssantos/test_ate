# Plano Técnico — REQ-002 (Uso Diário Completo)

- **Spec de referência:** `./spec.md`
- **Status:** Pending Approval

---

## 1. Arquitetura e Modularização (Respeitando teto <= 220 linhas/arquivo)

Para acomodar `REQ-002` sem violar a lei anti-monólito de `AGENTS.md`, modularizamos `core`, `api` e `web` por responsabilidade coesa:

```text
packages/core/src/
├── money.mjs         # Centavos, parse/format BRL, erros (existente)
├── validation.mjs    # NOVO: validação de datas, meses, categorias, contas e dias recorrentes
├── store.mjs         # Persistência JSON atômica + normalização retrocompatível (accounts/recurring)
├── accounts.mjs      # NOVO: gestão de contas e cálculo de saldo acumulado por conta
├── recurring.mjs     # NOVO: regras recorrentes + materialização idempotente por mês
├── export.mjs        # NOVO: gerador CSV RFC-4180 com proteção contra formula injection
├── ledger.mjs        # Refatorado: orquestra transações (incl. update/transfer), filtros e resumo
└── index.mjs         # Exports públicos

packages/api/src/
├── http.mjs          # Helpers JSON, CSV download, static safe
├── routes-ledger.mjs # NOVO: /api/transactions (incl. PATCH), /api/budgets (incl. DELETE), /api/summary, /api/export/csv
├── routes-extras.mjs # NOVO: /api/accounts, /api/transfers, /api/recurring, /api/recurring/apply
├── server.mjs        # Roteador enxuto + tratamento central de erros
└── index.mjs         # Entrypoint

packages/cli/src/
├── parser.mjs        # Parser de flags
├── commands.mjs      # add, edit, list (com filtros), delete, budget, summary
├── commands-extra.mjs# NOVO: accounts, transfer, recurring, export
└── index.mjs         # Entrypoint

packages/web/src/
├── index.html        # Layout com abas/seções: Visão Geral, Contas & Transferências, Recorrentes
├── styles.css        # Base, layout e cards
├── components.css    # NOVO: filtros, barras, badges, modal/form de edição e listas
├── api-client.mjs    # Cliente HTTP completo + escapeHtml + formatBRL
├── render.mjs        # NOVO: renderizadores puros e seguros (XSS-safe)
└── app.mjs           # Estado, filtros, edição inline, contas, recorrentes e download CSV
```

---

## 2. Contratos de Dados (Retrocompatíveis com `REQ-001`)

### Estado do Ledger (`version: 2`, migrado automaticamente em leitura)
```json
{
  "version": 2,
  "accounts": [
    { "id": "acc_default", "name": "Conta Principal", "type": "checking" }
  ],
  "transactions": [
    {
      "id": "tx_...",
      "type": "expense | income | transfer",
      "amountCents": 12550,
      "category": "alimentacao",
      "description": "Mercado",
      "date": "2026-11-26",
      "accountId": "acc_default",
      "toAccountId": null,
      "recurringRuleId": null,
      "createdAt": "..."
    }
  ],
  "budgets": [],
  "recurring": [
    {
      "id": "rec_...",
      "type": "expense",
      "amountCents": 180000,
      "category": "moradia",
      "description": "Aluguel",
      "dayOfMonth": 5,
      "accountId": "acc_default"
    }
  ]
}
```

### Novos Endpoints REST
- `PATCH /api/transactions/:id` — edição parcial de transação (`200`, `400`, `404`)
- `DELETE /api/budgets?month=YYYY-MM&category=...` — remove orçamento (`200`, `404`)
- `GET /api/transactions?month=&category=&type=&accountId=&q=` — filtros combinados
- `GET /api/accounts` / `POST /api/accounts` / `DELETE /api/accounts/:id`
- `POST /api/transfers` — cria transferência entre contas (`201`, `400`, `404`)
- `GET /api/recurring` / `POST /api/recurring` / `DELETE /api/recurring/:id`
- `POST /api/recurring/apply` (`{ "month": "YYYY-MM" }`) — aplica recorrentes idempotentemente (`200`)
- `GET /api/export/csv?month=YYYY-MM` — download `text/csv; charset=utf-8` com `Content-Disposition: attachment`

---

## 3. Estratégia de Testes (TDD)

| Requisito | Suíte de Teste |
| :--- | :--- |
| `RF-01`, `RF-02`, `RF-03` | `packages/core/test/ledger.test.mjs` + `packages/core/test/accounts-recurring.test.mjs` |
| `RF-04`, `RF-05` | `packages/core/test/accounts-recurring.test.mjs` (idempotência, dia 31 em fev, CSV formula injection) |
| `RF-01`..`RF-05` via HTTP | `packages/api/test/api.test.mjs` |
| CLI completo | `packages/cli/test/cli.test.mjs` |
| `RF-06` (WebApp + XSS) | `packages/web/test/web.test.mjs` |

---

## 4. Riscos e Mitigações
- **Limite de 220 linhas por arquivo:** Resolvido estruturalmente dividindo `core`, `api`, `cli` e `web` em módulos especializados antes de adicionar código novo.
- **CSV Formula Injection:** Toda célula textual iniciando com `=`, `+`, `-`, `@`, `\t` ou `\r` recebe prefixo `'` antes do escape RFC-4180.
- **Retrocompatibilidade de dados:** `store.mjs` injeta `acc_default` automaticamente se `accounts` estiver ausente e trata `tx.accountId ?? "acc_default"` nas consultas.
