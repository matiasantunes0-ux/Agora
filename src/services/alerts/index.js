import { ALERTS_MODE } from './constants';

// Single switch between demo data and the real backend. Screens import
// `alertsService` and never care which one they get.
export const alertsService =
  ALERTS_MODE === 'live' ? require('./liveService').liveService : require('./mockService').mockService;

export { ALERTS_MODE, MAX_WATCHLIST, normalizeTicker } from './constants';
