#!/usr/bin/env node
/**
 * Atelier Quality Gate ("Laws, Not Vibes") — Go + WebApp
 * Valida regras determinísticas do repositório:
 * 1. Integridade de artefatos de specs em docs/specs/REQ-*
 * 2. Limite máximo de linhas (<= 220) em arquivos de produção (.go, .mjs, .js, .css)
 * 3. Isolamento de domínio: backend/internal/domain não pode importar store/httpapi/cli/database/sql/net/http
 * 4. gofmt, go vet ./..., go test ./... e testes do WebApp
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT = process.cwd();
const BACKEND_DIR = path.join(ROOT, "backend");
const MAX_LINES = 220;
const args = new Set(process.argv.slice(2));
const withTests = args.has("--with-tests");
const withQA = args.has("--with-qa");
const specPhaseOnly = args.has("--spec-only");

const errors = [];
const checks = [];

function resolveGoBinary() {
  const candidates = ["go", "C:\\Program Files\\Go\\bin\\go.exe"];
  for (const bin of candidates) {
    try {
      execSync(`"${bin}" version`, { stdio: "ignore" });
      return bin;
    } catch {
      // try next
    }
  }
  return "go";
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
    if (fs.existsSync(tasksFile)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(tasksFile, "utf8"));
        if (!Array.isArray(parsed.tasks) || parsed.tasks.length === 0) {
          errors.push(`${req.name}/tasks.json deve conter um array não vazio 'tasks'.`);
        } else if (!specPhaseOnly) {
          const pending = parsed.tasks.filter((t) => t.status !== "done");
          if (pending.length > 0) {
            errors.push(
              `${req.name}: ${pending.length} tarefa(s) pendente(s) (${pending.map((t) => t.id).join(", ")}).`
            );
          }
          if (!fs.existsSync(path.join(reqPath, "review.md"))) {
            errors.push(`${req.name}: review.md obrigatório para concluir a REQ.`);
          }
        }
      } catch (err) {
        errors.push(`${req.name}/tasks.json inválido: ${err.message}`);
      }
    }
  }
  checks.push(`Specs verificadas: ${reqDirs.length} REQ(s) encontrada(s).`);
}

function checkSourceLaws() {
  const webFiles = walkFiles(
    path.join(ROOT, "packages"),
    (f) => f.includes(`${path.sep}src${path.sep}`) && /\.(mjs|js|ts|css)$/.test(f)
  );
  const goFiles = walkFiles(
    BACKEND_DIR,
    (f) => f.endsWith(".go") && !f.endsWith("_test.go")
  );
  const allFiles = [...webFiles, ...goFiles];

  for (const file of allFiles) {
    const content = fs.readFileSync(file, "utf8");
    const lines = content.split(/\r?\n/).length;
    const rel = path.relative(ROOT, file);

    if (lines > MAX_LINES) {
      errors.push(`Lei anti-monólito violada: ${rel} tem ${lines} linhas (máximo ${MAX_LINES}).`);
    }

    const normalized = rel.replace(/\\/g, "/");
    if (normalized.startsWith("backend/internal/domain/")) {
      const forbidden = /"(database\/sql|net\/http|atelier-fin\/backend\/internal\/(store|httpapi|cli)|modernc\.org\/sqlite)"/;
      if (forbidden.test(content)) {
        errors.push(`Lei de isolamento violada em ${rel}: domain deve usar apenas stdlib pura.`);
      }
    }
  }
  checks.push(`Leis de código verificadas em ${allFiles.length} arquivo(s) (${goFiles.length} Go + ${webFiles.length} Web).`);
}

function runChecksAndTests() {
  if (!withTests) return;
  const goBin = resolveGoBinary();

  try {
    const unformatted = execSync(`"${goBin}" fmt ./...`, { cwd: BACKEND_DIR, encoding: "utf8" }).trim();
    if (unformatted) {
      checks.push(`gofmt normalizou arquivo(s): ${unformatted.replace(/\r?\n/g, ", ")}`);
    } else {
      checks.push("gofmt limpo.");
    }
  } catch (err) {
    errors.push(`Falha no gofmt: ${err.message}`);
  }

  try {
    execSync(`"${goBin}" vet ./...`, { stdio: "inherit", cwd: BACKEND_DIR });
    checks.push("go vet ./... passou sem avisos.");
  } catch {
    errors.push("Falha no go vet ./... .");
  }

  try {
    execSync(`"${goBin}" test -v ./...`, { stdio: "inherit", cwd: BACKEND_DIR });
    checks.push("Suíte de testes Go passou 100%.");
  } catch {
    errors.push("Falha nos testes Go.");
  }

  try {
    execSync("node --test packages/web/test/*.test.mjs", { stdio: "inherit", cwd: ROOT });
    checks.push("Suíte de testes WebApp passou 100%.");
  } catch {
    errors.push("Falha nos testes do WebApp.");
  }

  if (withQA) {
    try {
      execSync("node scripts/qa-e2e.mjs", { stdio: "inherit", cwd: ROOT });
      checks.push("Suíte QA E2E (navegador real headless) passou 100%.");
    } catch {
      errors.push("Falha na suíte QA E2E de release.");
    }
  }
}

checkSpecs();
if (!specPhaseOnly) {
  checkSourceLaws();
  runChecksAndTests();
}

console.log("\n=== Atelier Quality Gate ===");
for (const c of checks) console.log(`  [OK] ${c}`);

if (errors.length > 0) {
  console.error("\nViolações encontradas:");
  for (const e of errors) console.error(`  [FAIL] ${e}`);
  process.exit(1);
}

console.log("\nGate APROVADO (0 violações).\n");
