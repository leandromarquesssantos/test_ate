import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { escapeHtml, formatBRL } from "../src/api-client.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("RF-07: escapeHtml neutraliza payloads XSS no WebApp", () => {
  const malicious = '<script>alert("xss")</script>&\'';
  assert.equal(
    escapeHtml(malicious),
    "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;&amp;&#39;"
  );
  assert.equal(formatBRL(123456), "R$ 1.234,56");
});

test("RF-07: assets essenciais do WebApp existem e referenciam módulos corretamente", () => {
  const html = fs.readFileSync(path.resolve(__dirname, "../src/index.html"), "utf8");
  assert.match(html, /href="\/styles\.css"/);
  assert.match(html, /src="\/app\.mjs"/);
  assert.match(html, /id="tx-form"/);
  assert.match(html, /id="budget-form"/);
});
