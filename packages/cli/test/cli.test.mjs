import test from "node:test";
import assert from "node:assert/strict";
import { LedgerService, MemoryStore } from "../../core/src/index.mjs";
import { runCli } from "../src/commands.mjs";

test("RF-06: CLI executa add, list, budget, summary e delete", () => {
  const ledger = new LedgerService(new MemoryStore());

  const addOut = runCli(
    [
      "add",
      "--type",
      "income",
      "--amount",
      "4500,00",
      "--category",
      "salario",
      "--desc",
      "Mensal",
      "--date",
      "2026-11-01"
    ],
    ledger
  );
  assert.match(addOut, /Transação criada: tx_/);

  const expOut = runCli(
    [
      "add",
      "--type",
      "expense",
      "--amount",
      "900.00",
      "--category",
      "alimentacao",
      "--desc",
      "Compras",
      "--date",
      "2026-11-12"
    ],
    ledger
  );
  const expId = expOut.match(/(tx_[a-f0-9]+)/)[1];

  const budgetOut = runCli(
    ["budget", "--month", "2026-11", "--category", "alimentacao", "--limit", "1000"],
    ledger
  );
  assert.match(budgetOut, /R\$ 1\.000,00/);

  const summaryOut = runCli(["summary", "--month", "2026-11"], ledger);
  assert.match(summaryOut, /Receitas: R\$ 4\.500,00/);
  assert.match(summaryOut, /Despesas: R\$ 900,00/);
  assert.match(summaryOut, /Saldo:\s+R\$ 3\.600,00/);
  assert.match(summaryOut, /90% - WARNING/);

  const listOut = runCli(["list", "--month", "2026-11"], ledger);
  assert.match(listOut, /alimentacao/);

  const delOut = runCli(["delete", expId], ledger);
  assert.match(delOut, /Transação removida/);
});
