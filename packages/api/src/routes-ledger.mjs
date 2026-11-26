import { parseCurrencyToCents } from "../../core/src/index.mjs";
import { readJsonBody, sendCsv, sendJson } from "./http.mjs";

export function resolveAmountCents(body, centsField, currencyField) {
  if (body[centsField] !== undefined) return body[centsField];
  if (body[currencyField] !== undefined) return parseCurrencyToCents(body[currencyField]);
  return undefined;
}

export async function handleLedgerRoutes(req, res, url, ledger) {
  const { pathname, searchParams } = url;

  if (req.method === "GET" && pathname === "/api/health") {
    sendJson(res, 200, { status: "ok" });
    return true;
  }

  if (req.method === "GET" && pathname === "/api/transactions") {
    const items = ledger.listTransactions({
      month: searchParams.get("month") || undefined,
      category: searchParams.get("category") || undefined,
      type: searchParams.get("type") || undefined,
      accountId: searchParams.get("accountId") || undefined,
      q: searchParams.get("q") || undefined
    });
    sendJson(res, 200, { items });
    return true;
  }

  if (req.method === "POST" && pathname === "/api/transactions") {
    const body = await readJsonBody(req);
    const created = ledger.addTransaction({
      type: body.type,
      amountCents: resolveAmountCents(body, "amountCents", "amount"),
      category: body.category,
      description: body.description,
      date: body.date,
      accountId: body.accountId
    });
    sendJson(res, 201, created);
    return true;
  }

  if (req.method === "PATCH" && pathname.startsWith("/api/transactions/")) {
    const id = decodeURIComponent(pathname.slice("/api/transactions/".length));
    const body = await readJsonBody(req);
    const patch = { ...body };
    if (body.amount !== undefined && body.amountCents === undefined) {
      patch.amountCents = parseCurrencyToCents(body.amount);
    }
    const updated = ledger.updateTransaction(id, patch);
    sendJson(res, 200, updated);
    return true;
  }

  if (req.method === "DELETE" && pathname.startsWith("/api/transactions/")) {
    const id = decodeURIComponent(pathname.slice("/api/transactions/".length));
    const removed = ledger.deleteTransaction(id);
    sendJson(res, 200, { removed });
    return true;
  }

  if (req.method === "GET" && pathname === "/api/budgets") {
    const items = ledger.listBudgets({ month: searchParams.get("month") || undefined });
    sendJson(res, 200, { items });
    return true;
  }

  if (req.method === "PUT" && pathname === "/api/budgets") {
    const body = await readJsonBody(req);
    const saved = ledger.setBudget({
      month: body.month,
      category: body.category,
      limitCents: resolveAmountCents(body, "limitCents", "limit")
    });
    sendJson(res, 200, saved);
    return true;
  }

  if (req.method === "DELETE" && pathname === "/api/budgets") {
    const removed = ledger.deleteBudget({
      month: searchParams.get("month") || undefined,
      category: searchParams.get("category") || undefined
    });
    sendJson(res, 200, { removed });
    return true;
  }

  if (req.method === "GET" && pathname === "/api/summary") {
    const summary = ledger.getMonthlySummary(searchParams.get("month") || undefined);
    sendJson(res, 200, summary);
    return true;
  }

  if (req.method === "GET" && pathname === "/api/export/csv") {
    const month = searchParams.get("month") || undefined;
    const csv = ledger.exportCsv({
      month,
      category: searchParams.get("category") || undefined,
      type: searchParams.get("type") || undefined,
      accountId: searchParams.get("accountId") || undefined,
      q: searchParams.get("q") || undefined
    });
    const filename = month ? `atelier-fin-${month}.csv` : "atelier-fin-all.csv";
    sendCsv(res, filename, csv);
    return true;
  }

  return false;
}
