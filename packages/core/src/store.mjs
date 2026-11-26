import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const EMPTY_STATE = () => ({
  version: 1,
  transactions: [],
  budgets: []
});

export class MemoryStore {
  constructor(initialState = EMPTY_STATE()) {
    this.state = structuredClone(initialState);
  }

  read() {
    return structuredClone(this.state);
  }

  write(nextState) {
    this.state = structuredClone(nextState);
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
      return EMPTY_STATE();
    }
    const raw = fs.readFileSync(this.filePath, "utf8").trim();
    if (!raw) {
      return EMPTY_STATE();
    }
    const parsed = JSON.parse(raw);
    return {
      version: parsed.version ?? 1,
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      budgets: Array.isArray(parsed.budgets) ? parsed.budgets : []
    };
  }

  write(nextState) {
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });
    const nonce = crypto.randomBytes(6).toString("hex");
    const tmpPath = `${this.filePath}.${process.pid}.${nonce}.tmp`;
    const payload = JSON.stringify(nextState, null, 2) + "\n";
    fs.writeFileSync(tmpPath, payload, "utf8");
    fs.renameSync(tmpPath, this.filePath);
  }
}
