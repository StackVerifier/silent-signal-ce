import { z } from 'zod'
import { parseBody, route } from '@/lib/api/handler'
import { teamRepo } from '@/lib/db/repositories'
import { PERMISSIONS } from '@/lib/rbac/permissions'

export const dynamic = 'force-dynamic'

const teamId = (request: Request) => new URL(request.url).pathname.split('/').pop()!

const patchSchema = z.object({
  name: z.string().min(2).max(60).optional(),
  workspaceId: z.string().optional(),
  description: z.string().max(160).optional(),
  releaseManagerId: z.string().optional(),
  qaLeadId: z.string().optional(),
})

export const PATCH = route({ permission: PERMISSIONS.TEAMS_WRITE }, async (context, request) => {
  const patch = await parseBody(request, patchSchema)
  return teamRepo.update(teamId(request), patch, context.memberId)
})

export const DELETE = route({ permission: PERMISSIONS.TEAMS_DELETE }, (context, request) => {
  teamRepo.remove(teamId(request), context.memberId)
  return { ok: true }
})

const membersSchema = z.object({ memberIds: z.array(z.string()) })

export const POST = route({ permission: PERMISSIONS.TEAMS_WRITE }, async (context, request) => {
  const { memberIds } = await parseBody(request, membersSchema)
  teamRepo.setMembers(teamId(request), memberIds, context.memberId)
  return { ok: true }
})
