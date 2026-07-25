'use client'

import dynamic from 'next/dynamic'
import { GatedPage } from '@/components/rbac/gated-page'
import { SprintSkeleton } from '@/components/dashboard/page-skeletons'
import { PERMISSIONS } from '@/lib/rbac/permissions'

// Route-level code splitting: each page ships its own chunk and streams in
// behind its skeleton instead of blocking the shell.
const SprintIntelligence = dynamic(
  () => import('@/components/dashboard/sprint-intelligence').then((mod) => mod.SprintIntelligence),
  { loading: () => <SprintSkeleton />, ssr: false },
)

export default function Page() {
  return (
    <GatedPage
      title="Sprint Intelligence"
      permission={PERMISSIONS.SPRINT_READ}
      skeleton={<SprintSkeleton />}
    >
      <SprintIntelligence />
    </GatedPage>
  )
}
