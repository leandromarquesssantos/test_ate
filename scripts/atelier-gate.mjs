#!/usr/bin/env node
/**
 * Atelier Quality Gate ("Laws, Not Vibes")
 * Valida regras determinísticas do repositório:
 * 1. Limite máximo de linhas por arquivo em src/ (anti-monólito)
 * 2. Isolamento de camada: packages/core não pode importar api/cli/web/mobile
 * 3. Integridade de artefatos de specs em docs/specs/REQ-*
 * 4. Execução da suíte de testes (quando --with-tests for passado)
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT = process.cwd();
const MAX_LINES = 220;
const args = new Set(process.argv.slice(2));
const withTests = args.has("--with-tests");
const specPhaseOnly = args.has("--spec-only");

const errors = [];
const checks = [];

function walkFiles(dir, predicate, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist") {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, predicate, results);
    } else if (predicate(full)) {
      results.push(full);
    }
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
              `${req.name}: ${pending.length} tarefa(s) ainda não concluída(s) (${pending.map((t) => t.id).join(", ")}).`
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
  const packagesDir = path.join(ROOT, "packages");
  const srcFiles = walkFiles(
    packagesDir,
    (f) => f.includes(`${path.sep}src${path.sep}`) && /\.(mjs|js|ts|jsx|tsx|css)$/.test(f)
  );

  for (const file of srcFiles) {
    const content = fs.readFileSync(file, "utf8");
    const lines = content.split(/\r?\n/).length;
    const rel = path.relative(ROOT, file);

    if (lines > MAX_LINES) {
      errors.push(`Lei anti-monólito violada: ${rel} tem ${lines} linhas (máximo ${MAX_LINES}).`);
    }

    if (rel.startsWith(`packages${path.sep}core${path.sep}`)) {
      const forbidden = /from\s+['"].*(packages\/(api|cli|web|mobile)|@fin\/(api|cli|web|mobile))/;
      if (forbidden.test(content)) {
        errors.push(`Lei de isolamento violada em ${rel}: core não pode importar outras camadas.`);
      }
    }
  }
  checks.push(`Leis de código verificadas em ${srcFiles.length} arquivo(s) de src/.`);
}

function runTests() {
  if (!withTests) return;
  try {
    execSync("node --test packages/*/test/*.test.mjs", { stdio: "inherit", cwd: ROOT });
    checks.push("Suíte de testes automatizados passou 100%.");
  } catch {
    errors.push("Falha na execução dos testes automatizados.");
  }
}

checkSpecs();
if (!specPhaseOnly) {
  checkSourceLaws();
  runTests();
}

console.log("\n=== Atelier Quality Gate ===");
for (const c of checks) console.log(`  [OK] ${c}`);

if (errors.length > 0) {
  console.error("\nViolações encontradas:");
  for (const e of errors) console.error(`  [FAIL] ${e}`);
  process.exit(1);
}

console.log("\nGate APROVADO (0 violações).\n");
