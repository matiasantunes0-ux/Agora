import type { Alert } from "../types.ts";
import type { Notifier } from "../pipeline/store.ts";
import { fetchWithRetry } from "../lib/http.ts";

// Expo's push service is free. It forwards to APNs (iOS) and FCM (Android), so
// Apple/Google credentials live with Expo, never in the app or this function.
// Real delivery to iPhones needs an EAS development build + Apple Developer account.

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const BATCH = 100; // Expo's per-request message limit

export function createExpoNotifier(fetchImpl: typeof fetch = fetch): Notifier {
  return {
    async notify(alert: Alert, tokens: string[]) {
      const valid = tokens.filter((t) => /^Expo(nent)?PushToken\[.+\]$/.test(t));
      for (let i = 0; i < valid.length; i += BATCH) {
        const messages = valid.slice(i, i + BATCH).map((to) => ({
          to,
          sound: "default",
          title: `${alert.ticker} · ${alert.kind === "opportunity" ? "Opportunity" : "Threat"}`,
          body: alert.headline,
          data: { alertId: alert.id, ticker: alert.ticker },
        }));
        await fetchWithRetry(EXPO_PUSH_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(messages),
        }, { fetchImpl });
      }
    },
  };
}

/** Used in mock mode and tests. */
export const consoleNotifier: Notifier = {
  async notify(alert, tokens) {
    console.log(`[push → ${tokens.length} device(s)] ${alert.ticker} ${alert.kind.toUpperCase()}: ${alert.headline}`);
  },
};
