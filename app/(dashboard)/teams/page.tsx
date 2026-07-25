'use client'

import { motion } from 'framer-motion'
import { Plus, UsersRound, Pencil, Trash2, GitBranch, FlaskConical } from 'lucide-react'
import { Topbar } from '@/components/layout/topbar'
import { PermissionGuard } from '@/components/rbac/permission-guard'
import { EmptyState } from '@/components/states/data-states'
import { SkeletonCard } from '@/components/ui/skeleton'
import { useGatedData } from '@/hooks/use-gated-data'
import { useAuth } from '@/lib/auth-context'
import { PERMISSIONS } from '@/lib/rbac/permissions'
import { mockMembers, mockTeams, mockWorkspaces } from '@/lib/mock-tenancy'

export default function TeamsPage() {
  const { can, workspace } = useAuth()
  const teams = useGatedData(mockTeams, { permission: PERMISSIONS.TEAMS_READ, delay: 350 })
  const canWrite = can(PERMISSIONS.TEAMS_WRITE)

  const grouped = mockWorkspaces
    .filter((candidate) => candidate.status === 'active')
    .map((candidate) => ({
      workspace: candidate,
      teams: (teams.data ?? []).filter((team) => team.workspaceId === candidate.id),
    }))
    .filter((group) => group.teams.length > 0)

  return (
    <PermissionGuard permission={PERMISSIONS.TEAMS_READ} showDenied>
      <div className="flex flex-col h-full overflow-hidden">
        <Topbar title="Teams" />
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[#E2E8F0]">Team management</h2>
                <p className="text-xs text-[#64748B] mt-1">
                  Teams group members inside a workspace and carry release and QA ownership.
                  {workspace && <> Currently viewing <span className="text-[#94A3B8]">{workspace.name}</span>.</>}
                </p>
              </div>
              {canWrite && (
                <button className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#6C63FF] hover:bg-[#5B52CC] text-white rounded-lg font-medium text-sm transition-colors">
                  <Plus aria-hidden="true" className="w-4 h-4" />
                  Create team
                </button>
              )}
            </div>

            {teams.isSkeleton ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <SkeletonCard key={index} rows={3} />
                ))}
              </div>
            ) : grouped.length === 0 ? (
              <div className="bg-[#151D32] border border-[#1E2D4A] rounded-xl">
                <EmptyState
                  icon={UsersRound}
                  title="No teams in this organization yet"
                  description="Create a team to assign release managers, QA leads and members to a workspace."
                  actions={canWrite ? [{ label: 'Create team' }] : []}
                />
              </div>
            ) : (
              grouped.map((group) => (
                <section key={group.workspace.id} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-semibold text-[#64748B] uppercase tracking-widest">
                      {group.workspace.name}
                    </h3>
                    <span className="text-[10px] text-[#64748B] bg-[#1E2D4A] px-1.5 py-0.5 rounded font-mono">
                      {group.teams.length}
                    </span>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {group.teams.map((team, index) => {
                      const members = mockMembers.filter((member) => member.teamIds.includes(team.id))
                      const releaseManager = mockMembers.find((m) => m.id === team.releaseManagerId)
                      const qaLead = mockMembers.find((m) => m.id === team.qaLeadId)

                      return (
                        <motion.article
                          key={team.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(index, 8) * 0.05 }}
                          className="group bg-[#151D32] border border-[#1E2D4A] rounded-xl p-5 hover:border-[#6C63FF]/40 hover:bg-[#1a2440] transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h4 className="text-sm font-semibold text-[#E2E8F0] truncate">{team.name}</h4>
                              {team.description && (
                                <p className="text-[11px] text-[#64748B] mt-1 line-clamp-2">{team.description}</p>
                              )}
                            </div>
                            {canWrite && (
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
                                <button aria-label={`Edit ${team.name}`} title="Edit team" className="p-1.5 rounded-lg text-[#94A3B8] hover:bg-[#1E2D4A] transition-colors">
                                  <Pencil aria-hidden="true" className="w-3.5 h-3.5" />
                                </button>
                                {can(PERMISSIONS.TEAMS_DELETE) && (
                                  <button aria-label={`Delete ${team.name}`} title="Delete team" className="p-1.5 rounded-lg text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors">
                                    <Trash2 aria-hidden="true" className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="mt-4 space-y-2">
                            <OwnerRow icon={GitBranch} label="Release manager" name={releaseManager?.name} />
                            <OwnerRow icon={FlaskConical} label="QA lead" name={qaLead?.name} />
                          </div>

                          <div className="mt-4 pt-4 border-t border-[#1E2D4A] flex items-center justify-between">
                            <div className="flex items-center -space-x-2">
                              {members.slice(0, 5).map((member) => (
                                <span
                                  key={member.id}
                                  title={member.name}
                                  className="w-7 h-7 rounded-full bg-[#6C63FF]/20 border-2 border-[#151D32] flex items-center justify-center text-[9px] font-bold text-[#6C63FF]"
                                >
                                  {member.avatar ?? member.name.slice(0, 2).toUpperCase()}
                                </span>
                              ))}
                              {members.length === 0 && (
                                <span className="text-[11px] text-[#64748B]">No members assigned</span>
                              )}
                              {members.length > 5 && (
                                <span className="w-7 h-7 rounded-full bg-[#1E2D4A] border-2 border-[#151D32] flex items-center justify-center text-[9px] font-bold text-[#94A3B8]">
                                  +{members.length - 5}
                                </span>
                              )}
                            </div>
                            {canWrite && (
                              <button className="text-[11px] font-medium text-[#6C63FF] hover:text-[#8B85FF] transition-colors">
                                Manage members
                              </button>
                            )}
                          </div>
                        </motion.article>
                      )
                    })}
                  </div>
                </section>
              ))
            )}
          </div>
        </div>
      </div>
    </PermissionGuard>
  )
}

function OwnerRow({
  icon: Icon,
  label,
  name,
}: {
  icon: typeof GitBranch
  label: string
  name?: string
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1.5 text-[11px] text-[#64748B]">
        <Icon aria-hidden="true" className="w-3 h-3" />
        {label}
      </span>
      <span className={`text-[11px] ${name ? 'text-[#E2E8F0]' : 'text-[#64748B] italic'}`}>
        {name ?? 'Unassigned'}
      </span>
    </div>
  )
}
