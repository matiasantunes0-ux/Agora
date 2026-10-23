import type { SourceHealth, SourceName } from "../types.ts";

// After this many failed scans in a row, stop calling the source for a while.
const FAILURE_THRESHOLD = 3;
// Cool-down grows with each extra failure, capped at 2 hours.
const BASE_COOLDOWN_MS = 15 * 60_000;
const MAX_COOLDOWN_MS = 2 * 60 * 60_000;

export function emptyHealth(source: SourceName): SourceHealth {
  return { source, consecutiveFailures: 0, openUntil: null, lastSuccess: null, lastError: null };
}

/** True when the circuit is open, i.e. we should skip this source for now. */
export function isOpen(health: SourceHealth, now: Date): boolean {
  return health.openUntil !== null && new Date(health.openUntil) > now;
}

/** Pure state transition, so it is easy to unit test and to persist. */
export function recordResult(
  health: SourceHealth,
  outcome: { ok: true } | { ok: false; error: string },
  now: Date,
): SourceHealth {
  if (outcome.ok) {
    return { ...health, consecutiveFailures: 0, openUntil: null, lastSuccess: now.toISOString() };
  }

  const failures = health.consecutiveFailures + 1;
  let openUntil: string | null = null;
  if (failures >= FAILURE_THRESHOLD) {
    const cooldown = Math.min(MAX_COOLDOWN_MS, BASE_COOLDOWN_MS * 2 ** (failures - FAILURE_THRESHOLD));
    openUntil = new Date(now.getTime() + cooldown).toISOString();
  }
  return { ...health, consecutiveFailures: failures, openUntil, lastError: outcome.error.slice(0, 300) };
}
