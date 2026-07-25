'use client'

import { Topbar } from '@/components/layout/topbar'
import { PermissionGuard } from './permission-guard'
import { ErrorState } from '@/components/states/data-states'
import type { GatedResult } from '@/hooks/use-gated-data'
import type { Permission } from '@/lib/rbac/permissions'

/**
 * Standard page boundary. Composes the checks every data page needs, in order:
 *   permission → access-denied · status/loading → skeleton · failure → retry
 *
 * Pages stay ~20 lines and dynamically import their widget, so each route ships
 * its own chunk.
 */
export function GatedPage({
  title,
  permission,
  skeleton,
  result,
  children,
}: {
  title: string
  permission: Permission
  skeleton: React.ReactNode
  result: Pick<GatedResult<unknown>, 'state' | 'isSkeleton' | 'errorMessage' | 'retry'>
  children: React.ReactNode
}) {
  return (
    <PermissionGuard permission={permission} showDenied>
      <div className="flex flex-col h-full overflow-hidden">
        <Topbar title={title} />
        <div className="flex-1 overflow-y-auto">
          {result.isSkeleton ? (
            skeleton
          ) : result.state === 'error' ? (
            <ErrorState
              title={`Unable to load ${title.toLowerCase()}`}
              description={result.errorMessage ?? undefined}
              onRetry={result.retry}
              logsHref="/audit-log"
            />
          ) : (
            children
          )}
        </div>
      </div>
    </PermissionGuard>
  )
}
