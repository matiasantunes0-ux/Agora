// Supabase Edge Function: one scan of every watched ticker.
// Triggered every 10 minutes by pg_cron (see migrations/0002_schedule.sql.example).
//
// Environment (set with `supabase secrets set ...`):
//   CRON_SECRET          required — shared secret the cron job sends
//   SCAN_MODE            "mock" (default) | "live"
//   FINNHUB_API_KEY      live mode: news + prices (free tier)
//   SEC_CONTACT_EMAIL    live mode: SEC requires a contact in the User-Agent
//   CLASSIFIER           "rules" (default, free) | "claude" (paid)
//   ANTHROPIC_API_KEY    only if CLASSIFIER=claude
//   CLAUDE_MODEL         optional, defaults to claude-opus-5-5
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.

import { createClient } from "npm:@supabase/supabase-js@2";
import { runScan } from "../_shared/pipeline/run.ts";
import { shouldScan } from "../_shared/lib/marketHours.ts";
import { createMockAdapter } from "../_shared/adapters/mock.ts";
import { createFinnhubAdapter } from "../_shared/adapters/finnhub.ts";
import { createSecEdgarAdapter } from "../_shared/adapters/secEdgar.ts";
import { rulesClassifier } from "../_shared/classify/rules.ts";
import { createExpoNotifier } from "../_shared/notify/expoPush.ts";
import type { Classifier, SourceAdapter } from "../_shared/types.ts";
import { createSupabaseStore } from "./supabaseStore.ts";

const env = (k: string) => Deno.env.get(k) ?? "";

function buildAdapters(): SourceAdapter[] {
  if (env("SCAN_MODE") !== "live") return [createMockAdapter()];
  const adapters: SourceAdapter[] = [];
  // Each source is optional: a missing key just means that source is off.
  if (env("SEC_CONTACT_EMAIL")) adapters.push(createSecEdgarAdapter(env("SEC_CONTACT_EMAIL")));
  if (env("FINNHUB_API_KEY")) adapters.push(createFinnhubAdapter(env("FINNHUB_API_KEY")));
  return adapters;
}

async function buildClassifier(): Promise<Classifier> {
  if (env("CLASSIFIER") === "claude" && env("ANTHROPIC_API_KEY")) {
    // Imported lazily so the default (free) path never loads the SDK.
    const { createClaudeClassifier, DEFAULT_CLAUDE_MODEL } = await import("../_shared/classify/claude.ts");
    return createClaudeClassifier(env("ANTHROPIC_API_KEY"), env("CLAUDE_MODEL") || DEFAULT_CLAUDE_MODEL);
  }
  return rulesClassifier;
}

Deno.serve(async (req) => {
  if (!env("CRON_SECRET") || req.headers.get("x-cron-secret") !== env("CRON_SECRET")) {
    return new Response("unauthorized", { status: 401 });
  }

  const force = new URL(req.url).searchParams.get("force") === "1";
  if (!force && !shouldScan(new Date())) {
    return Response.json({ skipped: "outside schedule (hourly off-market)" });
  }

  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const report = await runScan({
    store: createSupabaseStore(db),
    adapters: buildAdapters(),
    classifier: await buildClassifier(),
    notifier: createExpoNotifier(),
    log: console.log,
  });

  return Response.json({
    ...report,
    alerts: report.alerts.map((a) => ({ ticker: a.ticker, kind: a.kind, headline: a.headline })),
  });
});
