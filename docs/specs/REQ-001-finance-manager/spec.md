# REQ-001 — Atelier Fin: Mini App de Gestão Financeira Multi-Superfície

- **Status:** Draft (Aguardando aprovação do Principal Engineer)
- **Autor:** Principal Engineer + Agente Atelier
- **Data:** 2026-11-26

---

## 1. Contexto e Problema
Queremos validar a metodologia **Atelier** em um cenário realista e não trivial: um sistema de **gestão financeira pessoal** composto por múltiplas superfícies (**Core de Domínio + API REST + CLI + Frontend Web PWA + empacotamento Android**).

Em projetos multi-superfície, o "vibe coding" costuma duplicar regras de negócio entre CLI, backend e frontend, gerar erros de ponto flutuante em dinheiro e produzir arquivos monolíticos difíceis de manter. O objetivo é provar que *Spec-Driven Development* + *Laws, Not Vibes* mantém consistência arquitetural de ponta a ponta.

---

## 2. Escopo (In-Scope)
- **Core de Domínio (`packages/core`):**
  - Cadastro, listagem e remoção de transações (`income` | `expense`), com valor em centavos inteiros (`amountCents`), categoria, descrição e data (`YYYY-MM-DD`).
  - Definição de orçamento mensal por categoria (`category`, `month`, `limitCents`).
  - Cálculo de resumo financeiro mensal (receitas, despesas, saldo líquido, gasto por categoria e alertas de orçamento: `ok`, `warning >= 80%`, `exceeded > 100%`).
  - Persistência local atômica em JSON (`data/ledger.json`) via repositório desacoplado.
- **API REST (`packages/api`):**
  - Endpoints JSON para transações, orçamentos e resumo mensal + healthcheck.
  - Serve o frontend estático (`packages/web`) na mesma origem para uso local imediato e testes E2E sem fricção de CORS.
- **CLI (`packages/cli`):**
  - Comandos diretos no terminal (`add`, `list`, `delete`, `budget`, `summary`) operando sobre o mesmo domínio e base de dados.
- **Frontend Web Responsivo / PWA (`packages/web`):**
  - Dashboard mobile-first: cards de saldo/receita/despesa, formulário rápido de lançamento, lista com exclusão, filtro por mês (`YYYY-MM`) e barras de progresso dos orçamentos por categoria.
  - Suporte PWA (`manifest.webmanifest` + `sw.js`) instalável diretamente em celulares Android.
- **Empacotamento Android (`packages/mobile`):**
  - Configuração **Capacitor** pronta apontando para `packages/web/src` + guia reproduzível para gerar o projeto Android nativo (`npx cap add android`) e APK.

---

## 3. Fora de Escopo (Out-of-Scope)
- Autenticação multiusuário / OAuth / banco de dados em nuvem (esta POC é local-first / single-user).
- Open Finance / importação automática de extrato bancário (OFX/CSV).
- Compilação efetiva do `.apk` dentro desta máquina sem Android SDK instalado (entregamos a camada PWA funcional + configuração Capacitor pronta para build Android).
- Parcelamento recorrente complexo e conversão multi-moeda (fica para uma eventual `REQ-002`).

---

## 4. Requisitos Funcionais e Critérios de Aceite

### RF-01: Registrar transação financeira
- **Dado** um livro-caixa vazio ou existente
- **Quando** o usuário adiciona uma transação válida (`type`: `income`|`expense`, `amountCents > 0`, `category`, `date: YYYY-MM-DD`, `description`)
- **Então** a transação recebe um `id` único, é persistida atomicamente e aparece nas consultas seguintes.
- **E** entradas inválidas (valor `<= 0`, valor decimal/não inteiro em centavos, tipo desconhecido ou data inválida) são rejeitadas com erro claro.

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
- **Então** retorna `totalIncomeCents`, `totalExpenseCents`, `balanceCents` (`income - expense`), breakdown por categoria e status de orçamentos sem qualquer erro de arredondamento de ponto flutuante.

### RF-05: Exposição via API REST
- **Dado** o servidor API em execução
- **Quando** clientes chamam `GET/POST /api/transactions`, `DELETE /api/transactions/:id`, `GET/PUT /api/budgets` e `GET /api/summary?month=YYYY-MM`
- **Então** a API valida o payload, delega ao `packages/core` e responde com status HTTP adequados (`200`, `201`, `400`, `404`).

### RF-06: Operação via CLI
- **Dado** o comando `npm run cli -- <subcomando>`
- **Quando** o usuário executa `add`, `list`, `delete`, `budget` ou `summary`
- **Então** o CLI executa a operação no mesmo ledger e imprime saída legível formatada em BRL (`R$`).

### RF-07: Interface Web Mobile-First + PWA + Base Android
- **Dado** o acesso ao frontend via navegador desktop ou mobile
- **Quando** o usuário visualiza o dashboard, adiciona/remove transações ou define orçamentos
- **Então** a interface atualiza em tempo real via API, funciona em layout responsivo de celular, expõe `manifest.webmanifest` + Service Worker (instalável no Android) e possui configuração Capacitor em `packages/mobile`.

---

## 5. Requisitos Não-Funcionais & Leis Aplicáveis (`AGENTS.md`)
- **Zero dependências externas obrigatórias** no runtime principal (Node 22 nativo + ESM), garantindo execução rápida, auditável e sem atrito no Windows.
- **Lei Anti-Monólito:** Todo arquivo em `packages/*/src/` deve ter no máximo **220 linhas**.
- **Precisão Monetária:** Toda aritmética financeira ocorre em `amountCents` inteiros; conversão de reais (ex.: `"49.90"` ou `"49,90"`) acontece apenas na borda de entrada (`parseCurrencyToCents`).
- **Segurança:** Sanitização/escape de HTML no frontend (sem `innerHTML` com dados não escapados), limite de tamanho de body na API (64 KB) e proteção contra path traversal ao servir arquivos estáticos.

---

## 6. Decisões em Aberto (para aprovação do Principal Engineer)
- [ ] **Android Strategy:** Aprova **Web Mobile-First (PWA) + Capacitor (`packages/mobile`)** para esta POC (evita precisar de Android Studio/React Native rodando agora, mas já entrega base pronta para APK), ou prefere um scaffold Expo/React Native separado?
- [ ] **Persistência:** Aprova repositório JSON atômico (`data/ledger.json`) com interface plugável para manter zero dependências nativas no Windows?
- [ ] **Escopo funcional:** As features (`transações`, `categorias`, `orçamento mensal com alertas` e `resumo`) estão no tamanho ideal para o primeiro ciclo `REQ-001`?
