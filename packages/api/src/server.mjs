import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  NotFoundError,
  ValidationError,
  parseCurrencyToCents
} from "../../core/src/index.mjs";
import { HttpError, readJsonBody, sendJson, serveStaticFile } from "./http.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_WEB_ROOT = path.resolve(__dirname, "../../web/src");

function resolveAmountCents(body, centsField, currencyField) {
  if (body[centsField] !== undefined) {
    return body[centsField];
  }
  if (body[currencyField] !== undefined) {
    return parseCurrencyToCents(body[currencyField]);
  }
  return undefined;
}

async function handleApi(req, res, url, ledger) {
  const { pathname, searchParams } = url;

  if (req.method === "GET" && pathname === "/api/health") {
    return sendJson(res, 200, { status: "ok" });
  }

  if (req.method === "GET" && pathname === "/api/transactions") {
    const items = ledger.listTransactions({
      month: searchParams.get("month") || undefined,
      category: searchParams.get("category") || undefined,
      type: searchParams.get("type") || undefined
    });
    return sendJson(res, 200, { items });
  }

  if (req.method === "POST" && pathname === "/api/transactions") {
    const body = await readJsonBody(req);
    const amountCents = resolveAmountCents(body, "amountCents", "amount");
    const created = ledger.addTransaction({
      type: body.type,
      amountCents,
      category: body.category,
      description: body.description,
      date: body.date
    });
    return sendJson(res, 201, created);
  }

  if (req.method === "DELETE" && pathname.startsWith("/api/transactions/")) {
    const id = decodeURIComponent(pathname.slice("/api/transactions/".length));
    const removed = ledger.deleteTransaction(id);
    return sendJson(res, 200, { removed });
  }

  if (req.method === "GET" && pathname === "/api/budgets") {
    const items = ledger.listBudgets({
      month: searchParams.get("month") || undefined
    });
    return sendJson(res, 200, { items });
  }

  if (req.method === "PUT" && pathname === "/api/budgets") {
    const body = await readJsonBody(req);
    const limitCents = resolveAmountCents(body, "limitCents", "limit");
    const saved = ledger.setBudget({
      month: body.month,
      category: body.category,
      limitCents
    });
    return sendJson(res, 200, saved);
  }

  if (req.method === "GET" && pathname === "/api/summary") {
    const summary = ledger.getMonthlySummary(searchParams.get("month") || undefined);
    return sendJson(res, 200, summary);
  }

  return sendJson(res, 404, { error: "Endpoint não encontrado." });
}

export function createAppServer({ ledger, webRoot = DEFAULT_WEB_ROOT }) {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      if (url.pathname.startsWith("/api/")) {
        await handleApi(req, res, url, ledger);
        return;
      }
      if (req.method === "GET") {
        const rawPath = (req.url ?? "/").split("?")[0];
        serveStaticFile(res, webRoot, rawPath);
        return;
      }
      sendJson(res, 405, { error: "Método não permitido." });
    } catch (err) {
      if (err instanceof ValidationError) {
        return sendJson(res, 400, { error: err.message, code: err.code });
      }
      if (err instanceof NotFoundError) {
        return sendJson(res, 404, { error: err.message, code: err.code });
      }
      if (err instanceof HttpError) {
        return sendJson(res, err.status, { error: err.message, code: err.code });
      }
      sendJson(res, 500, { error: "Erro interno inesperado." });
    }
  });
}
