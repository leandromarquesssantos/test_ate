import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_ACCOUNT_ID,
  LedgerService,
  MemoryStore,
  NotFoundError,
  ValidationError
} from "../src/index.mjs";

test("RF-01 & RF-02: edita transação, remove orçamento e filtra por busca textual", () => {
  const ledger = new LedgerService(new MemoryStore());
  const tx = ledger.addTransaction({
    type: "expense",
    amountCents: 3500,
    category: "alimentacao",
    description: "Padaria Central",
    date: "2026-11-10"
  });

  const updated = ledger.updateTransaction(tx.id, {
    amountCents: 4200,
    description: "Padaria Artesanal",
    category: "cafe"
  });
  assert.equal(updated.id, tx.id);
  assert.equal(updated.amountCents, 4200);
  assert.equal(updated.category, "cafe");

  const searchHits = ledger.listTransactions({ month: "2026-11", q: "artesanal" });
  assert.equal(searchHits.length, 1);
  assert.equal(searchHits[0].id, tx.id);
  assert.equal(ledger.listTransactions({ q: "inexistente" }).length, 0);

  ledger.setBudget({ month: "2026-11", category: "cafe", limitCents: 10000 });
  const removedBudget = ledger.deleteBudget({ month: "2026-11", category: "cafe" });
  assert.equal(removedBudget.category, "cafe");
  assert.throws(
    () => ledger.deleteBudget({ month: "2026-11", category: "cafe" }),
    NotFoundError
  );
});

test("RF-03: contas, retrocompatibilidade REQ-001 e transferências sem distorcer resumo", () => {
  // Simula ledger v1 sem accounts nem accountId nas transações
  const legacyStore = new MemoryStore({
    version: 1,
    transactions: [
      {
        id: "tx_legacy",
        type: "income",
        amountCents: 100000,
        category: "salario",
        description: "Antigo",
        date: "2026-11-01",
        createdAt: "2026-11-01T10:00:00.000Z"
      }
    ],
    budgets: []
  });

  const ledger = new LedgerService(legacyStore);
  const wallet = ledger.addAccount({ name: "Carteira", type: "cash" });

  ledger.addTransfer({
    fromAccountId: DEFAULT_ACCOUNT_ID,
    toAccountId: wallet.id,
    amountCents: 25000,
    description: "Saque",
    date: "2026-11-05"
  });

  const summary = ledger.getMonthlySummary("2026-11");
  assert.equal(summary.totalIncomeCents, 100000);
  assert.equal(summary.totalExpenseCents, 0);
  assert.equal(summary.balanceCents, 100000);

  const byId = Object.fromEntries(summary.accounts.map((a) => [a.id, a.balanceCents]));
  assert.equal(byId[DEFAULT_ACCOUNT_ID], 75000);
  assert.equal(byId[wallet.id], 25000);

  assert.throws(
    () =>
      ledger.addTransfer({
        fromAccountId: wallet.id,
        toAccountId: wallet.id,
        amountCents: 1000
      }),
    ValidationError
  );
  assert.throws(() => ledger.deleteAccount(wallet.id), ValidationError);
});

test("RF-04: recorrências mensais são idempotentes e ajustam dia 31 em fevereiro", () => {
  const ledger = new LedgerService(new MemoryStore());
  ledger.addRecurring({
    type: "expense",
    amountCents: 180000,
    category: "moradia",
    description: "Aluguel",
    dayOfMonth: 31
  });

  const first = ledger.applyRecurring("2026-02");
  assert.equal(first.createdCount, 1);
  assert.equal(first.created[0].date, "2026-02-28");

  const second = ledger.applyRecurring("2026-02");
  assert.equal(second.createdCount, 0);
  assert.equal(second.skippedCount, 1);
  assert.equal(ledger.listTransactions({ month: "2026-02" }).length, 1);
});

test("RF-05: exportCsv protege contra formula injection e escapa RFC-4180", () => {
  const ledger = new LedgerService(new MemoryStore());
  ledger.addTransaction({
    type: "expense",
    amountCents: 1500,
    category: "teste",
    description: '=SUM(A1:A2), "aspas"',
    date: "2026-11-26"
  });

  const csv = ledger.exportCsv({ month: "2026-11" });
  assert.match(csv, /^id,date,type,category,description,account,toAccount,amountBRL,amountCents/);
  assert.match(csv, /"'=SUM\(A1:A2\), ""aspas"""/);
});
