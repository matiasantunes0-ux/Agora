import type { NormalizedEvent, Quote, SourceAdapter } from "../types.ts";
import { stableId } from "../lib/hash.ts";

// Fake source for demos and tests: no keys, no network. Timestamps are relative
// to "now" so the events always look fresh. Includes duplicates across outlets
// and routine noise on purpose, to exercise dedupe and the prefilter.

type Fixture = Omit<NormalizedEvent, "id" | "source" | "publishedAt" | "summary"> & { minutesAgo: number; summary?: string };

const FIXTURES: Fixture[] = [
  // Same guidance-cut story from three outlets → should become ONE alert.
  { ticker: "ENB", type: "news", minutesAgo: 35, publisher: "Reuters",
    title: "Enbridge cuts 2026 guidance 15% on pipeline delays",
    summary: "Enbridge lowered its full-year EBITDA guidance by 15%, citing delays on two major pipeline projects.",
    url: "https://example.com/reuters/enbridge-guidance-cut?utm_source=feed" },
  { ticker: "ENB", type: "news", minutesAgo: 30, publisher: "Bloomberg",
    title: "Enbridge cuts guidance 15% as pipeline delays bite",
    summary: "The Calgary-based company cut its outlook by 15%.",
    url: "https://example.com/bloomberg/enbridge-cuts-guidance" },
  { ticker: "ENB", type: "news", minutesAgo: 28, publisher: "Globe and Mail",
    title: "Enbridge cuts 2026 guidance 15%, cites pipeline delays",
    summary: "Shares were little changed after the announcement.",
    url: "https://example.com/globe/enbridge-guidance" },
  // Routine → dropped by the prefilter.
  { ticker: "ENB", type: "news", minutesAgo: 90, publisher: "Newswire",
    title: "Enbridge declares quarterly dividend",
    url: "https://example.com/newswire/enb-dividend" },

  // Insider buying (three Form 4s) → ONE weekly insider alert.
  { ticker: "META", type: "insider_trade", minutesAgo: 60 * 20, publisher: "SEC EDGAR",
    title: "Form 4: Director open-market purchase", url: "https://www.sec.gov/Archives/edgar/data/1326801/mock-1",
    accession: "0001326801-26-000101", facts: { insider: "Director A", purchaseValue: 1_850_000, saleValue: 0 } },
  { ticker: "META", type: "insider_trade", minutesAgo: 60 * 8, publisher: "SEC EDGAR",
    title: "Form 4: Director open-market purchase", url: "https://www.sec.gov/Archives/edgar/data/1326801/mock-2",
    accession: "0001326801-26-000102", facts: { insider: "Director B", purchaseValue: 1_200_000, saleValue: 0 } },
  { ticker: "META", type: "insider_trade", minutesAgo: 60 * 2, publisher: "SEC EDGAR",
    title: "Form 4: Officer open-market purchase", url: "https://www.sec.gov/Archives/edgar/data/1326801/mock-3",
    accession: "0001326801-26-000103", facts: { insider: "Officer C", purchaseValue: 1_070_000, saleValue: 0 } },
  // Routine META items.
  { ticker: "META", type: "news", minutesAgo: 120, publisher: "Blog",
    title: "3 top stocks to buy in November", url: "https://example.com/blog/top-stocks" },
  { ticker: "META", type: "news", minutesAgo: 240, publisher: "Analyst Wire",
    title: "Analyst reiterates Buy on Meta Platforms", url: "https://example.com/wire/meta-reiterate" },

  // Leadership departure without a successor (TSX name).
  { ticker: "STN.TO", type: "news", minutesAgo: 75, publisher: "Canadian Press",
    title: "Stantec CEO resigns effective immediately",
    summary: "The board said it has begun a search for a permanent chief executive and has not named a successor.",
    url: "https://example.com/cp/stantec-ceo" },

  // Raised guidance.
  { ticker: "NVDA", type: "news", minutesAgo: 180, publisher: "CNBC",
    title: "Nvidia raises full-year outlook on data-center demand",
    summary: "Nvidia lifted its forecast after another record quarter.",
    url: "https://example.com/cnbc/nvda-outlook" },

  // Neutral → classified not material.
  { ticker: "AAPL", type: "news", minutesAgo: 50, publisher: "The Verge",
    title: "Apple releases new colors for iPhone cases",
    url: "https://example.com/verge/iphone-cases" },
];

const QUOTES: Quote[] = [
  { ticker: "ENB", price: 61.42, changePct: -0.4 },
  { ticker: "META", price: 702.1, changePct: 1.2 },
  { ticker: "STN.TO", price: 128.55, changePct: -6.8 },
  { ticker: "NVDA", price: 196.3, changePct: 4.1 },
  { ticker: "AAPL", price: 258.9, changePct: 0.2 },
];

export function createMockAdapter(now: () => Date = () => new Date()): SourceAdapter {
  return {
    name: "mock",
    supports: () => true,
    async fetchEvents(tickers) {
      const t = now().getTime();
      return FIXTURES.filter((f) => tickers.includes(f.ticker)).map(({ minutesAgo, summary, ...f }) => ({
        ...f,
        summary: summary ?? "",
        id: stableId("ev", `mock|${f.accession ?? f.url}`),
        source: "mock" as const,
        publishedAt: new Date(t - minutesAgo * 60_000).toISOString(),
      }));
    },
    async fetchQuotes(tickers) {
      return QUOTES.filter((q) => tickers.includes(q.ticker));
    },
  };
}
