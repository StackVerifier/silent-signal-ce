'use client'

import dynamic from 'next/dynamic'
import { GatedPage } from '@/components/rbac/gated-page'
import { ReleaseSkeleton } from '@/components/dashboard/page-skeletons'
import { PERMISSIONS } from '@/lib/rbac/permissions'

// Route-level code splitting: each page ships its own chunk and streams in
// behind its skeleton instead of blocking the shell.
const ReleaseControl = dynamic(
  () => import('@/components/dashboard/release-control').then((mod) => mod.ReleaseControl),
  { loading: () => <ReleaseSkeleton />, ssr: false },
)

export default function Page() {
  return (
    <GatedPage
      title="Release Control"
      permission={PERMISSIONS.RELEASE_READ}
      skeleton={<ReleaseSkeleton />}
    >
      <ReleaseControl />
    </GatedPage>
  )
}
