import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getServerSession } from '@/lib/auth-server'
import { memberRepo } from '@/lib/db/repositories'
import { hashPassword, validatePassword, verifyPassword } from '@/lib/auth/password'

export const dynamic = 'force-dynamic'

const schema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password'),
  newPassword: z.string().min(1, 'Enter a new password'),
})

/**
 * Change password.
 *
 * The current password is required even though the caller already holds a
 * session: it is what stops a borrowed, unlocked browser from becoming a
 * permanent takeover.
 */
export async function POST(request: Request) {
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const parsed = schema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 422 },
    )
  }

  const member = await memberRepo.get(session.memberId)
  const credentials = member ? await memberRepo.credentialsFor(member.email) : null
  if (!credentials?.passwordHash) {
    return NextResponse.json({ error: 'This account has no password set' }, { status: 409 })
  }

  if (!(await verifyPassword(parsed.data.currentPassword, credentials.passwordHash))) {
    return NextResponse.json({ error: 'Your current password is incorrect' }, { status: 401 })
  }

  const problem = validatePassword(parsed.data.newPassword)
  if (problem) return NextResponse.json({ error: problem.message }, { status: 422 })

  if (await verifyPassword(parsed.data.newPassword, credentials.passwordHash)) {
    return NextResponse.json(
      { error: 'The new password must be different from the current one' },
      { status: 422 },
    )
  }

  await memberRepo.setPassword(
    session.memberId,
    await hashPassword(parsed.data.newPassword),
    session.memberId,
  )

  return NextResponse.json({ ok: true })
}
