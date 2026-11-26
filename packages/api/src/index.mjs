import path from "node:path";
import { JsonFileStore, LedgerService } from "../../core/src/index.mjs";
import { createAppServer } from "./server.mjs";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "127.0.0.1";
const dataFile = path.resolve(process.env.DATA_FILE ?? "data/ledger.json");

const ledger = new LedgerService(new JsonFileStore(dataFile));
const server = createAppServer({ ledger });

server.listen(port, host, () => {
  console.log(`Atelier Fin rodando em http://${host}:${port}`);
  console.log(`Ledger JSON: ${dataFile}`);
});
