import 'server-only'
import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'
import type { AuditSource } from './events'

/**
 * Request context for audit records.
 *
 * The IP, device and correlation id belong to the request, but the code that
 * writes the audit row is a repository three layers down which has no business
 * taking a `Request` parameter. Threading one through every signature would
 * couple the whole data layer to HTTP, and the first function someone forgets
 * to update silently writes a record with no origin — which is exactly the
 * record an investigation needs.
 *
 * `AsyncLocalStorage` keeps that plumbing out of the signatures. It is per
 * async execution context, so two concurrent requests cannot see each other's
 * values.
 */

export interface AuditContext {
  ipAddress?: string
  userAgent?: string
  device?: string
  sessionId?: string
  /** Groups every record written while handling one request. */
  correlationId: string
  source: AuditSource
}

const storage = new AsyncLocalStorage<AuditContext>()

export function runWithAuditContext<T>(context: AuditContext, work: () => T): T {
  return storage.run(context, work)
}

export function currentAuditContext(): AuditContext | undefined {
  return storage.getStore()
}

/**
 * Best-effort device string from a user agent.
 *
 * Deliberately coarse — "Chrome on macOS" is what a reviewer needs to spot
 * "that sign-in came from a browser I have never used". A full fingerprint
 * would be more identifying without being more useful.
 */
export function describeDevice(userAgent: string | null): string | undefined {
  if (!userAgent) return undefined

  const browser =
    /\bEdg\//.test(userAgent) ? 'Edge'
    : /\bOPR\//.test(userAgent) ? 'Opera'
    : /\bChrome\//.test(userAgent) ? 'Chrome'
    : /\bFirefox\//.test(userAgent) ? 'Firefox'
    : /\bSafari\//.test(userAgent) ? 'Safari'
    : /\bcurl\//i.test(userAgent) ? 'curl'
    : null

  const platform =
    /Windows NT/.test(userAgent) ? 'Windows'
    : /Mac OS X|Macintosh/.test(userAgent) ? 'macOS'
    : /Android/.test(userAgent) ? 'Android'
    : /iPhone|iPad|iOS/.test(userAgent) ? 'iOS'
    : /Linux/.test(userAgent) ? 'Linux'
    : null

  if (!browser && !platform) return undefined
  return [browser, platform].filter(Boolean).join(' on ')
}

/**
 * The client address, as far as it can be trusted.
 *
 * `x-forwarded-for` is client-controlled unless a proxy overwrites it, which
 * managed platforms do. Recording it is still right — an audit log records what
 * was observed — but nothing downstream should treat it as proof of origin.
 */
export function clientIp(request: Request): string | undefined {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim() || undefined
  return request.headers.get('x-real-ip') ?? undefined
}

/**
 * How the request arrived. A change made by the scheduler and a change made by
 * a person are different facts, and "who" alone does not distinguish them.
 */
export function inferSource(request: Request): AuditSource {
  const explicit = request.headers.get('x-silent-signal-source')
  if (explicit === 'cli' || explicit === 'api' || explicit === 'webhook') return explicit
  if (request.headers.get('x-cron-trigger')) return 'scheduler'

  const userAgent = request.headers.get('user-agent') ?? ''
  // A browser sends a Mozilla-prefixed agent and a same-origin fetch; anything
  // else calling these endpoints is a script or an integration.
  if (!/^Mozilla\//.test(userAgent)) return 'api'
  return 'dashboard'
}

export function auditContextFrom(request: Request, sessionId?: string): AuditContext {
  const userAgent = request.headers.get('user-agent')
  return {
    ipAddress: clientIp(request),
    userAgent: userAgent ?? undefined,
    device: describeDevice(userAgent),
    sessionId,
    correlationId: randomUUID(),
    source: inferSource(request),
  }
}
