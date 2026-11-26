import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NotFoundError, ValidationError } from "../../core/src/index.mjs";
import { HttpError, sendJson, serveStaticFile } from "./http.mjs";
import { handleLedgerRoutes } from "./routes-ledger.mjs";
import { handleExtraRoutes } from "./routes-extras.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_WEB_ROOT = path.resolve(__dirname, "../../web/src");

export function createAppServer({ ledger, webRoot = DEFAULT_WEB_ROOT }) {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      if (url.pathname.startsWith("/api/")) {
        const handled =
          (await handleLedgerRoutes(req, res, url, ledger)) ||
          (await handleExtraRoutes(req, res, url, ledger));
        if (!handled) {
          sendJson(res, 404, { error: "Endpoint não encontrado." });
        }
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
