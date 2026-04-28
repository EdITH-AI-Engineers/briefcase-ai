export type RetryOptions = {
  retries?: number;
  minDelayMs?: number;
  maxDelayMs?: number;
  onRetry?: (err: unknown, attempt: number, delayMs: number) => void;
};

const TRANSIENT_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const TRANSIENT_CODES = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ECONNREFUSED",
  "EPIPE",
  "UND_ERR_SOCKET",
  "ECONNABORTED",
]);

export function isTransientError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { status?: number; code?: string };
  if (typeof e.status === "number" && TRANSIENT_STATUS.has(e.status)) return true;
  if (typeof e.code === "string" && TRANSIENT_CODES.has(e.code)) return true;
  // SyntaxError from JSON.parse means the model returned truncated or
  // malformed JSON — treat as transient so the call gets retried
  // instead of aborting the whole run.
  if (err instanceof SyntaxError) return true;
  return false;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const retries = opts.retries ?? 5;
  const minDelay = opts.minDelayMs ?? 1500;
  const maxDelay = opts.maxDelayMs ?? 30_000;

  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= retries || !isTransientError(err)) throw err;
      const backoff = Math.min(maxDelay, minDelay * 2 ** attempt);
      const jitter = Math.floor(Math.random() * backoff * 0.3);
      const delay = backoff + jitter;
      opts.onRetry?.(err, attempt + 1, delay);
      await new Promise((r) => setTimeout(r, delay));
      attempt += 1;
    }
  }
}
