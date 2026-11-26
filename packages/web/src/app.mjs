import { apiClient, centsToInput, formatBRL } from "./api-client.mjs";
import {
  renderAccountsHtml,
  renderBudgetsHtml,
  renderRecurringHtml,
  renderTransactionsHtml,
  syncAccountSelects
} from "./render.mjs";
import { bindSecondaryHandlers } from "./handlers.mjs";

const $ = (id) => document.getElementById(id);
const monthInput = $("month-input");
const txForm = $("tx-form");
const filterQ = $("filter-q");
const filterType = $("filter-type");
const filterAccount = $("filter-account");
const banner = $("status-banner");

const now = new Date();
const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
const todayLocal = `${defaultMonth}-${String(now.getDate()).padStart(2, "0")}`;
monthInput.value = defaultMonth;
txForm.elements.date.value = todayLocal;

let lastItems = [];

function showMessage(text, isError = false) {
  banner.textContent = text;
  banner.classList.remove("hidden", "error");
  if (isError) banner.classList.add("error");
}

function getMonth() {
  return monthInput.value || defaultMonth;
}

function currentFilters() {
  return {
    month: getMonth(),
    q: filterQ.value,
    type: filterType.value,
    accountId: filterAccount.value
  };
}

function resetTxForm() {
  txForm.elements.editId.value = "";
  txForm.elements.amount.value = "";
  txForm.elements.description.value = "";
  txForm.elements.date.value = todayLocal;
  $("tx-form-title").textContent = "Novo Lançamento";
  $("tx-submit-btn").textContent = "Adicionar transação";
  $("cancel-edit-btn").classList.add("hidden");
}

function startEdit(tx) {
  txForm.elements.editId.value = tx.id;
  txForm.elements.type.value = tx.type;
  txForm.elements.amount.value = centsToInput(tx.amountCents);
  txForm.elements.category.value = tx.category;
  txForm.elements.accountId.value = tx.accountId;
  txForm.elements.date.value = tx.date;
  txForm.elements.description.value = tx.description ?? "";
  $("tx-form-title").textContent = `Editando (${tx.id})`;
  $("tx-submit-btn").textContent = "Salvar alterações";
  $("cancel-edit-btn").classList.remove("hidden");
  txForm.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function refresh() {
  const filters = currentFilters();
  try {
    const [summary, txData, recData] = await Promise.all([
      apiClient.getSummary(filters.month),
      apiClient.listTransactions(filters),
      apiClient.listRecurring()
    ]);
    lastItems = txData.items;
    const accMap = new Map(summary.accounts.map((a) => [a.id, a.name]));
    syncAccountSelects(summary.accounts, filterAccount);

    $("kpi-balance").textContent = formatBRL(summary.balanceCents);
    $("kpi-income").textContent = formatBRL(summary.totalIncomeCents);
    $("kpi-expense").textContent = formatBRL(summary.totalExpenseCents);
    $("accounts-list").innerHTML = renderAccountsHtml(summary.accounts);
    $("budgets-list").innerHTML = renderBudgetsHtml(summary.budgets);
    $("recurring-list").innerHTML = renderRecurringHtml(recData.items, accMap);
    $("tx-count").textContent = `${txData.items.length} lançamento(s)`;
    $("tx-list").innerHTML = renderTransactionsHtml(txData.items, accMap);
  } catch (err) {
    showMessage(err.message, true);
  }
}

async function runAction(fn, okMsg) {
  try {
    const result = await fn();
    if (okMsg) showMessage(typeof okMsg === "function" ? okMsg(result) : okMsg);
    await refresh();
  } catch (err) {
    showMessage(err.message, true);
  }
}

txForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const data = new FormData(txForm);
  const editId = String(data.get("editId") ?? "").trim();
  const payload = {
    type: data.get("type"),
    amount: data.get("amount"),
    category: data.get("category"),
    accountId: data.get("accountId"),
    date: data.get("date"),
    description: data.get("description")
  };
  runAction(
    async () => {
      if (editId) await apiClient.updateTransaction(editId, payload);
      else await apiClient.addTransaction(payload);
      resetTxForm();
    },
    editId ? "Transação atualizada." : "Transação adicionada."
  );
});

$("cancel-edit-btn").addEventListener("click", resetTxForm);

$("tx-list").addEventListener("click", (e) => {
  const editBtn = e.target.closest("[data-edit-id]");
  if (editBtn) {
    const tx = lastItems.find((i) => i.id === editBtn.dataset.editId);
    if (tx) startEdit(tx);
    return;
  }
  const delBtn = e.target.closest("[data-delete-id]");
  if (delBtn) {
    runAction(() => apiClient.deleteTransaction(delBtn.dataset.deleteId), "Transação removida.");
  }
});

bindSecondaryHandlers({ $, getMonth, todayLocal, currentFilters, runAction });
[monthInput, filterQ, filterType, filterAccount].forEach((el) =>
  el.addEventListener("input", refresh)
);
refresh();
