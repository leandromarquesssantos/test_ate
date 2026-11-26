import { NotFoundError, assertPositiveCents } from "./money.mjs";
import { listAccountsWithBalances } from "./accounts.mjs";
import { currentMonthISO, normalizeCategory, validateMonth } from "./validation.mjs";

export function setBudgetInState(state, { month, category, limitCents }) {
  const validMonth = validateMonth(month ?? currentMonthISO());
  const validCategory = normalizeCategory(category);
  const validLimit = assertPositiveCents(limitCents, "limitCents");
  const existing = state.budgets.find(
    (b) => b.month === validMonth && b.category === validCategory
  );
  if (existing) existing.limitCents = validLimit;
  else state.budgets.push({ month: validMonth, category: validCategory, limitCents: validLimit });
  return { month: validMonth, category: validCategory, limitCents: validLimit };
}

export function deleteBudgetInState(state, { month, category }) {
  const validMonth = validateMonth(month ?? currentMonthISO());
  const validCategory = normalizeCategory(category);
  const idx = state.budgets.findIndex(
    (b) => b.month === validMonth && b.category === validCategory
  );
  if (idx === -1) {
    throw new NotFoundError(`Orçamento não encontrado: ${validMonth}/${validCategory}.`);
  }
  const [removed] = state.budgets.splice(idx, 1);
  return removed;
}

export function listBudgetsInState(state, { month } = {}) {
  const validMonth = month ? validateMonth(month) : null;
  return state.budgets
    .filter((b) => !validMonth || b.month === validMonth)
    .sort((a, b) => a.category.localeCompare(b.category));
}

export function buildMonthlySummary(state, monthTransactions, month) {
  const validMonth = validateMonth(month ?? currentMonthISO());
  const budgets = listBudgetsInState(state, { month: validMonth });
  let totalIncomeCents = 0;
  let totalExpenseCents = 0;
  const byCat = new Map();

  for (const tx of monthTransactions) {
    if (tx.type === "income") {
      totalIncomeCents += tx.amountCents;
    } else if (tx.type === "expense") {
      totalExpenseCents += tx.amountCents;
      byCat.set(tx.category, (byCat.get(tx.category) ?? 0) + tx.amountCents);
    }
  }

  const budgetStatus = budgets.map((b) => {
    const spentCents = byCat.get(b.category) ?? 0;
    const percentUsed = Math.round((spentCents / b.limitCents) * 100);
    const status =
      spentCents > b.limitCents ? "exceeded" : percentUsed >= 80 ? "warning" : "ok";
    return {
      category: b.category,
      limitCents: b.limitCents,
      spentCents,
      remainingCents: b.limitCents - spentCents,
      percentUsed,
      status
    };
  });

  return {
    month: validMonth,
    transactionCount: monthTransactions.length,
    totalIncomeCents,
    totalExpenseCents,
    balanceCents: totalIncomeCents - totalExpenseCents,
    categories: Array.from(byCat.entries())
      .map(([category, spentCents]) => ({ category, spentCents }))
      .sort((a, b) => b.spentCents - a.spentCents),
    budgets: budgetStatus,
    accounts: listAccountsWithBalances(state)
  };
}
