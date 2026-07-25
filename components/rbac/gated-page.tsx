'use client'

import { Topbar } from '@/components/layout/topbar'
import { PermissionGuard } from './permission-guard'
import { useGatedData } from '@/hooks/use-gated-data'
import type { Permission } from '@/lib/rbac/permissions'

/**
 * Standard page boundary for every data page.
 *
 * Composes the three checks each page needs, in order:
 *   1. permission  → access-denied surface
 *   2. account status / loading → skeleton
 *   3. data → children
 *
 * Pages stay 15 lines; the widget inside is dynamically imported by the page,
 * so each route ships its own chunk.
 */
export function GatedPage({
  title,
  permission,
  skeleton,
  children,
  delay = 300,
}: {
  title: string
  permission: Permission
  skeleton: React.ReactNode
  children: React.ReactNode
  delay?: number
}) {
  const { isSkeleton } = useGatedData(true, { delay })

  return (
    <PermissionGuard permission={permission} showDenied>
      <div className="flex flex-col h-full overflow-hidden">
        <Topbar title={title} />
        <div className="flex-1 overflow-y-auto">
          {isSkeleton ? skeleton : children}
        </div>
      </div>
    </PermissionGuard>
  )
}
