import { z } from 'zod'
import { parseBody, route } from '@/lib/api/handler'
import { invitationRepo, orgRepo } from '@/lib/db/repositories'
import { PERMISSIONS } from '@/lib/rbac/permissions'
import { invitationLink } from '@/lib/auth/invitation-token'

export const dynamic = 'force-dynamic'

const actionSchema = z.object({ action: z.enum(['resend', 'cancel']) })

export const POST = route({ permission: PERMISSIONS.MEMBERS_INVITE }, async (context, request) => {
  const { action } = await parseBody(request, actionSchema)
  const invitationId = new URL(request.url).pathname.split('/').pop()!

  const invitation = (await invitationRepo.list(context.organizationId))
    .find((item) => item.id === invitationId)
  if (!invitation) throw Object.assign(new Error('Invitation not found'), { statusCode: 404 })

  if (action === 'cancel') {
    await invitationRepo.cancel(invitationId, context.memberId)
    return { ok: true }
  }

  const organization = await orgRepo.get(context.organizationId)
  // A resend mints a new token and invalidates the previous link, so a link
  // that leaked once does not stay valid.
  const token = await invitationRepo.resend(
    invitationId, context.memberId, organization?.settings.invitationExpiryDays ?? 7,
  )
  return { ok: true, acceptUrl: invitationLink(token, new URL(request.url).origin) }
})
