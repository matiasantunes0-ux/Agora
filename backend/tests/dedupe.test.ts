import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assignClusters, canonicalUrl, similarity, titleTokens,
} from "../supabase/functions/_shared/pipeline/dedupe.ts";
import { prefilter } from "../supabase/functions/_shared/pipeline/prefilter.ts";
import { ev } from "./helpers.ts";

test("canonicalUrl strips tracking params, fragments, www and trailing slash", () => {
  assert.equal(
    canonicalUrl("https://WWW.Reuters.com/markets/enb-cut/?utm_source=x&utm_medium=y#top"),
    "https://reuters.com/markets/enb-cut",
  );
  // Meaningful params are kept (and sorted so order doesn't matter).
  assert.equal(canonicalUrl("https://x.com/a?b=2&a=1"), canonicalUrl("https://x.com/a?a=1&b=2&fbclid=zzz"));
});

test("titleTokens ignores the ticker, filler words and plural endings", () => {
  const t = titleTokens("Enbridge stock cuts guidance on ENB pipeline delays", "ENB");
  assert.ok(t.has("cut") && t.has("guidance") && t.has("pipeline") && t.has("delay"));
  assert.ok(!t.has("enb") && !t.has("stock") && !t.has("on"));
});

test("the same story from 3 outlets becomes one cluster", () => {
  const events = [
    ev({ title: "Enbridge cuts 2026 guidance 15% on pipeline delays", publisher: "Reuters" }),
    ev({ title: "Enbridge cuts guidance 15% as pipeline delays bite", publisher: "Bloomberg", publishedAt: "2026-10-20T15:00:00.000Z" }),
    ev({ title: "Enbridge cuts 2026 guidance 15%, cites pipeline delays", publisher: "Globe", publishedAt: "2026-10-20T16:00:00.000Z" }),
  ];
  const { clusters } = assignClusters([], events);
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].eventIds.length, 3);
});

test("different stories about the same ticker stay separate", () => {
  const { clusters } = assignClusters([], [
    ev({ title: "Enbridge cuts 2026 guidance 15% on pipeline delays" }),
    ev({ title: "Enbridge CEO to retire next year, successor named" }),
  ]);
  assert.equal(clusters.length, 2);
});

test("similar headlines for different tickers never merge", () => {
  const { clusters } = assignClusters([], [
    ev({ ticker: "ENB", title: "Company cuts guidance 15% on weak demand" }),
    ev({ ticker: "TRP", title: "Company cuts guidance 15% on weak demand" }),
  ]);
  assert.equal(clusters.length, 2);
});

test("the same headline more than 48h apart is a new story", () => {
  const { clusters } = assignClusters([], [
    ev({ title: "Enbridge cuts guidance 15%", publishedAt: "2026-10-01T14:00:00.000Z" }),
    ev({ title: "Enbridge cuts guidance 15%", publishedAt: "2026-10-10T14:00:00.000Z" }),
  ]);
  assert.equal(clusters.length, 2);
});

test("same URL with tracking params, or same SEC accession, always merges", () => {
  const { clusters } = assignClusters([], [
    ev({ title: "Totally different headline A", url: "https://x.com/story?utm_source=a" }),
    ev({ title: "Unrelated words B", url: "https://www.x.com/story/" }),
    ev({ title: "8-K filed", accession: "0001-26-01", url: "https://sec.gov/a" }),
    ev({ title: "Current report", accession: "0001-26-01", url: "https://sec.gov/b" }),
  ]);
  assert.equal(clusters.length, 2);
});

test("insider trades for a ticker share one cluster per week", () => {
  const { clusters } = assignClusters([], [
    ev({ type: "insider_trade", title: "Form 4: A", accession: "1", publishedAt: "2026-10-19T14:00:00.000Z" }), // Mon
    ev({ type: "insider_trade", title: "Form 4: B", accession: "2", publishedAt: "2026-10-22T14:00:00.000Z" }), // Thu
    ev({ type: "insider_trade", title: "Form 4: C", accession: "3", publishedAt: "2026-10-27T14:00:00.000Z" }), // next week
  ]);
  assert.equal(clusters.length, 2);
  assert.equal(clusters.find((c) => c.eventIds.length === 2)?.title, "ENB insider trades");
});

test("re-fetching an event already in a cluster doesn't mark it as new", () => {
  const first = assignClusters([], [ev({ id: "dup", title: "Enbridge cuts guidance 15%" })]);
  const second = assignClusters(first.clusters, [ev({ id: "dup", title: "Enbridge cuts guidance 15%" })]);
  assert.equal(second.clusters.length, 1);
  assert.equal(second.touched.size, 0);
});

test("a late outlet joins an existing cluster and marks it touched", () => {
  const first = assignClusters([], [ev({ title: "Enbridge cuts 2026 guidance 15% on pipeline delays" })]);
  const id = first.clusters[0].id;
  const second = assignClusters(first.clusters, [
    ev({ title: "Enbridge cuts guidance 15% on pipeline delays", publishedAt: "2026-10-20T18:00:00.000Z" }),
  ]);
  assert.equal(second.clusters.length, 1);
  assert.ok(second.touched.has(id));
});

test("similarity is 0 for empty sets and 1 for identical ones", () => {
  assert.equal(similarity(new Set(), new Set(["a"])), 0);
  assert.equal(similarity(new Set(["a", "b"]), new Set(["a", "b"])), 1);
});

test("prefilter drops routine news, routine forms and non-market insider transactions", () => {
  const kept = prefilter([
    ev({ title: "Enbridge declares quarterly dividend" }),
    ev({ title: "3 top stocks to buy in November" }),
    ev({ title: "Analyst reiterates Buy on Enbridge" }),
    ev({ type: "filing", title: "S-8", facts: { form: "S-8" } }),
    ev({ type: "insider_trade", title: "Form 4 grant", facts: { purchaseValue: 0, saleValue: 0 } }),
    ev({ title: "Enbridge cuts guidance 15%" }),
    ev({ type: "filing", title: "8-K", facts: { form: "8-K" } }),
  ]);
  assert.deepEqual(kept.map((e) => e.title), ["Enbridge cuts guidance 15%", "8-K"]);
});
