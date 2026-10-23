// Shared types for the News & Opportunity Alerts pipeline.
// This folder must stay runtime-neutral (no Deno.* / npm: imports) so the same
// files run inside Supabase Edge Functions (Deno) and under `node --test`.

export type AlertKind = "opportunity" | "threat";

/** Where an event came from. Add new values when you add an adapter. */
export type SourceName = "sec_edgar" | "finnhub" | "mock";

/** What sort of item it is, so detectors/prefilters can treat them differently. */
export type EventType = "news" | "filing" | "insider_trade";

/** One item from any source, normalized to the same shape. */
export interface NormalizedEvent {
  /** Stable id: same story from the same source always hashes to the same id. */
  id: string;
  ticker: string;
  source: SourceName;
  type: EventType;
  title: string;
  summary: string;
  url: string;
  publisher: string;
  publishedAt: string; // ISO 8601
  /** SEC accession number, when the event is a filing. Strongest dedupe key. */
  accession?: string;
  /** Extra structured facts from the source (e.g. Form 4 totals, filing form type). */
  facts?: Record<string, string | number | boolean>;
}

/** A group of events that describe the same underlying story. One cluster → at most one alert. */
export interface EventCluster {
  id: string;
  ticker: string;
  /** Title of the first event, used to match later events against. */
  title: string;
  firstSeen: string;
  lastSeen: string;
  urls: string[]; // canonicalized
  accessions: string[];
  eventIds: string[];
  status: "pending" | "alerted" | "dismissed";
}

/** Market snapshot used to judge reactions ("-9% on…", "stock barely moved"). */
export interface Quote {
  ticker: string;
  price: number;
  changePct: number; // today's move vs previous close
}

/** A structured fact a detector adds for the classifier. Values must be grounded in source data. */
export interface Signal {
  detector: string;
  description: string;
  values: Record<string, number | string>;
}

/** Everything the classifier sees for one cluster. */
export interface ClassifierInput {
  ticker: string;
  events: NormalizedEvent[];
  quote?: Quote;
  signals: Signal[];
}

/** Raw classifier output — must match CLASSIFICATION_SCHEMA. Untrusted until validated. */
export interface ClassificationOutput {
  material: boolean;
  /** "none" when not material (a plain string enum is simpler for structured output than a nullable). */
  kind: AlertKind | "none";
  headline: string;
  why_it_matters: string;
  source_event_ids: string[];
}

export interface AlertSource {
  title: string;
  url: string;
  publisher: string;
  publishedAt: string;
}

/** A validated alert ready to store and send. */
export interface Alert {
  id: string;
  clusterId: string;
  ticker: string;
  kind: AlertKind;
  headline: string;
  whyItMatters: string;
  sources: AlertSource[];
  createdAt: string;
  classifier: string;
}

/**
 * Every data source implements this. To swap Finnhub for Polygon, write a new
 * adapter with the same interface and change the registry — nothing else moves.
 */
export interface SourceAdapter {
  name: SourceName;
  /** Which tickers this source can cover (e.g. SEC EDGAR → US listings only). */
  supports(ticker: string): boolean;
  fetchEvents(tickers: string[], since: Date): Promise<NormalizedEvent[]>;
  /** Optional: sources that also provide prices. */
  fetchQuotes?(tickers: string[]): Promise<Quote[]>;
}

export interface Classifier {
  name: string;
  classify(input: ClassifierInput): Promise<ClassificationOutput>;
}

export interface SourceHealth {
  source: SourceName;
  consecutiveFailures: number;
  /** While set and in the future, the source is skipped (circuit open). */
  openUntil: string | null;
  lastSuccess: string | null;
  lastError: string | null;
}
