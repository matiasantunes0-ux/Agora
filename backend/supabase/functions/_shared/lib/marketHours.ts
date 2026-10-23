// Decides whether a cron tick should actually scan.
// Cron fires every 10 minutes; we scan on every tick during market hours and
// only on the first tick of each hour otherwise.

// NYSE full-day closures. TSX closes on a slightly different set; on those days
// we just fall back to the hourly cadence, which is fine for a demo.
// Keep this list updated yearly.
const US_MARKET_HOLIDAYS = new Set([
  "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25", "2026-06-19",
  "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",
  "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31", "2027-06-18",
  "2027-07-05", "2027-09-06", "2027-11-25", "2027-12-24",
]);

function easternParts(now: Date) {
  // Intl handles daylight saving for us; both NYSE and TSX trade on Eastern time.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    weekday: get("weekday"),
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

export function isMarketHours(now: Date): boolean {
  const { date, weekday, minutes } = easternParts(now);
  if (weekday === "Sat" || weekday === "Sun") return false;
  if (US_MARKET_HOLIDAYS.has(date)) return false;
  return minutes >= 9 * 60 + 30 && minutes < 16 * 60;
}

/** Cron runs every 10 min. Outside market hours only the tick in the first 10 minutes of the hour scans. */
export function shouldScan(now: Date): boolean {
  return isMarketHours(now) || now.getUTCMinutes() < 10;
}
