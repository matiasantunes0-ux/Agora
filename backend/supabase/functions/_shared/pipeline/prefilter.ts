import type { NormalizedEvent } from "../types.ts";

// Cheap, free first pass. Drops items that are routine by construction so we
// never spend classifier time (or money, once Claude is on) on them.
// Being permissive is fine: anything that slips through is still judged by the classifier.

const ROUTINE_NEWS = [
  /\b(stocks? (to|you should) (buy|watch)|top \d+ stocks|best stocks)\b/i,
  /\b(here'?s why|what you need to know|should you buy)\b/i,
  /\b(stock (is|was) (up|down|trading)|shares (rise|fall|edge|slip|gain)) (today|on (monday|tuesday|wednesday|thursday|friday))\b/i,
  /\b(ex-dividend|declares (regular|quarterly) dividend|to present at|will participate in|investor (day|conference) presentation)\b/i,
  /\b(price target (maintained|reiterated)|reiterates? (buy|hold|sell))\b/i,
  /\b(etf|mutual fund) (holdings|flows)\b/i,
];

// SEC forms that are almost never material on their own.
const ROUTINE_FORMS = new Set(["S-8", "11-K", "SC 13G", "SC 13G/A", "424B2", "FWP", "CORRESP", "UPLOAD", "DEFA14A"]);

export function isRoutine(ev: NormalizedEvent): boolean {
  if (ev.type === "filing") {
    const form = String(ev.facts?.form ?? "");
    return ROUTINE_FORMS.has(form);
  }
  if (ev.type === "insider_trade") {
    // Only open-market purchases/sales matter; grants, option exercises and tax withholding don't.
    return !(Number(ev.facts?.purchaseValue ?? 0) > 0 || Number(ev.facts?.saleValue ?? 0) > 0);
  }
  const text = `${ev.title} ${ev.summary}`;
  return ROUTINE_NEWS.some((re) => re.test(text));
}

export function prefilter(events: NormalizedEvent[]): NormalizedEvent[] {
  return events.filter((ev) => !isRoutine(ev));
}
