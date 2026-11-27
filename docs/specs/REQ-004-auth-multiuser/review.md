# Code Review Multi-Perspectiva — REQ-004 (Autenticação + Multiusuário)

- **Data:** 2026-11-26
- **Branch/Worktree:** `feat/req-004` (isolado em `../test_ate-req-004`)
- **Veredito:** APROVADO (todos os achados resolvidos e validados por `npm run gate`)

---

## 1. Lente de Arquitetura
- **[BLOCKER DO GATE -> RESOLVIDO]** `backend/internal/cli/runner.go` atingiu 221 linhas (teto 220). Movido `helpText` para `runner_extra.go`; todos os 32 arquivos de produção (`25 Go + 7 Web`) estão abaixo de 220 linhas.
- **[OK]** `backend/internal/domain` permanece 100% stdlib Go (`bcrypt` isolado em `internal/store/auth.go`).
- **[OK]** Middleware `withAuth` aplica isolamento centralizado no roteamento HTTP; cada método do `store` exige `userID` explicitamente na assinatura.

## 2. Lente de Segurança
- **[OK]** Senhas armazenadas com `bcrypt.DefaultCost` e limite explícito de 72 bytes (`ValidatePassword`, prevenindo truncamento silencioso do bcrypt).
- **[OK]** Tokens de sessão de 256 bits (`crypto/rand`) armazenados no SQLite apenas como hash **SHA-256** (`token_hash`).
- **[OK]** Cookies `HttpOnly`, `SameSite=Lax` (e `Secure` via `COOKIE_SECURE=true`) + suporte a `Authorization: Bearer`.
- **[OK]** Proteção anti-IDOR verificada em `store` e `httpapi`: usuário B recebe `404` ao tentar operar sobre ID do usuário A.
- **[OK]** Rate limiting por IP (`429 Too Many Requests`) verificado em `TestAuthSecurityAntiIDORAndRateLimit`.
- **[OK]** `POST /api/auth/login` retorna erro genérico (`credenciais inválidas`) sem revelar se o e-mail existe.

## 3. Lente de Corretude
- **[OK]** Migração de banco SQLite v1 (`REQ-003`) → v2 (`REQ-004`) validada em `TestAuthMultiUserIsolationAndV1Migration`: dados existentes são preservados e adotados automaticamente pelo primeiro usuário registrado.
- **[OK]** WebApp exibe `#auth-view` quando não autenticado, oculta o dashboard e redireciona para login se qualquer chamada retornar `401`.
- **[OK]** Flag `ALLOW_REGISTRATION=false` permite trancar novos cadastros em uso pessoal.

## 4. Lente de Simplicidade (Crítico Obrigatório)
- **[OK]** Apenas `golang.org/x/crypto/bcrypt` adicionada (Pure Go, zero CGO); sessão, middleware e rate limiter implementados em stdlib Go sem frameworks pesados.

---

## Evidências de Verificação
- Comando: `npm run gate` (`node scripts/atelier-gate.mjs --with-tests`)
- Resultado: `gofmt` OK, `go vet ./...` OK, 100% testes Go (`domain`, `store`, `httpapi`, `cli`) + testes WebApp passando com 0 violações.
