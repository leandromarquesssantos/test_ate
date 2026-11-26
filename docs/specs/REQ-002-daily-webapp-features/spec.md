# REQ-002 — Uso Diário Completo no WebApp (Edição, Filtros, Contas, Recorrência e CSV)

- **Status:** Done (Aprovado e verificado em 2026-11-26)
- **Autor:** Principal Engineer + Agente Atelier
- **Data:** 2026-11-26
- **Pré-requisito:** `REQ-001` (concluída)

---

## 1. Contexto e Problema
Com a `REQ-001` entregue, o **Atelier Fin** já permite registrar/excluir transações, definir orçamentos e acompanhar o resumo mensal. Porém, no uso financeiro real diário, o usuário precisa:
1. Corrigir lançamentos errados sem precisar apagar e recriar, além de remover orçamentos antigos.
2. Filtrar e buscar lançamentos rapidamente no WebApp.
3. Separar saldos entre **contas/carteiras** (ex.: Conta Corrente, Dinheiro, Cartão) e fazer transferências sem distorcer receitas/despesas.
4. Automatizar contas fixas mensais (**recorrências**) sem risco de duplicação.
5. Exportar dados em **CSV** para planilhas e backup.

---

## 2. Escopo (In-Scope)
- **Edição e Gestão Completa:**
  - Editar qualquer campo de uma transação existente (`PATCH /api/transactions/:id`, CLI `edit` e formulário de edição no WebApp).
  - Remover orçamento mensal (`DELETE /api/budgets?month=YYYY-MM&category=...` e botão no WebApp).
- **Busca e Filtros:**
  - Filtrar transações por `month`, `type`, `category`, `accountId` e busca textual `q` (case-insensitive em descrição e categoria) na API, CLI e WebApp.
- **Contas / Carteiras e Transferências:**
  - CRUD de contas (`GET/POST /api/accounts`, `DELETE /api/accounts/:id`) com conta padrão automática (`conta-principal`) para 100% de retrocompatibilidade com ledgers da `REQ-001`.
  - Cálculo de saldo acumulado por conta no resumo.
  - Registro de transferências entre contas (`POST /api/transfers`) que movimentam saldos das contas **sem contar como receita nem despesa** no resultado mensal.
- **Recorrências Mensais Idempotentes:**
  - CRUD de regras recorrentes (`GET/POST /api/recurring`, `DELETE /api/recurring/:id`) com `dayOfMonth` (1–28 ou ajustado ao último dia do mês).
  - Materialização idempotente para um mês (`POST /api/recurring/apply` com `{ month }` + botão no WebApp + CLI `recurring apply`): gera apenas os lançamentos ainda não criados naquele mês (identificados por `recurringRuleId + month`).
- **Exportação CSV Segura:**
  - `GET /api/export/csv?month=YYYY-MM` + botão "Exportar CSV" no WebApp + CLI `export`.
  - Escape RFC-4180 + proteção contra *CSV Formula Injection* (`=`, `+`, `-`, `@` em textos).

---

## 3. Fora de Escopo (Out-of-Scope)
- Troca de persistência JSON para SQLite/Postgres (planejada para `REQ-003`).
- Autenticação multiusuário / deploy cloud (planejada para `REQ-004`).
- App Android / PWA offline (planejada para `REQ-005`).
- Importação OFX/CSV bancário e fechamento complexo de fatura de cartão de crédito.

---

## 4. Requisitos Funcionais e Critérios de Aceite

### RF-01: Editar transação e remover orçamento
- **Dado** uma transação existente
- **Quando** o usuário atualiza um ou mais campos (`type`, `amountCents`/`amount`, `category`, `description`, `date`, `accountId`)
- **Então** apenas os campos válidos enviados são atualizados, mantendo o `id` original e validando todas as regras de domínio; ID inexistente retorna `NOT_FOUND`.
- **Quando** o usuário remove um orçamento de `(month, category)`
- **Então** ele deixa de aparecer no resumo mensal; combinação inexistente retorna `NOT_FOUND`.

### RF-02: Busca e filtros combinados
- **Dado** múltiplas transações em categorias, tipos e contas diferentes
- **Quando** o usuário aplica filtros combinados (`month`, `type`, `category`, `accountId`, `q`)
- **Então** apenas as transações que satisfazem todos os critérios são retornadas.

### RF-03: Contas / Carteiras e Transferências
- **Dado** um ledger existente (mesmo criado na `REQ-001`)
- **Quando** o sistema é carregado
- **Então** existe ao menos a conta padrão (`conta-principal`), e transações antigas sem `accountId` são atribuídas a ela sem perder dados.
- **Quando** o usuário cria contas adicionais e registra uma transferência de `A` para `B` no valor `X`
- **Então** o saldo da conta `A` diminui `X`, o saldo da conta `B` aumenta `X`, e `totalIncomeCents` / `totalExpenseCents` do mês **não** são alterados.
- **E** não é permitido transferir para a mesma conta nem excluir uma conta que possua transações vinculadas ou que seja a única conta existente.

### RF-04: Lançamentos Recorrentes Idempotentes
- **Dado** uma regra recorrente (ex.: `Aluguel`, dia `5`, `R$ 1.800,00`, `expense`)
- **Quando** o usuário executa `applyRecurring("2026-11")`
- **Então** a transação correspondente é criada com data `2026-11-05` e `recurringRuleId`.
- **Quando** `applyRecurring("2026-11")` é executado uma segunda vez
- **Então** `createdCount === 0` (nenhuma duplicata é criada).
- **E** dias como `31` em meses mais curtos (ex.: fevereiro) são ajustados com segurança para o último dia válido do mês (`2026-02-28`).

### RF-05: Exportação CSV segura
- **Dado** transações no ledger (incluindo descrições com vírgulas, aspas ou prefixo `=SUM(A1:A2)`)
- **Quando** o usuário exporta CSV (via API, WebApp ou CLI)
- **Então** o CSV retornado possui cabeçalho padrão, campos escapados conforme RFC-4180 e fórmulas maliciosas neutralizadas com prefixo `'`.

### RF-06: Experiência Integrada no WebApp e CLI
- **Dado** o WebApp aberto no navegador
- **Quando** o usuário edita uma transação, filtra por busca/tipo/conta, cria/remove conta ou transferência, gera recorrentes do mês ou baixa o CSV
- **Então** todas as operações funcionam sem recarregar a página, com renderização segura contra XSS.

---

## 5. Requisitos Não-Funcionais & Leis Aplicáveis (`AGENTS.md`)
- **Lei Anti-Monólito (<= 220 linhas/arquivo em `src/`):** Como `ledger.mjs` (209 linhas) e `styles.css` (195 linhas) já estão próximos do teto, esta REQ inclui refatoração modular limpa antes de adicionar novas features.
- **Zero dependências externas / zero dependências de Windows:** Node 22 ESM puro.
- **Retrocompatibilidade total:** `data/ledger.json` existente continua funcionando sem migração manual destrutiva.

---

## 6. Decisões em Aberto (para aprovação do Principal Engineer)
- [ ] **Transferências:** Representar transferências como tipo dedicado (`type: "transfer"` com `accountId` origem e `toAccountId` destino) no mesmo histórico, excluído de receitas/despesas mensais? *(Recomendado: simples, auditável e preserva histórico único).*
- [ ] **Recorrências:** Aplicação sob demanda por botão/comando idempotente ("Gerar recorrentes do mês") em vez de cron oculto em background? *(Recomendado: explícito, previsível e sem surpresas no saldo).*
- [ ] **Workflow Git:** Quer que eu implemente a `REQ-002` em uma branch isolada com **Git worktree** (`feat/req-002`) e faça o merge na `main` após `npm run gate` verde (para você testar na prática o paralelismo do Atelier), ou direto na `main`?
