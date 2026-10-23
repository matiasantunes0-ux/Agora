import AsyncStorage from '@react-native-async-storage/async-storage';
import { MAX_WATCHLIST } from './constants';
import { incomingAlertFor, seedAlerts } from './mockData';

// On-device stand-in for the backend. Same interface as liveService.js.

const WATCHLIST_KEY = 'alerts.mock.watchlist';
const DEFAULT_WATCHLIST = ['META', 'ENB']; // matches the demo portfolio
const NEW_ALERT_EVERY_MS = 25_000;

const allAlerts = seedAlerts();
const usedIncoming = new Set();
let watchlist = null;

async function loadWatchlist() {
  if (watchlist) return watchlist;
  try {
    const saved = JSON.parse((await AsyncStorage.getItem(WATCHLIST_KEY)) ?? 'null');
    watchlist = Array.isArray(saved) ? saved : [...DEFAULT_WATCHLIST];
  } catch {
    watchlist = [...DEFAULT_WATCHLIST];
  }
  return watchlist;
}

async function saveWatchlist() {
  try {
    await AsyncStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
  } catch {
    // Not fatal: the watchlist still works for this session.
  }
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export const mockService = {
  mode: 'mock',

  async getWatchlist() {
    return [...(await loadWatchlist())];
  },

  async addTicker(ticker) {
    const list = await loadWatchlist();
    if (list.includes(ticker)) return;
    if (list.length >= MAX_WATCHLIST) throw new Error(`Watchlist is limited to ${MAX_WATCHLIST} tickers`);
    watchlist = [...list, ticker];
    await saveWatchlist();
  },

  async removeTicker(ticker) {
    watchlist = (await loadWatchlist()).filter((t) => t !== ticker);
    await saveWatchlist();
  },

  /** Alerts for the user's watchlist, newest first (the backend does this filtering via RLS). */
  async getAlerts() {
    await delay(300); // feel like a network call
    const list = await loadWatchlist();
    return allAlerts
      .filter((a) => list.includes(a.ticker))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  /** Which sources are currently delayed. Mock: always healthy. */
  async getSourceStatus() {
    return { delayed: [] };
  },

  /** Simulates the backend finding something new while the app is open. */
  subscribe(onAlert) {
    const timer = setInterval(async () => {
      const alert = incomingAlertFor(await loadWatchlist(), usedIncoming);
      if (alert) {
        allAlerts.push(alert);
        onAlert(alert);
      }
    }, NEW_ALERT_EVERY_MS);
    return () => clearInterval(timer);
  },

  async registerPushToken() {
    // Mock mode uses local notifications instead of server pushes.
  },
};
