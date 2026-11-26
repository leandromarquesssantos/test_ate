# Atelier Fin — POC da Metodologia Atelier

POC prática da metodologia **Atelier** (*Spec-Driven Development* + *Laws, Not Vibes* + *Git Worktrees*) aplicada a um sistema de **gestão financeira pessoal** (Core + API REST + CLI + WebApp responsivo), sem dependências externas e 100% cross-platform (Node 22 ESM).

## Histórico de Entregas (Memória Versionada)

- `docs/specs/REQ-001-finance-manager/` — MVP inicial (transações em centavos, orçamentos com alertas, resumo mensal, API, CLI e WebApp).
- `docs/specs/REQ-002-daily-webapp-features/` — Uso diário completo (edição de transações, remoção de orçamentos, busca/filtros combinados, contas/carteiras, transferências, recorrências mensais idempotentes e exportação CSV segura).

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

### 3. Exemplos no CLI (mesmo arquivo `data/ledger.json`)
```bash
npm run cli -- add --type income --amount 5000 --category salario --desc "Salário"
npm run cli -- accounts add --name "Carteira" --type cash
npm run cli -- transfer --from acc_default --to <id_carteira> --amount 300
npm run cli -- recurring add --type expense --amount 1800 --category moradia --desc "Aluguel" --day 5
npm run cli -- recurring apply --month 2026-11
npm run cli -- list --q aluguel
npm run cli -- export --month 2026-11
```
