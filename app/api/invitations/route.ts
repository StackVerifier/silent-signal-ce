import { z } from 'zod'
import { jsonError, parseBody, route } from '@/lib/api/handler'
import { invitationRepo, orgRepo } from '@/lib/db/repositories'
import { PERMISSIONS } from '@/lib/rbac/permissions'
import { assignableRoles } from '@/lib/rbac/roles'
import type { RoleId } from '@/lib/rbac/types'

export const dynamic = 'force-dynamic'

export const GET = route({ permission: PERMISSIONS.MEMBERS_READ }, async (context) =>
  await invitationRepo.list(context.organizationId))

const inviteSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  roleId: z.string().min(1),
  workspaceId: z.string().min(1),
  teamId: z.string().optional(),
})

export const POST = route({ permission: PERMISSIONS.MEMBERS_INVITE }, async (context, request) => {
  const input = await parseBody(request, inviteSchema)

  // The inviter cannot grant a role at or above their own — enforced server-side,
  // not merely omitted from the dropdown.
  const allowed = assignableRoles(context.roleId).some((role) => role.id === input.roleId)
  if (!allowed) {
    return jsonError('You cannot assign that role', 403, 'role_tier')
  }

  const organization = await orgRepo.get(context.organizationId)
  return await invitationRepo.create(
    {
      organizationId: context.organizationId,
      email: input.email,
      roleId: input.roleId as RoleId,
      workspaceId: input.workspaceId,
      teamId: input.teamId || undefined,
      expiryDays: organization?.settings.invitationExpiryDays ?? 7,
    },
    context.memberId,
  )
})
