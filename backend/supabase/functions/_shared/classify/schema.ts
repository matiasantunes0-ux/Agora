import type { AlertKind, AlertSource, ClassificationOutput, ClassifierInput } from "../types.ts";

export const MAX_HEADLINE_WORDS = 8;
const MAX_WHY_CHARS = 600;

/** JSON Schema sent to Claude as the structured output format. */
export const CLASSIFICATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["material", "kind", "headline", "why_it_matters", "source_event_ids"],
  properties: {
    material: {
      type: "boolean",
      description: "True only if this plausibly changes the stock's value. Routine or neutral news is false.",
    },
    kind: { type: "string", enum: ["opportunity", "threat", "none"] },
    headline: {
      type: "string",
      description: `At most ${MAX_HEADLINE_WORDS} words. Only use numbers that appear in the input.`,
    },
    why_it_matters: { type: "string", description: "2–3 sentences explaining why this matters for the stock." },
    source_event_ids: {
      type: "array",
      items: { type: "string" },
      description: "ids of the input events this alert is based on. At least one.",
    },
  },
} as const;

export type ValidationResult =
  | { status: "alert"; kind: AlertKind; headline: string; whyItMatters: string; sources: AlertSource[] }
  | { status: "not_material" }
  | { status: "rejected"; reason: string };

/**
 * The classifier (Claude or rules) is never trusted directly. Everything it
 * returns is checked here before an alert can exist:
 *  - shape and enum values
 *  - headline ≤ 8 words
 *  - at least one source, and sources must be events we actually fetched
 *    (links come from our data, never from the model)
 *  - every number in the headline must appear in the input data (no invented figures)
 */
export function validateClassification(raw: unknown, input: ClassifierInput): ValidationResult {
  if (!isOutput(raw)) return { status: "rejected", reason: "output does not match schema" };
  if (!raw.material || raw.kind === "none") return { status: "not_material" };

  const headline = raw.headline.trim().replace(/\s+/g, " ");
  const words = headline.split(" ").filter((w) => /[a-z0-9]/i.test(w));
  if (words.length === 0) return { status: "rejected", reason: "empty headline" };
  if (words.length > MAX_HEADLINE_WORDS) {
    return { status: "rejected", reason: `headline has ${words.length} words (max ${MAX_HEADLINE_WORDS})` };
  }

  const why = raw.why_it_matters.trim();
  if (!why || why.length > MAX_WHY_CHARS) return { status: "rejected", reason: "why_it_matters empty or too long" };

  const byId = new Map(input.events.map((e) => [e.id, e]));
  const cited = [...new Set(raw.source_event_ids)].map((id) => byId.get(id)).filter((e) => e !== undefined);
  const sources: AlertSource[] = cited
    .filter((e) => /^https?:\/\//.test(e.url))
    .map((e) => ({ title: e.title, url: e.url, publisher: e.publisher, publishedAt: e.publishedAt }));
  if (sources.length === 0) return { status: "rejected", reason: "no valid sources cited" };

  const ungrounded = ungroundedNumbers(headline, groundingText(input));
  if (ungrounded.length > 0) {
    return { status: "rejected", reason: `headline numbers not found in input: ${ungrounded.join(", ")}` };
  }

  return { status: "alert", kind: raw.kind, headline, whyItMatters: why, sources };
}

function isOutput(v: unknown): v is ClassificationOutput {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.material === "boolean" &&
    (o.kind === "opportunity" || o.kind === "threat" || o.kind === "none") &&
    typeof o.headline === "string" &&
    typeof o.why_it_matters === "string" &&
    Array.isArray(o.source_event_ids) &&
    o.source_event_ids.every((x) => typeof x === "string")
  );
}

/** All the text a headline number could legitimately come from. */
function groundingText(input: ClassifierInput): string {
  const parts: string[] = [];
  for (const e of input.events) {
    parts.push(e.title, e.summary, ...Object.values(e.facts ?? {}).map(String));
  }
  if (input.quote) parts.push(String(input.quote.changePct), String(input.quote.price));
  for (const s of input.signals) parts.push(s.description, ...Object.values(s.values).map(String));
  return parts.join(" \n ");
}

const SCALE: Record<string, number> = {
  k: 1e3, thousand: 1e3, m: 1e6, mm: 1e6, mn: 1e6, million: 1e6, b: 1e9, bn: 1e9, billion: 1e9, t: 1e12, trillion: 1e12,
};

/** "$4.1M" → 4100000, "-9%" → 9, "1,250" → 1250. Signs are ignored ("-9%" and "down 9%" are the same fact). */
export function extractNumbers(text: string): number[] {
  const re = /(\d[\d,]*(?:\.\d+)?)\s?(trillion|billion|million|thousand|bn|mn|mm|[kmbt])?(?![a-z])/gi;
  const out: number[] = [];
  for (const m of text.matchAll(re)) {
    const n = Number(m[1].replace(/,/g, ""));
    if (!Number.isFinite(n)) continue;
    // toPrecision removes float noise (4.1 * 1e6 = 4099999.9999999995).
    out.push(Number((n * (m[2] ? SCALE[m[2].toLowerCase()] : 1)).toPrecision(12)));
  }
  return out;
}

/** Headline numbers with no input number within 10% (allows "$4.1M" for 4,120,000 and "9%" for 9.2). */
export function ungroundedNumbers(headline: string, sourceText: string): string[] {
  const available = extractNumbers(sourceText);
  const bad: string[] = [];
  for (const n of extractNumbers(headline)) {
    const ok = available.some((a) => Math.abs(a - n) <= Math.max(Math.abs(a) * 0.1, 0.5));
    if (!ok) bad.push(String(n));
  }
  return bad;
}
