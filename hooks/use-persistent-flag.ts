'use client'

import { useCallback, useSyncExternalStore } from 'react'

/**
 * A boolean preference kept in `localStorage`.
 *
 * Reading it in an effect and calling `setState` would work, but it costs a
 * second render on every mount and trips the compiler's cascading-render rule.
 * `useSyncExternalStore` is the primitive for exactly this: the server snapshot
 * keeps SSR deterministic, and the client snapshot is read during render.
 */

const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  // `storage` only fires in *other* tabs, so same-tab writes notify explicitly.
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

type Setter = (next: boolean | ((current: boolean) => boolean)) => void

export function usePersistentFlag(
  key: string,
  /** What the server renders, before any browser storage exists. */
  serverValue = false,
): [boolean, Setter] {
  const value = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(key) === '1',
    () => serverValue,
  )

  const set = useCallback<Setter>(
    (next) => {
      const current = localStorage.getItem(key) === '1'
      const resolved = typeof next === 'function' ? next(current) : next
      localStorage.setItem(key, resolved ? '1' : '0')
      listeners.forEach((listener) => listener())
    },
    [key],
  )

  return [value, set]
}
