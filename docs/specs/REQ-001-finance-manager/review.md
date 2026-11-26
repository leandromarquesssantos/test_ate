# Code Review Multi-Perspectiva — REQ-001 (Atelier Fin MVP)

- **Data:** 2026-11-26
- **Escopo revisado:** `packages/core`, `packages/api`, `packages/cli`, `packages/web`, `scripts/atelier-gate.mjs`
- **Veredito:** APROVADO (todos os achados acionáveis resolvidos e verificados por `npm run gate`)

---

## 1. Lente de Arquitetura
- **[OK]** Isolamento estrito de camadas: `packages/core` não importa nenhuma camada externa (`api`, `cli`, `web`), validado automaticamente pelo `atelier-gate.mjs`.
- **[OK]** Regras de negócio centralizadas em `LedgerService` (`packages/core/src/ledger.mjs`), consumidas tanto pela API REST quanto pelo CLI sem duplicação.
- **[OK]** Zero dependências externas ou específicas de Windows; 100% Node 22 ESM cross-platform.
- **[OK]** Lei anti-monólito cumprida: todos os 13 arquivos de `src/` permanecem abaixo do teto de 220 linhas.

## 2. Lente de Segurança
- **[WARNING -> RESOLVIDO]** Em `packages/api/src/server.mjs`, `url.pathname` já vinha normalizado por `new URL()`, mascarando tentativas codificadas de path traversal como `404` em vez de rejeitar explicitamente com `403`. Corrigido passando o caminho bruto (`req.url.split("?")[0]`) para `serveStaticFile` e validado em teste automatizado (`..%2f..%2fpackage.json` -> `403`).
- **[OK]** Limite de payload de 64 KB validado por teste automatizado (`413 Payload Too Large`).
- **[OK]** `packages/web/src/app.mjs` escapa todas as strings interpoladas com `escapeHtml` (testado contra `<script>alert("xss")</script>`).
- **[OK]** Erros internos retornam mensagem genérica (`500`) sem vazar stack trace ao cliente.

## 3. Lente de Corretude
- **[WARNING -> RESOLVIDO]** Em `packages/web/src/app.mjs`, a data padrão do formulário usava `now.toISOString().slice(0, 10)` (UTC), enquanto o seletor de mês usava data local (`getFullYear()`/`getMonth()`), podendo divergir após as 21h em fusos `UTC-3`. Corrigido para usar data local consistente (`todayLocal`).
- **[OK]** Precisão monetária garantida em centavos inteiros (`0.1 + 0.2 -> 30` centavos exatos).
- **[OK]** Datas de calendário inválidas (ex.: `2026-02-31`) rejeitadas com `ValidationError`.
- **[OK]** Persistência em disco utiliza arquivo temporário único + `fs.renameSync` (escrita atômica).

## 4. Lente de Simplicidade (Crítico Obrigatório)
- **[OK]** Sem build step complexo, sem frameworks inchados e sem abstrações especulativas.
- **[NOTE]** `formatBRL` existe em `packages/core/src/money.mjs` e em `packages/web/src/api-client.mjs` (~6 linhas). Mantido intencionalmente para permitir que `packages/web/src` execute nativamente no navegador sem bundler ou rota extra para expor `packages/core`.

---

## Evidências de Verificação
- Comando: `npm run gate` (`node scripts/atelier-gate.mjs --with-tests`)
- Cobertura de requisitos: `RF-01` a `RF-07` cobertos por 10 testes automatizados (`core`, `api`, `cli`, `web`).
