---
name: atelier-spec-plan
description: >-
  Phase 2 of Substantial Work: creates concise plan.md and tasks.json referencing
  RF-XX IDs without duplicating spec prose, then stops for human approval.
---

# Atelier Lean — Fase 2: Arquitetura e Planejamento

Leia `spec.md` da REQ e gere `plan.md` + `tasks.json` no mesmo turno (paralelo), **referenciando `RF-XX` por ID sem copiar o texto da spec**:

### Formato de `plan.md` (<= 80 linhas)
```markdown
# Plano Técnico — REQ-XXX
- **Spec:** `./spec.md` | **Status:** Pending Approval | Approved

## 1. Fronteiras & Contratos
- Modelos, endpoints REST, CLI e regras de isolamento (`AGENTS.md`).

## 2. Mapa de Arquivos (meta <= 220 linhas/arquivo)
| Arquivo | Mudança / Responsabilidade | RFs |
| :--- | :--- | :--- |

## 3. Matriz TDD & Riscos
- Mapeamento `RF-XX -> arquivo de teste` e principais mitigações.
```

### Formato de `tasks.json`
```json
{
  "req": "REQ-XXX",
  "tasks": [
    { "id": "T1", "title": "Curto e objetivo (RFs cobertos)", "status": "pending" }
  ]
}
```

Valide com `npm run gate:spec` e **pare aguardando aprovação explícita do Principal Engineer**.
