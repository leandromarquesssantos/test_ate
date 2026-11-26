import {
  currentMonthISO,
  formatCentsBRL,
  parseCurrencyToCents
} from "../../core/src/index.mjs";
import { parseCliArgs } from "./parser.mjs";
import { runExtraCli } from "./commands-extra.mjs";

const HELP_TEXT = [
  "Atelier Fin CLI — Uso:",
  "  add --type <income|expense> --amount <valor> --category <cat> [--account <id>] [--desc <texto>] [--date YYYY-MM-DD]",
  "  edit <id> [--amount <valor>] [--category <cat>] [--desc <texto>] [--date YYYY-MM-DD]",
  "  list [--month YYYY-MM] [--category <cat>] [--type <tipo>] [--account <id>] [--q <busca>]",
  "  delete <id>",
  "  budget --category <cat> --limit <valor> [--month YYYY-MM]",
  "  summary [--month YYYY-MM]",
  "  accounts [list | add --name <nome> --type <tipo> | delete <id>]",
  "  transfer --from <id> --to <id> --amount <valor> [--desc <texto>]",
  "  recurring [list | add --type <tipo> --amount <valor> --category <cat> --day <1-31> | apply --month YYYY-MM]",
  "  export [--month YYYY-MM]"
].join("\n");

export function runCli(argv, ledger) {
  const { command, flags, positional } = parseCliArgs(argv);

  if (command === "help" || flags.help) return HELP_TEXT;

  if (command === "add") {
    const tx = ledger.addTransaction({
      type: flags.type,
      amountCents: parseCurrencyToCents(flags.amount),
      category: flags.category,
      description: flags.desc ?? flags.description ?? "",
      date: flags.date,
      accountId: flags.account
    });
    const sign = tx.type === "income" ? "+" : "-";
    return `Transação criada: ${tx.id} | ${tx.date} | ${tx.category} | ${sign}${formatCentsBRL(tx.amountCents)}`;
  }

  if (command === "edit") {
    const id = positional[0] ?? flags.id;
    const patch = {};
    if (flags.type) patch.type = flags.type;
    if (flags.amount) patch.amountCents = parseCurrencyToCents(flags.amount);
    if (flags.category) patch.category = flags.category;
    if (flags.desc !== undefined) patch.description = flags.desc;
    if (flags.date) patch.date = flags.date;
    if (flags.account) patch.accountId = flags.account;
    const updated = ledger.updateTransaction(id, patch);
    return `Transação atualizada: ${updated.id} | ${updated.category} | ${formatCentsBRL(updated.amountCents)}`;
  }

  if (command === "list") {
    const items = ledger.listTransactions({
      month: flags.month,
      category: flags.category,
      type: flags.type,
      accountId: flags.account,
      q: flags.q
    });
    if (!items.length) return "Nenhuma transação encontrada.";
    return items
      .map((tx) => {
        const sign = tx.type === "income" ? "+" : tx.type === "transfer" ? "⇄" : "-";
        const desc = tx.description ? ` (${tx.description})` : "";
        return `${tx.id} | ${tx.date} | ${tx.category.padEnd(14)} | ${sign}${formatCentsBRL(tx.amountCents)}${desc}`;
      })
      .join("\n");
  }

  if (command === "delete") {
    const removed = ledger.deleteTransaction(positional[0] ?? flags.id);
    return `Transação removida: ${removed.id} (${removed.category})`;
  }

  if (command === "budget") {
    const saved = ledger.setBudget({
      month: flags.month ?? currentMonthISO(),
      category: flags.category,
      limitCents: parseCurrencyToCents(flags.limit)
    });
    return `Orçamento definido: ${saved.month} | ${saved.category} -> ${formatCentsBRL(saved.limitCents)}`;
  }

  if (command === "summary") {
    const summary = ledger.getMonthlySummary(flags.month ?? currentMonthISO());
    const lines = [
      `Resumo Financeiro (${summary.month})`,
      `  Receitas: ${formatCentsBRL(summary.totalIncomeCents)}`,
      `  Despesas: ${formatCentsBRL(summary.totalExpenseCents)}`,
      `  Saldo:    ${formatCentsBRL(summary.balanceCents)}`
    ];
    if (summary.budgets.length > 0) {
      lines.push("  Orçamentos:");
      for (const b of summary.budgets) {
        lines.push(
          `    - ${b.category}: ${formatCentsBRL(b.spentCents)} / ${formatCentsBRL(b.limitCents)} (${b.percentUsed}% - ${b.status.toUpperCase()})`
        );
      }
    }
    return lines.join("\n");
  }

  const extra = runExtraCli(command, flags, positional, ledger);
  if (extra !== null) return extra;
  throw new Error(`Comando desconhecido: "${command}". Use "help" para ver opções.`);
}
