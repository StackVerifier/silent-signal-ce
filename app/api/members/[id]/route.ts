import { z } from 'zod'
import { jsonError, parseBody, route } from '@/lib/api/handler'
import { memberRepo } from '@/lib/db/repositories'
import { PERMISSIONS } from '@/lib/rbac/permissions'
import { canManageRole } from '@/lib/rbac/roles'

export const dynamic = 'force-dynamic'

const actionSchema = z.object({
  action: z.enum(['approve', 'reject', 'suspend', 'activate', 'remove']),
})

const STATUS_BY_ACTION = {
  approve: 'approved', activate: 'approved',
  reject: 'rejected', suspend: 'suspended',
} as const

/** Approve/reject need members.approve; the rest need members.write. */
export const POST = route({ permission: PERMISSIONS.MEMBERS_READ }, async (context, request) => {
  const { action } = await parseBody(request, actionSchema)
  const memberId = new URL(request.url).pathname.split('/').pop()!

  const target = await memberRepo.get(memberId)
  if (!target || target.organizationId !== context.organizationId) {
    // Cross-organization access must not confirm the member exists.
    throw Object.assign(new Error('Member not found'), { statusCode: 404 })
  }

  const required = action === 'approve' || action === 'reject'
    ? PERMISSIONS.MEMBERS_APPROVE
    : PERMISSIONS.MEMBERS_WRITE
  if (!context.permissions.includes(required)) {
    return jsonError('You do not have permission for this action', 403, 'forbidden')
  }

  // Tier is re-checked here, not just in the UI: hiding a button is not a control.
  if (!canManageRole(context.roleId, target.roleId)) {
    return jsonError('You cannot manage a member at or above your own role', 403, 'role_tier')
  }

  if (action === 'remove') {
    await memberRepo.remove(memberId, context.memberId)
    return { ok: true }
  }
  return await memberRepo.setStatus(memberId, STATUS_BY_ACTION[action], context.memberId)
})
