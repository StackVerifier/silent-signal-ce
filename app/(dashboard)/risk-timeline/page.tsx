'use client'

import dynamic from 'next/dynamic'
import { GatedPage } from '@/components/rbac/gated-page'
import { TimelineSkeleton } from '@/components/dashboard/page-skeletons'
import { useGatedQuery } from '@/hooks/use-gated-data'
import { useRiskTimeline } from '@/lib/query/hooks'
import { PERMISSIONS } from '@/lib/rbac/permissions'

// Route-level code splitting: each page ships its own chunk and streams in
// behind its skeleton instead of blocking the shell.
const RiskTimeline = dynamic(
  () => import('@/components/dashboard/risk-timeline').then((mod) => mod.RiskTimeline),
  { loading: () => <TimelineSkeleton />, ssr: false },
)

export default function Page() {
  const result = useGatedQuery(useRiskTimeline(), { permission: PERMISSIONS.RISK_READ })

  return (
    <GatedPage
      title="Risk Timeline"
      permission={PERMISSIONS.RISK_READ}
      skeleton={<TimelineSkeleton />}
      result={result}
    >
      <RiskTimeline />
    </GatedPage>
  )
}
