#!/usr/bin/env node
/**
 * Atelier Lean Quality Gate ("Laws, Not Vibes") — Go + WebApp
 * Regras determinísticas com saída enxuta (token-efficient: silencioso no sucesso, dump completo apenas em falha):
 * 1. Integridade de artefatos em docs/specs/REQ-* (aceita review.md legado ou release-audit.md consolidado)
 * 2. Anti-monólito: meta <= 220 linhas (WARN em 221..250, FAIL > 250) em arquivos de produção
 * 3. Isolamento de domínio: backend/internal/domain deve usar apenas stdlib pura
 * 4. gofmt, go vet ./..., go test -count=1 ./..., testes WebApp e (em release) QA E2E headless
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT = process.cwd();
const BACKEND_DIR = path.join(ROOT, "backend");
const SOFT_MAX_LINES = 220;
const HARD_MAX_LINES = 250;
const args = new Set(process.argv.slice(2));
const withTests = args.has("--with-tests");
const withQA = args.has("--with-qa");
const specPhaseOnly = args.has("--spec-only");
const verbose = args.has("--verbose");

const errors = [];
const warnings = [];
const checks = [];

function resolveGoBinary() {
  for (const bin of ["go", "C:\\Program Files\\Go\\bin\\go.exe"]) {
    try {
      execSync(`"${bin}" version`, { stdio: "ignore" });
      return bin;
    } catch {
      // try next
    }
  }
  return "go";
}

function runStep(cmd, cwd, okMessage, failMessage) {
  try {
    const out = execSync(cmd, {
      cwd,
      encoding: "utf8",
      stdio: verbose ? "inherit" : ["ignore", "pipe", "pipe"]
    });
    checks.push(okMessage(out || ""));
  } catch (err) {
    const stdout = err.stdout ? String(err.stdout).trim() : "";
    const stderr = err.stderr ? String(err.stderr).trim() : "";
    const detail = [stdout, stderr].filter(Boolean).join("\n");
    errors.push(detail ? `${failMessage}\n${detail}` : `${failMessage}: ${err.message}`);
  }
}

function walkFiles(dir, predicate, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".git", "dist", "bin"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, predicate, results);
    else if (predicate(full)) results.push(full);
  }
  return results;
}

function checkSpecs() {
  const specsDir = path.join(ROOT, "docs", "specs");
  if (!fs.existsSync(specsDir)) {
    errors.push("Diretório docs/specs não encontrado.");
    return;
  }
  const reqDirs = fs
    .readdirSync(specsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^REQ-\d{3}/.test(d.name));

  if (reqDirs.length === 0) {
    errors.push("Nenhuma especificação REQ-XXX encontrada em docs/specs/.");
    return;
  }

  for (const req of reqDirs) {
    const reqPath = path.join(specsDir, req.name);
    for (const required of ["spec.md", "plan.md", "tasks.json"]) {
      if (!fs.existsSync(path.join(reqPath, required))) {
        errors.push(`${req.name}: artefato obrigatório ausente (${required}).`);
      }
    }
    const tasksFile = path.join(reqPath, "tasks.json");
    if (!fs.existsSync(tasksFile)) continue;

    try {
      const parsed = JSON.parse(fs.readFileSync(tasksFile, "utf8"));
      if (!Array.isArray(parsed.tasks) || parsed.tasks.length === 0) {
        errors.push(`${req.name}/tasks.json deve conter um array não vazio 'tasks'.`);
        continue;
      }
      if (!specPhaseOnly) {
        const pending = parsed.tasks.filter((t) => t.status !== "done");
        if (pending.length > 0) {
          errors.push(`${req.name}: ${pending.length} tarefa(s) pendente(s) (${pending.map((t) => t.id).join(", ")}).`);
        }
        const hasAudit =
          fs.existsSync(path.join(reqPath, "release-audit.md")) ||
          fs.existsSync(path.join(reqPath, "review.md"));
        if (!hasAudit) {
          errors.push(`${req.name}: release-audit.md (ou review.md) obrigatório para concluir a REQ.`);
        }
      }
    } catch (err) {
      errors.push(`${req.name}/tasks.json inválido: ${err.message}`);
    }
  }
  checks.push(`Specs: ${reqDirs.length} REQ(s) íntegras.`);
}

function checkSourceLaws() {
  const webFiles = walkFiles(
    path.join(ROOT, "packages"),
    (f) => f.includes(`${path.sep}src${path.sep}`) && /\.(mjs|js|ts|css)$/.test(f)
  );
  const goFiles = walkFiles(BACKEND_DIR, (f) => f.endsWith(".go") && !f.endsWith("_test.go"));
  const allFiles = [...webFiles, ...goFiles];

  for (const file of allFiles) {
    const content = fs.readFileSync(file, "utf8");
    const lines = content.split(/\r?\n/).length;
    const rel = path.relative(ROOT, file).replace(/\\/g, "/");

    if (lines > HARD_MAX_LINES) {
      errors.push(`Lei anti-monólito violada: ${rel} tem ${lines} linhas (limite rígido ${HARD_MAX_LINES}).`);
    } else if (lines > SOFT_MAX_LINES) {
      warnings.push(`${rel} tem ${lines} linhas (acima da meta ideal de ${SOFT_MAX_LINES}; limite rígido ${HARD_MAX_LINES}).`);
    }

    if (rel.startsWith("backend/internal/domain/")) {
      const forbidden = /"(database\/sql|net\/http|atelier-fin\/backend\/internal\/(store|httpapi|cli)|modernc\.org\/sqlite)"/;
      if (forbidden.test(content)) {
        errors.push(`Lei de isolamento violada em ${rel}: domain deve usar apenas stdlib pura.`);
      }
    }
  }
  checks.push(`Leis de código: ${allFiles.length} arquivos (${goFiles.length} Go + ${webFiles.length} Web).`);
}

function runChecksAndTests() {
  if (!withTests) return;
  const goBin = resolveGoBinary();

  runStep(
    `"${goBin}" fmt ./...`,
    BACKEND_DIR,
    (out) => (out.trim() ? `gofmt formatou: ${out.trim().replace(/\r?\n/g, ", ")}` : "gofmt limpo."),
    "Falha no gofmt"
  );
  runStep(`"${goBin}" vet ./...`, BACKEND_DIR, () => "go vet OK.", "Falha no go vet ./...");
  runStep(
    `"${goBin}" test -count=1 ./...`,
    BACKEND_DIR,
    (out) => `Testes Go OK (${out.trim().split(/\r?\n/).filter(Boolean).length} pacotes sem cache).`,
    "Falha nos testes Go"
  );
  runStep("node --test packages/web/test/*.test.mjs", ROOT, () => "Testes WebApp OK.", "Falha nos testes do WebApp");

  if (withQA) {
    runStep(
      "node scripts/qa-e2e.mjs",
      ROOT,
      (out) => {
        const passCount = (out.match(/\[PASS\]/g) || []).length;
        return `QA E2E headless OK (${passCount} cenários).`;
      },
      "Falha na suíte QA E2E de release"
    );
  }
}

checkSpecs();
if (!specPhaseOnly) {
  checkSourceLaws();
  runChecksAndTests();
}

console.log("=== Atelier Lean Gate ===");
for (const c of checks) console.log(`  [OK] ${c}`);
for (const w of warnings) console.warn(`  [WARN] ${w}`);

if (errors.length > 0) {
  console.error("\nViolações encontradas:");
  for (const e of errors) console.error(`  [FAIL] ${e}`);
  process.exit(1);
}
console.log("Gate APROVADO (0 violações).");
