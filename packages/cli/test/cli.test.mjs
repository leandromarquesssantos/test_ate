import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_ACCOUNT_ID, LedgerService, MemoryStore } from "../../core/src/index.mjs";
import { runCli } from "../src/commands.mjs";

test("RF-06: CLI executa add, edit, list, budget, summary, accounts, transfer, recurring, export e delete", () => {
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

  const editOut = runCli(["edit", expId, "--amount", "950,00", "--desc", "Supermercado"], ledger);
  assert.match(editOut, /R\$ 950,00/);

  const accOut = runCli(["accounts", "add", "--name", "Carteira", "--type", "cash"], ledger);
  const walletId = accOut.match(/(acc_[a-f0-9]+)/)[1];
  const trOut = runCli(
    ["transfer", "--from", DEFAULT_ACCOUNT_ID, "--to", walletId, "--amount", "200"],
    ledger
  );
  assert.match(trOut, /Transferência criada/);

  runCli(
    [
      "recurring",
      "add",
      "--type",
      "expense",
      "--amount",
      "120",
      "--category",
      "internet",
      "--day",
      "15"
    ],
    ledger
  );
  const applyOut = runCli(["recurring", "apply", "--month", "2026-11"], ledger);
  assert.match(applyOut, /1 criada\(s\)/);

  const budgetOut = runCli(
    ["budget", "--month", "2026-11", "--category", "alimentacao", "--limit", "1000"],
    ledger
  );
  assert.match(budgetOut, /R\$ 1\.000,00/);

  const summaryOut = runCli(["summary", "--month", "2026-11"], ledger);
  assert.match(summaryOut, /95% - WARNING/);

  const csvOut = runCli(["export", "--month", "2026-11"], ledger);
  assert.match(csvOut, /Supermercado/);

  const delOut = runCli(["delete", expId], ledger);
  assert.match(delOut, /Transação removida/);
});
