---
name: atelier-code-review
description: >-
  Phase 4 lens checklist (Architecture, Security, Correctness, Simplicity).
  Consolidates findings directly into release-audit.md (avoiding duplicate files).
---

# Atelier Lean — Fase 4: Revisão Multi-Perspectiva

Audite o `git diff` da REQ sob as **4 lentes obrigatórias** antes ou junto ao QA de Release:

1. **Arquitetura:** `domain` 100% stdlib? Contratos coesos entre API, CLI e Web? Arquivos dentro do limite?
2. **Segurança:** Auth/anti-IDOR (`user_id`), validação de inputs, cookies `HttpOnly`, path traversal e limites de payload?
3. **Corretude:** Centavos inteiros exatos, datas locais vs UTC, idempotência e todos os `RF-XX` cobertos por testes reais?
4. **Simplicidade:** Sem código morto, over-engineering ou duplicação desnecessária?

**Saída Enxuta:** Registre os achados (`BLOCKER` / `WARN` / `OK`) diretamente na seção de Revisão de `docs/specs/REQ-XXX-<slug>/release-audit.md` (unificado com o QA de Release para eliminar duplicação entre `review.md` e `qa-report.md`). Corrija qualquer `BLOCKER` antes do sign-off.
