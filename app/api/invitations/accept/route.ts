import { NextResponse } from 'next/server'
import { z } from 'zod'
import { invitationRepo } from '@/lib/db/repositories'
import { hashPassword, validatePassword } from '@/lib/auth/password'
import { clientAddress, consume } from '@/lib/auth/rate-limit'
import { auditContextFrom, runWithAuditContext } from '@/lib/audit/context'

export const dynamic = 'force-dynamic'

/**
 * Redeeming an invitation.
 *
 * Deliberately outside `route()`: the whole point is that the caller has no
 * session yet. The token is the only credential, which is why this endpoint is
 * rate limited — without it, 256-bit tokens would still be safe but the
 * endpoint would be a free oracle for probing and a lever for hammering the
 * database.
 */
const PER_ADDRESS = { limit: 20, windowMs: 15 * 60_000 }

const acceptSchema = z.object({
  token: z.string().min(1),
  name: z.string().trim().min(1, 'Enter your name').max(120),
  password: z.string().min(1),
})

/** Preview: who invited you, to what organization, in what role. */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token') ?? ''
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  const preview = await invitationRepo.preview(token)
  // One answer for expired, cancelled, spent and never-existed alike.
  if (!preview) {
    return NextResponse.json(
      { error: 'That invitation link is not valid any more' },
      { status: 404 },
    )
  }
  return NextResponse.json(preview)
}

export async function POST(request: Request) {
  const address = clientAddress(request)
  const limit = consume(`invite-accept:${address}`, PER_ADDRESS)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } },
    )
  }

  const parsed = acceptSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter your name and a password' }, { status: 422 })
  }

  // The same rules the change-password flow enforces — an account created here
  // must not be able to start life weaker than one that changed its password.
  const problem = validatePassword(parsed.data.password)
  if (problem) return NextResponse.json({ error: problem.message }, { status: 422 })

  const passwordHash = await hashPassword(parsed.data.password)

  try {
    const result = await runWithAuditContext(auditContextFrom(request), () =>
      invitationRepo.accept(parsed.data.token, { name: parsed.data.name, passwordHash }))
    // No session is issued here: the new member signs in normally, which proves
    // the password they just chose actually works before they rely on it.
    return NextResponse.json({ email: result.email })
  } catch (error) {
    const status = (error as { statusCode?: number })?.statusCode ?? 400
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not accept the invitation' },
      { status },
    )
  }
}
