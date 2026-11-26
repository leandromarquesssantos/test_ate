import fs from "node:fs";
import path from "node:path";

const MAX_BODY_BYTES = 64 * 1024;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

export class HttpError extends Error {
  constructor(status, message, code = "HTTP_ERROR") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function sendJson(res, status, data) {
  const payload = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store"
  });
  res.end(payload);
}

export async function readJsonBody(req) {
  const chunks = [];
  let total = 0;

  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) {
      throw new HttpError(413, "Payload excede o limite de 64 KB.", "PAYLOAD_TOO_LARGE");
    }
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new HttpError(400, "Corpo JSON deve ser um objeto.", "INVALID_JSON");
    }
    return parsed;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(400, "JSON malformado.", "INVALID_JSON");
  }
}

export function serveStaticFile(res, webRoot, urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return sendJson(res, 400, { error: "Caminho inválido." });
  }

  const cleanRel = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  if (cleanRel.includes("..") || cleanRel.includes("\0")) {
    return sendJson(res, 403, { error: "Acesso negado." });
  }

  const resolvedRoot = path.resolve(webRoot);
  const target = path.resolve(resolvedRoot, cleanRel);
  if (target !== resolvedRoot && !target.startsWith(resolvedRoot + path.sep)) {
    return sendJson(res, 403, { error: "Acesso negado." });
  }

  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    return sendJson(res, 404, { error: "Arquivo não encontrado." });
  }

  const ext = path.extname(target).toLowerCase();
  const contentType = MIME_TYPES[ext] ?? "application/octet-stream";
  res.writeHead(200, {
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff"
  });
  fs.createReadStream(target).pipe(res);
}
