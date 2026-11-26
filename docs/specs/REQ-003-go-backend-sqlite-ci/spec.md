# REQ-003 — Migração de Core, API e CLI para Go + SQLite (Pure Go) + CI

- **Status:** Done (Aprovado e verificado em 2026-11-26)
- **Autor:** Principal Engineer + Agente Atelier
- **Data:** 2026-11-26
- **Pré-requisito:** `REQ-001` e `REQ-002` concluídas

---

## 1. Contexto e Problema
Com a evolução do **Atelier Fin**, queremos maximizar a **velocidade de iteração com agentes de IA** e a **robustez determinística** removendo ambiguidades de tipagem dinâmica:
- Um compilador rígido e rápido (**Go**) valida structs, erros e contratos em tempo de compilação (`go vet`, `go test`, `gofmt`), fortalecendo o princípio *"Laws, Not Vibes"* do Atelier.
- Trocar o arquivo JSON simples por **SQLite ACID** elimina riscos de concorrência de escrita entre WebApp e CLI e prepara o sistema para milhares de lançamentos.
- Usar driver SQLite **Pure Go (sem CGO)** (`modernc.org/sqlite`) preserva a regra de **zero dependências de Windows (sem GCC/MSVC)**.

---

## 2. Escopo (In-Scope)
- **Novo Backend + Core + CLI em Go (`backend/`):**
  - `backend/internal/domain`: tipos explícitos (`Cents` como `int64`, `Transaction`, `Account`, `Budget`, `RecurringRule`, `Summary`), validações de domínio, parse/formatação BRL e gerador CSV seguro (anti *formula injection*).
  - `backend/internal/store`: repositório SQLite (`modernc.org/sqlite`, sem CGO) com migrations idempotentes, índices e **importação automática única** de `data/ledger.json` caso o banco esteja vazio e o JSON legado exista.
  - `backend/internal/httpapi`: servidor HTTP (`net/http` da stdlib Go 1.22+ com roteamento por método/path), 100% compatível com **todos** os endpoints REST da `REQ-001` e `REQ-002`, além de servir o mesmo `packages/web/src` com proteção contra path traversal e limite de body (64 KB).
  - `backend/cmd/fin-server`: binário do servidor API + WebApp.
  - `backend/cmd/fin-cli`: binário CLI (`add`, `edit`, `list`, `delete`, `budget`, `summary`, `accounts`, `transfer`, `recurring`, `export`) usando o mesmo banco SQLite.
- **Preservação do WebApp (`packages/web`):**
  - Nenhuma quebra no frontend atual: o WebApp continua consumindo exatamente os mesmos endpoints JSON/CSV.
- **Evolução do Quality Gate (`scripts/atelier-gate.mjs`):**
  - Verifica lei anti-monólito (`<= 220 linhas`) também em todos os arquivos `.go` (excluindo `*_test.go`).
  - Verifica isolamento de camadas: `backend/internal/domain` não pode importar `httpapi`, `store` ou `cmd`.
  - Executa `gofmt` check, `go vet ./...`, `go test ./...` e testes do WebApp.
- **CI no GitHub Actions (`.github/workflows/atelier-gate.yml`):**
  - Executa o Quality Gate completo (Go + Node Web tests) em todo push e Pull Request na `main`.

---

## 3. Fora de Escopo (Out-of-Scope)
- Autenticação multiusuário / HTTPS / deploy Docker em nuvem (`REQ-004`).
- App Android / PWA offline (`REQ-005`).
- Reescrever o WebApp frontend (ele permanece em HTML/CSS/JS modular consumindo a API Go).

---

## 4. Requisitos Funcionais e Critérios de Aceite

### RF-01: Paridade 100% dos contratos REST (`REQ-001` + `REQ-002`)
- **Dado** o servidor Go rodando contra `packages/web/src`
- **Quando** clientes chamam `GET /api/health`, `GET/POST /api/transactions`, `PATCH/DELETE /api/transactions/:id`, `GET/PUT/DELETE /api/budgets`, `GET/POST/DELETE /api/accounts`, `POST /api/transfers`, `GET/POST/DELETE /api/recurring`, `POST /api/recurring/apply`, `GET /api/summary` e `GET /api/export/csv`
- **Então** todos os contratos JSON, códigos HTTP (`200`, `201`, `400`, `403`, `404`, `413`) e headers CSV respondem identicamente ao contrato aprovado na `REQ-002`.

### RF-02: Persistência SQLite ACID sem CGO + Migração do JSON legado
- **Dado** um arquivo SQLite (`data/atelier-fin.db`)
- **Quando** o sistema inicia pela primeira vez
- **Então** cria automaticamente as tabelas (`accounts`, `transactions`, `budgets`, `recurring_rules`) com chaves estrangeiras, `WAL mode` e conta padrão `acc_default`.
- **E** se `data/ledger.json` existir e o banco não tiver transações, importa os dados existentes sem perda.

### RF-03: CLI nativo em Go
- **Dado** o binário `fin-cli`
- **Quando** o usuário executa `add`, `edit`, `list`, `delete`, `budget`, `summary`, `accounts`, `transfer`, `recurring` e `export`
- **Então** opera diretamente no mesmo banco SQLite com saída formatada em BRL.

### RF-04: Quality Gate determinístico para Go + CI
- **Dado** `npm run gate` (e o workflow `.github/workflows/atelier-gate.yml`)
- **Quando** executado localmente ou no GitHub Actions
- **Então** valida specs, limite de 220 linhas por arquivo `.go`/`.mjs`/`.css`, isolamento do domínio, `gofmt`, `go vet ./...`, `go test ./...` e testes do WebApp.

---

## 5. Requisitos Não-Funcionais & Leis Aplicáveis (`AGENTS.md`)
- **Zero dependências de Windows:** SQLite em Go puro (`modernc.org/sqlite`), sem CGO, sem GCC, sem MSVC.
- **Lei Anti-Monólito:** Todo arquivo `.go` de produção (fora `*_test.go`) deve ter **<= 220 linhas**.
- **Isolamento de Domínio:** `backend/internal/domain` usa apenas stdlib Go (zero imports de `database/sql`, `net/http` ou outros pacotes internos).
- **Segurança:** Queries SQL 100% parametrizadas (zero concatenação), limite de body de 64 KB (`http.MaxBytesReader`), proteção contra path traversal e CSV formula injection.

---

## 6. Decisões em Aberto (para aprovação do Principal Engineer)
- [ ] **Backend Node legado (`packages/core`, `api`, `cli`):** Após a migração para Go + SQLite passar 100% no gate, prefere **substituir/remover** o backend Node legado (deixando o repo limpo com `backend/` em Go + `packages/web/`) ou mantê-lo arquivado em paralelo? *(Recomendado: substituir para ter 1 única fonte de verdade).*
- [ ] **Instalação do Go:** Autoriza instalar o Go via `winget install --id GoLang.Go` agora nesta máquina?
- [ ] **Banco SQLite Pure Go (`modernc.org/sqlite`):** Aprova usar `modernc.org/sqlite` (única dependência Go, zero CGO/MSVC no Windows)?
