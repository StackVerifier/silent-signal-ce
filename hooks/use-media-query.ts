'use client'

import { useEffect, useState } from 'react'

/**
 * SSR-safe media query. Starts at `defaultValue` so the server render is
 * deterministic, then syncs on mount — layout must not depend on this before
 * hydration, only behaviour.
 */
export function useMediaQuery(query: string, defaultValue = false): boolean {
  const [matches, setMatches] = useState(defaultValue)

  useEffect(() => {
    const list = window.matchMedia(query)
    setMatches(list.matches)
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches)
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/** Tailwind `lg` breakpoint — the point where the sidebar stops being a drawer. */
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)', true)
