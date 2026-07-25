'use client'

import { SettingsPageHeader } from '@/components/settings/page-header'
import { useAuditLog } from '@/lib/query/hooks'
import { useGatedQuery } from '@/hooks/use-gated-data'
import { PermissionGuard } from '@/components/rbac/permission-guard'
import { EmptyState, ErrorState } from '@/components/states/data-states'
import { PERMISSIONS } from '@/lib/rbac/permissions'
import { motion } from 'framer-motion'
import { FileText, User } from 'lucide-react'

const ACTION_LABELS: Record<string, string> = {
  create: 'Created',
  update: 'Updated',
  delete: 'Deleted',
  invite: 'Invited',
  remove: 'Removed',
  export: 'Exported',
}

export default function AuditLogPage() {
  const result = useGatedQuery(useAuditLog({ limit: 100 }), { permission: PERMISSIONS.AUDIT_READ })
  const entries = result.data?.data ?? []

  return (
    <PermissionGuard permission={PERMISSIONS.AUDIT_READ} showDenied>
    <div className="flex-1 flex flex-col overflow-hidden">
      <SettingsPageHeader
        title="Audit Log"
        description="View all workspace activity and changes"
      />

      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
        <div className="max-w-4xl">
          <div className="space-y-2">
            {entries.map((log, idx) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="p-4 rounded-lg bg-[#0F1824] border border-[#1E2D4A]"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#6C63FF]/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-[#6C63FF]" />
                    </div>
                    <div>
                      <p className="font-medium text-[#E2E8F0]">
                        <span className="text-[#6C63FF]">{log.user.name}</span> {ACTION_LABELS[log.action]} a {log.resource}
                      </p>
                      <p className="text-xs text-[#64748B] mt-2 flex items-center gap-1">
                        <User className="w-3 h-3" />
                        ID: {log.resourceId}
                      </p>
                      {log.changes && Object.keys(log.changes).length > 0 && (
                        <p className="text-xs text-[#64748B] mt-1">
                          Changed {Object.keys(log.changes).length} field{Object.keys(log.changes).length !== 1 ? 's' : ''}
                        </p>
                      )}
                      <p className="text-xs text-[#64748B] mt-2">
                        {new Date(log.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

            {result.isSkeleton && (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="h-24 rounded-lg bg-[#0F1824] border border-[#1E2D4A] animate-pulse" />
                ))}
              </div>
            )}
            {result.state === 'error' && (
              <ErrorState
                title="Unable to load the audit log"
                description={result.errorMessage ?? undefined}
                onRetry={result.retry}
              />
            )}
            {result.state === 'ready' && entries.length === 0 && (
              <EmptyState
                icon={FileText}
                title="No activity recorded yet"
                description="Member approvals, rule changes and integration updates all appear here."
              />
            )}
        </div>
      </div>
    </div>
    </PermissionGuard>
  )
}
