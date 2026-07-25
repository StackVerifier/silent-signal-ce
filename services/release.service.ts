import { releases } from '@/lib/mock-data'
import type { Release } from '@/lib/types'
import { resolve, resolveMutation } from './transport'

export const releaseService = {
  list: (workspaceId?: string, signal?: AbortSignal) =>
    resolve<Release[]>({ path: '/api/releases', workspaceId, signal, mock: () => releases }),

  get: (releaseId: string, workspaceId?: string, signal?: AbortSignal) =>
    resolve<Release | undefined>({
      path: `/api/releases/${releaseId}`,
      workspaceId,
      signal,
      mock: () => releases.find((release) => release.id === releaseId),
    }),

  /** Requires `release.approve`; re-checked server-side. */
  approve: (releaseId: string, workspaceId?: string) =>
    resolveMutation<{ ok: true }>({
      path: `/api/releases/${releaseId}/approve`,
      workspaceId,
      mock: () => ({ ok: true }),
    }),
}
