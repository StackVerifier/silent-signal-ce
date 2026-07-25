import { request } from './http'
import type { AccessContext, Workspace } from '@/lib/rbac/types'

export interface SessionPayload {
  access: AccessContext
  workspaces: Workspace[]
}

/**
 * The session is owned by the server: the cookie is httpOnly, so the browser
 * asks for its own identity rather than decoding it locally.
 */
export const sessionService = {
  current: (signal?: AbortSignal) =>
    request<SessionPayload | undefined>('/api/session', { signal, retries: 0 }),

  login: (email: string, password: string) =>
    request<SessionPayload>('/api/session', { method: 'POST', body: { email, password } }),

  switchWorkspace: (workspaceId: string) =>
    request<SessionPayload>('/api/session', { method: 'PATCH', body: { workspaceId } }),

  logout: () => request<void>('/api/session', { method: 'DELETE' }),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: true }>('/api/session/password', {
      method: 'POST',
      body: { currentPassword, newPassword },
    }),
}
