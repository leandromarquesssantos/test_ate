import crypto from "node:crypto";
import { NotFoundError, ValidationError, assertPositiveCents } from "./money.mjs";

const VALID_TYPES = new Set(["income", "expense"]);
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_RE = /^(\d{4})-(\d{2})$/;

export function normalizeCategory(category) {
  if (typeof category !== "string" || !category.trim()) {
    throw new ValidationError("Categoria é obrigatória.");
  }
  return category.trim().toLowerCase().slice(0, 40);
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

export function currentMonthISO(now = new Date()) {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function todayISO(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export class LedgerService {
  constructor(store) {
    this.store = store;
  }

  addTransaction({ type, amountCents, category, description = "", date }) {
    if (!VALID_TYPES.has(type)) {
      throw new ValidationError('Tipo inválido. Use "income" ou "expense".');
    }
    const validAmount = assertPositiveCents(amountCents, "amountCents");
    const validCategory = normalizeCategory(category);
    const validDate = validateDate(date ?? todayISO());
    const cleanDescription = String(description ?? "").trim().slice(0, 140);

    const tx = {
      id: `tx_${crypto.randomBytes(6).toString("hex")}`,
      type,
      amountCents: validAmount,
      category: validCategory,
      description: cleanDescription,
      date: validDate,
      createdAt: new Date().toISOString()
    };

    const state = this.store.read();
    state.transactions.push(tx);
    this.store.write(state);
    return tx;
  }

  listTransactions({ month, category, type } = {}) {
    const validMonth = month ? validateMonth(month) : null;
    const validCategory = category ? normalizeCategory(category) : null;
    if (type && !VALID_TYPES.has(type)) {
      throw new ValidationError('Tipo inválido. Use "income" ou "expense".');
    }

    const { transactions } = this.store.read();
    return transactions
      .filter((tx) => {
        if (validMonth && !tx.date.startsWith(validMonth)) return false;
        if (validCategory && tx.category !== validCategory) return false;
        if (type && tx.type !== type) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return b.createdAt.localeCompare(a.createdAt);
      });
  }

  deleteTransaction(id) {
    if (typeof id !== "string" || !id.trim()) {
      throw new ValidationError("ID da transação é obrigatório.");
    }
    const state = this.store.read();
    const index = state.transactions.findIndex((tx) => tx.id === id.trim());
    if (index === -1) {
      throw new NotFoundError(`Transação não encontrada: "${id}".`);
    }
    const [removed] = state.transactions.splice(index, 1);
    this.store.write(state);
    return removed;
  }

  setBudget({ month, category, limitCents }) {
    const validMonth = validateMonth(month ?? currentMonthISO());
    const validCategory = normalizeCategory(category);
    const validLimit = assertPositiveCents(limitCents, "limitCents");

    const state = this.store.read();
    const existing = state.budgets.find(
      (b) => b.month === validMonth && b.category === validCategory
    );
    if (existing) {
      existing.limitCents = validLimit;
    } else {
      state.budgets.push({
        month: validMonth,
        category: validCategory,
        limitCents: validLimit
      });
    }
    this.store.write(state);
    return { month: validMonth, category: validCategory, limitCents: validLimit };
  }

  listBudgets({ month } = {}) {
    const validMonth = month ? validateMonth(month) : null;
    const { budgets } = this.store.read();
    return budgets
      .filter((b) => !validMonth || b.month === validMonth)
      .sort((a, b) => a.category.localeCompare(b.category));
  }

  getMonthlySummary(month = currentMonthISO()) {
    const validMonth = validateMonth(month);
    const transactions = this.listTransactions({ month: validMonth });
    const budgets = this.listBudgets({ month: validMonth });

    let totalIncomeCents = 0;
    let totalExpenseCents = 0;
    const expenseByCategory = new Map();

    for (const tx of transactions) {
      if (tx.type === "income") {
        totalIncomeCents += tx.amountCents;
      } else {
        totalExpenseCents += tx.amountCents;
        expenseByCategory.set(
          tx.category,
          (expenseByCategory.get(tx.category) ?? 0) + tx.amountCents
        );
      }
    }

    const budgetStatus = budgets.map((b) => {
      const spentCents = expenseByCategory.get(b.category) ?? 0;
      const percentUsed = Math.round((spentCents / b.limitCents) * 100);
      const status =
        spentCents > b.limitCents
          ? "exceeded"
          : percentUsed >= 80
            ? "warning"
            : "ok";
      return {
        category: b.category,
        limitCents: b.limitCents,
        spentCents,
        remainingCents: b.limitCents - spentCents,
        percentUsed,
        status
      };
    });

    const categories = Array.from(expenseByCategory.entries())
      .map(([category, spentCents]) => ({ category, spentCents }))
      .sort((a, b) => b.spentCents - a.spentCents);

    return {
      month: validMonth,
      transactionCount: transactions.length,
      totalIncomeCents,
      totalExpenseCents,
      balanceCents: totalIncomeCents - totalExpenseCents,
      categories,
      budgets: budgetStatus
    };
  }
}
