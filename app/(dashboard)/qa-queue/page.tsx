'use client'

import dynamic from 'next/dynamic'
import { GatedPage } from '@/components/rbac/gated-page'
import { QueueSkeleton } from '@/components/dashboard/page-skeletons'
import { useGatedQuery } from '@/hooks/use-gated-data'
import { useQaQueue } from '@/lib/query/hooks'
import { PERMISSIONS } from '@/lib/rbac/permissions'

// Route-level code splitting: each page ships its own chunk and streams in
// behind its skeleton instead of blocking the shell.
const QAQueueMonitoring = dynamic(
  () => import('@/components/dashboard/qa-queue-monitoring').then((mod) => mod.QAQueueMonitoring),
  { loading: () => <QueueSkeleton />, ssr: false },
)

export default function Page() {
  const result = useGatedQuery(useQaQueue(), { permission: PERMISSIONS.QA_READ })

  return (
    <GatedPage
      title="QA Queue"
      permission={PERMISSIONS.QA_READ}
      skeleton={<QueueSkeleton />}
      result={result}
    >
      <QAQueueMonitoring />
    </GatedPage>
  )
}
