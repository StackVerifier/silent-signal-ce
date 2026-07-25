'use client'

import { SettingsPageHeader } from '@/components/settings/page-header'
import { mockIntegrations } from '@/lib/mock-data'
import { motion } from 'framer-motion'
import { Zap, Check, X, Clock } from 'lucide-react'

const INTEGRATION_ICONS: Record<string, string> = {
  jira: '🔷',
  slack: '⚡',
  github: '🐙',
  azure: '☁️',
  datadog: '📊',
}

export default function IntegrationsPage() {
  const enabledCount = mockIntegrations.filter(i => i.enabled).length

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <SettingsPageHeader
        title="Integrations"
        description={`${enabledCount} of ${mockIntegrations.length} connected`}
      />

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-3xl space-y-4">
          {mockIntegrations.map((integration, idx) => (
            <motion.div
              key={integration.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="p-4 rounded-lg bg-[#0F1824] border border-[#1E2D4A] hover:border-[#6C63FF]/30 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="text-3xl">{INTEGRATION_ICONS[integration.type] || '🔌'}</div>
                  <div>
                    <h3 className="font-semibold text-[#E2E8F0]">{integration.name}</h3>
                    <p className="text-xs text-[#64748B] mt-1">
                      Status:{' '}
                      <span className={`font-medium ${integration.enabled ? 'text-[#10B981]' : 'text-[#64748B]'}`}>
                        {integration.enabled ? 'Connected' : 'Disconnected'}
                      </span>
                    </p>
                    {integration.lastSyncAt && (
                      <p className="text-xs text-[#64748B] mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Last sync: {new Date(integration.lastSyncAt).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                    style={{
                      backgroundColor: integration.enabled ? '#6C63FF/10' : '#64748B/10',
                      color: integration.enabled ? '#6C63FF' : '#64748B',
                    }}
                  >
                    {integration.enabled ? (
                      <>
                        <Check className="w-3 h-3 inline-block mr-1" />
                        Disconnect
                      </>
                    ) : (
                      <>
                        <X className="w-3 h-3 inline-block mr-1" />
                        Connect
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          ))}

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: mockIntegrations.length * 0.05 }}
            className="p-6 rounded-lg border-2 border-dashed border-[#1E2D4A] flex items-center justify-between"
          >
            <div>
              <p className="font-medium text-[#E2E8F0]">Request New Integration</p>
              <p className="text-sm text-[#64748B] mt-1">Don&apos;t see what you need?</p>
            </div>
            <button className="px-4 py-2 rounded-lg text-sm font-medium bg-[#6C63FF]/10 text-[#6C63FF] hover:bg-[#6C63FF]/20 transition-colors">
              Request
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
