export class ValidationError extends Error {
  constructor(message, code = "VALIDATION_ERROR") {
    super(message);
    this.name = "ValidationError";
    this.code = code;
  }
}

export class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "NotFoundError";
    this.code = "NOT_FOUND";
  }
}

export function assertPositiveCents(value, fieldName = "amountCents") {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new ValidationError(`${fieldName} deve ser um inteiro positivo em centavos.`);
  }
  return value;
}

/**
 * Converte string ou número em reais (ex: "49.90", "49,90", "1.250,50", 100)
 * para centavos inteiros sem aritmética binária imprecisa.
 */
export function parseCurrencyToCents(input) {
  if (typeof input === "number") {
    if (!Number.isFinite(input) || input <= 0) {
      throw new ValidationError("Valor monetário deve ser maior que zero.");
    }
    return assertPositiveCents(Math.round(input * 100), "amount");
  }

  if (typeof input !== "string") {
    throw new ValidationError("Valor monetário inválido.");
  }

  let normalized = input.trim().replace(/^R\$\s*/i, "").replace(/\s+/g, "");
  if (!normalized) {
    throw new ValidationError("Valor monetário vazio.");
  }

  if (normalized.includes(",") && normalized.includes(".")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (normalized.includes(",")) {
    normalized = normalized.replace(",", ".");
  }

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new ValidationError(`Formato monetário inválido: "${input}".`);
  }

  const [wholePart, fracPart = ""] = normalized.split(".");
  const cents = Number(wholePart) * 100 + Number(fracPart.padEnd(2, "0"));
  return assertPositiveCents(cents, "amount");
}

export function formatCentsBRL(cents) {
  if (!Number.isSafeInteger(cents)) {
    throw new ValidationError("Valor em centavos inválido para formatação.");
  }
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, "0");
  const wholeFormatted = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}R$ ${wholeFormatted},${frac}`;
}
