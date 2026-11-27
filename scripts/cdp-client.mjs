import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

export function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

export function findBrowserBinary() {
  const candidates = [
    process.env.QA_BROWSER_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  ].filter(Boolean);

  for (const bin of candidates) {
    if (fs.existsSync(bin)) return bin;
  }
  throw new Error("Nenhum navegador Chromium (Chrome/Edge/Chromium) encontrado para QA E2E.");
}

async function waitForJson(url, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`Timeout aguardando ${url}`);
}

export async function launchCDPBrowser() {
  const bin = findBrowserBinary();
  const debugPort = await findFreePort();
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "atelier-qa-browser-"));

  const proc = spawn(
    bin,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--no-first-run",
      "--no-default-browser-check",
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${profileDir}`,
      "about:blank"
    ],
    { stdio: "ignore" }
  );

  const targets = await waitForJson(`http://127.0.0.1:${debugPort}/json/list`, 12000);
  const pageTarget = targets.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
  if (!pageTarget) {
    proc.kill();
    throw new Error("Target de página CDP não encontrado.");
  }

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });

  let nextId = 1;
  const pending = new Map();
  const pageErrors = [];

  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
      return;
    }
    if (msg.method === "Runtime.exceptionThrown") {
      pageErrors.push(`JS Exception: ${msg.params?.exceptionDetails?.text ?? "unknown"}`);
    } else if (msg.method === "Runtime.consoleAPICalled" && msg.params?.type === "error") {
      const text = (msg.params.args ?? []).map((a) => a.value ?? a.description ?? "").join(" ");
      pageErrors.push(`Console Error: ${text}`);
    }
  });

  function send(method, params = {}) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await send("Page.enable");
  await send("Runtime.enable");

  async function evalExpr(expression) {
    const res = await send("Runtime.evaluate", {
      expression: `(async () => { ${expression} })()`,
      awaitPromise: true,
      returnByValue: true
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval falhou: ${res.exceptionDetails.text}`);
    }
    return res.result?.value;
  }

  async function waitFor(predicateExpr, label, timeoutMs = 8000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const ok = await evalExpr(`return Boolean(${predicateExpr});`);
      if (ok) return;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error(`Timeout aguardando condição E2E: ${label}`);
  }

  async function navigate(url) {
    await send("Page.navigate", { url });
    await waitFor(`document.readyState === "complete"`, `load ${url}`);
  }

  async function close() {
    try { ws.close(); } catch { /* ignore */ }
    try { proc.kill(); } catch { /* ignore */ }
    await new Promise((r) => setTimeout(r, 250));
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }

  return { navigate, evalExpr, waitFor, pageErrors, close };
}
