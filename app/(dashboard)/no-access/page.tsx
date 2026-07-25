'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Topbar } from '@/components/layout/topbar'
import { AccessDenied } from '@/components/rbac/access-denied'
import { requiredPermissionsForPath } from '@/lib/rbac/navigation'

export const dynamic = 'force-dynamic'

function NoAccessContent() {
  const from = useSearchParams().get('from') ?? undefined
  const required = from ? requiredPermissionsForPath(from) ?? [] : []
  return <AccessDenied requiredPermissions={required} from={from} />
}

export default function NoAccessPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar title="Access Denied" />
      <div className="flex-1 overflow-y-auto flex">
        <Suspense fallback={null}>
          <NoAccessContent />
        </Suspense>
      </div>
    </div>
  )
}
