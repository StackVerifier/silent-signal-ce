'use client'

import dynamic from 'next/dynamic'
import { GatedPage } from '@/components/rbac/gated-page'
import { QueueSkeleton } from '@/components/dashboard/page-skeletons'
import { PERMISSIONS } from '@/lib/rbac/permissions'

// Route-level code splitting: each page ships its own chunk and streams in
// behind its skeleton instead of blocking the shell.
const QAQueueMonitoring = dynamic(
  () => import('@/components/dashboard/qa-queue-monitoring').then((mod) => mod.QAQueueMonitoring),
  { loading: () => <QueueSkeleton />, ssr: false },
)

export default function Page() {
  return (
    <GatedPage
      title="QA Queue"
      permission={PERMISSIONS.QA_READ}
      skeleton={<QueueSkeleton />}
    >
      <QAQueueMonitoring />
    </GatedPage>
  )
}
