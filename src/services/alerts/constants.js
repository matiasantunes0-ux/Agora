// "mock" (default): runs entirely on-device with demo data — no keys, no cost.
// "live": talks to the Supabase backend (needs EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY).
export const ALERTS_MODE = process.env.EXPO_PUBLIC_ALERTS_MODE === 'live' ? 'live' : 'mock';

export const MAX_WATCHLIST = 5;

// Same rule as the database check constraint: AAPL, BRK.B, STN.TO, RCI-B.TO, SHOP.TO…
const TICKER_RE = /^[A-Z0-9]{1,6}([.-][A-Z0-9]{1,3})?(\.(TO|V|CN|NE))?$/;

/** Cleans user input ("  stn.to " → "STN.TO"). Returns null if it can't be a ticker. */
export function normalizeTicker(raw) {
  const t = String(raw ?? '').trim().toUpperCase().replace(/^\$/, '');
  return TICKER_RE.test(t) ? t : null;
}
