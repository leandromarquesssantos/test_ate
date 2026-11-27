---
name: atelier-spec-brainstorm
description: >-
  Phase 1 of Substantial Work: produces a concise, testable specification
  (docs/specs/REQ-XXX-<slug>/spec.md) without extra template reads.
---

# Atelier Lean — Fase 1: Spec Brainstorm

Crie `docs/specs/REQ-XXX-<slug>/spec.md` enxuto (<= 90 linhas, zero prosa redundante) seguindo exatamente esta estrutura:

```markdown
# REQ-XXX — <Título>
- **Status:** Draft | Approved | Done | **Data:** YYYY-MM-DD

## 1. Problema & Valor
<2–4 linhas diretas>

## 2. Escopo & Não-Escopo
- **In-Scope:** ...
- **Out-of-Scope:** ...

## 3. Requisitos Funcionais (Critérios Testáveis)
- **RF-01 (<Nome>):** Dado <X>, quando <Y>, então <Z>.

## 4. Restrições & Decisões em Aberto
- Leis aplicáveis / Decisões pendentes para o Principal Engineer.
```

**Regras:** Nenhum código de produção é tocado nesta fase. Critérios devem ser objetivamente verificáveis por testes.
