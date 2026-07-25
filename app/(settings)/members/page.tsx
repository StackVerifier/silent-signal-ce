'use client'

import { useState } from 'react'
import { UserPlus, Mail, Clock } from 'lucide-react'
import { motion } from 'framer-motion'
import { SettingsPageHeader } from '@/components/settings/page-header'
import { MembersTable } from '@/components/members/members-table'
import { InvitationStatusBadge, relativeTime } from '@/components/members/member-status-badge'
import { PermissionGuard } from '@/components/rbac/permission-guard'
import { EmptyState, ErrorState } from '@/components/states/data-states'
import { useGatedQuery } from '@/hooks/use-gated-data'
import { useInvitationAction, useInvitations, useMembers } from '@/lib/query/hooks'
import { InviteMemberDialog } from '@/components/members/invite-member-dialog'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/lib/auth-context'
import { PERMISSIONS } from '@/lib/rbac/permissions'
import { getRoleLabel } from '@/lib/rbac/roles'
import { mockWorkspaces } from '@/lib/mock-tenancy'
import type { Invitation } from '@/lib/rbac/types'

type Tab = 'members' | 'invitations'

export default function MembersPage() {
  const { can } = useAuth()
  const [tab, setTab] = useState<Tab>('members')
  const [inviteOpen, setInviteOpen] = useState(false)

  const members = useGatedQuery(useMembers(), { permission: PERMISSIONS.MEMBERS_READ })
  const invitations = useGatedQuery(useInvitations(), { permission: PERMISSIONS.MEMBERS_READ })

  const memberList = members.data?.data ?? []
  const invitationList = invitations.data ?? []
  const pendingCount = memberList.filter((member) => member.status === 'pending').length
  const pendingInvites = invitationList.filter((invitation) => invitation.status === 'pending').length

  return (
    <PermissionGuard permission={PERMISSIONS.MEMBERS_READ} showDenied>
      <div className="flex-1 flex flex-col overflow-hidden">
        <SettingsPageHeader
          title="Members"
          description={
            members.isSkeleton
              ? 'Loading members…'
              : `${memberList.length} members · ${pendingCount} awaiting approval`
          }
          action={
            can(PERMISSIONS.MEMBERS_INVITE) ? (
              <button
                onClick={() => setInviteOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#6C63FF] hover:bg-[#5B52CC] text-white rounded-lg font-medium text-sm transition-colors"
              >
                <UserPlus aria-hidden="true" className="w-4 h-4" />
                Invite member
              </button>
            ) : undefined
          }
        />

        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
          <div className="max-w-6xl">
            <div className="flex items-center gap-1 mb-4 border-b border-[#1E2D4A]" role="tablist">
              {(['members', 'invitations'] as Tab[]).map((value) => (
                <button
                  key={value}
                  role="tab"
                  aria-selected={tab === value}
                  onClick={() => setTab(value)}
                  className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    tab === value
                      ? 'border-[#6C63FF] text-[#E2E8F0]'
                      : 'border-transparent text-[#64748B] hover:text-[#94A3B8]'
                  }`}
                >
                  {value === 'members' ? 'Members' : `Invitations (${pendingInvites})`}
                </button>
              ))}
            </div>

            {tab === 'members' ? (
              members.state === 'error' ? (
                <ErrorState
                  title="Unable to load members"
                  description={members.errorMessage ?? undefined}
                  onRetry={members.retry}
                />
              ) : (
                <MembersTable
                  members={memberList}
                  isLoading={members.isSkeleton}
                  onInvite={() => setInviteOpen(true)}
                />
              )
            ) : invitations.state === 'error' ? (
              <ErrorState
                title="Unable to load invitations"
                description={invitations.errorMessage ?? undefined}
                onRetry={invitations.retry}
              />
            ) : (
              <InvitationList
                invitations={invitationList}
                isLoading={invitations.isSkeleton}
                onInvite={() => setInviteOpen(true)}
              />
            )}
          </div>
        </div>
      </div>
      <InviteMemberDialog open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </PermissionGuard>
  )
}

function InvitationList({
  invitations,
  isLoading,
  onInvite,
}: {
  invitations: Invitation[]
  isLoading: boolean
  onInvite: () => void
}) {
  const { can } = useAuth()
  const invitationAction = useInvitationAction()
  const toast = useToast()

  const run = async (invitationId: string, action: 'resend' | 'cancel', email: string) => {
    try {
      await invitationAction.mutateAsync({ invitationId, action })
      toast.success(
        action === 'resend' ? 'Invitation resent' : 'Invitation cancelled',
        action === 'resend' ? `A fresh link is on its way to ${email}.` : `${email} can no longer use the old link.`,
      )
    } catch (error) {
      toast.error(
        'Action failed',
        error instanceof Error ? error.message : 'Please try again.',
      )
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-[72px] rounded-xl bg-[#151D32] border border-[#1E2D4A] animate-pulse" />
        ))}
      </div>
    )
  }

  if (invitations.length === 0) {
    return (
      <div className="bg-[#151D32] border border-[#1E2D4A] rounded-xl">
        <EmptyState
          icon={Mail}
          title="No invitations sent yet"
          description="Invite teammates by email. They pick up their workspace, team and role automatically when they accept."
          actions={can(PERMISSIONS.MEMBERS_INVITE) ? [{ label: 'Invite member', onClick: onInvite }] : []}
        />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {invitations.map((invitation, index) => (
        <motion.div
          key={invitation.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(index, 8) * 0.04 }}
          className="flex flex-wrap items-center gap-4 p-4 rounded-xl bg-[#151D32] border border-[#1E2D4A] hover:border-[#6C63FF]/30 transition-colors"
        >
          <div className="w-9 h-9 rounded-lg bg-[#6C63FF]/10 flex items-center justify-center shrink-0">
            <Mail aria-hidden="true" className="w-4 h-4 text-[#6C63FF]" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[#E2E8F0] truncate">{invitation.email}</p>
            <p className="text-[11px] text-[#64748B] truncate">
              {getRoleLabel(invitation.roleId)} ·{' '}
              {mockWorkspaces.find((workspace) => workspace.id === invitation.workspaceId)?.name}
            </p>
          </div>

          <p className="hidden sm:flex items-center gap-1 text-[11px] text-[#64748B] shrink-0">
            <Clock aria-hidden="true" className="w-3 h-3" />
            {invitation.status === 'pending'
              ? `Expires ${new Date(invitation.expiresAt).toLocaleDateString()}`
              : `Sent ${relativeTime(invitation.invitedAt)}`}
          </p>

          <InvitationStatusBadge status={invitation.status} />

          {can(PERMISSIONS.MEMBERS_INVITE) && invitation.status !== 'accepted' && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => run(invitation.id, 'resend', invitation.email)}
                disabled={invitationAction.isPending}
                className="text-[11px] font-medium text-[#6C63FF] hover:text-[#8B85FF] disabled:opacity-50 transition-colors"
              >
                Resend
              </button>
              {invitation.status === 'pending' && (
                <button
                  onClick={() => run(invitation.id, 'cancel', invitation.email)}
                  disabled={invitationAction.isPending}
                  className="text-[11px] font-medium text-[#64748B] hover:text-[#EF4444] disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
          )}
        </motion.div>
      ))}
    </div>
  )
}
