import { env } from '@/lib/env'

/**
 * Typed transport shared by every service.
 *
 * Responsibilities kept here and nowhere else: base URL, workspace scoping,
 * timeouts, retry with backoff, error normalisation, and honouring Retry-After
 * (Jira and Slack both rate-limit with it).
 */

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown
  /** Present on 429/503 responses that carried Retry-After. */
  readonly retryAfterMs?: number

  constructor(params: {
    status: number
    code: string
    message: string
    details?: unknown
    retryAfterMs?: number
  }) {
    super(params.message)
    this.name = 'ApiError'
    this.status = params.status
    this.code = params.code
    this.details = params.details
    this.retryAfterMs = params.retryAfterMs
  }

  /** 5xx, 408 and 429 are worth another attempt; 4xx are not. */
  get isRetryable(): boolean {
    return this.status >= 500 || this.status === 408 || this.status === 429
  }

  /** Copy suitable for an ErrorState — never leaks internals to the user. */
  get userMessage(): string {
    switch (this.status) {
      case 401: return 'Your session expired. Sign in again to continue.'
      case 403: return 'You do not have permission to view this data.'
      case 404: return 'This resource no longer exists.'
      case 429: return 'Too many requests. This usually clears within a minute.'
      default:
        return this.status >= 500
          ? 'The service is temporarily unavailable.'
          : this.message
    }
  }
}

/**
 * ISO-8601 timestamps, as JSON.stringify emits for a Date.
 * Anchored at both ends so a description that merely contains a date is not
 * silently converted into one.
 */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/

/**
 * Revives date strings into Date objects on the way in.
 *
 * JSON has no date type, so every Date the server sends arrives as a string.
 * Without this, `createdAt.getTime()` throws at the call site — and it throws
 * far away from the cause, in whichever component happens to touch the field
 * first. Converting once at the transport boundary means the domain types stay
 * true: if `Member.createdAt` says Date, it is a Date.
 */
function reviveDates<T>(value: T): T {
  if (typeof value === 'string') {
    return (ISO_DATE.test(value) ? new Date(value) : value) as unknown as T
  }
  if (Array.isArray(value)) return value.map(reviveDates) as unknown as T
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    for (const key of Object.keys(record)) record[key] = reviveDates(record[key])
  }
  return value
}

export interface Paginated<T> {
  data: T[]
  pageInfo: { nextCursor: string | null; hasMore: boolean }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  query?: Record<string, string | number | boolean | undefined | null>
  signal?: AbortSignal
  timeoutMs?: number
  retries?: number
  /** Scopes the request to a workspace; the org always comes from the session. */
  workspaceId?: string
}

const DEFAULT_TIMEOUT_MS = 15_000
const DEFAULT_RETRIES = 2

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const base = env.NEXT_PUBLIC_API_BASE_URL ?? ''
  const url = new URL(`${base}${path}`, base || 'http://localhost')
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value))
  }
  return base ? url.toString() : `${url.pathname}${url.search}`
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = 'GET',
    body,
    query,
    signal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = method === 'GET' ? DEFAULT_RETRIES : 0,
    workspaceId,
  } = options

  let attempt = 0
   
  while (true) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    const onAbort = () => controller.abort()
    signal?.addEventListener('abort', onAbort)

    try {
      const response = await fetch(buildUrl(path, query), {
        method,
        signal: controller.signal,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(workspaceId ? { 'X-Workspace-Id': workspaceId } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      })

      if (!response.ok) {
        const retryAfter = response.headers.get('Retry-After')
        const payload = await response.json().catch(() => ({}))
        throw new ApiError({
          status: response.status,
          code: payload?.code ?? `http_${response.status}`,
          // Route handlers reply with `{ error }`; `message` is accepted too so
          // a third-party endpoint's shape still produces a usable message
          // rather than falling through to a bare "Unauthorized".
          message: payload?.error ?? payload?.message ?? response.statusText,
          details: payload?.details,
          retryAfterMs: retryAfter ? Number(retryAfter) * 1000 : undefined,
        })
      }

      if (response.status === 204) return undefined as T
      return reviveDates((await response.json()) as T)
    } catch (error) {
      const normalized =
        error instanceof ApiError
          ? error
          : new ApiError({
              status: controller.signal.aborted && !signal?.aborted ? 408 : 0,
              code: controller.signal.aborted ? 'timeout' : 'network_error',
              message:
                controller.signal.aborted
                  ? 'The request timed out'
                  : 'Network request failed',
            })

      const canRetry = attempt < retries && normalized.isRetryable && !signal?.aborted
      if (!canRetry) throw normalized

      // Respect Retry-After when the server sent one; otherwise exponential backoff.
      await sleep(normalized.retryAfterMs ?? 2 ** attempt * 500)
      attempt += 1
    } finally {
      clearTimeout(timeout)
      signal?.removeEventListener('abort', onAbort)
    }
  }
}
