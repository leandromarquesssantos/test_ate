# QA Release Report — REQ-004

- **Data:** 2026-11-26
- **Executado por:** Agente QA Independente (`atelier-qa-release`)
- **Veredito:** **APPROVED FOR RELEASE**

## 1. Cenários E2E Executados (Navegador Headless Real)
- [x] Carregamento inicial não autenticado (`#auth-view` visível, `#app-view` oculto — `getComputedStyle` validado)
- [x] Cadastro de conta + transição real de tela (`#auth-view` com `display: none`, `#app-view` visível e `#user-name` = `"QA Tester"`, `getComputedStyle` validado)
- [x] Criação de conta extra (`Carteira`), receita (`R$ 5.000,00`), despesa (`R$ 950,00`) e edição inline (`R$ 1.000,00` atualizando saldo para `R$ 4.000,00`)
- [x] Orçamento mensal (`warning` em `alimentacao`), recorrência idempotente (`1 criada(s)` na 1ª execução e `0 criada(s)` na 2ª) e busca/filtros em tempo real (`#filter-q`)
- [x] Logout (`#app-view` oculto / `#auth-view` visível) e novo Login restaurando sessão e dados persistidos no SQLite (`kpi-income` = `R$ 5.000,00`)
- [x] Zero erros de console / zero exceções JS durante toda a jornada (`browser.pageErrors.length === 0`)

## 2. Evidências de Execução
- `npm run qa`: **PASS** (`6/6 cenários` em Chromium headless real via CDP contra instância isolada de `fin-server` + SQLite temporário)
- `npm run gate:release`: **PASS** (`Gate APROVADO (0 violações)`)
  - Specs verificadas: `4 REQ(s)` íntegras
  - Leis de código: `32 arquivo(s)` verificados (`25 Go + 7 Web`), dentro do limite `<= 220 linhas` e isolamento de domínio
  - `gofmt`: limpo
  - `go vet ./...`: sem avisos
  - Testes Go (`go test -v ./...` e reexecução sem cache `go test -count=1 -v ./...`): **PASS (100%)**
    - `backend/internal/cli`: `TestCLIEndToEnd`
    - `backend/internal/domain`: `TestMoneyParsingAndFormatting`, `TestDateAndRecurrenceClamping`, `TestCSVFormulaInjectionProtection`, `TestAuthValidation`
    - `backend/internal/httpapi`: `TestRESTContractParityAuthenticated` (inclui cookie `HttpOnly` + `SameSite=Lax`, CRUD, transferências, recorrências, orçamentos e CSV), `TestAuthSecurityAntiIDORAndRateLimit` (401 sem sessão, anti-IDOR 404 entre Alice e Bob, revogação no logout, path traversal 403, payload >64KB 413, rate limit 429)
    - `backend/internal/store`: `TestSQLiteCRUDTransfersBudgetsAndRecurring`, `TestAuthMultiUserIsolationAndV1Migration` (migração segura REQ-003 -> REQ-004), `TestImportLegacyJSONAdoptedByFirstUser`
  - Testes WebApp (`node --test packages/web/test/*.test.mjs`): **PASS (2/2)**
  - Suíte QA E2E (`node scripts/qa-e2e.mjs`): **PASS (6/6)**

## 3. Cobertura dos Requisitos da REQ-004 (`spec.md`)
- **RF-01 (Cadastro e Login seguros):** Validado (hash `bcrypt`, cookie `HttpOnly` + `SameSite=Lax`, `409` duplicado, `400` inválidos, `401` genérico).
- **RF-02 (Sessão, `/api/auth/me` e Logout):** Validado (cookie `atelier_session` + `Authorization: Bearer`, revogação no logout retornando `401`).
- **RF-03 (Proteção de Rotas e Anti-IDOR):** Validado (`401` em rotas protegidas sem sessão; isolamento por `user_id` com `404` cruzado).
- **RF-04 (Migração REQ-003 → REQ-004):** Validado (`TestAuthMultiUserIsolationAndV1Migration` e adoção pelo primeiro usuário).
- **RF-05 (Rate Limiting em Auth):** Validado (`429 Too Many Requests` após limite por IP/minuto).
- **RF-06 (Fluxo Login/Cadastro/Logout no WebApp):** Validado no navegador Chromium headless real via CDP (`npm run qa`).

## 4. Achados e Recomendações
- **Nenhum blocker encontrado.** Release apta para merge/publicação.
- **Recomendações não-bloqueantes (melhoria contínua):**
  1. Ampliar `scripts/qa-e2e.mjs` em releases futuras para também exercitar no navegador: mensagem `#auth-error` em login com senha incorreta, verificação explícita de `document.cookie` sem `atelier_session` (confirmando `HttpOnly` no cliente), transferência entre contas e isolamento visual entre dois usuários.
  2. Avaliar o uso de `go test -count=1 -v ./...` no `scripts/atelier-gate.mjs` para garantir execução sempre sem cache em execuções locais de release.
