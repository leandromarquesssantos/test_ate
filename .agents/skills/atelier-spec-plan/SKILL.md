---
name: atelier-spec-plan
description: >-
  Use this skill after a spec.md exists to design the technical architecture,
  file map, data contracts, and granular task list (plan.md and tasks.json)
  before writing any production code.
---

# Atelier — Fase 2: Arquitetura e Planejamento

## Objetivo
Traduzir `spec.md` em um plano técnico detalhado (`plan.md`) e uma lista de tarefas verificáveis (`tasks.json`) para aprovação do Principal Engineer.

## Passos
1. Leia `docs/specs/REQ-XXX-<slug>/spec.md` integralmente.
2. Leia o template em [plan.template.md](./resources/plan.template.md).
3. Mapeie:
   - **Arquitetura e fronteiras entre módulos** (respeitando as leis de `AGENTS.md`).
   - **Contratos de dados e APIs** (schemas, endpoints, comandos CLI).
   - **Mapa de arquivos** a criar/alterar (mantendo cada arquivo <= 220 linhas).
   - **Estratégia de testes (TDD)** mapeando cada `RF-XX` para testes automatizados.
   - **Riscos e Mitigações**.
4. Crie `plan.md` e `tasks.json` no diretório da REQ.
5. **Pare no Gate de Aprovação Humana** e apresente um resumo objetivo das decisões ao Principal Engineer.

## Validação
- Cada requisito `RF-XX` da spec está coberto por pelo menos uma tarefa em `tasks.json` e um teste planejado.
- O plano respeita todas as leis de `AGENTS.md`.
