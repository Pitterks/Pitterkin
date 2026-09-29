import "dotenv/config";
import { cryptoConfig } from "../src/lib/payments/crypto/config";
import { jsonRpcClient } from "../src/lib/payments/crypto/rpc";
import { scanDeposits } from "../src/lib/payments/crypto/scanner";

// Long-running alternative to the cron route: `npm run watcher`
const cfg = cryptoConfig();
if (!cfg) { console.error("CRYPTO_XPUB is not set"); process.exit(1); }
const rpc = jsonRpcClient(cfg.rpcUrl);
const every = Number(process.env.CRYPTO_POLL_MS ?? 15_000);

async function tick() {
  try {
    const r = await scanDeposits(rpc, cfg!);
    if (r.newTransfers || r.paid) console.log(new Date().toISOString(), r);
  } catch (e) {
    console.error("scan failed:", (e as Error).message);
  }
}
console.log(`watching ${cfg.chainName} (${cfg.chainId}) every ${every}ms`);
void tick();
setInterval(tick, every);
