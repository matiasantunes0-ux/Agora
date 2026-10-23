import { test } from "node:test";
import assert from "node:assert/strict";
import { runScan } from "../supabase/functions/_shared/pipeline/run.ts";
import { MemoryStore } from "../supabase/functions/_shared/pipeline/store.ts";
import type { Notifier } from "../supabase/functions/_shared/pipeline/store.ts";
import { createMockAdapter } from "../supabase/functions/_shared/adapters/mock.ts";
import { rulesClassifier } from "../supabase/functions/_shared/classify/rules.ts";
import { ClassifierUnavailable } from "../supabase/functions/_shared/classify/errors.ts";
import type { Alert, Classifier, SourceAdapter } from "../supabase/functions/_shared/types.ts";

const NOW = new Date("2026-10-21T15:00:00.000Z");
const silent: Notifier = { notify: async () => {} };

function deps(store: MemoryStore, extra: Partial<Parameters<typeof runScan>[0]> = {}) {
  return { store, adapters: [createMockAdapter(() => NOW)], classifier: rulesClassifier, notifier: silent, now: () => NOW, ...extra };
}

test("mock scan: duplicates collapse, routine news is ignored, every alert has a source", async () => {
  const store = new MemoryStore(["ENB", "META", "STN.TO", "NVDA", "AAPL"]);
  const report = await runScan(deps(store));

  const byTicker = Object.fromEntries(report.alerts.map((a) => [a.ticker, a]));
  assert.equal(report.alerts.length, 4);
  // 3 outlets → 1 ENB alert
  assert.equal(report.alerts.filter((a) => a.ticker === "ENB").length, 1);
  assert.equal(byTicker.ENB.headline, "Guidance cut 15%, stock barely moved yet");
  assert.equal(byTicker.ENB.sources.length, 3);
  assert.equal(byTicker.META.headline, "3 insiders bought $4.1M this week");
  assert.equal(byTicker["STN.TO"].kind, "threat");
  assert.equal(byTicker.NVDA.kind, "opportunity");
  assert.equal(byTicker.AAPL, undefined);
  for (const a of report.alerts) assert.ok(a.sources.length > 0);
});

test("running the same scan again creates no duplicate alerts", async () => {
  const store = new MemoryStore(["ENB", "META"]);
  await runScan(deps(store));
  const second = await runScan(deps(store));
  assert.equal(second.alerts.length, 0);
  assert.equal(store.alerts.length, 2);
});

test("only watched tickers are scanned", async () => {
  const report = await runScan(deps(new MemoryStore(["ENB"])));
  assert.deepEqual(report.alerts.map((a) => a.ticker), ["ENB"]);
});

test("a failing source doesn't stop the others, and its circuit opens after repeated failures", async () => {
  const broken: SourceAdapter = {
    name: "finnhub", supports: () => true, fetchEvents: async () => { throw new Error("503"); },
  };
  const store = new MemoryStore(["ENB"]);
  let report;
  for (let i = 0; i < 3; i++) {
    report = await runScan(deps(store, { adapters: [broken, createMockAdapter(() => NOW)] }));
  }
  assert.equal(report!.sources.finnhub, "failed");
  assert.equal(report!.sources.mock, "ok");
  assert.equal(store.alerts.length, 1);

  const next = await runScan(deps(store, { adapters: [broken, createMockAdapter(() => NOW)] }));
  assert.equal(next.sources.finnhub, "skipped_circuit_open");
});

test("classifier outage leaves stories pending and they're retried next scan", async () => {
  const store = new MemoryStore(["ENB"]);
  const down: Classifier = { name: "down", classify: async () => { throw new ClassifierUnavailable("429"); } };
  const first = await runScan(deps(store, { classifier: down }));
  assert.equal(first.alerts.length, 0);
  assert.ok([...store.clusters.values()].every((c) => c.status === "pending"));

  const second = await runScan(deps(store));
  assert.equal(second.alerts.length, 1);
});

test("invalid classifier output is rejected, not shown", async () => {
  const sloppy: Classifier = {
    name: "sloppy",
    classify: async (i) => ({ material: true, kind: "threat", headline: "Guidance cut 40%", why_it_matters: "x", source_event_ids: [i.events[0].id] }),
  };
  const report = await runScan(deps(new MemoryStore(["ENB"]), { classifier: sloppy }));
  assert.equal(report.alerts.length, 0);
  assert.ok(report.rejected.some((r) => /40/.test(r.reason)));
});

test("a push failure doesn't lose the alert", async () => {
  const store = new MemoryStore(["ENB"]);
  store.pushTokens.set("ENB", ["ExponentPushToken[abc]"]);
  const sent: Alert[] = [];
  const flaky: Notifier = { notify: async (a) => { sent.push(a); throw new Error("push down"); } };
  const report = await runScan(deps(store, { notifier: flaky }));
  assert.equal(report.alerts.length, 1);
  assert.equal(store.alerts.length, 1);
  assert.equal(sent.length, 1);
});

test("stale events (older than 72h) don't alert", async () => {
  const later = new Date(NOW.getTime() + 5 * 24 * 60 * 60_000);
  const store = new MemoryStore(["ENB"]);
  const report = await runScan({ ...deps(store), adapters: [createMockAdapter(() => NOW)], now: () => later });
  assert.equal(report.alerts.length, 0);
});
