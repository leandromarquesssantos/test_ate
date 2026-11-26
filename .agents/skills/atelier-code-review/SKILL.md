---
name: atelier-code-review
description: >-
  Use this skill after implementation and after npm run gate passes. Performs a
  structured multi-perspective review (Architecture, Security, Correctness,
  Simplicity) and saves findings to review.md before human sign-off.
---

# Atelier — Fase 4: Code Review Multi-Perspectiva

## Objetivo
Auditar as mudanças sob 4 lentes independentes e documentar evidências reais em `docs/specs/REQ-XXX-<slug>/review.md`.

## As 4 Lentes Obrigatórias
1. **Arquitetura:** Fronteiras entre camadas respeitadas? Domínio isolado? Contratos consistentes entre Core, API, CLI e Web/Mobile?
2. **Segurança:** Validação de inputs, proteção contra XSS/injection, manipulação segura de caminhos/arquivos, tratamento de erros sem vazar internals?
3. **Corretude:** Edge cases cobertos (valores negativos/zero, datas inválidas, concorrência de escrita, centavos exatos)? Todos os `RF-XX` têm evidência de teste?
4. **Simplicidade (Crítico Obrigatório):** Existe over-engineering, código morto, abstração prematura ou duplicação removível?

## Passos
1. Inspecione os arquivos modificados e o resultado real de `npm run gate`.
2. Registre achados classificados como `BLOCKER`, `WARNING` ou `NOTE` em `docs/specs/REQ-XXX-<slug>/review.md`.
3. Resolva todos os `BLOCKER`s (atualizando testes e re-executando `npm run gate`).
4. Apresente o resumo de evidências ao Principal Engineer para aprovação final.
