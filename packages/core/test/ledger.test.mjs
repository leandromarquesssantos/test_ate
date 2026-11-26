import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  JsonFileStore,
  LedgerService,
  MemoryStore,
  NotFoundError,
  ValidationError,
  formatCentsBRL,
  parseCurrencyToCents
} from "../src/index.mjs";

test("parseCurrencyToCents converte formatos BRL e evita erro de ponto flutuante", () => {
  assert.equal(parseCurrencyToCents("49.90"), 4990);
  assert.equal(parseCurrencyToCents("49,90"), 4990);
  assert.equal(parseCurrencyToCents("1.250,50"), 125050);
  assert.equal(parseCurrencyToCents("R$ 19,99"), 1999);
  assert.equal(parseCurrencyToCents(0.1) + parseCurrencyToCents(0.2), 30);
  assert.throws(() => parseCurrencyToCents("0"), ValidationError);
  assert.throws(() => parseCurrencyToCents("-10"), ValidationError);
  assert.throws(() => parseCurrencyToCents("abc"), ValidationError);
});

test("formatCentsBRL formata positivos, zero e negativos corretamente", () => {
  assert.equal(formatCentsBRL(0), "R$ 0,00");
  assert.equal(formatCentsBRL(125050), "R$ 1.250,50");
  assert.equal(formatCentsBRL(-3500), "-R$ 35,00");
});

test("RF-01 & RF-02: adiciona, valida, filtra por mês/categoria e remove transações", () => {
  const ledger = new LedgerService(new MemoryStore());

  const t1 = ledger.addTransaction({
    type: "income",
    amountCents: 500000,
    category: "Salario",
    description: "Pagamento",
    date: "2026-11-05"
  });
  const t2 = ledger.addTransaction({
    type: "expense",
    amountCents: 4590,
    category: "Alimentacao",
    description: "Almoço",
    date: "2026-11-10"
  });
  ledger.addTransaction({
    type: "expense",
    amountCents: 2000,
    category: "transporte",
    description: "Metrô",
    date: "2026-10-20"
  });

  const nov = ledger.listTransactions({ month: "2026-11" });
  assert.equal(nov.length, 2);
  assert.equal(nov[0].id, t2.id);
  assert.equal(nov[1].id, t1.id);
  assert.equal(nov[0].category, "alimentacao");

  assert.throws(
    () =>
      ledger.addTransaction({
        type: "expense",
        amountCents: 12.5,
        category: "lazer",
        date: "2026-11-10"
      }),
    ValidationError
  );
  assert.throws(
    () =>
      ledger.addTransaction({
        type: "expense",
        amountCents: 100,
        category: "lazer",
        date: "2026-02-31"
      }),
    ValidationError
  );

  const removed = ledger.deleteTransaction(t2.id);
  assert.equal(removed.id, t2.id);
  assert.equal(ledger.listTransactions({ month: "2026-11" }).length, 1);
  assert.throws(() => ledger.deleteTransaction("tx_inexistente"), NotFoundError);
});

test("RF-03 & RF-04: calcula resumo mensal e alertas ok, warning e exceeded", () => {
  const ledger = new LedgerService(new MemoryStore());

  ledger.addTransaction({
    type: "income",
    amountCents: 300000,
    category: "salario",
    date: "2026-11-01"
  });
  ledger.addTransaction({
    type: "expense",
    amountCents: 50000,
    category: "moradia",
    date: "2026-11-02"
  });
  ledger.addTransaction({
    type: "expense",
    amountCents: 85000,
    category: "alimentacao",
    date: "2026-11-03"
  });
  ledger.addTransaction({
    type: "expense",
    amountCents: 35000,
    category: "lazer",
    date: "2026-11-04"
  });

  ledger.setBudget({ month: "2026-11", category: "moradia", limitCents: 100000 });
  ledger.setBudget({ month: "2026-11", category: "alimentacao", limitCents: 100000 });
  ledger.setBudget({ month: "2026-11", category: "lazer", limitCents: 30000 });

  const summary = ledger.getMonthlySummary("2026-11");
  assert.equal(summary.totalIncomeCents, 300000);
  assert.equal(summary.totalExpenseCents, 170000);
  assert.equal(summary.balanceCents, 130000);

  const byCat = Object.fromEntries(summary.budgets.map((b) => [b.category, b]));
  assert.equal(byCat.moradia.status, "ok");
  assert.equal(byCat.alimentacao.status, "warning");
  assert.equal(byCat.lazer.status, "exceeded");
  assert.equal(byCat.lazer.remainingCents, -5000);
});

test("JsonFileStore persiste e recarrega dados atomicamente em disco", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "atelier-fin-"));
  const filePath = path.join(tmpDir, "ledger.json");
  try {
    const ledgerA = new LedgerService(new JsonFileStore(filePath));
    ledgerA.addTransaction({
      type: "expense",
      amountCents: 2500,
      category: "cafe",
      description: "Expresso",
      date: "2026-11-26"
    });

    const ledgerB = new LedgerService(new JsonFileStore(filePath));
    const items = ledgerB.listTransactions({ month: "2026-11" });
    assert.equal(items.length, 1);
    assert.equal(items[0].amountCents, 2500);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
