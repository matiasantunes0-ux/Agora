# Agora

Finance-focused social app (React Native + Expo). Two tabs:

- **Profile:** portfolio chart, returns, ideas and posts.
- **Alerts:** a watchlist of up to 5 stocks, and a feed of Opportunity / Threat alerts when something material happens.

## Run it

```bash
npm install
npx expo start --clear
```
Scan the QR code with **Expo Go**. The Alerts tab runs on **demo data** by default (no keys, no cost).
While it's open, a new demo alert arrives about every 25 seconds, with a notification.

## Live alerts (optional)

1. Set up the backend: see [backend/README.md](backend/README.md).
2. Create `.env` in this folder:
   ```
   EXPO_PUBLIC_ALERTS_MODE=live
   EXPO_PUBLIC_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
   ```
   Only the public anon key goes in the app. Secret keys stay on the backend.
3. Server push notifications need a development build (`eas build --profile development`).
   On iPhone that also needs an Apple Developer account ($99/year). Expo Go can't receive them.

## Files

- `App.js`: bottom tabs.
- `src/screens/`: `ProfileScreen`, `AlertsScreen`.
- `src/components/alerts/`: `AlertCard`, `WatchlistBar`, `AlertFilters`.
- `src/services/alerts/`: `mockService` (demo) / `liveService` (Supabase), chosen by `EXPO_PUBLIC_ALERTS_MODE`.
- `src/theme.js`: colors.
- `backend/`: scanner pipeline, database schema, tests.

## Publish / build with EAS

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build -p android
```
