import { route } from '@/lib/api/handler'
import { notificationRepo } from '@/lib/db/repositories'
import { PERMISSIONS } from '@/lib/rbac/permissions'

export const dynamic = 'force-dynamic'

// Scoped to the caller's own notifications — the repository filters by member.
export const POST = route({ permission: PERMISSIONS.NOTIFICATIONS_READ }, async (context, request) => {
  const id = new URL(request.url).pathname.split('/').pop()!
  await notificationRepo.markRead(id, context.memberId)
  return { ok: true }
})
