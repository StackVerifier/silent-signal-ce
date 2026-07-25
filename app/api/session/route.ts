import { NextResponse } from 'next/server'
import { z } from 'zod'
import { cookies } from 'next/headers'
import { SESSION_COOKIE, SESSION_TTL_MS, encodeClaims, type SessionClaims } from '@/lib/auth-config'
import { memberRepo, orgRepo, workspaceRepo } from '@/lib/db/repositories'
import { STATUS_CAN_AUTHENTICATE, buildAccessContext } from '@/lib/rbac/access'
import { getServerSession } from '@/lib/auth-server'
import { needsRehash, hashPassword, verifyPassword } from '@/lib/auth/password'

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
  store.set(SESSION_COOKIE, encodeClaims(claims), {
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
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

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
