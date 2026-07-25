'use client'

import { useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/lib/auth-context'
import { createQueryClient } from '@/lib/query/client'

/**
 * Single composition point for app-wide providers.
 *
 * The QueryClient is created in state rather than at module scope so each SSR
 * request gets its own cache — a module-level client would leak one tenant's
 * data into another's render.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(createQueryClient)

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  )
}
