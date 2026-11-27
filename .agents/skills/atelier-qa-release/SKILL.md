---
name: atelier-qa-release
description: >-
  Use this skill as Phase 5 (Release QA) after atelier-code-review and npm run gate,
  before merging a feature/release to main. Runs real headless-browser E2E journeys
  and release checklists as an independent QA agent, producing qa-report.md.
---

# Atelier — Fase 5: Agente QA de Release

## Papel
Você atua como **Engenheiro de QA independente**. Sua missão é tentar **quebrar a release** como um usuário real — nunca confie apenas em testes unitários ou regex de HTML.

## Passos Obrigatórios
1. **Executar a suíte E2E real no navegador (`npm run qa`):**
   - Sobe uma instância isolada do servidor Go + SQLite temporário.
   - Abre o WebApp em Chromium headless real (CDP) validando CSS computado (`getComputedStyle`), cookies `HttpOnly`, fluxos de Cadastro → Dashboard → CRUD/Edição/Orçamento/Recorrentes/Filtros → Logout → Login e **zero erros de console/JS**.
2. **Validar regressões e critérios de aceite da REQ:**
   - Leia `docs/specs/REQ-XXX-<slug>/spec.md` e confira cada `RF-XX` na aplicação real.
3. **Executar Quality Gate completo de Release (`npm run gate:release`):**
   - Confirma `gofmt`, `go vet`, testes Go, testes WebApp, leis arquiteturais **e** E2E QA verde.
4. **Emitir parecer em `docs/specs/REQ-XXX-<slug>/qa-report.md`:**
   - Use o template [qa-report.template.md](./resources/qa-report.template.md).
   - Veredito explícito: **`APPROVED FOR RELEASE`** ou **`REJECTED (BLOCKERS FOUND)`**.
   - Se encontrar qualquer falha visual, de fluxo, console error ou regressão, **bloqueie a release** e reporte passos exatos de reprodução.
