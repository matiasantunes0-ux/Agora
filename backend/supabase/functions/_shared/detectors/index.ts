import type { NormalizedEvent, Quote, Signal } from "../types.ts";

/**
 * A detector looks at one story (cluster) and adds structured, source-grounded
 * facts for the classifier. To add a new alert feature (e.g. "unusual options
 * volume", "short interest spike"), write a detector and add it to DETECTORS —
 * the pipeline, classifier and app don't need to change.
 */
export interface Detector {
  name: string;
  detect(ctx: { ticker: string; events: NormalizedEvent[]; quote?: Quote }): Signal | null;
}

// Moves smaller than this are treated as "barely moved".
const BIG_MOVE_PCT = 3;

export const priceReaction: Detector = {
  name: "price_reaction",
  detect({ quote }) {
    if (!quote) return null;
    const move = Math.round(quote.changePct * 10) / 10;
    return {
      detector: "price_reaction",
      description:
        Math.abs(move) >= BIG_MOVE_PCT
          ? `Stock moved ${move}% today — a large reaction.`
          : `Stock moved only ${move}% today — the market has barely reacted.`,
      values: { changePct: move, price: quote.price },
    };
  },
};

export const insiderBuying: Detector = {
  name: "insider_activity",
  detect({ events }) {
    const trades = events.filter((e) => e.type === "insider_trade");
    if (trades.length === 0) return null;

    const buyers = new Set<string>();
    const sellers = new Set<string>();
    let bought = 0;
    let sold = 0;
    for (const t of trades) {
      const who = String(t.facts?.insider ?? t.id);
      const p = Number(t.facts?.purchaseValue ?? 0);
      const s = Number(t.facts?.saleValue ?? 0);
      if (p > 0) { buyers.add(who); bought += p; }
      if (s > 0) { sellers.add(who); sold += s; }
    }
    return {
      detector: "insider_activity",
      description: `${buyers.size} insider(s) bought $${Math.round(bought)} and ${sellers.size} sold $${Math.round(sold)} in open-market trades this week.`,
      values: { buyers: buyers.size, purchaseValue: Math.round(bought), sellers: sellers.size, saleValue: Math.round(sold) },
    };
  },
};

export const DETECTORS: Detector[] = [priceReaction, insiderBuying];

export function runDetectors(ctx: Parameters<Detector["detect"]>[0], detectors = DETECTORS): Signal[] {
  return detectors.map((d) => d.detect(ctx)).filter((s): s is Signal => s !== null);
}
