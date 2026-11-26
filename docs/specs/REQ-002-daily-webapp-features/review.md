# Code Review Multi-Perspectiva — REQ-002 (Uso Diário Completo)

- **Data:** 2026-11-26
- **Branch/Worktree:** `feat/req-002` (isolado em `../test_ate-req-002`)
- **Veredito:** APROVADO (todos os achados resolvidos e validados por `npm run gate`)

---

## 1. Lente de Arquitetura
- **[BLOCKER DO GATE -> RESOLVIDO]** Na primeira execução do `npm run gate`, a lei anti-monólito bloqueou `packages/core/src/ledger.mjs` (268 linhas) e `packages/web/src/app.mjs` (226 linhas). Extraídos `packages/core/src/summary.mjs` e `packages/web/src/handlers.mjs`; todos os 24 arquivos de `src/` ficaram abaixo de 220 linhas.
- **[OK]** `packages/core` permanece 100% isolado de `api`, `cli` e `web`.
- **[OK]** `plan.md` atualizado para refletir `summary.mjs` e `handlers.mjs` (zero *spec drift*).

## 2. Lente de Segurança
- **[OK]** Exportação CSV protege contra *Formula Injection* (`=`, `+`, `-`, `@`, `\t`, `\r` prefixados com `'`) e aplica escape RFC-4180, coberto por teste automatizado.
- **[OK]** Renderizadores do WebApp (`render.mjs`) aplicam `escapeHtml` em todos os campos de conta, orçamento, recorrência e transação (validado contra `<script>` e `<img onerror=...>`).
- **[OK]** Proteções da API (`413` > 64 KB, `403` path traversal, `400` validação) mantidas e verificadas.

## 3. Lente de Corretude
- **[WARNING -> RESOLVIDO]** Em `updateTransaction`, adicionada guarda impedindo alterar `accountId` de uma transferência para coincidir com `toAccountId`.
- **[WARNING -> RESOLVIDO]** Em `syncAccountSelects` (`render.mjs`), quando há duas ou mais contas, o seletor `toAccountId` pré-seleciona automaticamente a segunda conta para evitar erro acidental de origem igual ao destino.
- **[OK]** Retrocompatibilidade testada: ledger `version: 1` (da `REQ-001`, sem `accounts` e sem `accountId`) migra transparentemente para `acc_default` sem perda de dados.
- **[OK]** Recorrências idempotentes testadas (segunda aplicação no mesmo mês retorna `createdCount: 0`) e ajuste de dia 31 em fevereiro (`2026-02-28`).

## 4. Lente de Simplicidade (Crítico Obrigatório)
- **[OK]** Nenhuma dependência externa adicionada; runtime 100% Node 22 ESM nativo e cross-platform.
- **[OK]** Transferências modeladas como `type: "transfer"` no mesmo histórico, evitando tabelas/rotas paralelas de extrato enquanto excluem transferências do cálculo de receita/despesa mensal.

---

## Evidências de Verificação
- Comando: `npm run gate` (`node scripts/atelier-gate.mjs --with-tests`)
- Cobertura: 14 testes automatizados (`core`, `api`, `cli`, `web`) cobrindo `REQ-001` + `REQ-002` sem regressões.
