import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { alertsService, MAX_WATCHLIST, normalizeTicker } from './index';
import { ensureNotificationPermission, getExpoPushToken, showLocalAlertNotification } from '../notifications';

const CACHE_KEY = 'alerts.cache.v1';

/**
 * All state for the Alerts page. Fails soft: if the backend can't be reached,
 * the last saved feed is shown with a banner instead of an error screen.
 */
export function useAlertsFeed() {
  const [watchlist, setWatchlist] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [delayedSources, setDelayedSources] = useState([]);
  const [newIds, setNewIds] = useState(() => new Set());
  const watchlistRef = useRef(watchlist);
  watchlistRef.current = watchlist;

  const cache = useCallback(async (list) => {
    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(list.slice(0, 100)));
    } catch {}
  }, []);

  const load = useCallback(async () => {
    const [wl, feed, status] = await Promise.allSettled([
      alertsService.getWatchlist(),
      alertsService.getAlerts(),
      alertsService.getSourceStatus(),
    ]);
    if (wl.status === 'fulfilled') setWatchlist(wl.value);
    if (status.status === 'fulfilled') setDelayedSources(status.value.delayed);

    if (feed.status === 'fulfilled') {
      setAlerts(feed.value);
      setOffline(false);
      cache(feed.value);
    } else {
      setOffline(true);
      try {
        const saved = JSON.parse((await AsyncStorage.getItem(CACHE_KEY)) ?? '[]');
        setAlerts((current) => (current.length ? current : saved));
      } catch {}
    }
  }, [cache]);

  // First load + notifications + live updates.
  useEffect(() => {
    let unsubscribe = () => {};
    (async () => {
      await load();
      setLoading(false);

      const allowed = await ensureNotificationPermission();
      if (allowed && alertsService.mode === 'live') {
        const token = await getExpoPushToken();
        if (token) alertsService.registerPushToken(token).catch(() => {});
      }

      unsubscribe = alertsService.subscribe((alert) => {
        if (!watchlistRef.current.includes(alert.ticker)) return;
        setAlerts((current) => {
          if (current.some((a) => a.id === alert.id)) return current;
          const next = [alert, ...current];
          cache(next);
          return next;
        });
        setNewIds((s) => new Set(s).add(alert.id));
        // In live mode the server sends the push; in demo mode we fake it locally.
        if (alertsService.mode === 'mock' && allowed) showLocalAlertNotification(alert);
      });
    })();
    return () => unsubscribe();
  }, [load, cache]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  /** Returns an error message, or null on success. Optimistic with rollback. */
  const addTicker = useCallback(async (raw) => {
    const ticker = normalizeTicker(raw);
    if (!ticker) return 'Enter a valid ticker, e.g. AAPL or STN.TO';
    if (watchlistRef.current.includes(ticker)) return `${ticker} is already on your watchlist`;
    if (watchlistRef.current.length >= MAX_WATCHLIST) return `You can watch up to ${MAX_WATCHLIST} stocks`;

    setWatchlist((w) => [...w, ticker]);
    try {
      await alertsService.addTicker(ticker);
      const feed = await alertsService.getAlerts();
      setAlerts(feed);
      cache(feed);
      return null;
    } catch (err) {
      setWatchlist((w) => w.filter((t) => t !== ticker));
      return err?.message ?? 'Could not add ticker';
    }
  }, [cache]);

  const removeTicker = useCallback(async (ticker) => {
    const prevWatchlist = watchlistRef.current;
    setWatchlist((w) => w.filter((t) => t !== ticker));
    setAlerts((a) => a.filter((x) => x.ticker !== ticker));
    try {
      await alertsService.removeTicker(ticker);
    } catch {
      setWatchlist(prevWatchlist);
      load();
    }
  }, [load]);

  const markSeen = useCallback((id) => {
    setNewIds((s) => {
      if (!s.has(id)) return s;
      const next = new Set(s);
      next.delete(id);
      return next;
    });
  }, []);

  return {
    mode: alertsService.mode,
    watchlist, alerts, loading, refreshing, offline, delayedSources, newIds,
    refresh, addTicker, removeTicker, markSeen,
  };
}
