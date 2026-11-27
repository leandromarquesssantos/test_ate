---
name: atelier-qa-release
description: >-
  Phase 5 Independent Release QA: runs npm run gate:release (real headless browser
  E2E + layout overflow + Go/Web tests) and writes consolidated release-audit.md.
---

# Atelier Lean — Fase 5: Auditoria Independente de Release (Review + QA E2E)

Atue como **Engenheiro de QA e Revisor independente** (preferencialmente via subagente com contexto limpo).

## Passos
1. Leia `docs/specs/REQ-XXX-<slug>/spec.md` e inspecione o diff dos arquivos alterados sob as 4 lentes (`Arquitetura`, `Segurança`, `Corretude`, `Simplicidade`).
2. Execute `npm run gate:release` (roda `gofmt`, `go vet`, `go test -count=1 ./...`, testes WebApp e Chromium headless E2E com auditoria geométrica desktop/mobile + zero erros de console).
3. Gere um único `docs/specs/REQ-XXX-<slug>/release-audit.md` objetivo (<= 60 linhas, sem copiar texto da spec):

```markdown
# Release Audit — REQ-XXX
- **Data:** YYYY-MM-DD | **Veredito:** APPROVED FOR RELEASE | REJECTED

## 1. Lentes de Código (Arch / Sec / Correctness / Simplicity)
- Resumo objetivo (`0 blockers`, eventuais notas).

## 2. Rastreabilidade & QA E2E (`npm run gate:release`)
| ID / Check | Evidência Automatizada | Status |
| :--- | :--- | :--- |
| `RF-01..RF-NN` | Testes Go / Web / E2E correspondentes | PASS |
| `QA Headless` | `npm run gate:release` (fluxos + layout + console=0) | PASS |
```
