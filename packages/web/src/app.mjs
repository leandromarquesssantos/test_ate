import { apiClient, escapeHtml, formatBRL } from "./api-client.mjs";

const monthInput = document.getElementById("month-input");
const txForm = document.getElementById("tx-form");
const budgetForm = document.getElementById("budget-form");
const banner = document.getElementById("status-banner");
const kpiBalance = document.getElementById("kpi-balance");
const kpiIncome = document.getElementById("kpi-income");
const kpiExpense = document.getElementById("kpi-expense");
const budgetsList = document.getElementById("budgets-list");
const txList = document.getElementById("tx-list");
const txCount = document.getElementById("tx-count");

const now = new Date();
const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
const todayLocal = `${defaultMonth}-${String(now.getDate()).padStart(2, "0")}`;
monthInput.value = defaultMonth;
txForm.elements.date.value = todayLocal;

function showMessage(text, isError = false) {
  banner.textContent = text;
  banner.classList.remove("hidden", "error");
  if (isError) banner.classList.add("error");
}

function renderBudgets(budgets) {
  if (!budgets.length) {
    budgetsList.innerHTML = '<p class="muted">Nenhum orçamento definido para este mês.</p>';
    return;
  }

  budgetsList.innerHTML = budgets
    .map((b) => {
      const width = Math.min(b.percentUsed, 100);
      const cls = b.status === "ok" ? "" : escapeHtml(b.status);
      return `
        <div class="budget-item">
          <div class="budget-meta">
            <strong>${escapeHtml(b.category)}</strong>
            <span>${formatBRL(b.spentCents)} / ${formatBRL(b.limitCents)} (${b.percentUsed}%)</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill ${cls}" style="width:${width}%"></div>
          </div>
        </div>`;
    })
    .join("");
}

function renderTransactions(items) {
  txCount.textContent = `${items.length} lançamento(s)`;
  if (!items.length) {
    txList.innerHTML = '<p class="muted">Nenhuma transação registrada neste mês.</p>';
    return;
  }

  txList.innerHTML = items
    .map((tx) => {
      const sign = tx.type === "income" ? "+" : "-";
      const desc = tx.description ? ` · ${escapeHtml(tx.description)}` : "";
      return `
        <div class="tx-item">
          <div>
            <strong>${escapeHtml(tx.category)}</strong>${desc}
            <div class="muted">${escapeHtml(tx.date)}</div>
          </div>
          <div class="tx-right">
            <span class="tx-amount ${escapeHtml(tx.type)}">${sign}${formatBRL(tx.amountCents)}</span>
            <button type="button" class="btn-danger" data-delete-id="${escapeHtml(tx.id)}">Excluir</button>
          </div>
        </div>`;
    })
    .join("");
}

async function refresh() {
  const month = monthInput.value || defaultMonth;
  try {
    const [summary, txData] = await Promise.all([
      apiClient.getSummary(month),
      apiClient.listTransactions(month)
    ]);
    kpiBalance.textContent = formatBRL(summary.balanceCents);
    kpiIncome.textContent = formatBRL(summary.totalIncomeCents);
    kpiExpense.textContent = formatBRL(summary.totalExpenseCents);
    renderBudgets(summary.budgets);
    renderTransactions(txData.items);
  } catch (err) {
    showMessage(err.message, true);
  }
}

txForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = new FormData(txForm);
  try {
    await apiClient.addTransaction({
      type: data.get("type"),
      amount: data.get("amount"),
      category: data.get("category"),
      description: data.get("description"),
      date: data.get("date")
    });
    txForm.elements.amount.value = "";
    txForm.elements.description.value = "";
    showMessage("Transação adicionada com sucesso.");
    await refresh();
  } catch (err) {
    showMessage(err.message, true);
  }
});

budgetForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = new FormData(budgetForm);
  try {
    await apiClient.setBudget({
      month: monthInput.value || defaultMonth,
      category: data.get("category"),
      limit: data.get("limit")
    });
    budgetForm.reset();
    showMessage("Orçamento mensal atualizado.");
    await refresh();
  } catch (err) {
    showMessage(err.message, true);
  }
});

txList.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-delete-id]");
  if (!btn) return;
  try {
    await apiClient.deleteTransaction(btn.dataset.deleteId);
    showMessage("Transação removida.");
    await refresh();
  } catch (err) {
    showMessage(err.message, true);
  }
});

monthInput.addEventListener("change", refresh);
refresh();
