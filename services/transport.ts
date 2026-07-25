import { isMockMode } from '@/lib/env'
import { ApiError, request, type RequestOptions } from './http'

/**
 * The single seam between mock fixtures and the real API.
 *
 * Every service call goes through `resolve()`, which either returns the
 * in-memory fixture (NEXT_PUBLIC_API_MODE=mock, today) or issues the HTTP
 * request. Components never learn which happened, so switching to Jira-backed
 * data is an environment change, not a refactor.
 */

/** Simulated latency, so loading states are exercised in mock mode. */
const MOCK_LATENCY_MS = { min: 180, max: 520 }

function mockLatency(): number {
  const { min, max } = MOCK_LATENCY_MS
  return min + Math.random() * (max - min)
}

export interface ResolveOptions<T> extends RequestOptions {
  /** Fixture used while running in mock mode. */
  mock: () => T
  /** Path used once the API is live. */
  path: string
}

export async function resolve<T>(options: ResolveOptions<T>): Promise<T> {
  const { mock, path, ...requestOptions } = options

  if (!isMockMode) {
    return request<T>(path, requestOptions)
  }

  await new Promise((done) => setTimeout(done, mockLatency()))

  if (requestOptions.signal?.aborted) {
    throw new ApiError({ status: 0, code: 'aborted', message: 'Request aborted' })
  }

  // Structured clone keeps callers from mutating the shared fixtures — the same
  // isolation a real network boundary would give.
  return structuredClone(mock())
}

/**
 * Mutations in mock mode are acknowledged but not persisted. Kept explicit so a
 * component never mistakes a no-op for a successful write.
 */
export async function resolveMutation<T>(options: ResolveOptions<T>): Promise<T> {
  if (isMockMode) {
    await new Promise((done) => setTimeout(done, mockLatency()))
    return structuredClone(options.mock())
  }
  const { mock: _mock, path, ...requestOptions } = options
  return request<T>(path, { method: 'POST', ...requestOptions })
}
