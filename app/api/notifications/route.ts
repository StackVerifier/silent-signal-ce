import { route } from '@/lib/api/handler'
import { notificationRepo } from '@/lib/db/repositories'
import { PERMISSIONS } from '@/lib/rbac/permissions'

export const dynamic = 'force-dynamic'

export const GET = route({ permission: PERMISSIONS.NOTIFICATIONS_READ }, (context) =>
  notificationRepo.listForMember(context.memberId))

// Mark-all-read; a single notification uses /api/notifications/[id].
export const POST = route({ permission: PERMISSIONS.NOTIFICATIONS_READ }, (context) => {
  notificationRepo.markAllRead(context.memberId)
  return { ok: true }
})
