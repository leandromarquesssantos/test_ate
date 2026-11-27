# Plano Técnico — REQ-004 (Autenticação + Multiusuário)

- **Spec de referência:** `./spec.md`
- **Status:** Approved

---

## 1. Arquitetura e Módulos (Todos <= 220 linhas/arquivo)

```text
backend/internal/
├── domain/
│   ├── auth.go                 # NOVO: User, AuthResult, ValidateEmail, ValidatePassword, NormalizeUserName, ErrUnauthorized/ErrConflict
│   └── ...                     # (existentes intactos, 100% stdlib)
├── store/
│   ├── sqlite.go               # Atualizado: chama migrateToMultiUser() idempotente + schema v2
│   ├── migrate.go              # NOVO: migração segura de bancos REQ-003 (v1) -> v2 (user_id + unique composto)
│   ├── auth.go                 # NOVO: RegisterUser (bcrypt + adoção legacy ou conta padrão), Authenticate, CreateSession (SHA-256), ValidateSession, RevokeSession
│   ├── accounts.go             # Atualizado: todas as operações recebem userID
│   ├── budgets.go              # Atualizado: todas as operações recebem userID
│   ├── transactions_write.go   # Atualizado: todas as operações recebem userID (anti-IDOR)
│   ├── transactions_query.go   # Atualizado: todas as operações recebem userID
│   └── recurring.go            # Atualizado: todas as operações recebem userID
├── httpapi/
│   ├── auth_middleware.go      # NOVO: extração de cookie/Bearer, RequireAuth context, RateLimiter por IP (10 req/min)
│   ├── routes_auth.go          # NOVO: POST /api/auth/register, /login, /logout, GET /api/auth/me
│   ├── routes_ledger.go        # Atualizado: passa userID do context em todas as rotas
│   ├── routes_extras.go        # Atualizado: passa userID do context em todas as rotas
│   ├── helpers.go              # Atualizado: mapeia ErrUnauthorized (401) e ErrConflict (409)
│   └── server.go               # Registra auth routes + envolve rotas /api/* protegidas com RequireAuth
└── cli/
    ├── runner.go               # Resolve userID (--user <email> ou primeiro usuário cadastrado)
    └── runner_extra.go         # Adiciona subcomando `users [list | register]`

packages/web/src/
├── index.html                  # Adiciona seção #auth-view (Login / Criar Conta) + badge usuário + botão Sair
├── components.css              # Estilos compactos da tela de autenticação
├── api-client.mjs              # Métodos auth (me, login, register, logout) + sinalização de 401
├── auth-ui.mjs                 # NOVO: controle da tela de login/cadastro e sessão no frontend
└── app.mjs                     # Verifica sessão ao iniciar e alterna entre #auth-view e #app-view
```

---

## 2. Schema SQLite v2 (Multiusuário)

```sql
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
```

E tabelas de domínio com isolamento composto:
- `accounts`: `(id PRIMARY KEY, user_id, name, type, UNIQUE(user_id, name COLLATE NOCASE))`
- `transactions`: inclui `user_id` + índice `idx_tx_user_date(user_id, date DESC)`
- `budgets`: `PRIMARY KEY (user_id, month, category)`
- `recurring_rules`: inclui `user_id`

### Migração sem perda (`migrate.go`)
1. Detecta via `PRAGMA table_info(accounts)` se a coluna `user_id` ainda não existe (banco criado na `REQ-003`).
2. Dentro de uma transação SQL (`PRAGMA foreign_keys = OFF` temporariamente, depois `ON`):
   - Recria tabelas no schema v2 copiando todos os registros antigos com `user_id = '__legacy__'`.
3. Ao registrar o **primeiro usuário** (`COUNT(*) == 0` em `users`):
   - Se existirem registros com `user_id = '__legacy__'`, atualiza todos para o `id` desse novo usuário (preservando `acc_default` e todo o histórico!).
   - Caso contrário, cria uma nova conta `"Conta Principal"` exclusiva do usuário.

---

## 3. Estratégia de Testes (TDD)

| Requisito | Suíte de Teste |
| :--- | :--- |
| `RF-01` (validação email/senha/nome) | `backend/internal/domain/domain_test.go` |
| `RF-01`, `RF-02`, `RF-03`, `RF-04` (bcrypt, SHA-256 session, anti-IDOR Alice vs Bob, migração v1→v2) | `backend/internal/store/auth_test.go` + `store_test.go` |
| `RF-01`..`RF-05` (cookie HttpOnly, Bearer, 401, 409, 404 anti-IDOR, 429 rate limit) | `backend/internal/httpapi/auth_api_test.go` + `api_test.go` |
| CLI multiusuário | `backend/internal/cli/cli_test.go` |
| `RF-06` (WebApp auth UI + XSS) | `packages/web/test/web.test.mjs` |
