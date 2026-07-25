'use client'

import { useMemo, useState } from 'react'
import {
  Search, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Check, X, Ban, RotateCw, Trash2, UserPlus, ShieldCheck,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useBulkMemberAction, useMemberAction, useTeams, useWorkspaces } from '@/lib/query/hooks'
import { useToast } from '@/components/ui/toast'
import { PERMISSIONS } from '@/lib/rbac/permissions'
import { canManageRole, getRoleLabel, SYSTEM_ROLE_LIST } from '@/lib/rbac/roles'
import type { AccountStatus, Member } from '@/lib/rbac/types'

import { EmptyState } from '@/components/states/data-states'
import { SkeletonTable } from '@/components/ui/skeleton'
import { MemberStatusBadge, relativeTime } from './member-status-badge'
import { cn } from '@/lib/utils'

type SortKey = 'name' | 'role' | 'status' | 'lastActiveAt' | 'createdAt'
const PAGE_SIZE = 8

const STATUS_FILTERS: { value: AccountStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'approved', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'rejected', label: 'Rejected' },
]

function Select({
  label, value, onChange, options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-lg bg-[#0F1824] border border-[#1E2D4A] text-xs text-[#E2E8F0] px-2.5 focus:outline-none focus:border-[#6C63FF] transition-colors"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  )
}

/**
 * Sortable column header. Defined at module scope: a component created inside
 * the table's render would be a new type on every render, remounting the header
 * and losing focus mid-interaction.
 */
function SortHeader({
  label, sortValue, sortKey, sortAsc, onSort,
}: {
  label: string
  sortValue: SortKey
  sortKey: SortKey
  sortAsc: boolean
  onSort: (key: SortKey) => void
}) {
  return (
    <button
      onClick={() => onSort(sortValue)}
      className="flex items-center gap-1 text-[10px] font-semibold text-[#64748B] uppercase tracking-widest hover:text-[#94A3B8] transition-colors"
      aria-label={`Sort by ${label}`}
    >
      {label}
      {sortKey === sortValue &&
        (sortAsc
          ? <ChevronUp aria-hidden="true" className="w-3 h-3" />
          : <ChevronDown aria-hidden="true" className="w-3 h-3" />)}
    </button>
  )
}

export function MembersTable({
  members,
  isLoading = false,
  onInvite,
}: {
  members: Member[]
  isLoading?: boolean
  onInvite?: () => void
}) {
  const { can, role: actorRole } = useAuth()
  const workspaces = useWorkspaces().data ?? []
  const teams = useTeams().data ?? []
  const memberAction = useMemberAction()
  const bulkAction = useBulkMemberAction()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<string>('all')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [workspaceFilter, setWorkspaceFilter] = useState<string>('all')
  const [teamFilter, setTeamFilter] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortAsc, setSortAsc] = useState(true)
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const canApprove = can(PERMISSIONS.MEMBERS_APPROVE)
  const canWrite = can(PERMISSIONS.MEMBERS_WRITE)
  const canInvite = can(PERMISSIONS.MEMBERS_INVITE)

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    const result = members.filter((member) => {
      if (term && !member.name.toLowerCase().includes(term) && !member.email.toLowerCase().includes(term)) return false
      if (status !== 'all' && member.status !== status) return false
      if (roleFilter !== 'all' && member.roleId !== roleFilter) return false
      if (workspaceFilter !== 'all' && !member.workspaceIds.includes(workspaceFilter)) return false
      if (teamFilter !== 'all' && !member.teamIds.includes(teamFilter)) return false
      return true
    })

    return result.sort((a, b) => {
      const direction = sortAsc ? 1 : -1
      switch (sortKey) {
        case 'role': return direction * getRoleLabel(a.roleId).localeCompare(getRoleLabel(b.roleId))
        case 'status': return direction * a.status.localeCompare(b.status)
        case 'lastActiveAt':
          return direction * ((a.lastActiveAt?.getTime() ?? 0) - (b.lastActiveAt?.getTime() ?? 0))
        case 'createdAt': return direction * (a.createdAt.getTime() - b.createdAt.getTime())
        default: return direction * a.name.localeCompare(b.name)
      }
    })
  }, [members, query, status, roleFilter, workspaceFilter, teamFilter, sortKey, sortAsc])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount - 1)
  const visible = filtered.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE)

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortAsc((current) => !current)
    else { setSortKey(key); setSortAsc(true) }
  }

  const toggleSelected = (id: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allVisibleSelected = visible.length > 0 && visible.every((member) => selected.has(member.id))

  const ACTION_COPY: Record<string, string> = {
    approve: 'approved', reject: 'rejected', suspend: 'suspended',
    activate: 'reactivated', remove: 'removed',
  }

  const runAction = async (
    memberId: string,
    action: 'approve' | 'reject' | 'suspend' | 'activate' | 'remove',
    name: string,
  ) => {
    // Removal is destructive and cannot be undone from the UI.
    if (action === 'remove' && !window.confirm(`Remove ${name} from the organization?`)) return
    try {
      await memberAction.mutateAsync({ memberId, action })
      toast.success(`Member ${ACTION_COPY[action]}`, `${name} has been ${ACTION_COPY[action]}.`)
      setSelected((current) => {
        const next = new Set(current)
        next.delete(memberId)
        return next
      })
    } catch (error) {
      toast.error('Action failed', error instanceof Error ? error.message : 'Please try again.')
    }
  }

  const runBulk = async (action: 'approve' | 'reject' | 'suspend' | 'activate') => {
    const ids = [...selected]
    try {
      const result = await bulkAction.mutateAsync({ ids, action })
      toast.success(
        `${result.updated} member${result.updated === 1 ? '' : 's'} ${ACTION_COPY[action]}`,
      )
      setSelected(new Set())
    } catch (error) {
      toast.error('Bulk action failed', error instanceof Error ? error.message : 'Please try again.')
    }
  }

  const resetFilters = () => {
    setQuery(''); setStatus('all'); setRoleFilter('all')
    setWorkspaceFilter('all'); setTeamFilter('all'); setPage(0)
  }

  if (isLoading) return <SkeletonTable rows={6} columns={6} />

  return (
    <div className="space-y-3">
      {/* Filters — sticky so they survive scrolling a long member list */}
      <div className="sticky top-0 z-10 -mx-1 px-1 py-2 bg-[#070B18]/95 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#64748B] pointer-events-none" />
            <input
              value={query}
              onChange={(event) => { setQuery(event.target.value); setPage(0) }}
              placeholder="Search by name or email..."
              aria-label="Search members"
              className="w-full h-9 pl-9 pr-3 rounded-lg bg-[#0F1824] border border-[#1E2D4A] text-xs text-[#E2E8F0] placeholder-[#64748B] focus:outline-none focus:border-[#6C63FF] transition-colors"
            />
          </div>

          <Select label="Status" value={status} onChange={(value) => { setStatus(value); setPage(0) }}
            options={STATUS_FILTERS.map((filter) => ({ value: filter.value, label: filter.label }))} />

          <Select label="Role" value={roleFilter} onChange={(value) => { setRoleFilter(value); setPage(0) }}
            options={[{ value: 'all', label: 'All roles' }, ...SYSTEM_ROLE_LIST.map((role) => ({ value: role.id, label: role.name }))]} />

          <Select label="Workspace" value={workspaceFilter} onChange={(value) => { setWorkspaceFilter(value); setPage(0) }}
            options={[{ value: 'all', label: 'All workspaces' }, ...workspaces.map((workspace) => ({ value: workspace.id, label: workspace.name }))]} />

          <Select label="Team" value={teamFilter} onChange={(value) => { setTeamFilter(value); setPage(0) }}
            options={[{ value: 'all', label: 'All teams' }, ...teams.map((team) => ({ value: team.id, label: `${team.name}` }))]} />
        </div>

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg bg-[#6C63FF]/10 border border-[#6C63FF]/25">
            <span className="text-xs font-medium text-[#E2E8F0]">{selected.size} selected</span>
            <div className="flex-1" />
            {canApprove && (
              <>
                <BulkButton icon={Check} label="Approve" tone="success"
                  disabled={bulkAction.isPending} onClick={() => runBulk('approve')} />
                <BulkButton icon={X} label="Reject" tone="danger"
                  disabled={bulkAction.isPending} onClick={() => runBulk('reject')} />
              </>
            )}
            {canWrite && (
              <BulkButton icon={Ban} label="Suspend" tone="warning"
                disabled={bulkAction.isPending} onClick={() => runBulk('suspend')} />
            )}
            <button onClick={() => setSelected(new Set())} className="text-xs text-[#64748B] hover:text-[#E2E8F0] px-2 py-1">
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-[#151D32] border border-[#1E2D4A] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left">
            <caption className="sr-only">Organization members</caption>
            <thead>
              <tr className="border-b border-[#1E2D4A]">
                <th scope="col" className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label="Select all members on this page"
                    checked={allVisibleSelected}
                    onChange={() =>
                      setSelected((current) => {
                        const next = new Set(current)
                        if (allVisibleSelected) visible.forEach((member) => next.delete(member.id))
                        else visible.forEach((member) => next.add(member.id))
                        return next
                      })
                    }
                    className="accent-[#6C63FF]"
                  />
                </th>
                <th scope="col" className="px-4 py-3"><SortHeader label="Member" sortValue="name" sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} /></th>
                <th scope="col" className="px-4 py-3"><SortHeader label="Role" sortValue="role" sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} /></th>
                <th scope="col" className="px-4 py-3 text-[10px] font-semibold text-[#64748B] uppercase tracking-widest">Workspace / Team</th>
                <th scope="col" className="px-4 py-3"><SortHeader label="Status" sortValue="status" sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} /></th>
                <th scope="col" className="px-4 py-3"><SortHeader label="Last active" sortValue="lastActiveAt" sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} /></th>
                <th scope="col" className="px-4 py-3 text-right text-[10px] font-semibold text-[#64748B] uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((member) => {
                const manageable = actorRole ? canManageRole(actorRole.id, member.roleId) : false
                return (
                  <tr key={member.id} className="border-b border-[#1E2D4A]/50 last:border-0 hover:bg-[#1a2440]/50 transition-colors">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Select ${member.name}`}
                        checked={selected.has(member.id)}
                        onChange={() => toggleSelected(member.id)}
                        disabled={!manageable}
                        className="accent-[#6C63FF] disabled:opacity-30"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-[#6C63FF]/15 border border-[#6C63FF]/25 flex items-center justify-center text-[10px] font-bold text-[#6C63FF] shrink-0">
                          {member.avatar ?? member.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-[#E2E8F0] truncate">{member.name}</p>
                          <p className="text-[11px] text-[#64748B] truncate">{member.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-[#94A3B8] whitespace-nowrap">{getRoleLabel(member.roleId)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-[11px] text-[#94A3B8] truncate max-w-[180px]">
                        {member.workspaceIds.map((id) => workspaces.find((w) => w.id === id)?.name).filter(Boolean).join(', ') || '—'}
                      </p>
                      <p className="text-[11px] text-[#64748B] truncate max-w-[180px]">
                        {member.teamIds.map((id) => teams.find((t) => t.id === id)?.name).filter(Boolean).join(', ') || 'No team'}
                      </p>
                    </td>
                    <td className="px-4 py-3"><MemberStatusBadge status={member.status} /></td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] text-[#64748B] whitespace-nowrap">{relativeTime(member.lastActiveAt)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {member.status === 'pending' && canApprove && (
                          <>
                            <RowAction icon={Check} label={`Approve ${member.name}`} tone="success"
                              disabled={!manageable || memberAction.isPending}
                              onClick={() => runAction(member.id, 'approve', member.name)} />
                            <RowAction icon={X} label={`Reject ${member.name}`} tone="danger"
                              disabled={!manageable || memberAction.isPending}
                              onClick={() => runAction(member.id, 'reject', member.name)} />
                          </>
                        )}
                        {member.status === 'approved' && canWrite && (
                          <RowAction icon={Ban} label={`Suspend ${member.name}`} tone="warning"
                            disabled={!manageable || memberAction.isPending}
                            onClick={() => runAction(member.id, 'suspend', member.name)} />
                        )}
                        {member.status === 'suspended' && canWrite && (
                          <RowAction icon={RotateCw} label={`Reactivate ${member.name}`} tone="success"
                            disabled={!manageable || memberAction.isPending}
                            onClick={() => runAction(member.id, 'activate', member.name)} />
                        )}
                        {canWrite && (
                          <RowAction icon={Trash2} label={`Remove ${member.name}`} tone="danger"
                            disabled={!manageable || memberAction.isPending}
                            onClick={() => runAction(member.id, 'remove', member.name)} />
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {visible.length === 0 && (
          filtered.length === 0 && members.length > 0 ? (
            <EmptyState
              icon={Search}
              title="No members match these filters"
              description="Try a different search term, or clear the filters to see everyone in the organization."
              actions={[{ label: 'Clear filters', onClick: resetFilters, variant: 'secondary' }]}
            />
          ) : (
            <EmptyState
              icon={UserPlus}
              title="No members yet"
              description="Invite your first teammate to start collaborating on release intelligence."
              actions={canInvite && onInvite ? [{ label: 'Invite member', onClick: onInvite }] : []}
            />
          )
        )}
      </div>

      {/* Pagination */}
      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between px-1">
          <p className="text-[11px] text-[#64748B]">
            Showing {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
          </p>
          <div className="flex items-center gap-1">
            <PageButton
              icon={ChevronLeft} label="Previous page"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            />
            <span className="text-[11px] text-[#94A3B8] px-2">{currentPage + 1} / {pageCount}</span>
            <PageButton
              icon={ChevronRight} label="Next page"
              disabled={currentPage >= pageCount - 1}
              onClick={() => setPage(currentPage + 1)}
            />
          </div>
        </div>
      )}

      {!canWrite && (
        <p className="flex items-center gap-1.5 text-[11px] text-[#64748B] px-1">
          <ShieldCheck aria-hidden="true" className="w-3.5 h-3.5" />
          You have read-only access to members.
        </p>
      )}
    </div>
  )
}

const TONE_CLASSES = {
  success: 'text-[#22C55E] hover:bg-[#22C55E]/10',
  danger: 'text-[#EF4444] hover:bg-[#EF4444]/10',
  warning: 'text-[#F59E0B] hover:bg-[#F59E0B]/10',
  neutral: 'text-[#94A3B8] hover:bg-[#151D32]',
} as const

function RowAction({
  icon: Icon, label, tone, disabled, onClick,
}: {
  icon: typeof Check
  label: string
  tone: keyof typeof TONE_CLASSES
  disabled?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'p-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed',
        TONE_CLASSES[tone],
      )}
    >
      <Icon aria-hidden="true" className="w-3.5 h-3.5" />
    </button>
  )
}

function BulkButton({
  icon: Icon, label, tone, disabled, onClick,
}: {
  icon: typeof Check
  label: string
  tone: keyof typeof TONE_CLASSES
  disabled?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'disabled:opacity-50 disabled:cursor-not-allowed','inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors', TONE_CLASSES[tone])}
    >
      <Icon aria-hidden="true" className="w-3.5 h-3.5" />
      {label}
    </button>
  )
}

function PageButton({
  icon: Icon, label, disabled, onClick,
}: {
  icon: typeof ChevronLeft
  label: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="p-1.5 rounded-lg border border-[#1E2D4A] text-[#94A3B8] hover:text-[#E2E8F0] hover:border-[#6C63FF]/40 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
    >
      <Icon aria-hidden="true" className="w-3.5 h-3.5" />
    </button>
  )
}
