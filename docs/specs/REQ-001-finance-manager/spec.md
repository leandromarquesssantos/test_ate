# REQ-001 — Atelier Fin: MVP de Gestão Financeira (Core + API + CLI + WebApp)

- **Status:** Done (Aprovado e verificado em 2026-11-26)
- **Autor:** Principal Engineer + Agente Atelier
- **Data:** 2026-11-26

---

## 1. Contexto e Problema
Validar a metodologia **Atelier** em um cenário realista e multi-superfície: um sistema de **gestão financeira pessoal** composto por **Core de Domínio + API REST + CLI + WebApp responsivo**.

O objetivo é provar que *Spec-Driven Development* + *Laws, Not Vibes* evita duplicação de regras de negócio entre CLI/API/Web, elimina erros de ponto flutuante em dinheiro e mantém arquivos enxutos, testáveis e sem dependências específicas de sistema operacional.

---

## 2. Escopo (In-Scope — MVP WebApp)
- **Core de Domínio (`packages/core`):**
  - Cadastro, listagem e remoção de transações (`income` | `expense`), com valor em centavos inteiros (`amountCents`), categoria, descrição e data (`YYYY-MM-DD`).
  - Definição de orçamento mensal por categoria (`category`, `month`, `limitCents`).
  - Cálculo de resumo financeiro mensal (receitas, despesas, saldo líquido, gasto por categoria e alertas de orçamento: `ok`, `warning >= 80%`, `exceeded > 100%`).
  - Persistência local atômica em JSON (`data/ledger.json`) via repositório desacoplado, 100% cross-platform (zero dependências de Windows ou binários nativos).
- **API REST (`packages/api`):**
  - Endpoints JSON para transações, orçamentos e resumo mensal + healthcheck.
  - Serve o frontend estático (`packages/web/src`) na mesma origem para uso local imediato.
- **CLI (`packages/cli`):**
  - Comandos diretos no terminal (`add`, `list`, `delete`, `budget`, `summary`) operando sobre o mesmo domínio e base de dados.
- **WebApp Responsivo (`packages/web`):**
  - Dashboard responsivo (desktop e mobile browser): cards de saldo/receita/despesa, formulário rápido de lançamento, lista com exclusão, filtro por mês (`YYYY-MM`) e barras de progresso dos orçamentos por categoria.

---

## 3. Fora de Escopo (Out-of-Scope)
- **App Mobile / Android nativo ou empacotamento Capacitor** (decisão do Principal Engineer: postergado para `REQ-002` após validação do MVP WebApp).
- Autenticação multiusuário / OAuth / banco em nuvem (MVP local-first / single-user).
- Open Finance / importação de extratos bancários (OFX/CSV).
- Parcelamento recorrente e multi-moeda.

---

## 4. Requisitos Funcionais e Critérios de Aceite

### RF-01: Registrar transação financeira
- **Dado** um livro-caixa vazio ou existente
- **Quando** o usuário adiciona uma transação válida (`type`: `income`|`expense`, `amountCents > 0`, `category`, `date: YYYY-MM-DD`, `description`)
- **Então** a transação recebe um `id` único, é persistida atomicamente e aparece nas consultas seguintes.
- **E** entradas inválidas (valor `<= 0`, valor não inteiro em centavos, tipo desconhecido ou data calendário inválida como `2026-02-31`) são rejeitadas com erro claro.

### RF-02: Listar e remover transações com filtro mensal
- **Dado** transações registradas em diferentes meses
- **Quando** o usuário consulta filtrando por `month=YYYY-MM` (ou por `category`)
- **Então** apenas as transações correspondentes são retornadas, ordenadas da data mais recente para a mais antiga.
- **Quando** o usuário remove uma transação por `id`
- **Então** ela é removida da persistência; se o `id` não existir, retorna erro `NOT_FOUND`.

### RF-03: Orçamento mensal por categoria e alertas
- **Dado** um orçamento definido para `(month, category, limitCents > 0)`
- **Quando** o resumo mensal é calculado
- **Então** cada categoria com orçamento reporta `spentCents`, `limitCents`, `percentUsed` e `status`:
  - `ok` se `< 80%`
  - `warning` se `>= 80%` e `<= 100%`
  - `exceeded` se `> 100%`

### RF-04: Resumo financeiro mensal
- **Dado** receitas e despesas em um mês `YYYY-MM`
- **Quando** o resumo mensal é solicitado
- **Então** retorna `totalIncomeCents`, `totalExpenseCents`, `balanceCents` (`income - expense`), breakdown por categoria e status de orçamentos sem qualquer erro de ponto flutuante.

### RF-05: Exposição via API REST
- **Dado** o servidor API em execução
- **Quando** clientes chamam `GET/POST /api/transactions`, `DELETE /api/transactions/:id`, `GET/PUT /api/budgets` e `GET /api/summary?month=YYYY-MM`
- **Então** a API valida o payload, delega ao `packages/core` e responde com status HTTP adequados (`200`, `201`, `400`, `404`).

### RF-06: Operação via CLI
- **Dado** o comando `npm run cli -- <subcomando>`
- **Quando** o usuário executa `add`, `list`, `delete`, `budget` ou `summary`
- **Então** o CLI executa a operação no mesmo ledger e imprime saída legível formatada em BRL (`R$`).

### RF-07: WebApp Responsivo
- **Dado** o acesso ao frontend via navegador
- **Quando** o usuário visualiza o dashboard, alterna o mês, adiciona/remove transações ou define orçamentos
- **Então** a interface atualiza em tempo real via API com renderização segura contra XSS.

---

## 5. Requisitos Não-Funcionais & Leis Aplicáveis (`AGENTS.md`)
- **Zero dependências externas e zero dependências de Windows:** Node 22 ESM puro, cross-platform (`path.join`, LF/CRLF agnóstico, sem binários nativos).
- **Lei Anti-Monólito:** Todo arquivo em `packages/*/src/` deve ter no máximo **220 linhas**.
- **Precisão Monetária:** Toda aritmética financeira ocorre em `amountCents` inteiros.
- **Segurança:** Escape de HTML no WebApp, limite de body na API (64 KB) e proteção contra path traversal nos arquivos estáticos.

---

## 6. Decisões Aprovadas pelo Principal Engineer
- [x] **Mobile/Android:** Postergado para `REQ-002`; foco inicial em MVP WebApp.
- [x] **Persistência e Runtime:** Repositório JSON atômico, zero dependências de Windows ou nativas.
- [x] **Escopo funcional:** Transações, categorias, orçamentos mensais com alertas e resumo mensal aprovados.
