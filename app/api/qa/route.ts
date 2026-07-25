import { route } from '@/lib/api/handler'
import { deliveryRepo } from '@/lib/db/repositories'
import { PERMISSIONS } from '@/lib/rbac/permissions'
import type { QAItem, QATester } from '@/lib/types'

export const dynamic = 'force-dynamic'

export const GET = route({ permission: PERMISSIONS.QA_READ }, async (context, request) => {
  const view = new URL(request.url).searchParams.get('view')
  return view === 'testers'
    ? deliveryRepo.qaTesters<QATester>(context.workspaceId)
    : deliveryRepo.qaQueue<QAItem>(context.workspaceId)
})
