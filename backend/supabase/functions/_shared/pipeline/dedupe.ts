import type { EventCluster, NormalizedEvent } from "../types.ts";
import { stableId } from "../lib/hash.ts";

// Two stories about the same ticker inside this window can be the same story.
export const CLUSTER_WINDOW_MS = 48 * 60 * 60_000;
// Title-word overlap needed to call two headlines the same story (0–1).
export const TITLE_SIMILARITY_THRESHOLD = 0.5;

const TRACKING_PARAMS = /^(utm_\w+|guccounter|guce_\w+|cmpid|ref|src|fbclid|gclid|mc_cid|mc_eid|ncid)$/i;

/** Same article, different link: strip tracking params, fragments, www, trailing slash. */
export function canonicalUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = "";
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING_PARAMS.test(key)) u.searchParams.delete(key);
    }
    u.searchParams.sort();
    const path = u.pathname.replace(/\/+$/, "") || "/";
    const query = u.searchParams.toString();
    return `${u.protocol}//${u.hostname}${path}${query ? `?${query}` : ""}`;
  } catch {
    return raw.trim().toLowerCase();
  }
}

// Words that appear in every finance headline and say nothing about *which* story it is.
const STOPWORDS = new Set(
  ("a an and are as at be by for from has have in into is it its of on or that the this to was were will with " +
    "after amid over says said report reports update stock stocks shares share inc corp co ltd company").split(" "),
);

/** Headline → set of meaningful words. Numbers are kept: "-9%" vs "-2%" are different stories. */
export function titleTokens(title: string, ticker = ""): Set<string> {
  const base = ticker.split(".")[0].toLowerCase();
  const words = title
    .toLowerCase()
    .replace(/[’']/g, "")
    .split(/[^a-z0-9%$.]+/)
    .map((w) => w.replace(/^\.+|\.+$/g, ""))
    .filter((w) => w.length > 1 && !STOPWORDS.has(w) && w !== base && w !== `$${base}`);
  // Light stemming so "cuts"/"cut" and "resigns"/"resign" match.
  return new Set(words.map((w) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w)));
}

/** Monday (UTC) of the event's week → one insider cluster per ticker per week. */
export function insiderWeekClusterId(ev: NormalizedEvent): string {
  const d = new Date(ev.publishedAt);
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7)));
  return stableId("cl", `${ev.ticker}|insider|${monday.toISOString().slice(0, 10)}`);
}

/** Jaccard overlap of two token sets: |A∩B| / |A∪B|. */
export function similarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return shared / (a.size + b.size - shared);
}

/**
 * Puts each new event into an existing cluster or starts a new one.
 *
 * Matching order (strongest signal first):
 *   1. Same SEC accession number  → same filing, always.
 *   2. Same canonical URL         → same article, always.
 *   3. Same ticker, within 48h, and headline similarity ≥ threshold → same story
 *      told by a different outlet.
 *
 * Returns the full updated cluster list plus which clusters changed, so the
 * caller only re-classifies clusters that actually got something new.
 */
export function assignClusters(
  existing: EventCluster[],
  events: NormalizedEvent[],
): { clusters: EventCluster[]; touched: Set<string>; assignments: Map<string, string> } {
  const clusters = existing.map((c) => ({ ...c, urls: [...c.urls], accessions: [...c.accessions], eventIds: [...c.eventIds] }));
  const touched = new Set<string>();
  const assignments = new Map<string, string>(); // eventId → clusterId
  const tokenCache = new Map<string, Set<string>>();
  const tokensOf = (c: EventCluster) => {
    if (!tokenCache.has(c.id)) tokenCache.set(c.id, titleTokens(c.title, c.ticker));
    return tokenCache.get(c.id)!;
  };

  // Oldest first so the earliest headline becomes the cluster's reference title.
  const sorted = [...events].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));

  for (const ev of sorted) {
    const url = canonicalUrl(ev.url);
    const evTime = new Date(ev.publishedAt).getTime();
    const evTokens = titleTokens(ev.title, ev.ticker);
    // Each Form 4 is its own filing, but "3 insiders bought $4M this week" is one
    // story, so insider trades for a ticker share one cluster per calendar week.
    const insiderClusterId = ev.type === "insider_trade" ? insiderWeekClusterId(ev) : undefined;

    const match =
      clusters.find((c) => c.eventIds.includes(ev.id)) ??
      (insiderClusterId ? clusters.find((c) => c.id === insiderClusterId) : undefined) ??
      (ev.accession ? clusters.find((c) => c.accessions.includes(ev.accession!)) : undefined) ??
      clusters.find((c) => c.urls.includes(url)) ??
      clusters.find(
        (c) =>
          c.ticker === ev.ticker &&
          Math.abs(evTime - new Date(c.lastSeen).getTime()) <= CLUSTER_WINDOW_MS &&
          similarity(evTokens, tokensOf(c)) >= TITLE_SIMILARITY_THRESHOLD,
      );

    if (match) {
      if (!match.eventIds.includes(ev.id)) {
        match.eventIds.push(ev.id);
        touched.add(match.id);
      }
      if (!match.urls.includes(url)) match.urls.push(url);
      if (ev.accession && !match.accessions.includes(ev.accession)) match.accessions.push(ev.accession);
      if (ev.publishedAt > match.lastSeen) match.lastSeen = ev.publishedAt;
      assignments.set(ev.id, match.id);
    } else {
      const cluster: EventCluster = {
        id: insiderClusterId ?? stableId("cl", `${ev.ticker}|${ev.accession ?? url}`),
        ticker: ev.ticker,
        title: insiderClusterId ? `${ev.ticker} insider trades` : ev.title,
        firstSeen: ev.publishedAt,
        lastSeen: ev.publishedAt,
        urls: [url],
        accessions: ev.accession ? [ev.accession] : [],
        eventIds: [ev.id],
        status: "pending",
      };
      clusters.push(cluster);
      touched.add(cluster.id);
      assignments.set(ev.id, cluster.id);
    }
  }

  return { clusters, touched, assignments };
}
