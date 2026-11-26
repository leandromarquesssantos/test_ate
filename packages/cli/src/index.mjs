import path from "node:path";
import { JsonFileStore, LedgerService } from "../../core/src/index.mjs";
import { runCli } from "./commands.mjs";

const dataFile = path.resolve(process.env.DATA_FILE ?? "data/ledger.json");
const ledger = new LedgerService(new JsonFileStore(dataFile));

try {
  const output = runCli(process.argv.slice(2), ledger);
  console.log(output);
} catch (err) {
  console.error(`Erro: ${err.message}`);
  process.exit(1);
}
