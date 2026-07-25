'use client'

import { create } from 'zustand'

/**
 * UI state only.
 *
 * Server data lives in the TanStack Query cache — keeping a second copy here
 * meant two sources of truth that could disagree, and a poll that re-rendered
 * every subscriber whether or not anything changed.
 */
interface DashboardState {
  commandPaletteOpen: boolean
  /** Mobile drawer visibility; desktop uses the persisted collapse state. */
  mobileNavOpen: boolean
  setCommandPaletteOpen: (open: boolean) => void
  setMobileNavOpen: (open: boolean) => void
}

export const useDashboardStore = create<DashboardState>((set) => ({
  commandPaletteOpen: false,
  mobileNavOpen: false,
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
}))
