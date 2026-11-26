# Atelier Fin — POC da Metodologia Atelier

POC prática da metodologia **Atelier** (*Spec-Driven Development* + *Laws, Not Vibes*) aplicada a um MVP de **gestão financeira pessoal** (Core + API REST + CLI + WebApp responsivo), sem dependências externas e 100% cross-platform (Node 22 ESM).

## Estrutura Atelier do Repositório

- `AGENTS.md` — Constituição do repositório (processo *Bounded vs. Substantial*, leis determinísticas e contrato de *done-state*).
- `.agents/skills/` — Skills do ciclo Atelier (`atelier-spec-brainstorm`, `atelier-spec-plan`, `atelier-spec-implement`, `atelier-code-review`).
- `docs/specs/REQ-001-finance-manager/` — Memória versionada da feature (`spec.md`, `plan.md`, `tasks.json`, `review.md`).
- `scripts/atelier-gate.mjs` — Quality gate determinístico (`npm run gate`).

## Arquitetura do App (`packages/`)

- `packages/core` — Domínio financeiro puro (centavos inteiros, transações, orçamentos, alertas e persistência JSON atômica).
- `packages/api` — API REST HTTP + servidor estático seguro do WebApp.
- `packages/cli` — Interface de linha de comando compartilhando o mesmo domínio e ledger.
- `packages/web` — WebApp responsivo (dashboard, lançamentos, orçamentos e proteção XSS).

## Como executar

### 1. Rodar Quality Gate completo (testes + leis arquiteturais)
```bash
npm run gate
```

### 2. Iniciar o WebApp + API REST
```bash
npm run api
# Acesse http://127.0.0.1:3000
```

### 3. Usar via CLI (mesmo arquivo data/ledger.json)
```bash
npm run cli -- add --type income --amount 5000 --category salario --desc "Salário"
npm run cli -- add --type expense --amount 125,50 --category alimentacao --desc "Mercado"
npm run cli -- budget --category alimentacao --limit 1000
npm run cli -- summary
npm run cli -- list
```
