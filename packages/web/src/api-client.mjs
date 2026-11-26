export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatBRL(cents) {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, "0");
  return `${sign}R$ ${String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${frac}`;
}

export function centsToInput(cents) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function buildQuery(params = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      qs.set(k, String(v).trim());
    }
  }
  const str = qs.toString();
  return str ? `?${str}` : "";
}

async function request(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Falha na requisição.");
  return data;
}

export const apiClient = {
  getSummary: (month) => request(`/api/summary${buildQuery({ month })}`),
  listTransactions: (filters) => request(`/api/transactions${buildQuery(filters)}`),
  addTransaction: (payload) =>
    request("/api/transactions", { method: "POST", body: JSON.stringify(payload) }),
  updateTransaction: (id, payload) =>
    request(`/api/transactions/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  deleteTransaction: (id) =>
    request(`/api/transactions/${encodeURIComponent(id)}`, { method: "DELETE" }),
  setBudget: (payload) =>
    request("/api/budgets", { method: "PUT", body: JSON.stringify(payload) }),
  deleteBudget: (month, category) =>
    request(`/api/budgets${buildQuery({ month, category })}`, { method: "DELETE" }),
  listAccounts: () => request("/api/accounts"),
  addAccount: (payload) =>
    request("/api/accounts", { method: "POST", body: JSON.stringify(payload) }),
  deleteAccount: (id) =>
    request(`/api/accounts/${encodeURIComponent(id)}`, { method: "DELETE" }),
  addTransfer: (payload) =>
    request("/api/transfers", { method: "POST", body: JSON.stringify(payload) }),
  listRecurring: () => request("/api/recurring"),
  addRecurring: (payload) =>
    request("/api/recurring", { method: "POST", body: JSON.stringify(payload) }),
  deleteRecurring: (id) =>
    request(`/api/recurring/${encodeURIComponent(id)}`, { method: "DELETE" }),
  applyRecurring: (month) =>
    request("/api/recurring/apply", { method: "POST", body: JSON.stringify({ month }) }),
  exportCsvUrl: (filters) => `/api/export/csv${buildQuery(filters)}`
};
