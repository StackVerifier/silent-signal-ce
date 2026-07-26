import { z } from 'zod'
import { parseBody, route } from '@/lib/api/handler'
import { memberRepo } from '@/lib/db/repositories'

export const dynamic = 'force-dynamic'

const profileSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(120),
})

/**
 * The signed-in member's own profile.
 *
 * No permission is required beyond holding a session, because the target is
 * always `context.memberId` — taken from the verified session, never from the
 * request. Accepting an id here would make this an "edit anyone" endpoint with
 * no permission check.
 */
export const PATCH = route({}, async (context, request) => {
  const input = await parseBody(request, profileSchema)
  return await memberRepo.updateOwnProfile(context.memberId, { name: input.name })
})
