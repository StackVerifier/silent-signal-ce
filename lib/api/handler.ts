import 'server-only'
import { NextResponse } from 'next/server'
import { ZodError, type ZodType } from 'zod'
import { getServerSession, type ServerSession } from '@/lib/auth-server'
import { STATUS_GRANTS_DATA_ACCESS } from '@/lib/rbac/access'
import type { Permission } from '@/lib/rbac/permissions'
import { ConflictError, NotFoundError } from '@/lib/db/repositories'
import { auditContextFrom, runWithAuditContext } from '@/lib/audit/context'
import { writeAudit } from '@/lib/audit/repository'

/**
 * Route-handler plumbing.
 *
 * This is the security boundary. Middleware only gates navigation — a client
 * can always call an endpoint directly — so every handler re-checks the
 * session, the account status and the permission here, using the same pure
 * functions the UI uses.
 */

export interface HandlerContext extends ServerSession {
  /** Workspace the request is scoped to: header first, then the session. */
  workspaceId: string
}

type Handler<T> = (context: HandlerContext, request: Request) => Promise<T> | T

export function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json({ error: message, code: code ?? `http_${status}` }, { status })
}

/**
 * Wraps a handler with auth, status and permission checks, and maps domain
 * errors onto status codes so no handler repeats that mapping.
 */
export function route<T>(
  options: { permission?: Permission; allowGated?: boolean },
  handler: Handler<T>,
) {
  return async (request: Request): Promise<Response> => {
    const session = await getServerSession()
    if (!session) return jsonError('Not authenticated', 401, 'unauthenticated')

    // A pending or suspended account holds a valid session but no data access.
    if (!options.allowGated && !STATUS_GRANTS_DATA_ACCESS[session.status]) {
      return jsonError('Your account is not active yet', 403, 'account_gated')
    }

    if (options.permission && !session.permissions.includes(options.permission)) {
      // A refused attempt is the event an investigation most wants and the one
      // most systems never record. Written outside any transaction, because
      // there is no mutation to attach it to.
      await runWithAuditContext(auditContextFrom(request, session.memberId), () =>
        writeAudit({
          event: 'authz.permission_denied',
          organizationId: session.organizationId,
          actorId: session.memberId,
          status: 'denied',
          metadata: { permission: options.permission, path: new URL(request.url).pathname },
        }),
      ).catch(() => undefined)
      return jsonError('You do not have permission for this action', 403, 'forbidden')
    }

    const headerWorkspace = request.headers.get('X-Workspace-Id')
    const workspaceId = headerWorkspace ?? session.workspaceId
    if (!workspaceId) return jsonError('No workspace in scope', 400, 'no_workspace')

    // Everything the handler writes inherits this request's origin — IP,
    // device, source and one correlation id — without a single repository
    // signature having to mention HTTP.
    const auditContext = auditContextFrom(request, session.memberId)

    try {
      const result = await runWithAuditContext(auditContext, () =>
        handler({ ...session, workspaceId }, request))
      return result === undefined
        ? new NextResponse(null, { status: 204 })
        : NextResponse.json(result)
    } catch (error) {
      if (error instanceof ZodError) {
        return NextResponse.json(
          {
            error: 'Invalid request',
            code: 'validation_failed',
            details: error.issues.map((issue) => ({
              path: issue.path.join('.'),
              message: issue.message,
            })),
          },
          { status: 422 },
        )
      }
      // Cross-tenant and missing both surface as 404: a 403 would confirm the
      // resource exists.
      if (error instanceof NotFoundError) return jsonError(error.message, 404, 'not_found')
      if (error instanceof ConflictError) return jsonError(error.message, 409, 'conflict')

      console.error('[api] unhandled error', error)
      return jsonError('Something went wrong', 500, 'internal_error')
    }
  }
}

export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  const body = await request.json().catch(() => ({}))
  return schema.parse(body)
}
