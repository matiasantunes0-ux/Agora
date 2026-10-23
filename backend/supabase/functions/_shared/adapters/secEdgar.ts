import type { NormalizedEvent, SourceAdapter } from "../types.ts";
import { Throttle, fetchWithRetry } from "../lib/http.ts";
import { stableId } from "../lib/hash.ts";

// SEC EDGAR: free, no key. SEC requires a descriptive User-Agent with a contact
// email and asks for <= 10 requests/second. US filers only: TSX names such as
// "STN.TO" are not in EDGAR, so supports() returns false for them.

const TICKER_MAP_URL = "https://www.sec.gov/files/company_tickers.json";
const SUBMISSIONS_URL = (cik: string) => `https://data.sec.gov/submissions/CIK${cik}.json`;
const ARCHIVE = "https://www.sec.gov/Archives/edgar/data";

// Filing types worth looking at. Everything else is ignored at the source.
const FORMS_OF_INTEREST = new Set(["8-K", "10-Q", "10-K", "4", "SC 13D", "SC 13D/A", "6-K"]);

const FORM_LABEL: Record<string, string> = {
  "8-K": "Material event report (8-K)",
  "10-Q": "Quarterly report (10-Q)",
  "10-K": "Annual report (10-K)",
  "SC 13D": "Activist stake disclosed (13D)",
  "SC 13D/A": "Activist stake update (13D/A)",
  "6-K": "Foreign issuer report (6-K)",
};

/** Parses the open-market purchases (code P) and sales (code S) out of a Form 4 XML document. */
export function parseForm4(xml: string): { insider: string; purchaseValue: number; saleValue: number } {
  const insider = xml.match(/<rptOwnerName>([^<]+)<\/rptOwnerName>/)?.[1]?.trim() ?? "Unknown insider";
  let purchaseValue = 0;
  let saleValue = 0;
  const txs = xml.match(/<nonDerivativeTransaction>[\s\S]*?<\/nonDerivativeTransaction>/g) ?? [];
  for (const tx of txs) {
    const code = tx.match(/<transactionCode>\s*([A-Z])\s*<\/transactionCode>/)?.[1];
    const shares = Number(tx.match(/<transactionShares>\s*<value>([\d.]+)<\/value>/)?.[1] ?? 0);
    const price = Number(tx.match(/<transactionPricePerShare>\s*<value>([\d.]+)<\/value>/)?.[1] ?? 0);
    // Other codes (A = grant, M = option exercise, F = tax withholding, G = gift) aren't market views.
    if (code === "P") purchaseValue += shares * price;
    if (code === "S") saleValue += shares * price;
  }
  return { insider, purchaseValue: Math.round(purchaseValue), saleValue: Math.round(saleValue) };
}

interface Submissions {
  name: string;
  filings: {
    recent: {
      accessionNumber: string[];
      form: string[];
      acceptanceDateTime: string[];
      primaryDocument: string[];
      items?: string[];
    };
  };
}

export function createSecEdgarAdapter(contactEmail: string, fetchImpl: typeof fetch = fetch): SourceAdapter {
  const throttle = new Throttle(150); // ≈ 6–7 req/s, safely under SEC's 10/s
  const headers = { "User-Agent": `Agora alerts demo ${contactEmail}`, Accept: "application/json, text/xml" };
  let tickerToCik: Map<string, string> | null = null;

  const get = async (url: string) => {
    await throttle.wait();
    return fetchWithRetry(url, { headers }, { fetchImpl });
  };

  const cikFor = async (ticker: string) => {
    if (!tickerToCik) {
      const data = (await (await get(TICKER_MAP_URL)).json()) as Record<string, { cik_str: number; ticker: string }>;
      tickerToCik = new Map(Object.values(data).map((r) => [r.ticker.toUpperCase(), String(r.cik_str).padStart(10, "0")]));
    }
    // EDGAR uses "BRK-B" where exchanges use "BRK.B".
    return tickerToCik.get(ticker.replace(".", "-")) ?? tickerToCik.get(ticker);
  };

  return {
    name: "sec_edgar",
    // No exchange suffix (".TO", ".V") → US listing.
    supports: (ticker) => !/\.(TO|V|CN|NE)$/i.test(ticker),

    async fetchEvents(tickers, since) {
      const out: NormalizedEvent[] = [];
      for (const ticker of tickers) {
        const cik = await cikFor(ticker);
        if (!cik) continue;
        const sub = (await (await get(SUBMISSIONS_URL(cik))).json()) as Submissions;
        const r = sub.filings.recent;

        for (let i = 0; i < r.accessionNumber.length; i++) {
          const form = r.form[i];
          const accepted = new Date(r.acceptanceDateTime[i]);
          // Filings are newest-first, so we can stop at the first old one.
          if (accepted < since) break;
          if (!FORMS_OF_INTEREST.has(form)) continue;

          const accession = r.accessionNumber[i];
          const folder = `${ARCHIVE}/${Number(cik)}/${accession.replace(/-/g, "")}`;
          // primaryDocument for Form 4 is often the XSL-rendered view ("xslF345X05/x.xml"); the raw XML is the basename.
          const doc = r.primaryDocument[i];
          const url = `${folder}/${doc}`;

          if (form === "4") {
            try {
              const xml = await (await get(`${folder}/${doc.split("/").pop()}`)).text();
              const parsed = parseForm4(xml);
              out.push({
                id: stableId("ev", `sec|${accession}`),
                ticker, source: "sec_edgar", type: "insider_trade",
                title: `Form 4: ${parsed.insider}`,
                summary: "",
                url, publisher: "SEC EDGAR", publishedAt: accepted.toISOString(), accession,
                facts: { form, ...parsed },
              });
            } catch {
              // One unreadable Form 4 shouldn't fail the whole source.
            }
            continue;
          }

          out.push({
            id: stableId("ev", `sec|${accession}`),
            ticker, source: "sec_edgar", type: "filing",
            title: `${sub.name}: ${FORM_LABEL[form] ?? form}`,
            summary: r.items?.[i] ? `8-K items: ${r.items[i]}` : "",
            url, publisher: "SEC EDGAR", publishedAt: accepted.toISOString(), accession,
            facts: { form, items: r.items?.[i] ?? "" },
          });
        }
      }
      return out;
    },
  };
}
