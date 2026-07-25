'use client'

import dynamic from 'next/dynamic'
import { GatedPage } from '@/components/rbac/gated-page'
import { DashboardSkeleton } from '@/components/dashboard/page-skeletons'
import { PERMISSIONS } from '@/lib/rbac/permissions'

// Route-level code splitting: each page ships its own chunk and streams in
// behind its skeleton instead of blocking the shell.
const ExecutiveDashboard = dynamic(
  () => import('@/components/dashboard/executive-dashboard').then((mod) => mod.ExecutiveDashboard),
  { loading: () => <DashboardSkeleton />, ssr: false },
)

export default function Page() {
  return (
    <GatedPage
      title="Executive Dashboard"
      permission={PERMISSIONS.DASHBOARD_READ}
      skeleton={<DashboardSkeleton />}
    >
      <ExecutiveDashboard />
    </GatedPage>
  )
}
