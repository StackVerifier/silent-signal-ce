'use client'

import { useEffect, useState } from 'react'

/**
 * The current time as reactive state.
 *
 * Calling `Date.now()` during render is impure: the value differs between the
 * server and client render, and — worse for a product full of "4 days left"
 * labels — it never updates afterwards. Holding it in state fixes both: the
 * render is pure with respect to its inputs, and the label actually ticks.
 *
 * The default cadence is a minute, which is the resolution every caller here
 * displays at.
 */
export function useNow(intervalMs = 60_000): number {
  // Initialised lazily so every consumer starts from the same first paint.
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])

  return now
}
