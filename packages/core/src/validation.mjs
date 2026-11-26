import { ValidationError } from "./money.mjs";

export const DEFAULT_ACCOUNT_ID = "acc_default";
export const VALID_TYPES = new Set(["income", "expense"]);
export const VALID_ALL_TYPES = new Set(["income", "expense", "transfer"]);
export const VALID_ACCOUNT_TYPES = new Set(["checking", "cash", "savings", "credit"]);

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_RE = /^(\d{4})-(\d{2})$/;

export function normalizeCategory(category) {
  if (typeof category !== "string" || !category.trim()) {
    throw new ValidationError("Categoria é obrigatória.");
  }
  return category.trim().toLowerCase().slice(0, 40);
}

export function normalizeAccountName(name) {
  if (typeof name !== "string" || !name.trim()) {
    throw new ValidationError("Nome da conta é obrigatório.");
  }
  return name.trim().slice(0, 50);
}

export function validateDate(dateStr) {
  if (typeof dateStr !== "string") {
    throw new ValidationError("Data deve estar no formato YYYY-MM-DD.");
  }
  const match = DATE_RE.exec(dateStr.trim());
  if (!match) {
    throw new ValidationError("Data deve estar no formato YYYY-MM-DD.");
  }
  const [, y, m, d] = match.map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const valid =
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d;
  if (!valid) {
    throw new ValidationError(`Data de calendário inválida: "${dateStr}".`);
  }
  return dateStr.trim();
}

export function validateMonth(monthStr) {
  if (typeof monthStr !== "string") {
    throw new ValidationError("Mês deve estar no formato YYYY-MM.");
  }
  const match = MONTH_RE.exec(monthStr.trim());
  if (!match) {
    throw new ValidationError("Mês deve estar no formato YYYY-MM.");
  }
  const monthNum = Number(match[2]);
  if (monthNum < 1 || monthNum > 12) {
    throw new ValidationError(`Mês inválido: "${monthStr}".`);
  }
  return monthStr.trim();
}

export function validateDayOfMonth(day) {
  const num = Number(day);
  if (!Number.isInteger(num) || num < 1 || num > 31) {
    throw new ValidationError("dayOfMonth deve ser um inteiro entre 1 e 31.");
  }
  return num;
}

export function resolveDateForMonth(monthStr, dayOfMonth) {
  const validMonth = validateMonth(monthStr);
  const day = validateDayOfMonth(dayOfMonth);
  const [y, m] = validMonth.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const clamped = Math.min(day, lastDay);
  return `${validMonth}-${String(clamped).padStart(2, "0")}`;
}

export function currentMonthISO(now = new Date()) {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function todayISO(now = new Date()) {
  return now.toISOString().slice(0, 10);
}
