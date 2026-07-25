/**
 * In-process rate limiting.
 *
 * Scope, stated plainly: the counters live in this process's memory. One
 * server — which is how this application is deployed with SQLite — means one
 * shared view, and the limiter is exact. Behind several instances each one
 * counts separately, so the effective limit multiplies by the instance count.
 * That still turns online password guessing from "unbounded" into "a few
 * attempts per window per instance", which is the property that matters; a
 * shared store (Redis, or a Postgres table) is the upgrade path when the
 * deployment actually fans out.
 *
 * A sliding window rather than a fixed one: a fixed window lets an attacker
 * fire `limit` attempts at the end of one window and `limit` more at the start
 * of the next, doubling the real rate at the boundary.
 */

export interface RateLimitRule {
  /** Attempts permitted inside the window. */
  limit: number
  windowMs: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  /** Seconds until the next attempt is permitted. Zero when allowed. */
  retryAfter: number
}

/**
 * Bounded so that spraying distinct keys cannot grow the map without limit —
 * that would turn the defence into a memory-exhaustion vector.
 */
const MAX_TRACKED_KEYS = 10_000

const attempts = new Map<string, number[]>()

function prune(timestamps: number[], now: number, windowMs: number): number[] {
  const cutoff = now - windowMs
  // Timestamps are appended in order, so the survivors are a suffix.
  let index = 0
  while (index < timestamps.length && timestamps[index] <= cutoff) index += 1
  return index === 0 ? timestamps : timestamps.slice(index)
}

function evictOldest() {
  // Map preserves insertion order, so the first key is the least recently
  // created. Good enough: this only runs under key-spray pressure.
  const oldest = attempts.keys().next()
  if (!oldest.done) attempts.delete(oldest.value)
}

/**
 * Records an attempt against `key` and reports whether it is permitted.
 * A rejected attempt is *not* recorded, so a client that keeps hammering during
 * a lockout does not extend it indefinitely.
 */
export function consume(key: string, rule: RateLimitRule, now = Date.now()): RateLimitResult {
  const timestamps = prune(attempts.get(key) ?? [], now, rule.windowMs)

  if (timestamps.length >= rule.limit) {
    attempts.set(key, timestamps)
    const oldest = timestamps[0]
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.max(1, Math.ceil((oldest + rule.windowMs - now) / 1000)),
    }
  }

  if (!attempts.has(key) && attempts.size >= MAX_TRACKED_KEYS) evictOldest()
  attempts.set(key, [...timestamps, now])

  return { allowed: true, remaining: rule.limit - timestamps.length - 1, retryAfter: 0 }
}

/** Clears the record for a key — called after a successful sign-in. */
export function reset(key: string): void {
  attempts.delete(key)
}

/** Test seam. */
export function clearAll(): void {
  attempts.clear()
}

/**
 * The client address, as far as it can be trusted.
 *
 * `x-forwarded-for` is client-controlled unless a proxy overwrites it. Vercel
 * and most managed platforms do; a bare `next start` behind nothing does not,
 * which is why the address is only ever one half of the key — the email is the
 * other, and an attacker cannot spoof their way out of the per-account limit.
 */
export function clientAddress(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip') ?? 'unknown'
}
