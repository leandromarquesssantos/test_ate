---
name: atelier-spec-implement
description: >-
  Phase 3 of Substantial Work (ONLY after human approval): executes tasks via TDD
  with minimal token churn (batch tasks.json update + quiet deterministic gate).
---

# Atelier Lean — Fase 3: Implementação (TDD + Baixo Consumo de Tokens)

## Pré-condição
Confirme aprovação explícita de `spec.md` e `plan.md`. Para isolar contexto em features grandes, prefira executar esta fase em Git worktree dedicado (`git worktree add ../test_ate-req-xxx -b feat/req-xxx`) e/ou delegada a um subagente.

## Fluxo Eficiente
1. Acompanhe o progresso visual pela ferramenta `update_steps` (**não re-escreva `tasks.json` a cada subtarefa**).
2. Implemente camada por camada com TDD (`domain` -> `store` -> `httpapi`/`cli` -> `web`), mantendo arquivos `<= 220` linhas (tolerância de aviso até `250`).
3. Ao concluir todas as entregas de código e testes, atualize `tasks.json` **uma única vez** marcando todas as tarefas como `"done"`.
4. Rode `npm run gate` (modo silencioso por padrão; use `-- --verbose` só se precisar investigar falha).
5. Avance para auditoria de release somente com `npm run gate` retornando código `0`.
