import test from "node:test";
import assert from "node:assert/strict";
import { LedgerService, MemoryStore } from "../../core/src/index.mjs";
import { createAppServer } from "../src/server.mjs";

async function withServer(fn) {
  const ledger = new LedgerService(new MemoryStore());
  const server = createAppServer({ ledger });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await fn(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("RF-05: ciclo completo REST (health, transactions, budgets, summary, delete)", async () => {
  await withServer(async (baseUrl) => {
    const health = await fetch(`${baseUrl}/api/health`).then((r) => r.json());
    assert.equal(health.status, "ok");

    const createRes = await fetch(`${baseUrl}/api/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "expense",
        amount: "120,50",
        category: "alimentacao",
        description: "Mercado",
        date: "2026-11-15"
      })
    });
    assert.equal(createRes.status, 201);
    const created = await createRes.json();
    assert.equal(created.amountCents, 12050);

    const budgetRes = await fetch(`${baseUrl}/api/budgets`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        month: "2026-11",
        category: "alimentacao",
        limitCents: 15000
      })
    });
    assert.equal(budgetRes.status, 200);

    const summary = await fetch(`${baseUrl}/api/summary?month=2026-11`).then((r) => r.json());
    assert.equal(summary.totalExpenseCents, 12050);
    assert.equal(summary.budgets[0].status, "warning");

    const delRes = await fetch(`${baseUrl}/api/transactions/${created.id}`, {
      method: "DELETE"
    });
    assert.equal(delRes.status, 200);

    const delAgain = await fetch(`${baseUrl}/api/transactions/${created.id}`, {
      method: "DELETE"
    });
    assert.equal(delAgain.status, 404);
  });
});

test("Segurança API: rejeita payload inválido e bloqueia path traversal", async () => {
  await withServer(async (baseUrl) => {
    const badRes = await fetch(`${baseUrl}/api/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "expense", amountCents: -10, category: "x" })
    });
    assert.equal(badRes.status, 400);

    const traversal = await fetch(`${baseUrl}/..%2f..%2fpackage.json`);
    assert.equal(traversal.status, 403);

    const huge = await fetch(`${baseUrl}/api/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "expense",
        amountCents: 100,
        category: "x",
        description: "a".repeat(70 * 1024)
      })
    });
    assert.equal(huge.status, 413);

    const htmlRes = await fetch(`${baseUrl}/`);
    assert.equal(htmlRes.status, 200);
    const html = await htmlRes.text();
    assert.match(html, /Atelier Fin/);
  });
});
