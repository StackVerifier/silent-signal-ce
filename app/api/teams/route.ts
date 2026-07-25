import { z } from 'zod'
import { parseBody, route } from '@/lib/api/handler'
import { teamRepo } from '@/lib/db/repositories'
import { PERMISSIONS } from '@/lib/rbac/permissions'

export const dynamic = 'force-dynamic'

export const GET = route({ permission: PERMISSIONS.TEAMS_READ }, async (context, request) => {
  const workspaceId = new URL(request.url).searchParams.get('workspaceId') ?? undefined
  return await teamRepo.list(context.organizationId, workspaceId)
})

const createSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(60),
  workspaceId: z.string().min(1),
  description: z.string().max(160).optional(),
  releaseManagerId: z.string().optional(),
  qaLeadId: z.string().optional(),
})

export const POST = route({ permission: PERMISSIONS.TEAMS_WRITE }, async (context, request) => {
  const input = await parseBody(request, createSchema)
  return await teamRepo.create({ ...input, organizationId: context.organizationId }, context.memberId)
})
