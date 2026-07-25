'use client'

import { useCallback, useSyncExternalStore } from 'react'

/**
 * SSR-safe media query. The server snapshot is `defaultValue` so the markup is
 * deterministic; the client reads the real value during render rather than
 * syncing it in afterwards. Layout must not depend on this before hydration,
 * only behaviour.
 */
export function useMediaQuery(query: string, defaultValue = false): boolean {
  const subscribe = useCallback(
    (listener: () => void) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', listener)
      return () => list.removeEventListener('change', listener)
    },
    [query],
  )

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => defaultValue,
  )
}

/** Tailwind `lg` breakpoint — the point where the sidebar stops being a drawer. */
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)', true)
