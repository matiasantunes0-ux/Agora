// Runs one full scan locally with mock data: no keys, no network, no cost.
//   cd backend && npm run demo

import { runScan } from "../supabase/functions/_shared/pipeline/run.ts";
import { MemoryStore } from "../supabase/functions/_shared/pipeline/store.ts";
import { createMockAdapter } from "../supabase/functions/_shared/adapters/mock.ts";
import { rulesClassifier } from "../supabase/functions/_shared/classify/rules.ts";
import { consoleNotifier } from "../supabase/functions/_shared/notify/expoPush.ts";

const store = new MemoryStore(["ENB", "META", "STN.TO", "NVDA", "AAPL"]);
for (const t of store.tickers) store.pushTokens.set(t, ["ExponentPushToken[demo-device]"]);

const report = await runScan({
  store,
  adapters: [createMockAdapter()],
  classifier: rulesClassifier,
  notifier: consoleNotifier,
  log: (m) => console.log(`  log: ${m}`),
});

console.log(`\nWatched: ${report.tickers.join(", ")}`);
console.log(`Fetched ${report.eventsFetched} events → ${report.eventsAfterPrefilter} after prefilter → ${store.clusters.size} stories`);
console.log(`Classified ${report.clustersClassified} stories → ${report.alerts.length} alerts\n`);

for (const a of report.alerts) {
  console.log(`${a.kind === "opportunity" ? "🟢 OPPORTUNITY" : "🔴 THREAT     "}  ${a.ticker.padEnd(7)} ${a.headline}`);
  console.log(`   ${a.whyItMatters}`);
  for (const s of a.sources) console.log(`   ↳ ${s.publisher}: ${s.url}`);
  console.log();
}
console.log("Informational only, not investment advice.");
