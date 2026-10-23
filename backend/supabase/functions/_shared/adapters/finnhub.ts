import type { NormalizedEvent, Quote, SourceAdapter } from "../types.ts";
import { Throttle, fetchWithRetry } from "../lib/http.ts";
import { stableId } from "../lib/hash.ts";

// Finnhub free tier: company news + quotes, 60 calls/min.
// NOTE: free-tier coverage of TSX symbols (e.g. "STN.TO") is not guaranteed.
// Unsupported symbols return empty results, which this adapter treats as "no news".

const BASE = "https://finnhub.io/api/v1";

interface FinnhubNews {
  id: number;
  datetime: number; // unix seconds
  headline: string;
  summary: string;
  source: string;
  url: string;
}

interface FinnhubQuote {
  c: number; // current price
  dp: number | null; // % change vs previous close
}

export function createFinnhubAdapter(apiKey: string, fetchImpl: typeof fetch = fetch): SourceAdapter {
  // ~1.1s between calls keeps us under 60/min even with retries.
  const throttle = new Throttle(1100);

  const get = async <T>(path: string, params: Record<string, string>): Promise<T> => {
    await throttle.wait();
    const qs = new URLSearchParams({ ...params, token: apiKey });
    const res = await fetchWithRetry(`${BASE}${path}?${qs}`, {}, { fetchImpl });
    return (await res.json()) as T;
  };

  return {
    name: "finnhub",
    supports: () => true,

    async fetchEvents(tickers, since) {
      const from = since.toISOString().slice(0, 10);
      const to = new Date().toISOString().slice(0, 10);
      const out: NormalizedEvent[] = [];
      for (const ticker of tickers) {
        const items = await get<FinnhubNews[]>("/company-news", { symbol: ticker, from, to });
        for (const n of Array.isArray(items) ? items : []) {
          const publishedAt = new Date(n.datetime * 1000);
          if (publishedAt < since || !n.url || !n.headline) continue;
          out.push({
            id: stableId("ev", `finnhub|${n.url}`),
            ticker,
            source: "finnhub",
            type: "news",
            title: n.headline,
            summary: n.summary ?? "",
            url: n.url,
            publisher: n.source || "Finnhub",
            publishedAt: publishedAt.toISOString(),
          });
        }
      }
      return out;
    },

    async fetchQuotes(tickers) {
      const out: Quote[] = [];
      for (const ticker of tickers) {
        const q = await get<FinnhubQuote>("/quote", { symbol: ticker });
        // Finnhub returns zeros for unknown symbols rather than an error.
        if (q && q.c > 0 && typeof q.dp === "number") out.push({ ticker, price: q.c, changePct: q.dp });
      }
      return out;
    },
  };
}
