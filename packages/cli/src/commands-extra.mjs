import {
  currentMonthISO,
  formatCentsBRL,
  parseCurrencyToCents
} from "../../core/src/index.mjs";

export function runExtraCli(command, flags, positional, ledger) {
  if (command === "accounts") {
    const action = positional[0] ?? "list";
    if (action === "list") {
      return ledger
        .listAccounts()
        .map((a) => `${a.id} | ${a.name} (${a.type}) | Saldo: ${formatCentsBRL(a.balanceCents)}`)
        .join("\n");
    }
    if (action === "add") {
      const acc = ledger.addAccount({ name: flags.name, type: flags.type ?? "checking" });
      return `Conta criada: ${acc.id} | ${acc.name} (${acc.type})`;
    }
    if (action === "delete") {
      const removed = ledger.deleteAccount(positional[1] ?? flags.id);
      return `Conta removida: ${removed.id} (${removed.name})`;
    }
  }

  if (command === "transfer") {
    const tx = ledger.addTransfer({
      fromAccountId: flags.from,
      toAccountId: flags.to,
      amountCents: parseCurrencyToCents(flags.amount),
      description: flags.desc ?? "",
      date: flags.date
    });
    return `Transferência criada: ${tx.id} | ${tx.accountId} -> ${tx.toAccountId} | ${formatCentsBRL(tx.amountCents)}`;
  }

  if (command === "recurring") {
    const action = positional[0] ?? "list";
    if (action === "list") {
      const items = ledger.listRecurring();
      if (!items.length) return "Nenhuma recorrência cadastrada.";
      return items
        .map(
          (r) =>
            `${r.id} | Dia ${r.dayOfMonth} | ${r.type} | ${r.category} | ${formatCentsBRL(r.amountCents)}`
        )
        .join("\n");
    }
    if (action === "add") {
      const rule = ledger.addRecurring({
        type: flags.type,
        amountCents: parseCurrencyToCents(flags.amount),
        category: flags.category,
        description: flags.desc ?? "",
        dayOfMonth: Number(flags.day),
        accountId: flags.account
      });
      return `Recorrência criada: ${rule.id} | Dia ${rule.dayOfMonth} | ${rule.category}`;
    }
    if (action === "delete") {
      const removed = ledger.deleteRecurring(positional[1] ?? flags.id);
      return `Recorrência removida: ${removed.id}`;
    }
    if (action === "apply") {
      const res = ledger.applyRecurring(flags.month ?? currentMonthISO());
      return `Recorrências (${res.month}): ${res.createdCount} criada(s), ${res.skippedCount} já existente(s).`;
    }
  }

  if (command === "export") {
    return ledger.exportCsv({
      month: flags.month,
      category: flags.category,
      type: flags.type,
      accountId: flags.account,
      q: flags.q
    });
  }

  return null;
}
