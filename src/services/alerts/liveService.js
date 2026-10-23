import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';

// Talks to the Supabase backend. Only the public "anon" key is in the app — it is
// designed to be public and can only do what the row-level-security policies allow.
// All secret keys (Finnhub, Anthropic, service role) live on the server.

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: { storage: AsyncStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      })
    : null;

// Each install signs in anonymously once; the session is kept in AsyncStorage.
let sessionPromise = null;
function ensureSession() {
  if (!supabase) throw new Error('Live mode needs EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY');
  sessionPromise ??= (async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
    }
  })().catch((err) => {
    sessionPromise = null; // allow a retry on the next call
    throw err;
  });
  return sessionPromise;
}

const ALERT_COLUMNS = 'id, ticker, kind, headline, why_it_matters, created_at, alert_sources(title, url, publisher, published_at)';

function toAlert(row) {
  return {
    id: row.id,
    ticker: row.ticker,
    kind: row.kind,
    headline: row.headline,
    whyItMatters: row.why_it_matters,
    createdAt: row.created_at,
    sources: (row.alert_sources ?? []).map((s) => ({
      title: s.title, url: s.url, publisher: s.publisher, publishedAt: s.published_at,
    })),
  };
}

function check({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

export const liveService = {
  mode: 'live',

  async getWatchlist() {
    await ensureSession();
    const rows = check(await supabase.from('watchlist_items').select('ticker').order('created_at'));
    return rows.map((r) => r.ticker);
  },

  async addTicker(ticker) {
    await ensureSession();
    const { error } = await supabase.from('watchlist_items').insert({ ticker });
    if (error && error.code !== '23505') throw new Error(error.message); // 23505 = already added
  },

  async removeTicker(ticker) {
    await ensureSession();
    check(await supabase.from('watchlist_items').delete().eq('ticker', ticker));
  },

  async getAlerts() {
    await ensureSession();
    const rows = check(
      await supabase.from('alerts').select(ALERT_COLUMNS).order('created_at', { ascending: false }).limit(100),
    );
    // Never show an alert without a source, even if one slipped through.
    return rows.map(toAlert).filter((a) => a.sources.length > 0);
  },

  async getSourceStatus() {
    await ensureSession();
    const rows = check(
      await supabase.from('source_health').select('source, open_until').gt('open_until', new Date().toISOString()),
    );
    return { delayed: rows.map((r) => r.source) };
  },

  /** Realtime: new alerts the user is allowed to see (RLS applies to realtime too). */
  subscribe(onAlert) {
    let channel;
    ensureSession()
      .then(() => {
        channel = supabase
          .channel('alerts-feed')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerts' }, async ({ new: row }) => {
            // The insert event has no joined sources; fetch the full row.
            const { data } = await supabase.from('alerts').select(ALERT_COLUMNS).eq('id', row.id).maybeSingle();
            if (data) {
              const alert = toAlert(data);
              if (alert.sources.length > 0) onAlert(alert);
            }
          })
          .subscribe();
      })
      .catch(() => {}); // feed still works via pull-to-refresh
    return () => channel && supabase.removeChannel(channel);
  },

  async registerPushToken(token) {
    await ensureSession();
    check(await supabase.from('push_tokens').upsert({ token, platform: Platform.OS, updated_at: new Date().toISOString() }));
  },
};
