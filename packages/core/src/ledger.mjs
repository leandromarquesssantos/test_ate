import crypto from "node:crypto";
import { NotFoundError, ValidationError, assertPositiveCents } from "./money.mjs";
import {
  createAccountInState,
  ensureAccountExists,
  listAccountsWithBalances,
  removeAccountFromState
} from "./accounts.mjs";
import {
  addRecurringInState,
  applyRecurringInState,
  removeRecurringFromState
} from "./recurring.mjs";
import {
  buildMonthlySummary,
  deleteBudgetInState,
  listBudgetsInState,
  setBudgetInState
} from "./summary.mjs";
import { transactionsToCsv } from "./export.mjs";
import {
  DEFAULT_ACCOUNT_ID,
  VALID_ALL_TYPES,
  VALID_TYPES,
  currentMonthISO,
  normalizeCategory,
  todayISO,
  validateDate,
  validateMonth
} from "./validation.mjs";

export class LedgerService {
  constructor(store) {
    this.store = store;
  }

  addTransaction({ type, amountCents, category, description = "", date, accountId }) {
    if (!VALID_TYPES.has(type)) {
      throw new ValidationError('Tipo inválido. Use "income" ou "expense".');
    }
    const state = this.store.read();
    const account = ensureAccountExists(state, accountId ?? DEFAULT_ACCOUNT_ID);
    const tx = {
      id: `tx_${crypto.randomBytes(6).toString("hex")}`,
      type,
      amountCents: assertPositiveCents(amountCents, "amountCents"),
      category: normalizeCategory(category),
      description: String(description ?? "").trim().slice(0, 140),
      date: validateDate(date ?? todayISO()),
      accountId: account.id,
      toAccountId: null,
      recurringRuleId: null,
      createdAt: new Date().toISOString()
    };
    state.transactions.push(tx);
    this.store.write(state);
    return tx;
  }

  addTransfer({ fromAccountId, toAccountId, amountCents, description = "", date }) {
    const state = this.store.read();
    const fromAcc = ensureAccountExists(state, fromAccountId);
    const toAcc = ensureAccountExists(state, toAccountId);
    if (fromAcc.id === toAcc.id) {
      throw new ValidationError("Conta de origem e destino devem ser diferentes.");
    }
    const tx = {
      id: `tx_${crypto.randomBytes(6).toString("hex")}`,
      type: "transfer",
      amountCents: assertPositiveCents(amountCents, "amountCents"),
      category: "transferencia",
      description: String(description ?? "").trim().slice(0, 140),
      date: validateDate(date ?? todayISO()),
      accountId: fromAcc.id,
      toAccountId: toAcc.id,
      recurringRuleId: null,
      createdAt: new Date().toISOString()
    };
    state.transactions.push(tx);
    this.store.write(state);
    return tx;
  }

  updateTransaction(id, patch = {}) {
    if (typeof id !== "string" || !id.trim()) {
      throw new ValidationError("ID da transação é obrigatório.");
    }
    const state = this.store.read();
    const tx = state.transactions.find((t) => t.id === id.trim());
    if (!tx) throw new NotFoundError(`Transação não encontrada: "${id}".`);

    if (patch.type !== undefined) {
      if (tx.type === "transfer" || !VALID_TYPES.has(patch.type)) {
        throw new ValidationError('Tipo inválido para edição. Use "income" ou "expense".');
      }
      tx.type = patch.type;
    }
    if (patch.amountCents !== undefined) {
      tx.amountCents = assertPositiveCents(patch.amountCents, "amountCents");
    }
    if (patch.category !== undefined) tx.category = normalizeCategory(patch.category);
    if (patch.description !== undefined) {
      tx.description = String(patch.description ?? "").trim().slice(0, 140);
    }
    if (patch.date !== undefined) tx.date = validateDate(patch.date);
    if (patch.accountId !== undefined) {
      const nextAccId = ensureAccountExists(state, patch.accountId).id;
      if (tx.type === "transfer" && tx.toAccountId === nextAccId) {
        throw new ValidationError("Conta de origem e destino devem ser diferentes.");
      }
      tx.accountId = nextAccId;
    }
    this.store.write(state);
    return tx;
  }

  listTransactions({ month, category, type, accountId, q } = {}) {
    const validMonth = month ? validateMonth(month) : null;
    const validCategory = category ? normalizeCategory(category) : null;
    if (type && !VALID_ALL_TYPES.has(type)) {
      throw new ValidationError('Tipo inválido. Use "income", "expense" ou "transfer".');
    }
    const query = q ? String(q).trim().toLowerCase() : null;

    return this.store
      .read()
      .transactions.map((tx) => ({ ...tx, accountId: tx.accountId ?? DEFAULT_ACCOUNT_ID }))
      .filter((tx) => {
        if (validMonth && !tx.date.startsWith(validMonth)) return false;
        if (validCategory && tx.category !== validCategory) return false;
        if (type && tx.type !== type) return false;
        if (accountId && tx.accountId !== accountId && tx.toAccountId !== accountId) {
          return false;
        }
        if (query && !`${tx.category} ${tx.description ?? ""}`.toLowerCase().includes(query)) {
          return false;
        }
        return true;
      })
      .sort((a, b) =>
        a.date !== b.date ? b.date.localeCompare(a.date) : b.createdAt.localeCompare(a.createdAt)
      );
  }

  deleteTransaction(id) {
    if (typeof id !== "string" || !id.trim()) {
      throw new ValidationError("ID da transação é obrigatório.");
    }
    const state = this.store.read();
    const idx = state.transactions.findIndex((tx) => tx.id === id.trim());
    if (idx === -1) throw new NotFoundError(`Transação não encontrada: "${id}".`);
    const [removed] = state.transactions.splice(idx, 1);
    this.store.write(state);
    return removed;
  }

  setBudget(input) {
    const state = this.store.read();
    const saved = setBudgetInState(state, input);
    this.store.write(state);
    return saved;
  }
  deleteBudget(input) {
    const state = this.store.read();
    const removed = deleteBudgetInState(state, input);
    this.store.write(state);
    return removed;
  }
  listBudgets(filter) { return listBudgetsInState(this.store.read(), filter); }

  listAccounts() { return listAccountsWithBalances(this.store.read()); }
  addAccount(input) {
    const state = this.store.read();
    const acc = createAccountInState(state, input);
    this.store.write(state);
    return acc;
  }
  deleteAccount(id) {
    const state = this.store.read();
    const removed = removeAccountFromState(state, id);
    this.store.write(state);
    return removed;
  }

  listRecurring() { return this.store.read().recurring; }
  addRecurring(input) {
    const state = this.store.read();
    const rule = addRecurringInState(state, input);
    this.store.write(state);
    return rule;
  }
  deleteRecurring(id) {
    const state = this.store.read();
    const removed = removeRecurringFromState(state, id);
    this.store.write(state);
    return removed;
  }
  applyRecurring(month = currentMonthISO()) {
    const state = this.store.read();
    const result = applyRecurringInState(state, month);
    if (result.createdCount > 0) this.store.write(state);
    return result;
  }

  exportCsv(filters = {}) {
    return transactionsToCsv(this.listTransactions(filters), this.store.read().accounts);
  }
  getMonthlySummary(month = currentMonthISO()) {
    const validMonth = validateMonth(month);
    return buildMonthlySummary(this.store.read(), this.listTransactions({ month: validMonth }), validMonth);
  }
}
