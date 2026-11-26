# Atelier — Constituição de Engenharia do Repositório

Este repositório segue a metodologia **Atelier** (*Spec-Driven Development* + *Laws, Not Vibes*).
O desenvolvedor humano atua como **Principal Engineer / Arquiteto**. Agentes de IA atuam como engenheiros disciplinados que seguem este contrato.

---

## 1. Processo Adaptativo: Bounded vs. Substantial Work

Antes de editar código, classifique o pedido:

- **Bounded Work** (correção pontual, ajuste de texto, 1–2 arquivos, sem mudança de contrato ou arquitetura):
  - Apresente um plano curto inline (3–5 linhas) e execute com testes.
- **Substantial Work** (nova feature, mudança de arquitetura, novo módulo/endpoint, mais de 3 arquivos):
  - **Proibido escrever código de produção antes da aprovação humana da Spec e do Plano.**
  - Siga rigorosamente o ciclo:
    1. `atelier-spec-brainstorm` → cria `docs/specs/REQ-XXX-<slug>/spec.md`
    2. `atelier-spec-plan` → cria `docs/specs/REQ-XXX-<slug>/plan.md` e `tasks.json`
    3. **Gate de Aprovação Humana** (aguardar OK explícito do Principal Engineer)
    4. `atelier-spec-implement` → implementação orientada a TDD + execução do gate determinístico
    5. `atelier-code-review` → revisão multi-perspectiva registrada em `review.md`

---

## 2. Leis Determinísticas ("Laws, Not Vibes")

Regras verificadas automaticamente por `node scripts/atelier-gate.mjs`:

1. **Anti-monólito:** Nenhum arquivo de produção (`backend/**/*.go` exceto `*_test.go`, e `packages/*/src/*`) pode exceder **220 linhas**. Divida responsabilidades coesas em módulos pequenos.
2. **Dinheiro em centavos inteiros:** Valores monetários DEVEM ser armazenados e calculados como inteiros (`domain.Cents` / `int64` / `INTEGER` no SQLite), nunca `float`.
3. **Separação de camadas:** `backend/internal/domain` deve usar **apenas stdlib Go** (proibido importar `database/sql`, `net/http`, `store`, `httpapi` ou `cli`).
4. **Zero dependências de Windows / CGO:** SQLite deve operar em Go puro (`modernc.org/sqlite`), compilando sem GCC/MSVC.
5. **Contrato de Artefatos:** Toda `REQ-XXX` concluída deve possuir `spec.md`, `plan.md`, `tasks.json` (100% `done`) e `review.md`.
6. **Contrato de "Done-State":** Nenhum agente pode declarar uma tarefa concluída enquanto `npm run gate` (`gofmt`, `go vet`, `go test`, testes WebApp e leis arquiteturais) não passar com código `0`.

---

## 3. Paralelismo com Git Worktrees

Para executar múltiplas `REQ-XXX` em paralelo sem conflito na `main`:
```bash
git worktree add ../test_ate-req-004 -b feat/req-004
```
Cada agente trabalha isolado em seu worktree e só integra na `main` após `npm run gate` verde e aprovação humana.

---

## 4. Higiene contra Spec Drift

Se uma mudança de escopo ou contrato ocorrer durante a implementação, atualize `spec.md` e `plan.md` no mesmo commit. A documentação versionada em `docs/specs/` é a memória permanente do projeto.
