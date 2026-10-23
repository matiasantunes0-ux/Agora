import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractNumbers, ungroundedNumbers, validateClassification,
} from "../supabase/functions/_shared/classify/schema.ts";
import { classifyWithRules, formatUsdShort } from "../supabase/functions/_shared/classify/rules.ts";
import { buildUserMessage } from "../supabase/functions/_shared/classify/prompt.ts";
import { runDetectors } from "../supabase/functions/_shared/detectors/index.ts";
import { ev, input } from "./helpers.ts";

const guidance = ev({ id: "g1", title: "Enbridge cuts 2026 guidance 15% on pipeline delays" });

const valid = {
  material: true,
  kind: "threat",
  headline: "Guidance cut 15%, stock barely moved yet",
  why_it_matters: "Management lowered its forecast. The price hasn't reacted.",
  source_event_ids: ["g1"],
};

// ── Validation (applies to Claude and rules output alike) ───────────────────

test("accepts a well-formed, grounded, sourced alert and builds sources from our own data", () => {
  const r = validateClassification(valid, input([guidance]));
  assert.equal(r.status, "alert");
  if (r.status === "alert") {
    assert.equal(r.kind, "threat");
    assert.equal(r.sources[0].url, guidance.url);
  }
});

test("not material → no alert", () => {
  assert.equal(validateClassification({ ...valid, material: false, kind: "none" }, input([guidance])).status, "not_material");
  assert.equal(validateClassification({ ...valid, kind: "none" }, input([guidance])).status, "not_material");
});

test("rejects headlines over 8 words", () => {
  const r = validateClassification({ ...valid, headline: "Enbridge has cut its guidance by 15% and nobody noticed" }, input([guidance]));
  assert.equal(r.status, "rejected");
});

test("allows exactly 8 words, counting tokens like -9% and <2% as words", () => {
  const e = ev({ id: "x", title: "Shares fall 9% on news hitting 2% of revenue" });
  const r = validateClassification({ ...valid, headline: "Overreaction: -9% on news hitting <2% of revenue", source_event_ids: ["x"] }, input([e]));
  assert.equal(r.status, "alert");
});

test("never shows an alert without a source", () => {
  assert.equal(validateClassification({ ...valid, source_event_ids: [] }, input([guidance])).status, "rejected");
  // The model can't invent a source either: unknown ids are dropped.
  assert.equal(validateClassification({ ...valid, source_event_ids: ["made-up"] }, input([guidance])).status, "rejected");
  // Events without a usable link can't be cited.
  const noUrl = ev({ id: "n", title: "Guidance cut 15%", url: "" });
  assert.equal(validateClassification({ ...valid, source_event_ids: ["n"] }, input([noUrl])).status, "rejected");
});

test("rejects numbers in the headline that aren't in the input", () => {
  const r = validateClassification({ ...valid, headline: "Guidance cut 25%, stock barely moved yet" }, input([guidance]));
  assert.equal(r.status, "rejected");
  if (r.status === "rejected") assert.match(r.reason, /25/);
});

test("rejects malformed output", () => {
  for (const bad of [null, "text", { ...valid, kind: "maybe" }, { ...valid, headline: 5 }, { ...valid, source_event_ids: "g1" }]) {
    assert.equal(validateClassification(bad, input([guidance])).status, "rejected");
  }
});

test("number grounding tolerates rounding and units", () => {
  assert.deepEqual(extractNumbers("$4.1M, -9%, 1,250 and 2bn"), [4_100_000, 9, 1250, 2_000_000_000]);
  assert.deepEqual(ungroundedNumbers("3 insiders bought $4.1M", "buyers 3 purchaseValue 4120000"), []);
  assert.deepEqual(ungroundedNumbers("Down 9%", "changePct -9.2"), []);
  assert.deepEqual(ungroundedNumbers("Down 12%", "changePct -9.2"), ["12"]);
});

test("prompt includes event ids and marks event text as data", () => {
  const msg = buildUserMessage(input([guidance]));
  assert.match(msg, /"id": "g1"/);
  assert.match(msg, /<input>/);
});

// ── Rule-based classifier (the free default) ─────────────────────────────────

test("guidance cut with a tiny price move → threat, 'barely moved' headline", () => {
  const i = input([guidance], { quote: { ticker: "ENB", price: 61, changePct: -0.4 } });
  const out = classifyWithRules(i);
  assert.equal(out.kind, "threat");
  assert.equal(out.headline, "Guidance cut 15%, stock barely moved yet");
  assert.equal(validateClassification(out, i).status, "alert");
});

test("guidance cut after a big move → threat without the 'barely moved' clause", () => {
  const out = classifyWithRules(input([guidance], { quote: { ticker: "ENB", price: 55, changePct: -8 } }));
  assert.equal(out.headline, "Guidance cut 15%");
});

test("CEO exit with no successor → threat", () => {
  const e = ev({ ticker: "STN.TO", title: "Stantec CEO resigns effective immediately", summary: "The board has not named a successor." });
  const out = classifyWithRules(input([e]));
  assert.equal(out.kind, "threat");
  assert.equal(out.headline, "CEO departure announced, no successor named");
});

test("insider buying across several Form 4s → opportunity with grounded total", () => {
  const trades = [
    ev({ ticker: "META", type: "insider_trade", title: "Form 4", facts: { insider: "A", purchaseValue: 1_850_000 } }),
    ev({ ticker: "META", type: "insider_trade", title: "Form 4", facts: { insider: "B", purchaseValue: 1_200_000 } }),
    ev({ ticker: "META", type: "insider_trade", title: "Form 4", facts: { insider: "C", purchaseValue: 1_070_000 } }),
  ];
  const i = input(trades, { signals: runDetectors({ ticker: "META", events: trades }) });
  const out = classifyWithRules(i);
  assert.equal(out.kind, "opportunity");
  assert.equal(out.headline, "3 insiders bought $4.1M this week");
  assert.equal(out.source_event_ids.length, 3);
  assert.equal(validateClassification(out, i).status, "alert");
});

test("small insider purchases are not material", () => {
  const t = [ev({ type: "insider_trade", title: "Form 4", facts: { insider: "A", purchaseValue: 40_000 } })];
  assert.equal(classifyWithRules(input(t, { signals: runDetectors({ ticker: "ENB", events: t }) })).material, false);
});

test("neutral news is not material", () => {
  assert.equal(classifyWithRules(input([ev({ title: "Apple releases new colors for iPhone cases" })])).material, false);
});

test("raised guidance → opportunity", () => {
  assert.equal(classifyWithRules(input([ev({ title: "Nvidia raises full-year outlook on data-center demand" })])).kind, "opportunity");
});

test("formatUsdShort", () => {
  assert.equal(formatUsdShort(4_120_000), "$4.1M");
  assert.equal(formatUsdShort(950_000), "$950K");
  assert.equal(formatUsdShort(12_400_000), "$12M");
  assert.equal(formatUsdShort(2_500_000_000), "$2.5B");
});
