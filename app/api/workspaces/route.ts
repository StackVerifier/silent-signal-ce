import { route } from '@/lib/api/handler'
import { workspaceRepo } from '@/lib/db/repositories'

export const dynamic = 'force-dynamic'

// Every authenticated member needs the workspace list to render the switcher,
// so this one carries no extra permission.
export const GET = route({}, (context) => workspaceRepo.list(context.organizationId))
