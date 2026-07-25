import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/services/http'

/**
 * Query defaults tuned for a monitoring product: data is refetched when the
 * operator returns to the tab, but not on every mount, and never retried when
 * the server has already said "no".
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Delivery signals move on the order of minutes, not seconds.
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        refetchOnMount: false,
        retry: (failureCount, error) => {
          // 401/403/404 are terminal — retrying is noise and can mask an auth bug.
          if (error instanceof ApiError && !error.isRetryable) return false
          return failureCount < 2
        },
        retryDelay: (attempt, error) =>
          error instanceof ApiError && error.retryAfterMs
            ? error.retryAfterMs
            : Math.min(1000 * 2 ** attempt, 15_000),
      },
      mutations: {
        retry: false,
      },
    },
  })
}
