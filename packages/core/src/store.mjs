import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DEFAULT_ACCOUNT_ID } from "./validation.mjs";

const DEFAULT_ACCOUNT = () => ({
  id: DEFAULT_ACCOUNT_ID,
  name: "Conta Principal",
  type: "checking"
});

export function normalizeState(raw = {}) {
  const accounts =
    Array.isArray(raw.accounts) && raw.accounts.length > 0
      ? raw.accounts
      : [DEFAULT_ACCOUNT()];

  return {
    version: 2,
    accounts,
    transactions: Array.isArray(raw.transactions) ? raw.transactions : [],
    budgets: Array.isArray(raw.budgets) ? raw.budgets : [],
    recurring: Array.isArray(raw.recurring) ? raw.recurring : []
  };
}

export class MemoryStore {
  constructor(initialState = {}) {
    this.state = normalizeState(structuredClone(initialState));
  }

  read() {
    return normalizeState(structuredClone(this.state));
  }

  write(nextState) {
    this.state = normalizeState(structuredClone(nextState));
  }
}

export class JsonFileStore {
  constructor(filePath) {
    if (!filePath || typeof filePath !== "string") {
      throw new Error("filePath obrigatório para JsonFileStore.");
    }
    this.filePath = path.resolve(filePath);
  }

  read() {
    if (!fs.existsSync(this.filePath)) {
      return normalizeState();
    }
    const raw = fs.readFileSync(this.filePath, "utf8").trim();
    if (!raw) {
      return normalizeState();
    }
    return normalizeState(JSON.parse(raw));
  }

  write(nextState) {
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });
    const nonce = crypto.randomBytes(6).toString("hex");
    const tmpPath = `${this.filePath}.${process.pid}.${nonce}.tmp`;
    const payload = JSON.stringify(normalizeState(nextState), null, 2) + "\n";
    fs.writeFileSync(tmpPath, payload, "utf8");
    fs.renameSync(tmpPath, this.filePath);
  }
}
