#!/usr/bin/env node
/**
 * Seed idempotente de desenvolvimento para o Atelier Fin.
 * Cria um usuário admin (padrão: admin@atelier.local / admin1234)
 * e popula contas, transações, transferências, orçamentos e recorrências
 * caso o usuário ainda não possua transações.
 */

import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();
const BACKEND_DIR = path.join(ROOT, "backend");

const ADMIN_NAME = process.env.SEED_ADMIN_NAME || "Admin";
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || "admin@atelier.local";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "admin1234";

function resolveGoBinary() {
  for (const bin of ["go", "C:\\Program Files\\Go\\bin\\go.exe"]) {
    try {
      execFileSync(bin, ["version"], { stdio: "ignore" });
      return bin;
    } catch {
      // try next
    }
  }
  throw new Error("Binário 'go' não encontrado no PATH.");
}

const GO_BIN = resolveGoBinary();

function runCli(args, { allowFail = false } = {}) {
  try {
    return execFileSync(GO_BIN, ["run", "./cmd/fin-cli", ...args], {
      cwd: BACKEND_DIR,
      encoding: "utf8"
    }).trim();
  } catch (err) {
    if (allowFail) return null;
    throw new Error(err.stderr?.toString() || err.message);
  }
}

function nowMonthAndDay(day) {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return { month: `${y}-${m}`, date: `${y}-${m}-${String(day).padStart(2, "0")}` };
}

console.log(`Executando seed para ${ADMIN_NAME} <${ADMIN_EMAIL}>...`);

const regOut = runCli(
  ["users", "register", "--name", ADMIN_NAME, "--email", ADMIN_EMAIL, "--password", ADMIN_PASSWORD],
  { allowFail: true }
);
if (regOut) {
  console.log(`  [OK] ${regOut}`);
} else {
  console.log(`  [INFO] Usuário ${ADMIN_EMAIL} já existe — reaproveitando.`);
}

const existingList = runCli(["list", "--user", ADMIN_EMAIL]);
if (existingList !== "Nenhuma transação encontrada.") {
  console.log("  [INFO] Usuário já possui transações. Seed ignorado (idempotente).");
  process.exit(0);
}

const accountsRaw = runCli(["accounts", "list", "--user", ADMIN_EMAIL]);
const mainAccMatch = accountsRaw.match(/(acc_[a-f0-9]+)/);
if (!mainAccMatch) throw new Error("Conta principal não encontrada.");
const mainAccId = mainAccMatch[1];

const walletOut = runCli(["accounts", "add", "--name", "Carteira", "--type", "cash", "--user", ADMIN_EMAIL]);
const walletId = walletOut.match(/(acc_[a-f0-9]+)/)[1];

const savingsOut = runCli(["accounts", "add", "--name", "Reserva", "--type", "savings", "--user", ADMIN_EMAIL]);
const savingsId = savingsOut.match(/(acc_[a-f0-9]+)/)[1];

const { month } = nowMonthAndDay(1);

const txs = [
  ["income", "6500,00", "salario", "Salário mensal", 1],
  ["expense", "1800,00", "moradia", "Aluguel apartamento", 5],
  ["expense", "850,00", "alimentacao", "Supermercado do mês", 7],
  ["expense", "120,00", "alimentacao", "Almoço com equipe", 11],
  ["expense", "240,00", "transporte", "Combustível e metrô", 12],
  ["expense", "360,00", "lazer", "Cinema e jantar", 15]
];

for (const [type, amount, category, desc, day] of txs) {
  const { date } = nowMonthAndDay(day);
  runCli([
    "add", "--type", type, "--amount", amount, "--category", category,
    "--desc", desc, "--date", date, "--account", mainAccId, "--user", ADMIN_EMAIL
  ]);
}

runCli([
  "transfer", "--from", mainAccId, "--to", walletId, "--amount", "400,00",
  "--desc", "Saque para gastos diários", "--date", nowMonthAndDay(6).date, "--user", ADMIN_EMAIL
]);
runCli([
  "transfer", "--from", mainAccId, "--to", savingsId, "--amount", "1000,00",
  "--desc", "Aporte mensal reserva", "--date", nowMonthAndDay(8).date, "--user", ADMIN_EMAIL
]);

for (const [category, limit] of [["moradia", "2500,00"], ["alimentacao", "1100,00"], ["lazer", "300,00"]]) {
  runCli(["budget", "--month", month, "--category", category, "--limit", limit, "--user", ADMIN_EMAIL]);
}

runCli([
  "recurring", "add", "--type", "expense", "--amount", "129,90",
  "--category", "assinaturas", "--desc", "Internet Fibra", "--day", "10", "--user", ADMIN_EMAIL
]);
runCli([
  "recurring", "add", "--type", "expense", "--amount", "119,00",
  "--category", "saude", "--desc", "Academia", "--day", "15", "--user", ADMIN_EMAIL
]);

console.log("\nSeed concluído com sucesso!");
console.log(runCli(["summary", "--month", month, "--user", ADMIN_EMAIL]));
console.log(`\nCredenciais dev -> E-mail: ${ADMIN_EMAIL} | Senha: ${ADMIN_PASSWORD}`);
