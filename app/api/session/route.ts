import { NextResponse } from 'next/server'
import { z } from 'zod'
import { cookies } from 'next/headers'
import { SESSION_COOKIE, SESSION_TTL_MS, encodeClaims, type SessionClaims } from '@/lib/auth-config'
import { memberRepo, orgRepo, workspaceRepo } from '@/lib/db/repositories'
import { STATUS_CAN_AUTHENTICATE, buildAccessContext } from '@/lib/rbac/access'
import { getServerSession } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

/**
 * Session endpoint.
 *
 * The session is now issued server-side and the cookie is httpOnly, so no
 * script can read it — the previous browser-minted cookie could be lifted by
 * any XSS. Credential checking is still a demo password rather than a hash:
 * members carry no password column yet. That is the one remaining gap between
 * this and real authentication, and it is deliberately narrow.
 */
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'admin123'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

function sessionPayload(memberId: string, workspaceId: string | null) {
  const member = memberRepo.get(memberId)
  if (!member) return null

  const organization = orgRepo.get(member.organizationId)
  if (!organization) return null

  const available = workspaceRepo
    .list(member.organizationId)
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

  const payload = sessionPayload(session.memberId, session.workspaceId)
  if (!payload) return new NextResponse(null, { status: 204 })

  return NextResponse.json(payload)
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter an email and password' }, { status: 422 })
  }

  const member = memberRepo.findByEmail(parsed.data.email)
  // One message for both cases: a distinct "no such account" reply would let
  // anyone enumerate who belongs to the organization.
  if (!member || parsed.data.password !== DEMO_PASSWORD) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

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

  const payload = sessionPayload(member.id, null)
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

  const member = memberRepo.get(session.memberId)
  if (!member?.workspaceIds.includes(parsed.data.workspaceId)) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  }

  const payload = sessionPayload(session.memberId, parsed.data.workspaceId)!
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
