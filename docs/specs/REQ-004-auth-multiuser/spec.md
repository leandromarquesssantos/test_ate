# REQ-004 — Autenticação, Sessões Seguras e Isolamento Multiusuário

- **Status:** Done (Aprovado e verificado em 2026-11-26)
- **Autor:** Principal Engineer + Agente Atelier
- **Data:** 2026-11-26
- **Pré-requisito:** `REQ-003` (Backend Go + SQLite + CI) concluída

---

## 1. Contexto e Problema
Atualmente qualquer pessoa com acesso ao servidor do **Atelier Fin** visualiza e modifica todos os dados financeiros sem autenticação. Para evoluir o sistema para uso real multi-dispositivo ou compartilhado, precisamos de:
1. Cadastro, login e logout seguros com senhas protegidas por hash forte (`bcrypt`).
2. Sessões persistidas em SQLite com cookies `HttpOnly` (e suporte opcional a `Authorization: Bearer` para futuros clientes móveis).
3. **Isolamento estrito por usuário (`user_id`)** em contas, transações, orçamentos, recorrências e exportação CSV (zero IDOR).
4. Migração automática sem perda de dados para bancos SQLite já criados na `REQ-003`.

---

## 2. Escopo (In-Scope)
- **Endpoints de Autenticação (`backend/internal/httpapi`):**
  - `POST /api/auth/register` (`{ name, email, password }`) → cria usuário, inicia sessão, cria conta padrão própria (ou adota dados legados se for o primeiro usuário) e retorna `201`.
  - `POST /api/auth/login` (`{ email, password }`) → valida credenciais, cria sessão e define cookie `atelier_session` (`200`), ou `401` genérico em caso de falha.
  - `POST /api/auth/logout` → revoga sessão no SQLite e limpa o cookie (`200`).
  - `GET /api/auth/me` → retorna dados públicos do usuário autenticado (`id`, `name`, `email`) ou `401`.
- **Segurança de Credenciais e Sessões:**
  - Hash de senha com `golang.org/x/crypto/bcrypt` (nunca expor `passwordHash` em JSON).
  - Token aleatório de 32 bytes (`crypto/rand`); o SQLite armazena **apenas o SHA-256 do token** (`token_hash`).
  - Cookie `HttpOnly`, `SameSite=Lax`, `Path=/`, expiração de 7 dias (`COOKIE_SECURE=true` para HTTPS).
  - Suporte também a `Authorization: Bearer <token>` para clientes API / futuro App Android.
  - Rate limit em memória para `/api/auth/login` e `/api/auth/register` (10 req/min por IP → `429 Too Many Requests`).
- **Isolamento Multiusuário (`backend/internal/store`):**
  - Tabelas `users` e `sessions` + escopo `user_id` em `accounts`, `transactions`, `budgets` e `recurring_rules`.
  - Migração idempotente de bancos da `REQ-003`: dados existentes são adotados automaticamente pelo primeiro usuário cadastrado.
  - Proteção de todos os endpoints `/api/*` (exceto `/api/health` e `/api/auth/*`) via middleware de autenticação (`401 Unauthorized` se não autenticado).
  - Proteção anti-IDOR: usuário A nunca consegue ler, editar ou remover registros do usuário B.
- **WebApp (`packages/web`):**
  - Tela limpa de **Entrar / Criar Conta** exibida quando não autenticado.
  - Topbar exibindo nome do usuário logado e botão **Sair**; redirecionamento automático para login se alguma requisição retornar `401`.
- **CLI (`backend/internal/cli`):**
  - Flag global opcional `--user <email>` (se omitida, usa automaticamente o único/primeiro usuário cadastrado, ou cria usuário local sob demanda via `users register`).

---

## 3. Fora de Escopo (Out-of-Scope)
- Recuperação de senha via envio de e-mail (SMTP) e verificação de e-mail.
- OAuth social (Google/GitHub) e 2FA/Passkeys.
- Deploy Docker/TLS/Caddy em servidor público (planejado para próxima entrega de infra).

---

## 4. Requisitos Funcionais e Critérios de Aceite

### RF-01: Cadastro e Login seguros
- **Dado** um novo usuário com `name`, `email` válido e `password` (>= 8 caracteres)
- **Quando** chama `POST /api/auth/register`
- **Então** o usuário é criado com senha em `bcrypt`, recebe cookie `HttpOnly` + `token`, e possui sua própria conta inicial `"Conta Principal"`.
- **E** e-mail duplicado (case-insensitive) retorna `409 Conflict`; senha < 8 caracteres ou e-mail inválido retorna `400`.
- **Quando** chama `POST /api/auth/login` com senha incorreta ou e-mail inexistente
- **Então** retorna `401` com mensagem genérica (`Credenciais inválidas.`) sem revelar se o e-mail existe.

### RF-02: Sessão, `/api/auth/me` e Logout
- **Dado** um usuário autenticado via cookie `atelier_session` ou header `Authorization: Bearer`
- **Quando** chama `GET /api/auth/me`
- **Então** retorna `200` com `{ id, name, email }` (nunca `passwordHash`).
- **Quando** chama `POST /api/auth/logout`
- **Então** a sessão é removida do banco e chamadas subsequentes com o mesmo token retornam `401`.

### RF-03: Proteção de Rotas e Isolamento Multiusuário (Anti-IDOR)
- **Dado** requisições sem sessão válida para `/api/transactions`, `/api/accounts`, `/api/budgets`, `/api/recurring`, `/api/summary` ou `/api/export/csv`
- **Então** todas retornam `401 Unauthorized`.
- **Dado** dois usuários autenticados `Alice` e `Bob`
- **Quando** `Alice` cria conta, transação, orçamento e recorrência
- **Então** `Bob` vê apenas seus próprios dados e recebe `404` ao tentar `PATCH`/`DELETE` em qualquer ID pertencente a `Alice`.

### RF-04: Migração segura de dados existentes (`REQ-003` → `REQ-004`)
- **Dado** um banco SQLite criado na `REQ-003` (sem tabela `users` e sem `user_id`) contendo transações
- **Quando** o servidor `REQ-004` inicia e o primeiro usuário se cadastra
- **Então** todas as contas, transações, orçamentos e recorrências pré-existentes são migrados e atribuídos a esse primeiro usuário sem perda de dados.

### RF-05: Rate Limiting em Autenticação
- **Dado** mais de 10 requisições no intervalo de 1 minuto do mesmo IP para `/api/auth/login`
- **Então** a API responde `429 Too Many Requests`.

### RF-06: Fluxo de Login/Cadastro/Logout no WebApp
- **Dado** um visitante abrindo `http://127.0.0.1:3000` sem sessão ativa
- **Quando** a página carrega
- **Então** exibe a tela de Login/Cadastro (ocultando o dashboard); após login/cadastro bem-sucedido, exibe o dashboard com nome do usuário e botão **Sair**.

---

## 5. Requisitos Não-Funcionais & Leis Aplicáveis (`AGENTS.md`)
- **Lei Anti-Monólito:** Todo arquivo de produção `.go`, `.mjs`, `.css` deve permanecer **<= 220 linhas**.
- **Isolamento de Domínio:** `backend/internal/domain` continua 100% stdlib Go.
- **Zero dependências de Windows / CGO:** `golang.org/x/crypto/bcrypt` e `modernc.org/sqlite` são 100% Pure Go.
- **Segurança:** Token armazenado como SHA-256 no SQLite; cookies `HttpOnly` + `SameSite=Lax`; zero vazamento de hashes ou stack traces.

---

## 6. Decisões em Aberto (para aprovação do Principal Engineer)
- [ ] **Primeiro usuário e dados locais existentes:** Aprova que o primeiro usuário registrado adote automaticamente os dados locais já existentes no banco SQLite da `REQ-003` (e novos usuários comecem com carteira limpa)?
- [ ] **Modo de sessão:** Aprova **Cookie `HttpOnly` (para o WebApp) + suporte a `Authorization: Bearer` (já deixando pronto para futuro App Android/CLI remoto)**?
- [ ] **Cadastro aberto:** Aprova permitir cadastro livre na tela inicial (`Criar conta`) neste estágio (com opção de desativar via variável `ALLOW_REGISTRATION=false` quando for para produção pessoal)?
