import { formatCentsBRL } from "./money.mjs";
import { DEFAULT_ACCOUNT_ID } from "./validation.mjs";

const FORMULA_PREFIX_RE = /^[=+\-@\t\r]/;

export function sanitizeCsvText(value) {
  const str = String(value ?? "");
  return FORMULA_PREFIX_RE.test(str) ? `'${str}` : str;
}

export function escapeCsvCell(value, { neutralizeFormula = false } = {}) {
  const text = neutralizeFormula ? sanitizeCsvText(value) : String(value ?? "");
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function transactionsToCsv(transactions, accounts = []) {
  const accountMap = new Map(accounts.map((a) => [a.id, a.name]));
  const header = [
    "id",
    "date",
    "type",
    "category",
    "description",
    "account",
    "toAccount",
    "amountBRL",
    "amountCents"
  ].join(",");

  const rows = transactions.map((tx) => {
    const accId = tx.accountId ?? DEFAULT_ACCOUNT_ID;
    const accName = accountMap.get(accId) ?? accId;
    const toAccName = tx.toAccountId ? (accountMap.get(tx.toAccountId) ?? tx.toAccountId) : "";
    return [
      escapeCsvCell(tx.id),
      escapeCsvCell(tx.date),
      escapeCsvCell(tx.type),
      escapeCsvCell(tx.category, { neutralizeFormula: true }),
      escapeCsvCell(tx.description ?? "", { neutralizeFormula: true }),
      escapeCsvCell(accName, { neutralizeFormula: true }),
      escapeCsvCell(toAccName, { neutralizeFormula: true }),
      escapeCsvCell(formatCentsBRL(tx.amountCents)),
      escapeCsvCell(tx.amountCents)
    ].join(",");
  });

  return [header, ...rows].join("\r\n") + "\r\n";
}
