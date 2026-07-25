'use client'

import { SettingsPageHeader } from '@/components/settings/page-header'
import { mockWorkspace } from '@/lib/mock-data'
import { motion } from 'framer-motion'
import { Settings, Shield, Lock } from 'lucide-react'

export default function WorkspacePage() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <SettingsPageHeader
        title="Workspace Settings"
        description="Manage your workspace configuration and security"
      />

      <div className="flex-1 overflow-y-auto px-8 py-6">
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
                  {mockWorkspace.name}
                </div>
              </div>
              <div>
                <label className="text-sm text-[#64748B]">Slug</label>
                <div className="mt-1 p-3 bg-[#070B18] rounded border border-[#1E2D4A] text-[#E2E8F0] font-mono text-sm">
                  {mockWorkspace.slug}
                </div>
              </div>
              <div>
                <label className="text-sm text-[#64748B]">Created</label>
                <div className="mt-1 p-3 bg-[#070B18] rounded border border-[#1E2D4A] text-[#E2E8F0]">
                  {new Date(mockWorkspace.createdAt).toLocaleDateString()}
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
                <div className={`text-xs font-medium ${mockWorkspace.settings.twoFactorRequired ? 'text-[#10B981]' : 'text-[#64748B]'}`}>
                  {mockWorkspace.settings.twoFactorRequired ? 'Required' : 'Optional'}
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-[#070B18] rounded border border-[#1E2D4A]">
                <label className="text-sm text-[#E2E8F0]">SSO Enabled</label>
                <div className={`text-xs font-medium ${mockWorkspace.settings.ssoEnabled ? 'text-[#10B981]' : 'text-[#64748B]'}`}>
                  {mockWorkspace.settings.ssoEnabled ? 'Active' : 'Inactive'}
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-[#070B18] rounded border border-[#1E2D4A]">
                <label className="text-sm text-[#E2E8F0]">Audit Logging</label>
                <div className={`text-xs font-medium ${mockWorkspace.settings.auditLoggingEnabled ? 'text-[#10B981]' : 'text-[#64748B]'}`}>
                  {mockWorkspace.settings.auditLoggingEnabled ? 'Enabled' : 'Disabled'}
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
            <p className="text-sm text-[#64748B] mb-3">
              Workspace data is retained for <strong className="text-[#E2E8F0]">{mockWorkspace.settings.dataRetentionDays} days</strong> after deletion.
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
