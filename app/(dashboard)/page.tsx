'use client'

import dynamic from 'next/dynamic'
import { GatedPage } from '@/components/rbac/gated-page'
import { DashboardSkeleton } from '@/components/dashboard/page-skeletons'
import { useGatedQuery } from '@/hooks/use-gated-data'
import { useDashboardSnapshot } from '@/lib/query/hooks'
import { PERMISSIONS } from '@/lib/rbac/permissions'

// Route-level code splitting: each page ships its own chunk and streams in
// behind its skeleton instead of blocking the shell.
const ExecutiveDashboard = dynamic(
  () => import('@/components/dashboard/executive-dashboard').then((mod) => mod.ExecutiveDashboard),
  { loading: () => <DashboardSkeleton />, ssr: false },
)

export default function Page() {
  const result = useGatedQuery(useDashboardSnapshot(), { permission: PERMISSIONS.DASHBOARD_READ })

  return (
    <GatedPage
      title="Executive Dashboard"
      permission={PERMISSIONS.DASHBOARD_READ}
      skeleton={<DashboardSkeleton />}
      result={result}
    >
      <ExecutiveDashboard />
    </GatedPage>
  )
}
