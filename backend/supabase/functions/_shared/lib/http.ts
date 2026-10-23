// HTTP helpers shared by every adapter: per-source throttling + retries.

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Spaces out calls to one provider so we stay under its free-tier limit
 * (e.g. SEC asks for <= 10 req/s, Finnhub free is 60 req/min).
 * Calls are chained on a promise so concurrent callers queue up in order.
 */
export class Throttle {
  private last = 0;
  private chain: Promise<void> = Promise.resolve();
  private minIntervalMs: number;
  private sleep: (ms: number) => Promise<void>;

  constructor(minIntervalMs: number, sleep = defaultSleep) {
    this.minIntervalMs = minIntervalMs;
    this.sleep = sleep;
  }

  wait(): Promise<void> {
    this.chain = this.chain.then(async () => {
      const elapsed = Date.now() - this.last;
      if (elapsed < this.minIntervalMs) await this.sleep(this.minIntervalMs - elapsed);
      this.last = Date.now();
    });
    return this.chain;
  }
}

export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  fetchImpl?: typeof fetch;
}

const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);

/**
 * fetch() with exponential backoff + jitter on 429/5xx and network errors.
 * Honors Retry-After when the server sends it. Non-retryable statuses
 * (400, 401, 403, 404…) throw immediately — retrying them only burns quota.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  opts: RetryOptions = {},
): Promise<Response> {
  const { retries = 3, baseDelayMs = 500, maxDelayMs = 8000, sleep = defaultSleep, fetchImpl = fetch } = opts;

  for (let attempt = 0; ; attempt++) {
    let res: Response | undefined;
    try {
      res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(15_000) });
    } catch (err) {
      if (attempt >= retries) throw err;
    }

    if (res) {
      if (res.ok) return res;
      if (!RETRYABLE.has(res.status) || attempt >= retries) {
        throw new HttpError(res.status, `${res.status} from ${redact(url)}`);
      }
    }

    const retryAfter = Number(res?.headers.get("retry-after"));
    const backoff = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
    // Full jitter: spread retries out so many functions don't hit the API in lockstep.
    const delay = retryAfter > 0 ? retryAfter * 1000 : Math.random() * backoff;
    await sleep(delay);
  }
}

/** Never log API keys that live in query strings (Finnhub uses ?token=). */
export function redact(url: string): string {
  return url.replace(/([?&](token|apikey|api_key)=)[^&]+/gi, "$1***");
}

function defaultSleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}
