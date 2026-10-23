// Postgres-backed AlertStore. Uses the service-role key, which bypasses
// row-level security, so this file only ever runs on the server.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { AlertStore } from "../_shared/pipeline/store.ts";
import type { Alert, EventCluster, NormalizedEvent, SourceHealth, SourceName } from "../_shared/types.ts";
import { emptyHealth } from "../_shared/lib/circuitBreaker.ts";

function check<T>({ data, error }: { data: T; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data;
}

export function createSupabaseStore(db: SupabaseClient): AlertStore {
  return {
    async getWatchedTickers() {
      const rows = check(await db.from("watchlist_items").select("ticker")) as { ticker: string }[];
      return [...new Set(rows.map((r) => r.ticker))];
    },

    async getHealth(source: SourceName) {
      const row = check(await db.from("source_health").select("*").eq("source", source).maybeSingle());
      if (!row) return emptyHealth(source);
      return {
        source,
        consecutiveFailures: row.consecutive_failures,
        openUntil: row.open_until,
        lastSuccess: row.last_success,
        lastError: row.last_error,
      };
    },

    async saveHealth(h: SourceHealth) {
      check(await db.from("source_health").upsert({
        source: h.source,
        consecutive_failures: h.consecutiveFailures,
        open_until: h.openUntil,
        last_success: h.lastSuccess,
        last_error: h.lastError,
        updated_at: new Date().toISOString(),
      }));
    },

    async saveEvents(events) {
      if (events.length === 0) return;
      // ignoreDuplicates → insert-or-ignore on the primary key, so overlapping scans are harmless.
      check(await db.from("events").upsert(
        events.map((e) => ({
          id: e.id, ticker: e.ticker, source: e.source, type: e.type, title: e.title, summary: e.summary,
          url: e.url, publisher: e.publisher, published_at: e.publishedAt, accession: e.accession ?? null,
          facts: e.facts ?? {}, cluster_id: e.clusterId,
        })),
        { onConflict: "id", ignoreDuplicates: true },
      ));
    },

    async getEvents(ids: string[]): Promise<NormalizedEvent[]> {
      if (ids.length === 0) return [];
      const rows = check(await db.from("events").select("*").in("id", ids)) as Record<string, any>[];
      return rows.map((r) => ({
        id: r.id, ticker: r.ticker, source: r.source, type: r.type, title: r.title, summary: r.summary,
        url: r.url, publisher: r.publisher, publishedAt: r.published_at, accession: r.accession ?? undefined,
        facts: r.facts ?? {},
      }));
    },

    async getRecentClusters(tickers: string[], since: Date): Promise<EventCluster[]> {
      const rows = check(
        await db.from("event_clusters").select("*").in("ticker", tickers).gte("last_seen", since.toISOString()),
      ) as Record<string, any>[];
      return rows.map((r) => ({
        id: r.id, ticker: r.ticker, title: r.title, firstSeen: r.first_seen, lastSeen: r.last_seen,
        urls: r.urls, accessions: r.accessions, eventIds: r.event_ids, status: r.status,
      }));
    },

    async saveClusters(clusters: EventCluster[]) {
      if (clusters.length === 0) return;
      check(await db.from("event_clusters").upsert(clusters.map((c) => ({
        id: c.id, ticker: c.ticker, title: c.title, first_seen: c.firstSeen, last_seen: c.lastSeen,
        urls: c.urls, accessions: c.accessions, event_ids: c.eventIds, status: c.status,
      }))));
    },

    async insertAlert(alert: Alert) {
      // One transaction for alert + sources (see insert_alert in the migration).
      // Returns false when this story already has an alert.
      return check(await db.rpc("insert_alert", {
        alert: {
          id: alert.id, cluster_id: alert.clusterId, ticker: alert.ticker, kind: alert.kind,
          headline: alert.headline, why_it_matters: alert.whyItMatters, classifier: alert.classifier,
          created_at: alert.createdAt,
        },
        sources: alert.sources.map((s) => ({
          title: s.title, url: s.url, publisher: s.publisher, published_at: s.publishedAt,
        })),
      })) as boolean;
    },

    async getPushTokens(ticker: string) {
      const watchers = check(await db.from("watchlist_items").select("user_id").eq("ticker", ticker)) as { user_id: string }[];
      if (watchers.length === 0) return [];
      const rows = check(
        await db.from("push_tokens").select("token").in("user_id", watchers.map((w) => w.user_id)),
      ) as { token: string }[];
      return rows.map((r) => r.token);
    },
  };
}
