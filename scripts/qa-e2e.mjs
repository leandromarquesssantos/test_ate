#!/usr/bin/env node
/**
 * Atelier QA Release E2E Runner (Zero dependências externas)
 * Executa a jornada real do usuário em Chromium headless contra uma
 * instância isolada do servidor Go + SQLite temporário.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { findFreePort, launchCDPBrowser } from "./cdp-client.mjs";

const ROOT = process.cwd();
const BACKEND_DIR = path.join(ROOT, "backend");

function resolveGoBinary() {
  for (const bin of ["go", "C:\\Program Files\\Go\\bin\\go.exe"]) {
    try {
      execFileSync(bin, ["version"], { stdio: "ignore" });
      return bin;
    } catch {
      // try next
    }
  }
  throw new Error("Binário 'go' não encontrado.");
}

async function startIsolatedServer() {
  const goBin = resolveGoBinary();
  const port = await findFreePort();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "atelier-qa-srv-"));
  const dbPath = path.join(tmpDir, "qa.db");
  const binPath = path.join(tmpDir, process.platform === "win32" ? "fin-server.exe" : "fin-server");

  execFileSync(goBin, ["build", "-o", binPath, "./cmd/fin-server"], {
    cwd: BACKEND_DIR,
    stdio: "inherit"
  });

  const proc = spawn(binPath, [], {
    cwd: ROOT,
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      DB_PATH: dbPath,
      WEB_ROOT: path.join(ROOT, "packages", "web", "src")
    },
    stdio: "pipe"
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) {
        return {
          baseUrl,
          async stop() {
            proc.kill();
            await new Promise((r) => setTimeout(r, 250));
            try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
          }
        };
      }
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  proc.kill();
  throw new Error("Timeout aguardando servidor Go QA subir.");
}

const steps = [];
function pass(label) {
  steps.push(label);
  console.log(`  [PASS] ${label}`);
}

async function main() {
  console.log("\n=== Atelier QA Agent — Release E2E (Real Chromium) ===");
  const server = await startIsolatedServer();
  const browser = await launchCDPBrowser();

  try {
    // 1. Estado inicial não autenticado (valida CSS computado real!)
    await browser.navigate(server.baseUrl);
    await browser.waitFor(
      `getComputedStyle(document.getElementById("auth-view")).display !== "none"`,
      "tela de login visível"
    );
    const initialState = await browser.evalExpr(`
      return {
        authDisplay: getComputedStyle(document.getElementById("auth-view")).display,
        appDisplay: getComputedStyle(document.getElementById("app-view")).display
      };
    `);
    assert.notEqual(initialState.authDisplay, "none");
    assert.equal(initialState.appDisplay, "none");
    pass("1. Visitante não autenticado vê #auth-view e #app-view fica oculto (CSS computado)");

    // 2. Cadastro + verificação real de transição de tela (pegaria o bug .hidden!)
    await browser.evalExpr(`
      document.getElementById("tab-register").click();
      const f = document.getElementById("auth-form");
      f.elements.name.value = "QA Tester";
      f.elements.email.value = "qa@atelier.test";
      f.elements.password.value = "qaSenha123";
      f.requestSubmit();
    `);
    await browser.waitFor(
      `getComputedStyle(document.getElementById("auth-view")).display === "none" &&
       getComputedStyle(document.getElementById("app-view")).display !== "none" &&
       document.getElementById("user-name").textContent === "QA Tester"`,
      "transição real para dashboard após cadastro"
    );
    pass("2. Cadastro oculta #auth-view (display:none) e exibe dashboard com usuário logado");

    // 3. Criar conta extra, receita, despesa e editar inline
    await browser.evalExpr(`
      const af = document.getElementById("account-form");
      af.elements.name.value = "Carteira";
      af.elements.type.value = "cash";
      af.requestSubmit();
    `);
    await browser.waitFor(
      `document.getElementById("accounts-list").textContent.includes("Carteira")`,
      "conta Carteira renderizada"
    );
    await browser.evalExpr(`
      const tf = document.getElementById("tx-form");
      tf.elements.type.value = "income";
      tf.elements.amount.value = "5000,00";
      tf.elements.category.value = "salario";
      tf.elements.description.value = "Salário QA";
      tf.requestSubmit();
    `);
    await browser.waitFor(
      `document.getElementById("kpi-income").textContent === "R$ 5.000,00"`,
      "receita refletida no KPI"
    );
    await browser.evalExpr(`
      const tf = document.getElementById("tx-form");
      tf.elements.type.value = "expense";
      tf.elements.amount.value = "950,00";
      tf.elements.category.value = "alimentacao";
      tf.elements.description.value = "Supermercado QA";
      tf.requestSubmit();
    `);
    await browser.waitFor(
      `document.getElementById("kpi-expense").textContent === "R$ 950,00"`,
      "despesa refletida no KPI"
    );
    await browser.evalExpr(`
      const item = Array.from(document.querySelectorAll(".tx-item"))
        .find((el) => el.textContent.includes("Supermercado QA"));
      item.querySelector("[data-edit-id]").click();
      const tf = document.getElementById("tx-form");
      tf.elements.amount.value = "1000,00";
      tf.requestSubmit();
    `);
    await browser.waitFor(
      `document.getElementById("kpi-balance").textContent === "R$ 4.000,00"`,
      "edição inline atualiza saldo"
    );
    pass("3. Contas, receita, despesa e edição inline atualizam DOM e KPIs corretamente");

    // 4. Orçamento (warning) + Recorrência idempotente + Filtro de busca
    await browser.evalExpr(`
      const bf = document.getElementById("budget-form");
      bf.elements.category.value = "alimentacao";
      bf.elements.limit.value = "1100,00";
      bf.requestSubmit();
    `);
    await browser.waitFor(
      `document.querySelector("#budgets-list .bar-fill.warning") !== null`,
      "barra de orçamento warning renderizada"
    );
    await browser.evalExpr(`
      const rf = document.getElementById("recurring-form");
      rf.elements.type.value = "expense";
      rf.elements.amount.value = "120,00";
      rf.elements.category.value = "assinaturas";
      rf.elements.description.value = "Internet QA";
      rf.elements.dayOfMonth.value = "10";
      rf.requestSubmit();
    `);
    await browser.waitFor(
      `document.getElementById("recurring-list").textContent.includes("Internet QA")`,
      "regra recorrente criada"
    );
    await browser.evalExpr(`document.getElementById("apply-recurring-btn").click();`);
    await browser.waitFor(
      `document.getElementById("status-banner").textContent.includes("1 criada(s)")`,
      "primeira aplicação recorrente"
    );
    await browser.evalExpr(`document.getElementById("apply-recurring-btn").click();`);
    await browser.waitFor(
      `document.getElementById("status-banner").textContent.includes("0 criada(s)")`,
      "segunda aplicação idempotente"
    );
    await browser.evalExpr(`
      const q = document.getElementById("filter-q");
      q.value = "Internet QA";
      q.dispatchEvent(new Event("input"));
    `);
    await browser.waitFor(
      `document.querySelectorAll("#tx-list .tx-item").length === 1`,
      "filtro de busca em tempo real"
    );
    pass("4. Orçamento warning, recorrência idempotente e filtro em tempo real validados");

    // 5. Logout e re-Login com persistência SQLite
    await browser.evalExpr(`document.getElementById("logout-btn").click();`);
    await browser.waitFor(
      `getComputedStyle(document.getElementById("app-view")).display === "none" &&
       getComputedStyle(document.getElementById("auth-view")).display !== "none"`,
      "logout volta para tela de login"
    );
    await browser.evalExpr(`
      document.getElementById("tab-login").click();
      const f = document.getElementById("auth-form");
      f.elements.email.value = "qa@atelier.test";
      f.elements.password.value = "qaSenha123";
      f.requestSubmit();
    `);
    await browser.waitFor(
      `getComputedStyle(document.getElementById("auth-view")).display === "none" &&
       document.getElementById("kpi-income").textContent === "R$ 5.000,00"`,
      "login restaura sessão e dados do SQLite"
    );
    pass("5. Logout limpa tela e novo Login redireciona corretamente mantendo dados no SQLite");

    assert.equal(
      browser.pageErrors.length,
      0,
      `Erros de navegador detectados:\n${browser.pageErrors.join("\n")}`
    );
    pass("6. Zero erros de console e zero exceções JS durante toda a jornada");

    console.log(`\nQA Release E2E APROVADO (${steps.length}/${steps.length} cenários).\n`);
  } finally {
    await browser.close();
    await server.stop();
  }
}

main().catch((err) => {
  console.error(`\n[QA FAIL] ${err.message}\n`);
  process.exit(1);
});
