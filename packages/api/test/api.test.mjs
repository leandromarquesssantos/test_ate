import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_ACCOUNT_ID, LedgerService, MemoryStore } from "../../core/src/index.mjs";
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

test("REQ-001 & REQ-002 REST: CRUD, PATCH, DELETE budget, filtros, contas, recorrentes e CSV", async () => {
  await withServer(async (baseUrl) => {
    const accRes = await fetch(`${baseUrl}/api/accounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Carteira", type: "cash" })
    });
    assert.equal(accRes.status, 201);
    const wallet = await accRes.json();

    const createRes = await fetch(`${baseUrl}/api/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "expense",
        amount: "120,50",
        category: "alimentacao",
        description: "Mercado Central",
        date: "2026-11-15"
      })
    });
    assert.equal(createRes.status, 201);
    const created = await createRes.json();

    const patchRes = await fetch(`${baseUrl}/api/transactions/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: "130,00", description: "Mercado Bairro" })
    });
    assert.equal(patchRes.status, 200);
    const patched = await patchRes.json();
    assert.equal(patched.amountCents, 13000);

    const search = await fetch(`${baseUrl}/api/transactions?month=2026-11&q=bairro`).then((r) =>
      r.json()
    );
    assert.equal(search.items.length, 1);

    const trRes = await fetch(`${baseUrl}/api/transfers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromAccountId: DEFAULT_ACCOUNT_ID,
        toAccountId: wallet.id,
        amount: "50,00",
        date: "2026-11-16"
      })
    });
    assert.equal(trRes.status, 201);

    const recRes = await fetch(`${baseUrl}/api/recurring`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "expense",
        amount: "100,00",
        category: "internet",
        description: "Fibra",
        dayOfMonth: 10
      })
    });
    assert.equal(recRes.status, 201);

    const apply1 = await fetch(`${baseUrl}/api/recurring/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: "2026-11" })
    }).then((r) => r.json());
    assert.equal(apply1.createdCount, 1);

    const apply2 = await fetch(`${baseUrl}/api/recurring/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: "2026-11" })
    }).then((r) => r.json());
    assert.equal(apply2.createdCount, 0);

    await fetch(`${baseUrl}/api/budgets`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: "2026-11", category: "alimentacao", limitCents: 15000 })
    });
    const delBudget = await fetch(
      `${baseUrl}/api/budgets?month=2026-11&category=alimentacao`,
      { method: "DELETE" }
    );
    assert.equal(delBudget.status, 200);

    const csvRes = await fetch(`${baseUrl}/api/export/csv?month=2026-11`);
    assert.equal(csvRes.status, 200);
    assert.match(csvRes.headers.get("content-type"), /text\/csv/);
    const csvText = await csvRes.text();
    assert.match(csvText, /Mercado Bairro/);
    assert.match(csvText, /Fibra/);
  });
});

test("Segurança API: rejeita payload inválido, payload >64KB e bloqueia path traversal", async () => {
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
    assert.match(await htmlRes.text(), /Atelier Fin/);
  });
});
