'use client'

import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth-context'
import { PERMISSIONS, type Permission } from '@/lib/rbac/permissions'
import { queryKeys, queryScopes } from './keys'
import {
  auditService, dashboardService, jiraService, memberService, notificationService,
  qaService, releaseService, riskService, ruleService, sprintService, billingService,
} from '@/services'
import type { MemberQuery } from '@/services/member.service'
import type { WebhookInput } from '@/services/notification.service'
import type { JiraFieldMapping } from '@/services/jira.service'
import type { RoleId, Team } from '@/lib/rbac/types'

/**
 * Query hooks are the only thing components import — never a service directly.
 * That keeps fetching, caching and invalidation out of the render tree.
 *
 * Every hook is gated twice: it does not run without the permission, and it
 * does not run for an account whose status withholds data. A gated account
 * therefore issues no requests at all, rather than firing requests that 403.
 */
function useGate(permission: Permission) {
  const { can, isGated, isLoading, workspace } = useAuth()
  return {
    enabled: !isLoading && !isGated && can(permission),
    workspaceId: workspace?.id,
  }
}

type Options<T> = Omit<UseQueryOptions<T, Error, T>, 'queryKey' | 'queryFn' | 'enabled'>

// ─── Delivery ─────────────────────────────────────────────────────────────────

export function useDashboardSnapshot(options?: Options<Awaited<ReturnType<typeof dashboardService.getSnapshot>>>) {
  const { enabled, workspaceId } = useGate(PERMISSIONS.DASHBOARD_READ)
  return useQuery({
    queryKey: queryKeys.dashboard(workspaceId),
    queryFn: ({ signal }) => dashboardService.getSnapshot(workspaceId, signal),
    enabled,
    ...options,
  })
}

export function useSprints() {
  const { enabled, workspaceId } = useGate(PERMISSIONS.SPRINT_READ)
  return useQuery({
    queryKey: queryKeys.sprints(workspaceId),
    queryFn: ({ signal }) => sprintService.list(workspaceId, signal),
    enabled,
  })
}

export function useReleases() {
  const { enabled, workspaceId } = useGate(PERMISSIONS.RELEASE_READ)
  return useQuery({
    queryKey: queryKeys.releases(workspaceId),
    queryFn: ({ signal }) => releaseService.list(workspaceId, signal),
    enabled,
  })
}

export function useQaQueue() {
  const { enabled, workspaceId } = useGate(PERMISSIONS.QA_READ)
  return useQuery({
    queryKey: queryKeys.qaQueue(workspaceId),
    queryFn: ({ signal }) => qaService.listQueue(workspaceId, signal),
    enabled,
  })
}

export function useQaTesters() {
  const { enabled, workspaceId } = useGate(PERMISSIONS.QA_READ)
  return useQuery({
    queryKey: [...queryKeys.qaTesters(workspaceId)],
    queryFn: ({ signal }) => qaService.listTesters(workspaceId, signal),
    enabled,
  })
}

export function useRiskTimeline(range?: { from?: string; to?: string }) {
  const { enabled, workspaceId } = useGate(PERMISSIONS.RISK_READ)
  return useQuery({
    queryKey: queryKeys.riskTimeline(workspaceId, range),
    queryFn: ({ signal }) => riskService.listTimeline({ ...range, workspaceId }, signal),
    enabled,
  })
}

export function useSignals() {
  const { enabled, workspaceId } = useGate(PERMISSIONS.RISK_READ)
  return useQuery({
    queryKey: queryKeys.signals(workspaceId),
    queryFn: ({ signal }) => riskService.listSignals(workspaceId, signal),
    enabled,
  })
}

export function useRules() {
  const { enabled, workspaceId } = useGate(PERMISSIONS.RULES_READ)
  return useQuery({
    queryKey: queryKeys.rules(workspaceId),
    queryFn: ({ signal }) => ruleService.list(workspaceId, signal),
    enabled,
  })
}

export function useToggleRule() {
  const queryClient = useQueryClient()
  const { workspace } = useAuth()
  const workspaceId = workspace?.id

  return useMutation({
    mutationFn: ({ ruleId, enabled }: { ruleId: string; enabled: boolean }) =>
      ruleService.toggle(ruleId, enabled, workspaceId),
    // Optimistic: a rule toggle must feel instant, and rolls back on failure.
    onMutate: async ({ ruleId, enabled }) => {
      const key = queryKeys.rules(workspaceId)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData(key)
      queryClient.setQueryData(key, (current: { id: string; enabled: boolean }[] | undefined) =>
        current?.map((rule) => (rule.id === ruleId ? { ...rule, enabled } : rule)),
      )
      return { previous, key }
    },
    onError: (_error, _variables, context) => {
      if (context) queryClient.setQueryData(context.key, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.rules(workspaceId) }),
  })
}

// ─── Jira ─────────────────────────────────────────────────────────────────────

export function useJiraConnection() {
  const { enabled, workspaceId } = useGate(PERMISSIONS.INTEGRATION_READ)
  return useQuery({
    queryKey: queryKeys.jiraConnection(workspaceId),
    queryFn: ({ signal }) => jiraService.getConnection(workspaceId, signal),
    enabled,
  })
}

export function useJiraSyncStatus() {
  const { enabled, workspaceId } = useGate(PERMISSIONS.INTEGRATION_READ)
  return useQuery({
    queryKey: queryKeys.jiraSync(workspaceId),
    queryFn: ({ signal }) => jiraService.getSyncStatus(workspaceId, signal),
    enabled,
    // A running sync is the one thing worth polling.
    refetchInterval: (query) => (query.state.data?.state === 'syncing' ? 5_000 : false),
  })
}

export function useJiraProjects() {
  const { enabled, workspaceId } = useGate(PERMISSIONS.INTEGRATION_READ)
  return useQuery({
    queryKey: queryKeys.jiraProjects(workspaceId),
    queryFn: ({ signal }) => jiraService.listProjects(workspaceId, signal),
    enabled,
    staleTime: 10 * 60_000, // Project lists barely change.
  })
}

export function useJiraFieldMapping() {
  const { enabled, workspaceId } = useGate(PERMISSIONS.INTEGRATION_READ)
  return useQuery({
    queryKey: queryKeys.jiraFields(workspaceId),
    queryFn: ({ signal }) => jiraService.getFieldMapping(workspaceId, signal),
    enabled,
  })
}

export function useConnectJira() {
  const queryClient = useQueryClient()
  const { workspace } = useAuth()
  return useMutation({
    mutationFn: () => jiraService.connect(workspace?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryScopes.allJira })
      queryClient.invalidateQueries({ queryKey: queryScopes.allAudit })
    },
  })
}

export function useDisconnectJira() {
  const queryClient = useQueryClient()
  const { workspace } = useAuth()
  return useMutation({
    mutationFn: () => jiraService.disconnect(workspace?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryScopes.allJira })
      queryClient.invalidateQueries({ queryKey: queryScopes.allAudit })
    },
  })
}

export function useTriggerJiraSync() {
  const queryClient = useQueryClient()
  const { workspace } = useAuth()
  return useMutation({
    mutationFn: () => jiraService.triggerSync(workspace?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryScopes.allJira })
      queryClient.invalidateQueries({ queryKey: queryScopes.allNotifications })
    },
  })
}

export function useSaveJiraFieldMapping() {
  const queryClient = useQueryClient()
  const { workspace } = useAuth()
  return useMutation({
    mutationFn: (mapping: JiraFieldMapping) => jiraService.saveFieldMapping(mapping, workspace?.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryScopes.allJira }),
  })
}

// ─── People ───────────────────────────────────────────────────────────────────

export function useMembers(params: MemberQuery = {}) {
  const { enabled } = useGate(PERMISSIONS.MEMBERS_READ)
  return useQuery({
    queryKey: queryKeys.members(params),
    queryFn: ({ signal }) => memberService.list(params, signal),
    enabled,
    // Keeps the previous page visible while the next one loads.
    placeholderData: (previous) => previous,
  })
}

export function useInvitations() {
  const { enabled } = useGate(PERMISSIONS.MEMBERS_READ)
  return useQuery({
    queryKey: queryKeys.invitations(),
    queryFn: ({ signal }) => memberService.listInvitations(signal),
    enabled,
  })
}

export function useWorkspaces() {
  const { isLoading, isGated } = useAuth()
  return useQuery({
    queryKey: queryKeys.workspaces(),
    queryFn: ({ signal }) => memberService.listWorkspaces(signal),
    enabled: !isLoading && !isGated,
    staleTime: 5 * 60_000,
  })
}

export function useTeams() {
  const { enabled, workspaceId } = useGate(PERMISSIONS.TEAMS_READ)
  return useQuery({
    queryKey: queryKeys.teams(workspaceId),
    queryFn: ({ signal }) => memberService.listTeams(undefined, signal),
    enabled,
  })
}

type MemberAction = 'approve' | 'reject' | 'suspend' | 'activate' | 'remove'

export function useMemberAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ memberId, action }: { memberId: string; action: MemberAction }): Promise<void> => {
      await memberService.act(memberId, action)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryScopes.allMembers })
      queryClient.invalidateQueries({ queryKey: queryScopes.allAudit })
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications() })
    },
  })
}

export function useBulkMemberAction() {
  const queryClient = useQueryClient()
  return useMutation({
    // No bulk endpoint: each action is audited individually, and a partial
    // failure must leave the successful ones applied.
    mutationFn: async ({ ids, action }: { ids: string[]; action: 'approve' | 'reject' | 'suspend' | 'activate' }) => {
      const results = await Promise.allSettled(ids.map((id) => memberService.act(id, action)))
      return { updated: results.filter((item) => item.status === 'fulfilled').length }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryScopes.allMembers })
      queryClient.invalidateQueries({ queryKey: queryScopes.allAudit })
    },
  })
}

export function useInviteMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { email: string; roleId: RoleId; workspaceId: string; teamId?: string }) =>
      memberService.invite(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryScopes.allInvitations })
      queryClient.invalidateQueries({ queryKey: queryScopes.allAudit })
    },
  })
}

export function useInvitationAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ invitationId, action }: { invitationId: string; action: 'resend' | 'cancel' }) =>
      memberService.invitationAction(invitationId, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryScopes.allInvitations })
      queryClient.invalidateQueries({ queryKey: queryScopes.allAudit })
    },
  })
}

export function useCreateTeam() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      name: string; workspaceId: string; description?: string
      releaseManagerId?: string; qaLeadId?: string
    }) => memberService.createTeam(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryScopes.allTeams })
      queryClient.invalidateQueries({ queryKey: queryScopes.allAudit })
    },
  })
}

export function useUpdateTeam() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ teamId, patch }: { teamId: string; patch: Partial<Team> }) =>
      memberService.updateTeam(teamId, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryScopes.allTeams })
      queryClient.invalidateQueries({ queryKey: queryScopes.allAudit })
    },
  })
}

export function useDeleteTeam() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (teamId: string) => memberService.deleteTeam(teamId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryScopes.allTeams })
      queryClient.invalidateQueries({ queryKey: queryScopes.allMembers })
      queryClient.invalidateQueries({ queryKey: queryScopes.allAudit })
    },
  })
}

export function useSetTeamMembers() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ teamId, memberIds }: { teamId: string; memberIds: string[] }) =>
      memberService.setTeamMembers(teamId, memberIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryScopes.allTeams })
      queryClient.invalidateQueries({ queryKey: queryScopes.allMembers })
      queryClient.invalidateQueries({ queryKey: queryScopes.allAudit })
    },
  })
}

// ─── Notifications & audit ────────────────────────────────────────────────────

export function useNotifications() {
  const { enabled } = useGate(PERMISSIONS.NOTIFICATIONS_READ)
  return useQuery({
    queryKey: queryKeys.notifications(),
    queryFn: ({ signal }) => notificationService.list(signal),
    enabled,
  })
}

/** Optimistic: the unread badge is derived state, so a round trip reads as broken. */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (notificationId: string) => notificationService.markRead(notificationId),
    onMutate: async (notificationId) => {
      const key = queryKeys.notifications()
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData(key)
      queryClient.setQueryData(key, (current: { id: string; read: boolean }[] | undefined) =>
        current?.map((item) => (item.id === notificationId ? { ...item, read: true } : item)),
      )
      return { previous, key }
    },
    onError: (_error, _variables, context) => {
      if (context) queryClient.setQueryData(context.key, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications() }),
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => notificationService.markAllRead(),
    onMutate: async () => {
      const key = queryKeys.notifications()
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData(key)
      queryClient.setQueryData(key, (current: { read: boolean }[] | undefined) =>
        current?.map((item) => ({ ...item, read: true })),
      )
      return { previous, key }
    },
    onError: (_error, _variables, context) => {
      if (context) queryClient.setQueryData(context.key, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications() }),
  })
}

export function useWebhooks() {
  const { enabled, workspaceId } = useGate(PERMISSIONS.NOTIFICATIONS_READ)
  return useQuery({
    queryKey: queryKeys.webhooks(workspaceId),
    queryFn: ({ signal }) => notificationService.listWebhooks(workspaceId, signal),
    enabled,
  })
}

export function useSaveWebhook() {
  const queryClient = useQueryClient()
  const { workspace } = useAuth()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: Partial<WebhookInput> }) =>
      id
        ? notificationService.updateWebhook(id, input, workspace?.id)
        : notificationService.createWebhook(input as WebhookInput, workspace?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryScopes.allWebhooks })
      queryClient.invalidateQueries({ queryKey: queryScopes.allAudit })
    },
  })
}

export function useDeleteWebhook() {
  const queryClient = useQueryClient()
  const { workspace } = useAuth()
  return useMutation({
    mutationFn: (webhookId: string) => notificationService.deleteWebhook(webhookId, workspace?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryScopes.allWebhooks })
      queryClient.invalidateQueries({ queryKey: queryScopes.allAudit })
    },
  })
}

/** Posts a real message, so wiring is proven before an incident tests it. */
export function useTestWebhook() {
  const queryClient = useQueryClient()
  const { workspace } = useAuth()
  return useMutation({
    mutationFn: (webhookId: string) => notificationService.testWebhook(webhookId, workspace?.id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryScopes.allWebhooks }),
  })
}

export function useBilling() {
  const { enabled, workspaceId } = useGate(PERMISSIONS.BILLING_READ)
  return useQuery({
    queryKey: ['billing', workspaceId],
    queryFn: ({ signal }) => billingService.get(workspaceId, signal),
    enabled,
  })
}

export function useAuditLog(params: Parameters<typeof auditService.list>[0] = {}) {
  const { enabled } = useGate(PERMISSIONS.AUDIT_READ)
  return useQuery({
    queryKey: queryKeys.audit(params),
    queryFn: ({ signal }) => auditService.list(params, signal),
    enabled,
    placeholderData: (previous) => previous,
  })
}
