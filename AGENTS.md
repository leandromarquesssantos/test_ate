# Atelier Lean — Constituição de Engenharia do Repositório

Este repositório segue a metodologia **Atelier Lean** (*Spec-Driven Development* + *Laws, Not Vibes* + *Token Efficiency*).
O desenvolvedor humano atua como **Principal Engineer / Arquiteto**. Agentes atuam sob este contrato.

---

## 1. Processo Adaptativo: Bounded vs. Substantial Work

Antes de editar código, classifique o pedido:

- **Bounded Work** (correção pontual, ajuste visual/texto, 1–2 arquivos, sem mudança de arquitetura):
  - Apresente um plano curto inline (3–5 linhas), implemente com teste de regressão e rode `npm run gate`.
- **Substantial Work** (nova feature, mudança de arquitetura, novo módulo/endpoint, mais de 3 arquivos):
  - **Proibido escrever código de produção antes da aprovação humana da Spec e do Plano.**
  - Siga o ciclo enxuto:
    1. `atelier-spec-brainstorm` → cria `docs/specs/REQ-XXX-<slug>/spec.md` conciso
    2. `atelier-spec-plan` → cria `plan.md` e `tasks.json` (sem duplicar texto da spec; referencie IDs `RF-XX`)
    3. **Gate de Aprovação Humana** (aguardar OK explícito do Principal Engineer; valide antes com `npm run gate:spec`)
    4. `atelier-spec-implement` → implementação TDD (prefira delegar a um subagente isolado para poupar contexto principal; marque `tasks.json` em lote ao concluir)
    5. `atelier-code-review` + `atelier-qa-release` → subagente QA independente audita as 4 lentes + roda `npm run gate:release` (navegador headless real) e emite um único `release-audit.md` objetivo

---

## 2. Leis Determinísticas ("Laws, Not Vibes")

Verificadas automaticamente por `node scripts/atelier-gate.mjs` (saída silenciosa em sucesso; use `--verbose` apenas para depurar):

1. **Anti-monólito com tolerância inteligente:** Meta de design `<= 220` linhas em arquivos de produção (`backend/**/*.go` exceto `*_test.go`, e `packages/*/src/*`). Entre `221–250` linhas emite `[WARN]`; acima de `250` linhas bloqueia com `[FAIL]`.
2. **Dinheiro em centavos inteiros:** Valores monetários DEVEM ser inteiros (`domain.Cents` / `int64` / `INTEGER` no SQLite), nunca `float`.
3. **Separação de camadas:** `backend/internal/domain` deve usar **apenas stdlib Go** (proibido importar `database/sql`, `net/http`, `store`, `httpapi` ou `cli`).
4. **Zero dependências de Windows / CGO:** SQLite em Go puro (`modernc.org/sqlite`), compilando sem GCC/MSVC. Fim de linha normalizado em LF via `.gitattributes`.
5. **Contrato de Artefatos Enxuto:** Toda `REQ-XXX` concluída possui `spec.md`, `plan.md`, `tasks.json` (`100% done`) e `release-audit.md` (ou `review.md` legado nas REQs 001–004).
6. **Contrato de "Done-State":** Nenhuma tarefa termina sem `npm run gate` código `0`; nenhuma release sobe sem `npm run gate:release` verde e parecer `APPROVED FOR RELEASE`.

---

## 3. Economia de Contexto e Isolamento ("Orchestrator Lean")

1. **Delegação de Churn:** O agente principal conduz Spec + Plan com o humano e delega ciclos pesados de compilação/testes (Fase 3) e auditoria E2E (Fases 4–5) para subagentes (`invoke_subagent`), evitando poluir o histórico principal com logs intermediários.
2. **Zero Re-escrita Desnecessária:** Não edite `tasks.json` a cada subtarefa; acompanhe o progresso em memória (`update_steps`) e atualize `tasks.json` uma única vez antes de `npm run gate`.
3. **Higiene entre REQs:** Como toda memória arquitetural vive em `docs/specs/`, compacte a conversa (`/compact`) ou inicie nova sessão ao encerrar uma `REQ-XXX` para evitar reprocessar centenas de milhares de tokens históricos.
4. **Paralelismo com Git Worktrees:** Use `git worktree add ../test_ate-req-XXX -b feat/req-XXX` para isolar features antes do merge na `main`.
