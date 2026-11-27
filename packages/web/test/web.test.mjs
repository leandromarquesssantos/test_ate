import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { centsToInput, escapeHtml, formatBRL } from "../src/api-client.mjs";
import { renderTransactionsHtml } from "../src/render.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("RF-06: escapeHtml neutraliza XSS e renderTransactionsHtml protege campos dinâmicos", () => {
  const malicious = '<script>alert("xss")</script>&\'';
  assert.equal(
    escapeHtml(malicious),
    "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;&amp;&#39;"
  );
  assert.equal(formatBRL(123456), "R$ 1.234,56");
  assert.equal(centsToInput(4990), "49,90");

  const html = renderTransactionsHtml(
    [
      {
        id: "tx_1",
        type: "expense",
        category: "<b>cat</b>",
        description: "<img src=x onerror=alert(1)>",
        date: "2026-11-26",
        accountId: "acc_default",
        amountCents: 1000
      }
    ],
    new Map([["acc_default", "Conta Principal"]])
  );
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /data-edit-id="tx_1"/);
});

test("RF-06: assets essenciais do WebApp REQ-002 existem e contêm controles esperados", () => {
  const html = fs.readFileSync(path.resolve(__dirname, "../src/index.html"), "utf8");
  assert.match(html, /href="\/styles\.css"/);
  assert.match(html, /href="\/components\.css"/);
  assert.match(html, /id="export-csv-btn"/);
  assert.match(html, /id="filter-q"/);
  assert.match(html, /id="account-form"/);
  assert.match(html, /id="transfer-form"/);
  assert.match(html, /id="recurring-form"/);
  assert.match(html, /id="auth-form"/);
  assert.match(html, /id="logout-btn"/);

  const css = fs.readFileSync(path.resolve(__dirname, "../src/components.css"), "utf8");
  assert.match(css, /\.hidden\s*\{\s*display:\s*none\s*!important;/);
});
