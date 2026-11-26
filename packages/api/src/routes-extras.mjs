import { readJsonBody, sendJson } from "./http.mjs";
import { resolveAmountCents } from "./routes-ledger.mjs";

export async function handleExtraRoutes(req, res, url, ledger) {
  const { pathname } = url;

  if (req.method === "GET" && pathname === "/api/accounts") {
    sendJson(res, 200, { items: ledger.listAccounts() });
    return true;
  }

  if (req.method === "POST" && pathname === "/api/accounts") {
    const body = await readJsonBody(req);
    const created = ledger.addAccount({ name: body.name, type: body.type });
    sendJson(res, 201, created);
    return true;
  }

  if (req.method === "DELETE" && pathname.startsWith("/api/accounts/")) {
    const id = decodeURIComponent(pathname.slice("/api/accounts/".length));
    const removed = ledger.deleteAccount(id);
    sendJson(res, 200, { removed });
    return true;
  }

  if (req.method === "POST" && pathname === "/api/transfers") {
    const body = await readJsonBody(req);
    const created = ledger.addTransfer({
      fromAccountId: body.fromAccountId,
      toAccountId: body.toAccountId,
      amountCents: resolveAmountCents(body, "amountCents", "amount"),
      description: body.description,
      date: body.date
    });
    sendJson(res, 201, created);
    return true;
  }

  if (req.method === "GET" && pathname === "/api/recurring") {
    sendJson(res, 200, { items: ledger.listRecurring() });
    return true;
  }

  if (req.method === "POST" && pathname === "/api/recurring") {
    const body = await readJsonBody(req);
    const created = ledger.addRecurring({
      type: body.type,
      amountCents: resolveAmountCents(body, "amountCents", "amount"),
      category: body.category,
      description: body.description,
      dayOfMonth: body.dayOfMonth,
      accountId: body.accountId
    });
    sendJson(res, 201, created);
    return true;
  }

  if (req.method === "POST" && pathname === "/api/recurring/apply") {
    const body = await readJsonBody(req);
    const result = ledger.applyRecurring(body.month);
    sendJson(res, 200, result);
    return true;
  }

  if (req.method === "DELETE" && pathname.startsWith("/api/recurring/")) {
    const id = decodeURIComponent(pathname.slice("/api/recurring/".length));
    const removed = ledger.deleteRecurring(id);
    sendJson(res, 200, { removed });
    return true;
  }

  return false;
}
