'use client'

import { useMemo, useState } from 'react'
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react'
import { Topbar } from '@/components/layout/topbar'
import { PermissionGuard } from '@/components/rbac/permission-guard'
import { EmptyState } from '@/components/states/data-states'
import { useTeams, useWorkspaces } from '@/lib/query/hooks'
import { useAuth } from '@/lib/auth-context'
import { PERMISSIONS } from '@/lib/rbac/permissions'
import { REPORT_KINDS, REPORT_LABELS, type ReportKind } from '@/lib/reports/types'
import { teamTheme } from '@/lib/reports/theme'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/**
 * Reports.
 *
 * One screen, one click: pick which of the three reports you want and which
 * teams, then download the whole pack as a PDF or a workbook. The default is
 * everything — an administrator asking for "this week's numbers" wants all of
 * it, and making them tick nine boxes first is the kind of friction that sends
 * people back to copying tables by hand.
 *
 * The two formats are different jobs, not the same file twice. The PDF is for
 * reading, filing and sending on: cover sheet, colour key, one page flow per
 * team. The workbook is for someone who will sort and pivot: a sheet per team
 * with frozen headers and autofilters. Offering both is why neither has to
 * compromise.
 */

const KIND_DESCRIPTIONS: Record<ReportKind, string> = {
  sprint: 'Issues, points, blockers and velocity for the active sprint.',
  release: 'Gate status, confidence and blocking issues per release.',
  qa: 'Queue depth, wait times, unassigned items and reopens.',
}

export default function ReportsPage() {
  const { can } = useAuth()
  const teams = useTeams()
  const workspaces = useWorkspaces()

  const [kinds, setKinds] = useState<ReportKind[]>([...REPORT_KINDS])
  const [teamIds, setTeamIds] = useState<string[] | null>(null) // null = every team
  const [pending, setPending] = useState<string | null>(null)

  const allTeams = useMemo(() => teams.data ?? [], [teams.data])
  const workspaceNames = useMemo(
    () => new Map((workspaces.data ?? []).map((workspace) => [workspace.id, workspace.name])),
    [workspaces.data],
  )

  const selectedTeams = teamIds ?? allTeams.map((team) => team.id)
  const canExport = can(PERMISSIONS.REPORTS_EXPORT)

  const href = (format: 'pdf' | 'xlsx') => {
    const params = new URLSearchParams({ format, kinds: kinds.join(',') })
    // Omitted rather than listing every id: "all teams" should keep meaning all
    // teams if one is added between opening this page and clicking download.
    if (teamIds) params.set('teams', teamIds.join(','))
    return `/api/reports/export?${params}`
  }

  const download = (format: 'pdf' | 'xlsx') => {
    setPending(format)
    // A hidden iframe rather than fetch-and-blob: the browser streams the file
    // straight to disk, so a 200-page pack never has to sit in a JS string.
    const frame = document.createElement('iframe')
    frame.style.display = 'none'
    frame.src = href(format)
    document.body.appendChild(frame)
    window.setTimeout(() => {
      frame.remove()
      setPending(null)
    }, 4000)
  }

  const toggleKind = (kind: ReportKind) =>
    setKinds((current) =>
      current.includes(kind)
        ? current.filter((item) => item !== kind)
        : [...REPORT_KINDS].filter((item) => current.includes(item) || item === kind))

  const toggleTeam = (teamId: string) =>
    setTeamIds((current) => {
      const base = current ?? allTeams.map((team) => team.id)
      const next = base.includes(teamId)
        ? base.filter((id) => id !== teamId)
        : [...base, teamId]
      return next.length === allTeams.length ? null : next
    })

  const rowCount = selectedTeams.length * kinds.length
  const ready = kinds.length > 0 && selectedTeams.length > 0

  return (
    <PermissionGuard permission={PERMISSIONS.REPORTS_READ} showDenied>
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar title="Reports" />

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-5xl space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-[#E2E8F0]">Delivery report pack</h2>
              <p className="text-xs text-[#64748B] mt-0.5">
                Sprint, release and QA reports for every team, in one file.
              </p>
            </div>

            <section className="space-y-2">
              <h3 className="text-[10px] font-semibold text-[#64748B] uppercase tracking-widest">
                Reports to include
              </h3>
              <div className="grid gap-2 sm:grid-cols-3">
                {REPORT_KINDS.map((kind) => {
                  const active = kinds.includes(kind)
                  return (
                    <button
                      key={kind}
                      onClick={() => toggleKind(kind)}
                      aria-pressed={active}
                      className={cn(
                        'text-left rounded-xl border p-3 transition-colors',
                        active
                          ? 'bg-[#6C63FF]/10 border-[#6C63FF]/40'
                          : 'bg-[#0F1824] border-[#1E2D4A] hover:border-[#2A3B5C]',
                      )}
                    >
                      <p className={cn('text-xs font-medium', active ? 'text-[#E2E8F0]' : 'text-[#94A3B8]')}>
                        {REPORT_LABELS[kind]}
                      </p>
                      <p className="text-[10px] text-[#64748B] mt-1 leading-relaxed">
                        {KIND_DESCRIPTIONS[kind]}
                      </p>
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-semibold text-[#64748B] uppercase tracking-widest">
                  Teams
                </h3>
                <button
                  onClick={() => setTeamIds(null)}
                  disabled={teamIds === null}
                  className="text-[10px] text-[#6C63FF] hover:text-[#8B85FF] disabled:text-[#334155] transition-colors"
                >
                  Select all
                </button>
              </div>

              {teams.isLoading ? (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-12 rounded-xl" />
                  ))}
                </div>
              ) : allTeams.length === 0 ? (
                <EmptyState
                  icon={FileSpreadsheet}
                  title="No teams yet"
                  description="Reports are organised by team. Create one to start generating packs."
                  actions={[{ label: 'Go to Teams', href: '/teams' }]}
                />
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {allTeams.map((team) => {
                    const active = selectedTeams.includes(team.id)
                    const theme = teamTheme(team.id)
                    return (
                      <button
                        key={team.id}
                        onClick={() => toggleTeam(team.id)}
                        aria-pressed={active}
                        className={cn(
                          'flex items-center gap-2.5 rounded-xl border p-3 text-left transition-colors',
                          active
                            ? 'bg-[#151D32] border-[#6C63FF]/40'
                            : 'bg-[#0F1824] border-[#1E2D4A] hover:border-[#2A3B5C] opacity-60',
                        )}
                      >
                        {/* The same colour the team gets in the file, so the
                            pack is recognisable before it is opened. */}
                        <span
                          aria-hidden="true"
                          className="w-3 h-8 rounded shrink-0"
                          style={{ backgroundColor: `#${theme.primary}` }}
                        />
                        <span className="min-w-0">
                          <span className="block text-xs font-medium text-[#E2E8F0] truncate">
                            {team.name}
                          </span>
                          <span className="block text-[10px] text-[#64748B] truncate">
                            {workspaceNames.get(team.workspaceId) ?? '—'}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </section>

            <section className="rounded-xl border border-[#1E2D4A] bg-[#0F1824] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[11px] text-[#64748B]">
                  {ready
                    ? `${selectedTeams.length} team${selectedTeams.length === 1 ? '' : 's'} · ${kinds.length} report${kinds.length === 1 ? '' : 's'} · ${rowCount} section${rowCount === 1 ? '' : 's'}`
                    : 'Pick at least one report and one team.'}
                </p>

                <div className="flex items-center gap-2">
                  <DownloadButton
                    icon={FileText}
                    label="PDF"
                    hint="For reading and filing"
                    busy={pending === 'pdf'}
                    disabled={!ready || !canExport}
                    onClick={() => download('pdf')}
                  />
                  <DownloadButton
                    icon={FileSpreadsheet}
                    label="Excel"
                    hint="For sorting and pivoting"
                    busy={pending === 'xlsx'}
                    disabled={!ready || !canExport}
                    onClick={() => download('xlsx')}
                  />
                </div>
              </div>

              {!canExport && (
                <p className="text-[10px] text-[#F59E0B] mt-2">
                  Downloading reports needs the export permission.
                </p>
              )}
            </section>

            <p className="text-[10px] text-[#64748B] leading-relaxed">
              Both formats embed a Unicode typeface and give each team its own
              colour, so a pack stays readable and separable on any machine.
              Every download is recorded in the audit log.
            </p>
          </div>
        </div>
      </div>
    </PermissionGuard>
  )
}

function DownloadButton({
  icon: Icon, label, hint, busy, disabled, onClick,
}: {
  icon: typeof FileText
  label: string
  hint: string
  busy: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || busy}
      title={hint}
      className={cn(
        'inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors',
        disabled
          ? 'bg-[#151D32] text-[#334155] cursor-not-allowed'
          : 'bg-[#6C63FF] text-white hover:bg-[#5A52E0]',
      )}
    >
      {busy
        ? <Loader2 aria-hidden="true" className="w-3.5 h-3.5 animate-spin" />
        : <Icon aria-hidden="true" className="w-3.5 h-3.5" />}
      {busy ? 'Preparing…' : label}
      {!busy && <Download aria-hidden="true" className="w-3 h-3 opacity-70" />}
    </button>
  )
}
