'use client'

import { SettingsPageHeader } from '@/components/settings/page-header'
import { useAuth } from '@/lib/auth-context'
import { motion } from 'framer-motion'
import { Settings, Shield, Lock } from 'lucide-react'
import { RETENTION_OPTIONS, retentionLabel } from '@/lib/audit/retention-options'
import { useSetRetention } from '@/lib/query/hooks'
import { useToast } from '@/components/ui/toast'
import { PERMISSIONS } from '@/lib/rbac/permissions'

/**
 * The audit retention window.
 *
 * Configurable rather than fixed because keeping personal data forever is not
 * the safe default it sounds like — GDPR and KVKK both require a purpose and a
 * limit — while too short a window makes the log useless for the incident
 * reviews it exists for. The options span both constraints; free entry does
 * not, which is why there is no number field here.
 */
function RetentionSetting({ current, canEdit }: { current: number; canEdit: boolean }) {
  const setRetention = useSetRetention()
  const toast = useToast()

  const onChange = async (days: number) => {
    try {
      await setRetention.mutateAsync(days)
      toast.success('Retention updated', `Audit records are kept for ${retentionLabel(days)}.`)
    } catch (error) {
      toast.error('Could not update retention', error instanceof Error ? error.message : undefined)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[#64748B]">
        Audit records are kept for{' '}
        <strong className="text-[#E2E8F0]">{retentionLabel(current)}</strong>, then
        deleted by the nightly retention job. The purge itself is recorded, so the
        log cannot shrink without a trace.
      </p>
      {canEdit ? (
        <div className="flex flex-wrap gap-1.5">
          {RETENTION_OPTIONS.map((days) => (
            <button
              key={days}
              onClick={() => onChange(days)}
              disabled={setRetention.isPending}
              aria-pressed={days === current}
              className={
                days === current
                  ? 'text-[11px] font-medium px-2.5 py-1.5 rounded-lg border bg-[#6C63FF]/15 text-[#8B85FF] border-[#6C63FF]/40'
                  : 'text-[11px] font-medium px-2.5 py-1.5 rounded-lg border bg-[#070B18] text-[#64748B] border-[#1E2D4A] hover:text-[#94A3B8] hover:border-[#2A3B5C] transition-colors disabled:opacity-50'
              }
            >
              {retentionLabel(days)}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-[#64748B]">
          Changing this needs the settings permission.
        </p>
      )}
    </div>
  )
}

export default function WorkspacePage() {
  const { organization, can } = useAuth()
  if (!organization) return null
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <SettingsPageHeader
        title="Workspace Settings"
        description="Manage your workspace configuration and security"
      />

      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
        <div className="max-w-2xl space-y-6">
          {/* Workspace Info */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-lg bg-[#0F1824] border border-[#1E2D4A]"
          >
            <h2 className="text-lg font-semibold text-[#E2E8F0] flex items-center gap-2 mb-4">
              <Settings className="w-5 h-5 text-[#6C63FF]" />
              Workspace Information
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-[#64748B]">Workspace Name</label>
                <div className="mt-1 p-3 bg-[#070B18] rounded border border-[#1E2D4A] text-[#E2E8F0]">
                  {organization.name}
                </div>
              </div>
              <div>
                <label className="text-sm text-[#64748B]">Slug</label>
                <div className="mt-1 p-3 bg-[#070B18] rounded border border-[#1E2D4A] text-[#E2E8F0] font-mono text-sm">
                  {organization.slug}
                </div>
              </div>
              <div>
                <label className="text-sm text-[#64748B]">Created</label>
                <div className="mt-1 p-3 bg-[#070B18] rounded border border-[#1E2D4A] text-[#E2E8F0]">
                  {new Date(organization.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Security Settings */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-6 rounded-lg bg-[#0F1824] border border-[#1E2D4A]"
          >
            <h2 className="text-lg font-semibold text-[#E2E8F0] flex items-center gap-2 mb-4">
              <Shield className="w-5 h-5 text-[#6C63FF]" />
              Security Settings
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-[#070B18] rounded border border-[#1E2D4A]">
                <label className="text-sm text-[#E2E8F0]">Two-Factor Authentication</label>
                <div className={`text-xs font-medium ${organization.settings.twoFactorRequired ? 'text-[#10B981]' : 'text-[#64748B]'}`}>
                  {organization.settings.twoFactorRequired ? 'Required' : 'Optional'}
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-[#070B18] rounded border border-[#1E2D4A]">
                <label className="text-sm text-[#E2E8F0]">SSO Enabled</label>
                <div className={`text-xs font-medium ${organization.ssoEnabled ? 'text-[#10B981]' : 'text-[#64748B]'}`}>
                  {organization.ssoEnabled ? 'Active' : 'Inactive'}
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-[#070B18] rounded border border-[#1E2D4A]">
                <label className="text-sm text-[#E2E8F0]">Audit Logging</label>
                <div className={`text-xs font-medium ${organization.settings.auditLoggingEnabled ? 'text-[#10B981]' : 'text-[#64748B]'}`}>
                  {organization.settings.auditLoggingEnabled ? 'Enabled' : 'Disabled'}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Data Retention */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-6 rounded-lg bg-[#0F1824] border border-[#1E2D4A]"
          >
            <h2 className="text-lg font-semibold text-[#E2E8F0] flex items-center gap-2 mb-4">
              <Lock className="w-5 h-5 text-[#6C63FF]" />
              Data Retention
            </h2>
            <RetentionSetting
              current={organization.settings.dataRetentionDays}
              canEdit={can(PERMISSIONS.SETTINGS_WRITE)}
            />
          </motion.div>
        </div>
      </div>
    </div>
  )
}
