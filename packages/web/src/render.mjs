import { escapeHtml, formatBRL } from "./api-client.mjs";

export function renderAccountsHtml(accounts) {
  return accounts
    .map((acc) => {
      const canDelete = accounts.length > 1;
      const delBtn = canDelete
        ? `<button type="button" class="btn-danger" data-delete-account="${escapeHtml(acc.id)}">x</button>`
        : "";
      return `
        <div class="account-pill">
          <div>
            <strong>${escapeHtml(acc.name)}</strong>
            <span class="muted">${formatBRL(acc.balanceCents)}</span>
          </div>
          ${delBtn}
        </div>`;
    })
    .join("");
}

export function renderBudgetsHtml(budgets) {
  if (!budgets.length) {
    return '<p class="muted">Nenhum orçamento definido para este mês.</p>';
  }
  return budgets
    .map((b) => {
      const width = Math.min(b.percentUsed, 100);
      const cls = b.status === "ok" ? "" : escapeHtml(b.status);
      return `
        <div class="budget-item">
          <div class="budget-meta">
            <strong>${escapeHtml(b.category)}</strong>
            <span>
              ${formatBRL(b.spentCents)} / ${formatBRL(b.limitCents)} (${b.percentUsed}%)
              <button type="button" class="btn-danger" data-delete-budget="${escapeHtml(b.category)}">x</button>
            </span>
          </div>
          <div class="bar-track"><div class="bar-fill ${cls}" style="width:${width}%"></div></div>
        </div>`;
    })
    .join("");
}

export function renderRecurringHtml(rules, accountNameById) {
  if (!rules.length) {
    return '<p class="muted">Nenhuma regra recorrente cadastrada.</p>';
  }
  return rules
    .map((r) => {
      const acc = accountNameById.get(r.accountId) ?? r.accountId;
      const desc = r.description ? ` · ${escapeHtml(r.description)}` : "";
      return `
        <div class="tx-item">
          <div>
            <strong>Dia ${r.dayOfMonth} · ${escapeHtml(r.category)}</strong>${desc}
            <div class="muted">${escapeHtml(acc)}</div>
          </div>
          <div class="tx-right">
            <span class="tx-amount ${escapeHtml(r.type)}">${formatBRL(r.amountCents)}</span>
            <button type="button" class="btn-danger" data-delete-recurring="${escapeHtml(r.id)}">Excluir</button>
          </div>
        </div>`;
    })
    .join("");
}

export function renderTransactionsHtml(items, accountNameById) {
  if (!items.length) {
    return '<p class="muted">Nenhuma transação encontrada para os filtros atuais.</p>';
  }
  return items
    .map((tx) => {
      const sign = tx.type === "income" ? "+" : tx.type === "transfer" ? "⇄ " : "-";
      const desc = tx.description ? ` · ${escapeHtml(tx.description)}` : "";
      const accName = accountNameById.get(tx.accountId) ?? tx.accountId;
      const route = tx.toAccountId
        ? `${escapeHtml(accName)} → ${escapeHtml(accountNameById.get(tx.toAccountId) ?? tx.toAccountId)}`
        : escapeHtml(accName);
      const editBtn =
        tx.type !== "transfer"
          ? `<button type="button" class="btn-ghost" data-edit-id="${escapeHtml(tx.id)}">Editar</button>`
          : "";
      return `
        <div class="tx-item">
          <div>
            <strong>${escapeHtml(tx.category)}</strong>${desc}
            <div class="muted">${escapeHtml(tx.date)} · ${route}</div>
          </div>
          <div class="tx-right">
            <span class="tx-amount ${escapeHtml(tx.type)}">${sign}${formatBRL(tx.amountCents)}</span>
            ${editBtn}
            <button type="button" class="btn-danger" data-delete-id="${escapeHtml(tx.id)}">Excluir</button>
          </div>
        </div>`;
    })
    .join("");
}

export function syncAccountSelects(accounts, filterSelect) {
  const optionsHtml = accounts
    .map((a) => `<option value="${escapeHtml(a.id)}">${escapeHtml(a.name)}</option>`)
    .join("");
  document.querySelectorAll("[data-account-select]").forEach((sel) => {
    const prev = sel.value;
    sel.innerHTML = optionsHtml;
    if (prev && accounts.some((a) => a.id === prev)) {
      sel.value = prev;
    } else if (sel.name === "toAccountId" && accounts.length > 1) {
      sel.value = accounts[1].id;
    }
  });
  const prevFilter = filterSelect.value;
  filterSelect.innerHTML = `<option value="">Todas as contas</option>${optionsHtml}`;
  if (prevFilter && accounts.some((a) => a.id === prevFilter)) filterSelect.value = prevFilter;
}
