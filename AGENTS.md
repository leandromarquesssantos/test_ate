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

1. **Anti-monólito:** Nenhum arquivo de código-fonte (`src/`) pode exceder **220 linhas**. Divida responsabilidades coesas em módulos pequenos.
2. **Dinheiro em centavos inteiros:** Valores monetários no domínio e na API DEVEM ser armazenados e calculados como inteiros (`amountCents: number`), nunca `float` para evitar erros de precisão IEEE-754.
3. **Separação de camadas:** `packages/core` não pode importar nada de `api`, `cli`, `web` ou `mobile` (domínio puro e testável).
4. **Contrato de Artefatos:** Toda `REQ-XXX` marcada como concluída deve possuir `spec.md`, `plan.md`, `tasks.json` (100% `done`) e `review.md`.
5. **Contrato de "Done-State":** Nenhum agente pode declarar uma tarefa concluída enquanto `npm run gate` (testes + checagens arquiteturais + build/validação) não passar com código `0`.

---

## 3. Paralelismo com Git Worktrees

Para executar múltiplas `REQ-XXX` ou frentes (`api`, `web`, `mobile`) em paralelo sem conflito na `main`:
```bash
git worktree add ../concept-req-002 -b feat/req-002
```
Cada agente trabalha isolado em seu worktree e só integra na `main` após `npm run gate` verde e aprovação humana.

---

## 4. Higiene contra Spec Drift

Se uma mudança de escopo ou contrato ocorrer durante a implementação, atualize `spec.md` e `plan.md` no mesmo commit. A documentação versionada em `docs/specs/` é a memória permanente do projeto.
