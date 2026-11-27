# Atelier Fin — Gestão Financeira (Go + SQLite + Auth + WebApp)

Projeto construído com a metodologia **Atelier** (*Spec-Driven Development* + *Laws, Not Vibes* + *Git Worktrees* + *CI*).

## Arquitetura Atual

- **`backend/` (Go + SQLite Pure Go + bcrypt)**:
  - `internal/domain`: domínio financeiro puro em stdlib (`Cents` como `int64`, validações, resumo mensal, CSV seguro, validações de auth).
  - `internal/store`: SQLite ACID (`modernc.org/sqlite`, zero CGO), migração automática v1→v2, isolamento multiusuário por `user_id`, senhas em `bcrypt` e sessões com `SHA-256`.
  - `internal/httpapi` + `cmd/fin-server`: API REST `net/http`, rotas `/api/auth/*`, cookies `HttpOnly` + `Bearer`, rate limit (`429`) e servidor estático seguro.
  - `internal/cli` + `cmd/fin-cli`: CLI nativo em Go com suporte multiusuário (`--user` e `users register`).
- **`packages/web/`**: WebApp responsivo com tela de Login/Cadastro/Logout e dashboard completo.
- **`.github/workflows/atelier-gate.yml`**: CI rodando `npm run gate`.

## Histórico de Entregas (`docs/specs/`)

- `REQ-001` — MVP inicial (transações em centavos, orçamentos com alertas, resumo mensal).
- `REQ-002` — Uso diário completo (edição inline, busca/filtros, contas/transferências, recorrências idempotentes, CSV seguro).
- `REQ-003` — Migração de Core, API e CLI para **Go + SQLite Pure Go** + Quality Gate Go + CI.
- `REQ-004` — Sistema de **Login/Cadastro/Logout**, sessões seguras (`HttpOnly` + `Bearer`), rate limit e isolamento multiusuário anti-IDOR.

## Como executar

```bash
# 1. Rodar Quality Gate completo (leis + Go + WebApp)
npm run gate

# 2. Iniciar o servidor Go + WebApp (http://127.0.0.1:3000)
npm run api

# 3. Usar o CLI Go (mesmo banco data/atelier-fin.db)
npm run cli -- users register --name "Seu Nome" --email "voce@exemplo.com" --password "suasenha"
npm run cli -- add --type income --amount 5000 --category salario --desc "Salário"
npm run cli -- summary
```

### Variáveis de ambiente opcionais do servidor
- `PORT` (padrão `3000`), `HOST` (padrão `127.0.0.1`)
- `DB_PATH` (padrão `data/atelier-fin.db`)
- `COOKIE_SECURE=true` (ativar atrás de HTTPS)
- `ALLOW_REGISTRATION=false` (bloquear novos cadastros após criar sua conta)
