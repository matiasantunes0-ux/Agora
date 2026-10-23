import type { Alert, Classifier, NormalizedEvent, Quote, SourceAdapter } from "../types.ts";
import type { AlertStore, Notifier } from "./store.ts";
import { isOpen, recordResult } from "../lib/circuitBreaker.ts";
import { stableId } from "../lib/hash.ts";
import { prefilter } from "./prefilter.ts";
import { assignClusters } from "./dedupe.ts";
import { runDetectors } from "../detectors/index.ts";
import { validateClassification } from "../classify/schema.ts";
import { ClassifierRefusal, ClassifierUnavailable } from "../classify/errors.ts";

// Ignore events older than this. Prevents a burst of stale alerts the first
// time a ticker is added or after a long outage.
const MAX_EVENT_AGE_MS = 72 * 60 * 60_000;
// How far back to look for clusters a new event could belong to.
const CLUSTER_LOOKBACK_MS = 7 * 24 * 60 * 60_000;
// First scan of a source (or after it was down): look back this far.
const DEFAULT_LOOKBACK_MS = 24 * 60 * 60_000;
// Overlap between scans so items published late by the provider aren't missed (dupes are ignored).
const SCAN_OVERLAP_MS = 60 * 60_000;

export interface ScanDeps {
  store: AlertStore;
  adapters: SourceAdapter[];
  classifier: Classifier;
  notifier: Notifier;
  now?: () => Date;
  log?: (msg: string) => void;
}

export interface ScanReport {
  tickers: string[];
  sources: Record<string, "ok" | "skipped_circuit_open" | "failed">;
  eventsFetched: number;
  eventsAfterPrefilter: number;
  clustersClassified: number;
  alerts: Alert[];
  rejected: { clusterId: string; reason: string }[];
}

/**
 * One scan: fetch → prefilter → cluster (dedupe) → detect → classify → validate → store → notify.
 * Each stage fails soft: a broken source or classifier error never stops the others.
 */
export async function runScan(deps: ScanDeps): Promise<ScanReport> {
  const { store, adapters, classifier, notifier } = deps;
  const now = deps.now?.() ?? new Date();
  const log = deps.log ?? (() => {});

  const report: ScanReport = {
    tickers: [], sources: {}, eventsFetched: 0, eventsAfterPrefilter: 0, clustersClassified: 0, alerts: [], rejected: [],
  };

  const tickers = await store.getWatchedTickers();
  report.tickers = tickers;
  if (tickers.length === 0) return report;

  // 1. Fetch from every source independently.
  const fetched: NormalizedEvent[] = [];
  const quotes = new Map<string, Quote>();
  for (const adapter of adapters) {
    const health = await store.getHealth(adapter.name);
    if (isOpen(health, now)) {
      report.sources[adapter.name] = "skipped_circuit_open";
      continue;
    }
    const supported = tickers.filter((t) => adapter.supports(t));
    if (supported.length === 0) continue;

    const since = health.lastSuccess
      ? new Date(new Date(health.lastSuccess).getTime() - SCAN_OVERLAP_MS)
      : new Date(now.getTime() - DEFAULT_LOOKBACK_MS);
    try {
      fetched.push(...(await adapter.fetchEvents(supported, since)));
      if (adapter.fetchQuotes) {
        for (const q of await adapter.fetchQuotes(supported)) quotes.set(q.ticker, q);
      }
      await store.saveHealth(recordResult(health, { ok: true }, now));
      report.sources[adapter.name] = "ok";
    } catch (err) {
      log(`source ${adapter.name} failed: ${err}`);
      await store.saveHealth(recordResult(health, { ok: false, error: String(err) }, now));
      report.sources[adapter.name] = "failed";
    }
  }
  report.eventsFetched = fetched.length;

  // 2. Drop stale and routine items before spending anything on them.
  const fresh = fetched.filter((e) => now.getTime() - new Date(e.publishedAt).getTime() <= MAX_EVENT_AGE_MS);
  const candidates = prefilter(fresh);
  report.eventsAfterPrefilter = candidates.length;

  // 3. Deduplicate into story clusters.
  const recent = await store.getRecentClusters(tickers, new Date(now.getTime() - CLUSTER_LOOKBACK_MS));
  const { clusters, touched, assignments } = assignClusters(recent, candidates);
  await store.saveEvents(candidates.map((e) => ({ ...e, clusterId: assignments.get(e.id)! })));

  // Classify clusters that got new events, plus older ones left pending by a classifier outage.
  // Clusters that already produced an alert never alert again.
  const toClassify = clusters.filter((c) => c.status !== "alerted" && (touched.has(c.id) || c.status === "pending"));

  // 4. Detect → classify → validate → store → notify, one story at a time.
  for (const cluster of toClassify) {
    const events = await store.getEvents(cluster.eventIds);
    if (events.length === 0) continue;
    const quote = quotes.get(cluster.ticker);
    const input = { ticker: cluster.ticker, events, quote, signals: runDetectors({ ticker: cluster.ticker, events, quote }) };

    let raw;
    try {
      raw = await classifier.classify(input);
      report.clustersClassified++;
    } catch (err) {
      if (err instanceof ClassifierUnavailable) {
        log(`classifier unavailable, will retry ${cluster.id}: ${err.message}`);
        cluster.status = "pending";
        continue;
      }
      if (err instanceof ClassifierRefusal) {
        cluster.status = "dismissed";
        continue;
      }
      log(`classifier error on ${cluster.id}: ${err}`);
      cluster.status = "pending";
      continue;
    }

    const result = validateClassification(raw, input);
    if (result.status !== "alert") {
      if (result.status === "rejected") report.rejected.push({ clusterId: cluster.id, reason: result.reason });
      // "dismissed" isn't final: if more coverage arrives the cluster is touched and re-checked.
      cluster.status = "dismissed";
      continue;
    }

    const alert: Alert = {
      id: stableId("al", cluster.id),
      clusterId: cluster.id,
      ticker: cluster.ticker,
      kind: result.kind,
      headline: result.headline,
      whyItMatters: result.whyItMatters,
      sources: result.sources,
      createdAt: now.toISOString(),
      classifier: classifier.name,
    };
    if (await store.insertAlert(alert)) {
      report.alerts.push(alert);
      try {
        await notifier.notify(alert, await store.getPushTokens(alert.ticker));
      } catch (err) {
        // A failed push must not lose the alert; it's already in the feed.
        log(`push failed for ${alert.id}: ${err}`);
      }
    }
    cluster.status = "alerted";
  }

  await store.saveClusters(clusters.filter((c) => touched.has(c.id) || toClassify.includes(c)));
  return report;
}
