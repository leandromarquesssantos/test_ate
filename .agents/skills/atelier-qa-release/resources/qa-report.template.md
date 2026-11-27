# QA Release Report — REQ-XXX

- **Data:** YYYY-MM-DD
- **Executado por:** Agente QA Independente (`atelier-qa-release`)
- **Veredito:** APPROVED FOR RELEASE | REJECTED

## 1. Cenários E2E Executados (Navegador Headless Real)
- [ ] Carregamento inicial não autenticado (`#auth-view` visível, `#app-view` oculto)
- [ ] Cadastro de conta + transição real de tela (`getComputedStyle` validado)
- [ ] Criação de conta extra, receita, despesa e edição inline
- [ ] Orçamentos, recorrências idempotentes e busca/filtros
- [ ] Logout e novo Login com persistência SQLite
- [ ] Zero erros de console / zero exceções JS

## 2. Evidências de Execução
- `npm run qa`: PASS / FAIL
- `npm run gate:release`: PASS / FAIL

## 3. Achados e Recomendações
- Nenhum blocker encontrado (ou lista detalhada com passos de reprodução).
