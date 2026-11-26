import {
  currentMonthISO,
  formatCentsBRL,
  parseCurrencyToCents
} from "../../core/src/index.mjs";
import { parseCliArgs } from "./parser.mjs";

const HELP_TEXT = [
  "Atelier Fin CLI — Uso:",
  "  add --type <income|expense> --amount <valor> --category <cat> [--desc <texto>] [--date YYYY-MM-DD]",
  "  list [--month YYYY-MM] [--category <cat>] [--type <income|expense>]",
  "  delete <id>",
  "  budget --category <cat> --limit <valor> [--month YYYY-MM]",
  "  summary [--month YYYY-MM]"
].join("\n");

export function runCli(argv, ledger) {
  const { command, flags, positional } = parseCliArgs(argv);

  if (command === "help" || flags.help) {
    return HELP_TEXT;
  }

  if (command === "add") {
    const amountCents = parseCurrencyToCents(flags.amount);
    const tx = ledger.addTransaction({
      type: flags.type,
      amountCents,
      category: flags.category,
      description: flags.desc ?? flags.description ?? "",
      date: flags.date
    });
    const sign = tx.type === "income" ? "+" : "-";
    return `Transação criada: ${tx.id} | ${tx.date} | ${tx.category} | ${sign}${formatCentsBRL(tx.amountCents)}`;
  }

  if (command === "list") {
    const items = ledger.listTransactions({
      month: flags.month,
      category: flags.category,
      type: flags.type
    });
    if (items.length === 0) {
      return "Nenhuma transação encontrada.";
    }
    return items
      .map((tx) => {
        const sign = tx.type === "income" ? "+" : "-";
        const desc = tx.description ? ` (${tx.description})` : "";
        return `${tx.id} | ${tx.date} | ${tx.category.padEnd(14)} | ${sign}${formatCentsBRL(tx.amountCents)}${desc}`;
      })
      .join("\n");
  }

  if (command === "delete") {
    const id = positional[0] ?? flags.id;
    const removed = ledger.deleteTransaction(id);
    return `Transação removida: ${removed.id} (${removed.category})`;
  }

  if (command === "budget") {
    const limitCents = parseCurrencyToCents(flags.limit);
    const saved = ledger.setBudget({
      month: flags.month ?? currentMonthISO(),
      category: flags.category,
      limitCents
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
        const badge = b.status.toUpperCase();
        lines.push(
          `    - ${b.category}: ${formatCentsBRL(b.spentCents)} / ${formatCentsBRL(b.limitCents)} (${b.percentUsed}% - ${badge})`
        );
      }
    }
    return lines.join("\n");
  }

  throw new Error(`Comando desconhecido: "${command}". Use "help" para ver opções.`);
}
