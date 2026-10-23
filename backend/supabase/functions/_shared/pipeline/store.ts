import type { Alert, EventCluster, NormalizedEvent, SourceHealth, SourceName } from "../types.ts";
import { emptyHealth } from "../lib/circuitBreaker.ts";

/**
 * Persistence used by the pipeline. Supabase implements it in production
 * (scan/supabaseStore.ts); MemoryStore below is for tests and the local demo.
 */
export interface AlertStore {
  getWatchedTickers(): Promise<string[]>;
  getHealth(source: SourceName): Promise<SourceHealth>;
  saveHealth(health: SourceHealth): Promise<void>;
  /** Insert-or-ignore: the same event id twice is a no-op. */
  saveEvents(events: (NormalizedEvent & { clusterId: string })[]): Promise<void>;
  getEvents(ids: string[]): Promise<NormalizedEvent[]>;
  /** Clusters for these tickers seen since `since` (for matching new events and retrying pending ones). */
  getRecentClusters(tickers: string[], since: Date): Promise<EventCluster[]>;
  saveClusters(clusters: EventCluster[]): Promise<void>;
  /** Returns false if this cluster already has an alert (enforced by a unique constraint in Postgres). */
  insertAlert(alert: Alert): Promise<boolean>;
  getPushTokens(ticker: string): Promise<string[]>;
}

export interface Notifier {
  notify(alert: Alert, tokens: string[]): Promise<void>;
}

export class MemoryStore implements AlertStore {
  tickers: string[] = [];
  health = new Map<SourceName, SourceHealth>();
  events = new Map<string, NormalizedEvent & { clusterId: string }>();
  clusters = new Map<string, EventCluster>();
  alerts: Alert[] = [];
  pushTokens = new Map<string, string[]>();

  constructor(tickers: string[] = []) {
    this.tickers = tickers;
  }

  async getWatchedTickers() { return [...this.tickers]; }
  async getHealth(source: SourceName) { return this.health.get(source) ?? emptyHealth(source); }
  async saveHealth(h: SourceHealth) { this.health.set(h.source, h); }
  async saveEvents(events: (NormalizedEvent & { clusterId: string })[]) {
    for (const e of events) if (!this.events.has(e.id)) this.events.set(e.id, e);
  }
  async getEvents(ids: string[]) {
    return ids.map((id) => this.events.get(id)).filter((e): e is NormalizedEvent & { clusterId: string } => !!e);
  }
  async getRecentClusters(tickers: string[], since: Date) {
    return [...this.clusters.values()].filter((c) => tickers.includes(c.ticker) && new Date(c.lastSeen) >= since);
  }
  async saveClusters(clusters: EventCluster[]) {
    for (const c of clusters) this.clusters.set(c.id, c);
  }
  async insertAlert(alert: Alert) {
    if (this.alerts.some((a) => a.clusterId === alert.clusterId)) return false;
    this.alerts.push(alert);
    return true;
  }
  async getPushTokens(ticker: string) { return this.pushTokens.get(ticker) ?? []; }
}
