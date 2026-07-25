import { route } from '@/lib/api/handler'
import { PERMISSIONS } from '@/lib/rbac/permissions'
import { resolveJiraAuth } from '@/lib/env'

export const dynamic = 'force-dynamic'

/**
 * Project discovery. Returns an empty list until credentials are configured —
 * inventing projects would make an unconfigured integration look healthy.
 */
export const GET = route({ permission: PERMISSIONS.INTEGRATION_READ }, () => {
  const auth = resolveJiraAuth()
  if (!auth) return []
  // TODO: call GET /rest/api/3/project/search with the resolved credentials.
  return []
})
