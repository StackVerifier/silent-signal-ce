import { NextResponse } from 'next/server'
import { z } from 'zod'
import { cookies } from 'next/headers'
import { SESSION_COOKIE, SESSION_TTL_MS, encodeClaims, type SessionClaims } from '@/lib/auth-config'
import { memberRepo, orgRepo, workspaceRepo } from '@/lib/db/repositories'
import { STATUS_CAN_AUTHENTICATE, buildAccessContext } from '@/lib/rbac/access'
import { getServerSession } from '@/lib/auth-server'
import { needsRehash, hashPassword, verifyPassword } from '@/lib/auth/password'
import { clientAddress, consume, reset } from '@/lib/auth/rate-limit'
import { auditContextFrom, runWithAuditContext } from '@/lib/audit/context'
import { writeAudit } from '@/lib/audit/repository'
import type { AuditEventId } from '@/lib/audit/events'
import type { AuditStatus } from '@/lib/audit/events'

/**
 * Authentication events, recorded outside any transaction.
 *
 * A failed sign-in has no mutation to ride along with, and it is precisely the
 * record a security review asks for. Failures never throw: an audit write that
 * can break the login path would be a denial-of-service on the product.
 */
async function recordAuth(
  request: Request,
  event: AuditEventId,
  details: {
    organizationId: string | null
    actorId: string | null
    actor?: { name: string; email: string }
    status?: AuditStatus
    metadata?: Record<string, unknown>
  },
) {
  try {
    await runWithAuditContext(
      auditContextFrom(request, details.actorId ?? undefined),
      () => writeAudit({ event, ...details }),
    )
  } catch {
    // Recording must not break signing in.
  }
}

export const dynamic = 'force-dynamic'

/**
 * Session endpoint.
 *
 * The session is issued server-side and the cookie is httpOnly, so no script
 * can read it. Passwords are verified against a stored scrypt hash — nothing
 * here compares plaintext.
 */

/** A real hash to compare against for unknown accounts; never matches. */
const DUMMY_HASH =
  'scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=='

/**
 * Two limits, because they stop different attacks. The per-account limit stops
 * guessing one password; the per-address limit stops spraying one common
 * password across many accounts, which the per-account limit never sees.
 */
const PER_ACCOUNT = { limit: 5, windowMs: 15 * 60_000 }
const PER_ADDRESS = { limit: 20, windowMs: 15 * 60_000 }

function tooManyAttempts(retryAfter: number) {
  return NextResponse.json(
    { error: 'Too many sign-in attempts. Try again shortly.' },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } },
  )
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

async function sessionPayload(memberId: string, workspaceId: string | null) {
  const member = await memberRepo.get(memberId)
  if (!member) return null

  const organization = await orgRepo.get(member.organizationId)
  if (!organization) return null

  const available = (await workspaceRepo.list(member.organizationId))
    .filter((workspace) => workspace.status === 'active' && member.workspaceIds.includes(workspace.id))

  const workspace =
    available.find((candidate) => candidate.id === workspaceId) ?? available[0] ?? null

  return {
    access: buildAccessContext({ member, organization, workspace }),
    workspaces: available,
  }
}

async function setSessionCookie(claims: SessionClaims) {
  const store = await cookies()
  store.set(SESSION_COOKIE, await encodeClaims(claims), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(claims.expiresAt),
  })
}

/** Current session, or 204 when signed out. */
export async function GET() {
  const session = await getServerSession()
  if (!session) return new NextResponse(null, { status: 204 })

  const payload = await sessionPayload(session.memberId, session.workspaceId)
  if (!payload) return new NextResponse(null, { status: 204 })

  return NextResponse.json(payload)
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter an email and password' }, { status: 422 })
  }

  const email = parsed.data.email.toLowerCase()
  const address = clientAddress(request)

  const byAddress = consume(`ip:${address}`, PER_ADDRESS)
  if (!byAddress.allowed) {
    await recordAuth(request, 'auth.login_blocked', {
      organizationId: null, actorId: null,
      actor: { name: email, email },
      status: 'denied', metadata: { limit: 'address' },
    })
    return tooManyAttempts(byAddress.retryAfter)
  }

  const byAccount = consume(`email:${email}`, PER_ACCOUNT)
  if (!byAccount.allowed) {
    await recordAuth(request, 'auth.login_blocked', {
      organizationId: null, actorId: null,
      actor: { name: email, email },
      status: 'denied', metadata: { limit: 'account' },
    })
    return tooManyAttempts(byAccount.retryAfter)
  }

  const credentials = await memberRepo.credentialsFor(parsed.data.email)

  // Hash even when the account does not exist, so the response time does not
  // reveal which addresses are registered.
  const valid = credentials?.passwordHash
    ? await verifyPassword(parsed.data.password, credentials.passwordHash)
    : await verifyPassword(parsed.data.password, DUMMY_HASH).then(() => false)

  const member = valid && credentials ? await memberRepo.get(credentials.memberId) : null
  // One message for both cases: a distinct "no such account" reply would let
  // anyone enumerate who belongs to the organization.
  if (!member) {
    // The organization is unknown for an unrecognised address, so the record is
    // filed against the one the attempted account belongs to when there is one.
    await recordAuth(request, 'auth.login_failed', {
      organizationId: credentials?.organizationId ?? null,
      actorId: null,
      actor: { name: email, email },
      status: 'failed',
    })
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  // The credentials were right, so the failure counters no longer apply.
  reset(`email:${email}`)
  reset(`ip:${address}`)

  // Transparently upgrade a hash made with weaker parameters.
  if (credentials?.passwordHash && needsRehash(credentials.passwordHash)) {
    await memberRepo.setPassword(member.id, await hashPassword(parsed.data.password), member.id)
  }
  await memberRepo.touchLastActive(member.id)

  if (!STATUS_CAN_AUTHENTICATE[member.status]) {
    return NextResponse.json(
      {
        error: member.status === 'rejected'
          ? 'Your access request was declined. Contact your administrator.'
          : 'This account is no longer active.',
      },
      { status: 403 },
    )
  }

  const payload = await sessionPayload(member.id, null)
  if (!payload) {
    return NextResponse.json({ error: 'Account not found in this organization' }, { status: 401 })
  }

  await setSessionCookie({
    memberId: member.id,
    organizationId: member.organizationId,
    workspaceId: payload.access.workspace?.id ?? null,
    roleId: member.roleId,
    status: member.status,
    expiresAt: Date.now() + SESSION_TTL_MS,
  })

  await recordAuth(request, 'auth.login', {
    organizationId: member.organizationId,
    actorId: member.id,
  })

  return NextResponse.json(payload)
}

const switchSchema = z.object({ workspaceId: z.string().min(1) })

/** Workspace switch — re-issues the cookie so middleware sees the new scope. */
export async function PATCH(request: Request) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const parsed = switchSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: 'workspaceId is required' }, { status: 422 })
  }

  const member = await memberRepo.get(session.memberId)
  if (!member?.workspaceIds.includes(parsed.data.workspaceId)) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  }

  const payload = await sessionPayload(session.memberId, parsed.data.workspaceId)!
  await setSessionCookie({
    memberId: session.memberId,
    organizationId: session.organizationId,
    workspaceId: parsed.data.workspaceId,
    roleId: session.roleId,
    status: session.status,
    expiresAt: Date.now() + SESSION_TTL_MS,
  })

  return NextResponse.json(payload)
}

export async function DELETE() {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
  return new NextResponse(null, { status: 204 })
}
