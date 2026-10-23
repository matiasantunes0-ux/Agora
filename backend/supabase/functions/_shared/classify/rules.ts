import type { ClassificationOutput, Classifier, ClassifierInput, NormalizedEvent, Signal } from "../types.ts";

// Free, offline classifier used by default (and in mock mode). It only fires on
// clear-cut patterns, so it misses nuance that Claude would catch ("overreaction
// on news hitting <2% of revenue"), but it costs nothing and is deterministic.

/** 4120000 → "$4.1M". Rounded to stay within the validator's 10% grounding tolerance. */
export function formatUsdShort(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${trim(abs / 1e9)}B`;
  if (abs >= 1e6) return `$${trim(abs / 1e6)}M`;
  if (abs >= 1e3) return `$${Math.round(abs / 1e3)}K`;
  return `$${Math.round(abs)}`;
}
const trim = (n: number) => (n >= 10 ? Math.round(n).toString() : n.toFixed(1).replace(/\.0$/, ""));

const NOT_MATERIAL: ClassificationOutput = {
  material: false, kind: "none", headline: "", why_it_matters: "Routine.", source_event_ids: [],
};

interface Rule {
  name: string;
  test: (ctx: RuleContext) => ClassificationOutput | null;
}

interface RuleContext {
  input: ClassifierInput;
  priceMove?: number;
  matching: (re: RegExp) => NormalizedEvent[];
  signal: (name: string) => Signal | undefined;
}

const barelyMoved = (move?: number) => move !== undefined && Math.abs(move) < 3;

const RULES: Rule[] = [
  {
    name: "insider_buying",
    test: ({ input, signal }) => {
      const s = signal("insider_activity");
      const value = Number(s?.values.purchaseValue ?? 0);
      const buyers = Number(s?.values.buyers ?? 0);
      if (!s || value < 500_000 || buyers === 0) return null;
      const trades = input.events.filter((e) => e.type === "insider_trade" && Number(e.facts?.purchaseValue ?? 0) > 0);
      return {
        material: true,
        kind: "opportunity",
        headline: `${buyers} insider${buyers > 1 ? "s" : ""} bought ${formatUsdShort(value)} this week`,
        why_it_matters:
          `Company insiders spent ${formatUsdShort(value)} of their own money buying ${input.ticker} on the open market. ` +
          `Insiders sell for many reasons but usually buy for one: they think the shares are undervalued.`,
        source_event_ids: trades.map((t) => t.id),
      };
    },
  },
  {
    name: "leadership_departure",
    test: ({ matching }) => {
      const re = /\b(ceo|cfo|chief executive|chief financial)\b[^.]{0,80}\b(resign\w*|step(s|ping)? down|depart\w*|exit\w*|leav\w*|fired|ousted|terminated)\b/i;
      const hits = matching(re);
      if (hits.length === 0) return null;
      const text = hits.map((e) => `${e.title} ${e.summary}`).join(" ");
      const role = /\b(cfo|chief financial)\b/i.test(text) && !/\b(ceo|chief executive)\b/i.test(text) ? "CFO" : "CEO";
      const noSuccessor = /\b(no successor|search for (a )?(new|permanent)|has not named|without a successor)\b/i.test(text);
      return {
        material: true,
        kind: "threat",
        headline: noSuccessor ? `${role} departure announced, no successor named` : `${role} departure announced`,
        why_it_matters:
          `A sudden ${role} exit can signal problems the market hasn't seen yet and often stalls strategy. ` +
          (noSuccessor ? "With no successor named, uncertainty may last for months." : "Watch how the transition is handled."),
        source_event_ids: hits.map((e) => e.id),
      };
    },
  },
  {
    name: "guidance_cut",
    test: ({ matching, priceMove }) => {
      const re = /\b((cut|cuts|lower|lowers|lowered|slash\w*|reduc\w*|withdraw\w*)\b[^.]{0,40}\b(guidance|outlook|forecast)|(guidance|outlook|forecast)\b[^.]{0,30}\b(cut|lowered|slashed|reduced|withdrawn))\b/i;
      const hits = matching(re);
      if (hits.length === 0) return null;
      const pct = hits.map((e) => e.title.match(/(\d+(?:\.\d+)?)\s?%/)).find(Boolean)?.[1];
      const base = pct ? `Guidance cut ${pct}%` : "Company cut its guidance";
      return {
        material: true,
        kind: "threat",
        headline: barelyMoved(priceMove) ? `${base}, stock barely moved yet` : base,
        why_it_matters:
          "Management lowered its own forecast, which usually leads analysts to cut estimates. " +
          (barelyMoved(priceMove)
            ? "The share price has barely reacted so far, so the bad news may not be priced in."
            : "Expect estimate revisions over the coming days."),
        source_event_ids: hits.map((e) => e.id),
      };
    },
  },
  {
    name: "guidance_raise",
    test: ({ matching }) => {
      const re = /\b(rais\w*|lift\w*|boost\w*|hik\w*)\b[^.]{0,40}\b(guidance|outlook|forecast)\b/i;
      const hits = matching(re);
      if (hits.length === 0) return null;
      return {
        material: true,
        kind: "opportunity",
        headline: "Company raised its full-year guidance",
        why_it_matters:
          "Management now expects better results than it previously forecast. Raised guidance often leads analysts to lift estimates and price targets.",
        source_event_ids: hits.map((e) => e.id),
      };
    },
  },
  {
    name: "regulatory_or_accounting",
    test: ({ matching }) => {
      const re = /\b((sec|doj|ftc|osc|competition bureau)\b[^.]{0,30}\b(investigat\w*|probe|subpoena\w*|charges?|lawsuit)|restate\w*|accounting irregularit\w*|material weakness|fraud)\b/i;
      const hits = matching(re);
      if (hits.length === 0) return null;
      const accounting = hits.some((e) => /restate|irregularit|material weakness/i.test(`${e.title} ${e.summary}`));
      return {
        material: true,
        kind: "threat",
        headline: accounting ? "Accounting problems disclosed" : "Regulatory probe disclosed",
        why_it_matters: accounting
          ? "Accounting restatements or control weaknesses call the reported numbers into question. They often bring audits, lawsuits and a lower valuation."
          : "A regulator is examining the company. Outcomes range from nothing to large fines or forced changes to the business.",
        source_event_ids: hits.map((e) => e.id),
      };
    },
  },
  {
    name: "dividend_cut",
    test: ({ matching }) => {
      const hits = matching(/\b(cut\w*|suspend\w*|slash\w*|eliminat\w*|reduc\w*)\b[^.]{0,30}\bdividend\b/i);
      if (hits.length === 0) return null;
      return {
        material: true,
        kind: "threat",
        headline: "Dividend cut announced",
        why_it_matters:
          "Companies cut dividends only when cash is tight or priorities change. Income investors often sell, and it can signal weaker results ahead.",
        source_event_ids: hits.map((e) => e.id),
      };
    },
  },
  {
    name: "takeover_target",
    test: ({ matching }) => {
      const hits = matching(/\b(to be acquired|agrees? to be (bought|acquired)|takeover (bid|offer)|buyout offer|go(ing)? private)\b/i);
      if (hits.length === 0) return null;
      return {
        material: true,
        kind: "opportunity",
        headline: "Takeover offer announced",
        why_it_matters:
          "A buyer is offering to purchase the company, usually at a premium to the market price. The deal could still fail on price, financing or regulators.",
        source_event_ids: hits.map((e) => e.id),
      };
    },
  },
];

export function classifyWithRules(input: ClassifierInput): ClassificationOutput {
  const ctx: RuleContext = {
    input,
    priceMove: input.quote?.changePct,
    matching: (re) => input.events.filter((e) => e.type !== "insider_trade" && re.test(`${e.title}. ${e.summary}`)),
    signal: (name) => input.signals.find((s) => s.detector === name),
  };
  for (const rule of RULES) {
    const out = rule.test(ctx);
    if (out) return out;
  }
  return NOT_MATERIAL;
}

export const rulesClassifier: Classifier = {
  name: "rules",
  classify: async (input) => classifyWithRules(input),
};
