'use client'

import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth-context'
import { PERMISSIONS, type Permission } from '@/lib/rbac/permissions'
import { queryKeys, queryScopes } from './keys'
import {
  auditService, dashboardService, jiraService, memberService, notificationService,
  qaService, releaseService, riskService, ruleService, sprintService,
} from '@/services'
import type { MemberQuery } from '@/services/member.service'
import type { ChannelRoute } from '@/services/notification.service'
import type { JiraFieldMapping } from '@/services/jira.service'

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

export function useRiskTimeline(range?: { from?: string; to?: string }) {
  const { enabled, workspaceId } = useGate(PERMISSIONS.RISK_READ)
  return useQuery({
    queryKey: queryKeys.riskTimeline(workspaceId, range),
    queryFn: ({ signal }) => riskService.listTimeline({ ...range, workspaceId }, signal),
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

export function useJiraBoards(projectKey?: string) {
  const { enabled, workspaceId } = useGate(PERMISSIONS.INTEGRATION_READ)
  return useQuery({
    queryKey: queryKeys.jiraBoards(workspaceId, projectKey),
    queryFn: ({ signal }) => jiraService.listBoards(projectKey, workspaceId, signal),
    enabled,
    staleTime: 10 * 60_000,
  })
}

export function useTriggerJiraSync() {
  const queryClient = useQueryClient()
  const { workspace } = useAuth()
  return useMutation({
    mutationFn: () => jiraService.triggerSync(workspace?.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryScopes.allJira }),
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
      switch (action) {
        case 'approve': await memberService.approve(memberId); return
        case 'reject': await memberService.reject(memberId); return
        case 'suspend': await memberService.suspend(memberId); return
        case 'activate': await memberService.activate(memberId); return
        case 'remove': await memberService.remove(memberId); return
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryScopes.allMembers }),
  })
}

export function useBulkMemberAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ ids, action }: { ids: string[]; action: 'approve' | 'reject' | 'suspend' | 'activate' }) =>
      memberService.bulk(ids, action),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryScopes.allMembers }),
  })
}

export function useInvitationAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ invitationId, action }: { invitationId: string; action: 'resend' | 'cancel' }) =>
      action === 'resend'
        ? memberService.resendInvitation(invitationId)
        : memberService.cancelInvitation(invitationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryScopes.allInvitations }),
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

export function useNotificationRoutes() {
  const { enabled, workspaceId } = useGate(PERMISSIONS.NOTIFICATIONS_READ)
  return useQuery({
    queryKey: queryKeys.notificationRoutes(workspaceId),
    queryFn: ({ signal }) => notificationService.listRoutes(workspaceId, signal),
    enabled,
  })
}

/** Optimistic: marking read must feel instant, and the badge is derived state. */
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

export function useSaveNotificationRoute() {
  const queryClient = useQueryClient()
  const { workspace } = useAuth()
  return useMutation({
    mutationFn: (route: ChannelRoute) => notificationService.saveRoute(route, workspace?.id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.notificationRoutes(workspace?.id) }),
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
