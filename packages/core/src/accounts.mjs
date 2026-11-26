import crypto from "node:crypto";
import { NotFoundError, ValidationError } from "./money.mjs";
import {
  DEFAULT_ACCOUNT_ID,
  VALID_ACCOUNT_TYPES,
  normalizeAccountName
} from "./validation.mjs";

export function ensureAccountExists(state, accountId) {
  const id = accountId ?? DEFAULT_ACCOUNT_ID;
  const found = state.accounts.find((a) => a.id === id);
  if (!found) {
    throw new NotFoundError(`Conta não encontrada: "${id}".`);
  }
  return found;
}

export function listAccountsWithBalances(state) {
  const balances = new Map(state.accounts.map((a) => [a.id, 0]));

  for (const tx of state.transactions) {
    const accId = tx.accountId ?? DEFAULT_ACCOUNT_ID;
    if (tx.type === "income") {
      balances.set(accId, (balances.get(accId) ?? 0) + tx.amountCents);
    } else if (tx.type === "expense") {
      balances.set(accId, (balances.get(accId) ?? 0) - tx.amountCents);
    } else if (tx.type === "transfer") {
      balances.set(accId, (balances.get(accId) ?? 0) - tx.amountCents);
      if (tx.toAccountId) {
        balances.set(
          tx.toAccountId,
          (balances.get(tx.toAccountId) ?? 0) + tx.amountCents
        );
      }
    }
  }

  return state.accounts.map((a) => ({
    ...a,
    balanceCents: balances.get(a.id) ?? 0
  }));
}

export function createAccountInState(state, { name, type = "checking" }) {
  const cleanName = normalizeAccountName(name);
  if (!VALID_ACCOUNT_TYPES.has(type)) {
    throw new ValidationError(
      'Tipo de conta inválido. Use "checking", "cash", "savings" ou "credit".'
    );
  }
  const duplicate = state.accounts.some(
    (a) => a.name.toLowerCase() === cleanName.toLowerCase()
  );
  if (duplicate) {
    throw new ValidationError(`Já existe uma conta chamada "${cleanName}".`);
  }

  const account = {
    id: `acc_${crypto.randomBytes(5).toString("hex")}`,
    name: cleanName,
    type
  };
  state.accounts.push(account);
  return account;
}

export function removeAccountFromState(state, id) {
  if (typeof id !== "string" || !id.trim()) {
    throw new ValidationError("ID da conta é obrigatório.");
  }
  const index = state.accounts.findIndex((a) => a.id === id.trim());
  if (index === -1) {
    throw new NotFoundError(`Conta não encontrada: "${id}".`);
  }
  if (state.accounts.length <= 1) {
    throw new ValidationError("Não é possível remover a única conta existente.");
  }

  const targetId = state.accounts[index].id;
  const inUseTx = state.transactions.some(
    (tx) => (tx.accountId ?? DEFAULT_ACCOUNT_ID) === targetId || tx.toAccountId === targetId
  );
  const inUseRec = state.recurring.some(
    (r) => (r.accountId ?? DEFAULT_ACCOUNT_ID) === targetId
  );
  if (inUseTx || inUseRec) {
    throw new ValidationError(
      "Não é possível remover conta com transações ou recorrências vinculadas."
    );
  }

  const [removed] = state.accounts.splice(index, 1);
  return removed;
}
