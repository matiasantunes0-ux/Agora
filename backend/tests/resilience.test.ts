import { test } from "node:test";
import assert from "node:assert/strict";
import { HttpError, fetchWithRetry, redact } from "../supabase/functions/_shared/lib/http.ts";
import { emptyHealth, isOpen, recordResult } from "../supabase/functions/_shared/lib/circuitBreaker.ts";
import { isMarketHours, shouldScan } from "../supabase/functions/_shared/lib/marketHours.ts";
import { parseForm4 } from "../supabase/functions/_shared/adapters/secEdgar.ts";

const noSleep = async () => {};

function fakeFetch(statuses: number[]) {
  let i = 0;
  const calls: string[] = [];
  const impl = (async (url: string) => {
    calls.push(url);
    const status = statuses[Math.min(i++, statuses.length - 1)];
    return new Response("{}", { status });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

test("retries 429/5xx with backoff, then succeeds", async () => {
  const f = fakeFetch([429, 503, 200]);
  const res = await fetchWithRetry("https://api.test/x", {}, { fetchImpl: f.impl, sleep: noSleep });
  assert.equal(res.status, 200);
  assert.equal(f.calls.length, 3);
});

test("does not retry 4xx client errors", async () => {
  const f = fakeFetch([404]);
  await assert.rejects(fetchWithRetry("https://api.test/x", {}, { fetchImpl: f.impl, sleep: noSleep }), HttpError);
  assert.equal(f.calls.length, 1);
});

test("gives up after the retry limit", async () => {
  const f = fakeFetch([500]);
  await assert.rejects(fetchWithRetry("https://api.test/x", {}, { fetchImpl: f.impl, sleep: noSleep, retries: 2 }));
  assert.equal(f.calls.length, 3);
});

test("API keys in URLs are redacted from errors", () => {
  assert.equal(redact("https://finnhub.io/api/v1/quote?symbol=ENB&token=SECRET"), "https://finnhub.io/api/v1/quote?symbol=ENB&token=***");
});

test("circuit opens after 3 straight failures and closes on success", () => {
  const t = new Date("2026-10-21T15:00:00Z");
  let h = emptyHealth("finnhub");
  h = recordResult(h, { ok: false, error: "x" }, t);
  h = recordResult(h, { ok: false, error: "x" }, t);
  assert.equal(isOpen(h, t), false);
  h = recordResult(h, { ok: false, error: "x" }, t);
  assert.equal(isOpen(h, t), true);
  assert.equal(isOpen(h, new Date(t.getTime() + 16 * 60_000)), false); // 15-min cool-down
  h = recordResult(h, { ok: true }, t);
  assert.equal(h.consecutiveFailures, 0);
  assert.equal(isOpen(h, t), false);
});

test("market hours: weekdays 9:30–16:00 ET, not weekends or holidays", () => {
  assert.equal(isMarketHours(new Date("2026-10-21T14:00:00Z")), true); // Wed 10:00 ET
  assert.equal(isMarketHours(new Date("2026-10-21T13:00:00Z")), false); // Wed 09:00 ET
  assert.equal(isMarketHours(new Date("2026-10-24T15:00:00Z")), false); // Saturday
  assert.equal(isMarketHours(new Date("2026-11-26T15:00:00Z")), false); // Thanksgiving
});

test("off-hours scans run only once an hour", () => {
  assert.equal(shouldScan(new Date("2026-10-24T15:05:00Z")), true);
  assert.equal(shouldScan(new Date("2026-10-24T15:25:00Z")), false);
  assert.equal(shouldScan(new Date("2026-10-21T15:25:00Z")), true); // market open → every tick
});

test("Form 4 parser counts open-market buys and sells only", () => {
  const xml = `
    <reportingOwner><reportingOwnerId><rptOwnerName>Doe Jane</rptOwnerName></reportingOwnerId></reportingOwner>
    <nonDerivativeTransaction><transactionCoding><transactionCode>P</transactionCode></transactionCoding>
      <transactionAmounts><transactionShares><value>1000</value></transactionShares>
      <transactionPricePerShare><value>50.5</value></transactionPricePerShare></transactionAmounts></nonDerivativeTransaction>
    <nonDerivativeTransaction><transactionCoding><transactionCode>A</transactionCode></transactionCoding>
      <transactionAmounts><transactionShares><value>9999</value></transactionShares>
      <transactionPricePerShare><value>0</value></transactionPricePerShare></transactionAmounts></nonDerivativeTransaction>
    <nonDerivativeTransaction><transactionCoding><transactionCode>S</transactionCode></transactionCoding>
      <transactionAmounts><transactionShares><value>200</value></transactionShares>
      <transactionPricePerShare><value>60</value></transactionPricePerShare></transactionAmounts></nonDerivativeTransaction>`;
  assert.deepEqual(parseForm4(xml), { insider: "Doe Jane", purchaseValue: 50500, saleValue: 12000 });
});
