import { apiClient } from "./api-client.mjs";

export function bindSecondaryHandlers({ $, getMonth, todayLocal, currentFilters, runAction }) {
  $("budget-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    runAction(async () => {
      await apiClient.setBudget({
        month: getMonth(),
        category: data.get("category"),
        limit: data.get("limit")
      });
      form.reset();
    }, "Orçamento mensal salvo.");
  });

  $("account-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    runAction(async () => {
      await apiClient.addAccount({ name: data.get("name"), type: data.get("type") });
      form.reset();
    }, "Conta criada.");
  });

  $("transfer-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    runAction(async () => {
      await apiClient.addTransfer({
        fromAccountId: data.get("fromAccountId"),
        toAccountId: data.get("toAccountId"),
        amount: data.get("amount"),
        date: todayLocal
      });
      form.elements.amount.value = "";
    }, "Transferência registrada.");
  });

  $("recurring-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    runAction(async () => {
      await apiClient.addRecurring({
        type: data.get("type"),
        amount: data.get("amount"),
        category: data.get("category"),
        description: data.get("description"),
        dayOfMonth: Number(data.get("dayOfMonth")),
        accountId: data.get("accountId")
      });
      form.reset();
    }, "Regra recorrente adicionada.");
  });

  $("apply-recurring-btn").addEventListener("click", () =>
    runAction(
      () => apiClient.applyRecurring(getMonth()),
      (res) => `Recorrências aplicadas: ${res.createdCount} criada(s), ${res.skippedCount} já existente(s).`
    )
  );

  $("export-csv-btn").addEventListener("click", () => {
    window.location.href = apiClient.exportCsvUrl(currentFilters());
  });

  $("budgets-list").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-delete-budget]");
    if (btn) {
      runAction(
        () => apiClient.deleteBudget(getMonth(), btn.dataset.deleteBudget),
        "Orçamento removido."
      );
    }
  });

  $("accounts-list").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-delete-account]");
    if (btn) runAction(() => apiClient.deleteAccount(btn.dataset.deleteAccount), "Conta removida.");
  });

  $("recurring-list").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-delete-recurring]");
    if (btn) {
      runAction(
        () => apiClient.deleteRecurring(btn.dataset.deleteRecurring),
        "Recorrência removida."
      );
    }
  });
}
