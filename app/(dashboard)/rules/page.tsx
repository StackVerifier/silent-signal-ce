'use client'

import dynamic from 'next/dynamic'
import { GatedPage } from '@/components/rbac/gated-page'
import { RulesSkeleton } from '@/components/dashboard/page-skeletons'
import { PERMISSIONS } from '@/lib/rbac/permissions'

// Route-level code splitting: each page ships its own chunk and streams in
// behind its skeleton instead of blocking the shell.
const RuleManagement = dynamic(
  () => import('@/components/dashboard/rule-management').then((mod) => mod.RuleManagement),
  { loading: () => <RulesSkeleton />, ssr: false },
)

export default function Page() {
  return (
    <GatedPage
      title="Rule Management"
      permission={PERMISSIONS.RULES_READ}
      skeleton={<RulesSkeleton />}
    >
      <RuleManagement />
    </GatedPage>
  )
}
