import crypto from "node:crypto";
import { NotFoundError, ValidationError, assertPositiveCents } from "./money.mjs";
import { ensureAccountExists } from "./accounts.mjs";
import {
  DEFAULT_ACCOUNT_ID,
  VALID_TYPES,
  normalizeCategory,
  resolveDateForMonth,
  validateDayOfMonth,
  validateMonth
} from "./validation.mjs";

export function addRecurringInState(
  state,
  { type, amountCents, category, description = "", dayOfMonth, accountId }
) {
  if (!VALID_TYPES.has(type)) {
    throw new ValidationError('Tipo recorrente inválido. Use "income" ou "expense".');
  }
  const validAmount = assertPositiveCents(amountCents, "amountCents");
  const validCategory = normalizeCategory(category);
  const validDay = validateDayOfMonth(dayOfMonth);
  const account = ensureAccountExists(state, accountId ?? DEFAULT_ACCOUNT_ID);
  const cleanDescription = String(description ?? "").trim().slice(0, 140);

  const rule = {
    id: `rec_${crypto.randomBytes(5).toString("hex")}`,
    type,
    amountCents: validAmount,
    category: validCategory,
    description: cleanDescription,
    dayOfMonth: validDay,
    accountId: account.id
  };
  state.recurring.push(rule);
  return rule;
}

export function removeRecurringFromState(state, id) {
  if (typeof id !== "string" || !id.trim()) {
    throw new ValidationError("ID da recorrência é obrigatório.");
  }
  const idx = state.recurring.findIndex((r) => r.id === id.trim());
  if (idx === -1) {
    throw new NotFoundError(`Recorrência não encontrada: "${id}".`);
  }
  const [removed] = state.recurring.splice(idx, 1);
  return removed;
}

export function applyRecurringInState(state, monthStr) {
  const validMonth = validateMonth(monthStr);
  const created = [];
  let skippedCount = 0;

  for (const rule of state.recurring) {
    const alreadyExists = state.transactions.some(
      (tx) => tx.recurringRuleId === rule.id && tx.date.startsWith(validMonth)
    );
    if (alreadyExists) {
      skippedCount += 1;
      continue;
    }

    const tx = {
      id: `tx_${crypto.randomBytes(6).toString("hex")}`,
      type: rule.type,
      amountCents: rule.amountCents,
      category: rule.category,
      description: rule.description,
      date: resolveDateForMonth(validMonth, rule.dayOfMonth),
      accountId: rule.accountId ?? DEFAULT_ACCOUNT_ID,
      toAccountId: null,
      recurringRuleId: rule.id,
      createdAt: new Date().toISOString()
    };
    state.transactions.push(tx);
    created.push(tx);
  }

  return {
    month: validMonth,
    createdCount: created.length,
    skippedCount,
    created
  };
}
