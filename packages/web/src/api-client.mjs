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

async function request(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Falha na requisição.");
  }
  return data;
}

export const apiClient = {
  getSummary: (month) => request(`/api/summary?month=${encodeURIComponent(month)}`),
  listTransactions: (month) =>
    request(`/api/transactions?month=${encodeURIComponent(month)}`),
  addTransaction: (payload) =>
    request("/api/transactions", { method: "POST", body: JSON.stringify(payload) }),
  deleteTransaction: (id) =>
    request(`/api/transactions/${encodeURIComponent(id)}`, { method: "DELETE" }),
  setBudget: (payload) =>
    request("/api/budgets", { method: "PUT", body: JSON.stringify(payload) })
};
