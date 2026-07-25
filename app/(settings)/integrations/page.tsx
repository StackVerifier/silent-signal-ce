'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Check, Clock, Plug, RefreshCw, Settings2, AlertTriangle, ExternalLink,
} from 'lucide-react'
import { SettingsPageHeader } from '@/components/settings/page-header'
import { PermissionGuard } from '@/components/rbac/permission-guard'
import { EmptyState, ErrorState } from '@/components/states/data-states'
import { SkeletonCard } from '@/components/ui/skeleton'
import { Dialog, DialogButton } from '@/components/ui/dialog'
import { TextField } from '@/components/forms/fields'
import { useToast } from '@/components/ui/toast'
import { useGatedQuery } from '@/hooks/use-gated-data'
import {
  useConnectJira, useDisconnectJira, useJiraConnection, useJiraFieldMapping,
  useJiraProjects, useJiraSyncStatus, useSaveJiraFieldMapping, useTriggerJiraSync,
} from '@/lib/query/hooks'
import { useAuth } from '@/lib/auth-context'
import { PERMISSIONS } from '@/lib/rbac/permissions'
import { relativeTime } from '@/components/members/member-status-badge'
import type { JiraFieldMapping } from '@/services/jira.service'
import { cn } from '@/lib/utils'

const OTHER_INTEGRATIONS = [
  { type: 'slack', name: 'Slack', description: 'Post risk alerts to a channel', icon: '⚡' },
  { type: 'teams', name: 'Microsoft Teams', description: 'Deliver alerts to a Teams channel', icon: '💬' },
  { type: 'github', name: 'GitHub', description: 'Correlate pull requests with Jira issues', icon: '🐙' },
  { type: 'azure', name: 'Azure DevOps', description: 'Planned — pipelines and boards', icon: '☁️', comingSoon: true },
]

export default function IntegrationsPage() {
  const { can } = useAuth()
  const canWrite = can(PERMISSIONS.INTEGRATION_WRITE)

  const connection = useGatedQuery(useJiraConnection(), { permission: PERMISSIONS.INTEGRATION_READ })
  const sync = useGatedQuery(useJiraSyncStatus(), { permission: PERMISSIONS.INTEGRATION_READ })
  const projects = useJiraProjects()

  const connect = useConnectJira()
  const disconnect = useDisconnectJira()
  const triggerSync = useTriggerJiraSync()
  const toast = useToast()

  const [mappingOpen, setMappingOpen] = useState(false)
  const isConnected = Boolean(connection.data?.enabled)

  const handleConnect = async () => {
    try {
      const result = await connect.mutateAsync()
      // In live mode the server hands back a consent URL to redirect to.
      if (result.redirectUrl) {
        window.location.href = result.redirectUrl
        return
      }
      toast.success('Jira connected', 'Boards are discoverable and the first sync has been queued.')
    } catch (error) {
      toast.error('Could not connect Jira', error instanceof Error ? error.message : 'Please try again.')
    }
  }

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect Jira? Dashboards keep the last synced data but stop updating.')) return
    try {
      await disconnect.mutateAsync()
      toast.success('Jira disconnected', 'No further data will be pulled until you reconnect.')
    } catch (error) {
      toast.error('Could not disconnect', error instanceof Error ? error.message : 'Please try again.')
    }
  }

  const handleSync = async () => {
    try {
      await triggerSync.mutateAsync()
      toast.success('Sync started', 'Incremental sync is running; this page updates as it progresses.')
    } catch (error) {
      toast.error('Sync failed to start', error instanceof Error ? error.message : 'Please try again.')
    }
  }

  return (
    <PermissionGuard permission={PERMISSIONS.INTEGRATION_READ} showDenied>
      <div className="flex-1 flex flex-col overflow-hidden">
        <SettingsPageHeader
          title="Integrations"
          description="Connect the systems Silent Signal reads delivery signals from"
        />

        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
          <div className="max-w-3xl space-y-4">
            {/* Jira — the primary integration, so it gets a full panel */}
            {connection.isSkeleton ? (
              <SkeletonCard rows={3} />
            ) : connection.state === 'error' ? (
              <ErrorState
                title="Unable to load the Jira connection"
                description={connection.errorMessage ?? undefined}
                onRetry={connection.retry}
              />
            ) : (
              <section className="bg-[#151D32] border border-[#1E2D4A] rounded-xl overflow-hidden">
                <div className="flex flex-wrap items-start gap-4 p-5">
                  <div className="text-3xl leading-none" aria-hidden="true">🔷</div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-semibold text-[#E2E8F0]">Jira Cloud</h2>
                      <span
                        className={cn(
                          'text-[10px] font-semibold px-2 py-0.5 rounded-full border',
                          isConnected
                            ? 'text-[#22C55E] bg-[#22C55E]/10 border-[#22C55E]/25'
                            : 'text-[#64748B] bg-[#64748B]/10 border-[#64748B]/25',
                        )}
                      >
                        {isConnected ? 'Connected' : 'Not connected'}
                      </span>
                    </div>
                    <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                      Sprints, releases, QA states and risk signals are all derived from Jira.
                    </p>

                    {isConnected && !sync.isSkeleton && sync.data && (
                      <dl className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div>
                          <dt className="text-[10px] text-[#64748B] uppercase tracking-widest">Last sync</dt>
                          <dd className="text-xs text-[#E2E8F0] mt-0.5 flex items-center gap-1">
                            <Clock aria-hidden="true" className="w-3 h-3 text-[#64748B]" />
                            {sync.data.lastSyncAt ? relativeTime(sync.data.lastSyncAt) : 'Never'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10px] text-[#64748B] uppercase tracking-widest">Issues</dt>
                          <dd className="text-xs text-[#E2E8F0] mt-0.5">
                            {sync.data.syncedIssueCount.toLocaleString()}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10px] text-[#64748B] uppercase tracking-widest">Boards</dt>
                          <dd className="text-xs text-[#E2E8F0] mt-0.5">
                            {projects.isPending ? '—' : `${projects.data?.length ?? 0} projects`}
                          </dd>
                        </div>
                      </dl>
                    )}

                    {sync.data?.state === 'error' && (
                      <p className="mt-3 flex items-start gap-1.5 text-[11px] text-[#FCA5A5]">
                        <AlertTriangle aria-hidden="true" className="w-3.5 h-3.5 shrink-0 mt-px" />
                        {sync.data.lastError ?? 'The last sync failed.'}
                      </p>
                    )}
                    {sync.data?.rateLimitedUntil && (
                      <p className="mt-2 text-[11px] text-[#F59E0B]">
                        Rate limited by Jira until {new Date(sync.data.rateLimitedUntil).toLocaleTimeString()}.
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {isConnected ? (
                      <>
                        <button
                          onClick={handleSync}
                          disabled={triggerSync.isPending || sync.data?.state === 'syncing'}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#1E2D4A] text-xs font-medium text-[#94A3B8] hover:text-[#E2E8F0] hover:border-[#6C63FF]/40 disabled:opacity-50 transition-colors"
                        >
                          <RefreshCw
                            aria-hidden="true"
                            className={cn('w-3.5 h-3.5', sync.data?.state === 'syncing' && 'animate-spin')}
                          />
                          {sync.data?.state === 'syncing' ? 'Syncing…' : 'Sync now'}
                        </button>
                        {canWrite && (
                          <>
                            <button
                              onClick={() => setMappingOpen(true)}
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#1E2D4A] text-xs font-medium text-[#94A3B8] hover:text-[#E2E8F0] hover:border-[#6C63FF]/40 transition-colors"
                            >
                              <Settings2 aria-hidden="true" className="w-3.5 h-3.5" />
                              Field mapping
                            </button>
                            <button
                              onClick={handleDisconnect}
                              disabled={disconnect.isPending}
                              className="px-3 py-2 rounded-lg text-xs font-medium text-[#EF4444] hover:bg-[#EF4444]/10 disabled:opacity-50 transition-colors"
                            >
                              Disconnect
                            </button>
                          </>
                        )}
                      </>
                    ) : canWrite ? (
                      <button
                        onClick={handleConnect}
                        disabled={connect.isPending}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#6C63FF] hover:bg-[#5B52CC] text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
                      >
                        <Plug aria-hidden="true" className="w-4 h-4" />
                        {connect.isPending ? 'Connecting…' : 'Connect Jira'}
                      </button>
                    ) : (
                      <span className="text-[11px] text-[#64748B]">
                        Ask an administrator to connect Jira
                      </span>
                    )}
                  </div>
                </div>

                {isConnected && projects.data && projects.data.length > 0 && (
                  <div className="border-t border-[#1E2D4A] px-5 py-3.5">
                    <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-widest mb-2">
                      Synced projects
                    </p>
                    <ul className="flex flex-wrap gap-1.5">
                      {projects.data.map((project) => (
                        <li
                          key={project.id}
                          className="inline-flex items-center gap-1.5 text-[11px] text-[#94A3B8] bg-[#0F1824] border border-[#1E2D4A] rounded-full px-2.5 py-1"
                        >
                          <Check aria-hidden="true" className="w-3 h-3 text-[#22C55E]" />
                          <span className="font-mono text-[#6C63FF]">{project.key}</span>
                          {project.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {!isConnected && (
                  <div className="border-t border-[#1E2D4A]">
                    <EmptyState
                      icon={Plug}
                      title="No Jira connection yet"
                      description="Every dashboard stays empty until Jira is connected. Connecting takes about a minute and only requires read access."
                      actions={
                        canWrite
                          ? [{ label: connect.isPending ? 'Connecting…' : 'Connect Jira', onClick: handleConnect }]
                          : []
                      }
                    />
                  </div>
                )}
              </section>
            )}

            {/* Secondary integrations */}
            <div className="space-y-3">
              <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-widest">
                Delivery channels &amp; other sources
              </p>
              {OTHER_INTEGRATIONS.map((integration, index) => (
                <motion.div
                  key={integration.type}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className="flex flex-wrap items-center gap-4 p-4 rounded-xl bg-[#151D32] border border-[#1E2D4A]"
                >
                  <span className="text-2xl leading-none" aria-hidden="true">{integration.icon}</span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-medium text-[#E2E8F0]">{integration.name}</h3>
                    <p className="text-[11px] text-[#64748B] mt-0.5">{integration.description}</p>
                  </div>
                  {integration.comingSoon ? (
                    <span className="text-[10px] font-semibold text-[#64748B] bg-[#64748B]/10 border border-[#64748B]/25 px-2 py-0.5 rounded-full">
                      Planned
                    </span>
                  ) : (
                    <button
                      disabled={!canWrite}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#1E2D4A] text-xs font-medium text-[#94A3B8] hover:text-[#E2E8F0] hover:border-[#6C63FF]/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ExternalLink aria-hidden="true" className="w-3.5 h-3.5" />
                      Connect
                    </button>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <FieldMappingDialog open={mappingOpen} onClose={() => setMappingOpen(false)} />
    </PermissionGuard>
  )
}

/**
 * Jira custom field ids differ per tenant, so the mapping cannot be hardcoded —
 * without it, story points and severity silently read as empty.
 */
function FieldMappingDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const mapping = useJiraFieldMapping()
  const save = useSaveJiraFieldMapping()
  const toast = useToast()
  const [draft, setDraft] = useState<JiraFieldMapping | null>(null)

  const current = draft ?? mapping.data ?? {
    storyPoints: null, sprint: null, severity: null, qaStatus: null,
  }

  const update = (key: keyof JiraFieldMapping, value: string) =>
    setDraft({ ...current, [key]: value || null })

  const handleSave = async () => {
    try {
      await save.mutateAsync(current)
      toast.success('Field mapping saved', 'The next sync will use these fields.')
      setDraft(null)
      onClose()
    } catch (error) {
      toast.error('Could not save mapping', error instanceof Error ? error.message : 'Please try again.')
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Jira field mapping"
      description="Custom field ids differ per Jira site. Map them once so story points, sprints and severity read correctly."
      footer={
        <>
          <DialogButton variant="ghost" type="button" onClick={onClose}>Cancel</DialogButton>
          <DialogButton type="button" onClick={handleSave} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save mapping'}
          </DialogButton>
        </>
      }
    >
      {mapping.isPending ? (
        <SkeletonCard rows={3} />
      ) : (
        <div className="space-y-4">
          <TextField
            label="Story points field"
            placeholder="customfield_10016"
            hint="Find it under Jira settings → Issues → Custom fields."
            value={current.storyPoints ?? ''}
            onChange={(event) => update('storyPoints', event.target.value)}
          />
          <TextField
            label="Sprint field"
            placeholder="customfield_10020"
            value={current.sprint ?? ''}
            onChange={(event) => update('sprint', event.target.value)}
          />
          <TextField
            label="Severity field"
            placeholder="customfield_10101"
            value={current.severity ?? ''}
            onChange={(event) => update('severity', event.target.value)}
          />
          <TextField
            label="QA status field"
            placeholder="Leave empty to use the workflow status"
            hint="Optional. Falls back to the issue's workflow status when empty."
            value={current.qaStatus ?? ''}
            onChange={(event) => update('qaStatus', event.target.value)}
          />
        </div>
      )}
    </Dialog>
  )
}
