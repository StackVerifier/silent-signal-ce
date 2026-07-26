import { z } from 'zod'
import { parseBody, route } from '@/lib/api/handler'
import { workspaceRepo } from '@/lib/db/repositories'
import { PERMISSIONS } from '@/lib/rbac/permissions'

export const dynamic = 'force-dynamic'

// Every authenticated member needs the workspace list to render the switcher,
// so this one carries no extra permission.
export const GET = route({}, async (context) => await workspaceRepo.list(context.organizationId))

const createSchema = z.object({
  name: z.string().trim().min(1, 'Give the workspace a name').max(80),
  description: z.string().trim().max(280).optional(),
})

export const POST = route({ permission: PERMISSIONS.WORKSPACE_WRITE }, async (context, request) => {
  const input = await parseBody(request, createSchema)
  return await workspaceRepo.create(
    { organizationId: context.organizationId, name: input.name, description: input.description },
    context.memberId,
  )
})
