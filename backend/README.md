# Agora alerts backend

Scans news and filings for watched tickers and creates **Opportunity** / **Threat** alerts.
Runs as a Supabase Edge Function on a 10-minute cron. Everything defaults to free/mock.

```
cron (every 10 min) → scan function
  → adapters (mock | SEC EDGAR | Finnhub)        _shared/adapters/
  → prefilter routine items                       _shared/pipeline/prefilter.ts
  → dedupe into stories (1 story = max 1 alert)   _shared/pipeline/dedupe.ts
  → detectors add facts (price move, insiders)    _shared/detectors/
  → classify (rules = free | Claude = paid)       _shared/classify/
  → validate (≤8 words, has source, no invented numbers)
  → store + push (Expo)                           _shared/notify/
```

## Test locally (no accounts, no keys)

Needs Node 22.18+ (runs the TypeScript directly).

```bash
cd backend
npm test
npm run demo
```

## Deploy (free tier)

1. Create a project at supabase.com (free).
2. Install the CLI and link:
   ```bash
   cd backend
   npx supabase init
   npx supabase login
   npx supabase link --project-ref <PROJECT_REF>
   npx supabase db push
   ```
3. Dashboard → Authentication → Sign In / Providers → enable **Anonymous sign-ins**.
4. Set secrets and deploy:
   ```bash
   npx supabase secrets set CRON_SECRET=$(openssl rand -hex 24) SCAN_MODE=mock
   npx supabase functions deploy scan --no-verify-jwt
   ```
5. Schedule it: edit `supabase/migrations/0002_schedule.sql.example` (project ref + the same CRON_SECRET) and run it in the SQL editor.
6. Test by hand:
   ```bash
   curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/scan?force=1" -H "x-cron-secret: <CRON_SECRET>"
   ```

### Real data (still free)

```bash
npx supabase secrets set SCAN_MODE=live SEC_CONTACT_EMAIL=you@example.com FINNHUB_API_KEY=<free key from finnhub.io>
```
- SEC EDGAR covers US companies only. TSX tickers (`.TO`) get news + price alerts only.
- Finnhub free-tier coverage of TSX symbols isn't guaranteed. Unsupported symbols just return no news.

### Claude classifier (costs money, off by default)

```bash
npx supabase secrets set CLASSIFIER=claude ANTHROPIC_API_KEY=<key>
```
Without these, the free rule-based classifier is used. It catches clear-cut events (guidance cuts,
CEO exits, insider buying, probes, dividend cuts, takeovers) but not nuance like "overreaction on news
hitting <2% of revenue".

## Adding things later

- **New data source:** implement `SourceAdapter` (`_shared/types.ts`), add it in `scan/index.ts`.
- **New alert feature:** write a `Detector` (`_shared/detectors/index.ts`) and, for the free path, a rule in `classify/rules.ts`.
- All classifier output goes through `validateClassification`, whatever produced it.
