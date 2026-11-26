---
name: atelier-spec-implement
description: >-
  Use this skill ONLY after spec.md and plan.md have been approved by the human
  Principal Engineer. Executes tasks.json incrementally using TDD and enforces
  the deterministic quality gate (npm run gate) before completion.
---

# Atelier — Fase 3: Implementação (Spec-Loop + TDD)

## Pré-condição Obrigatória
Verifique que `spec.md` e `plan.md` estão aprovados. Nunca pule esta verificação.

## Passos
1. Leia `docs/specs/REQ-XXX-<slug>/tasks.json`.
2. (Opcional para trabalho paralelo) Crie um Git worktree dedicado:
   `git worktree add ../concept-req-xxx -b feat/req-xxx`
3. Para cada tarefa em `tasks.json`:
   - Marque `status: "in_progress"`.
   - **TDD:** Escreva os testes cobrindo os critérios de aceite primeiro (ou junto ao contrato) e confirme a falha antes da implementação.
   - Implemente o código mínimo, limpo e modular (<= 220 linhas por arquivo).
   - Rode os testes daquela camada e confirme que passam.
   - Marque a tarefa como `status: "done"` em `tasks.json`.
4. Ao finalizar todas as tarefas, execute o gate determinístico:
   `npm run gate`
5. Só avance para `atelier-code-review` se `npm run gate` retornar código `0`.
