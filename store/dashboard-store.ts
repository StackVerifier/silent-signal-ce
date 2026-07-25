'use client'

import { create } from 'zustand'
import { dashboardMetrics, serviceHealth, liveSignals } from '@/lib/mock-data'
import type { DashboardMetrics, ServiceHealth, LiveSignal } from '@/lib/types'

interface DashboardState {
  metrics: DashboardMetrics
  serviceHealth: ServiceHealth[]
  liveSignals: LiveSignal[]
  isPolling: boolean
  lastHash: string
  commandPaletteOpen: boolean
  /** Mobile drawer visibility — desktop uses the persisted collapse state. */
  mobileNavOpen: boolean
  setCommandPaletteOpen: (open: boolean) => void
  setMobileNavOpen: (open: boolean) => void
  simulateUpdate: () => void
}

// Simple fingerprint hash
function hashMetrics(m: DashboardMetrics) {
  return `${m.releaseHealth}-${m.sprintHealth}-${m.blockedIssues}-${m.openRisks}`
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  metrics: dashboardMetrics,
  serviceHealth,
  liveSignals,
  isPolling: true,
  lastHash: hashMetrics(dashboardMetrics),
  commandPaletteOpen: false,
  mobileNavOpen: false,

  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),

  // BLE-style: only update if hash changed
  simulateUpdate: () => {
    const state = get()
    // Simulate slight metric drift for live feel
    const newMetrics: DashboardMetrics = {
      ...state.metrics,
      lastSyncAt: new Date(),
    }
    set({ metrics: newMetrics, lastHash: hashMetrics(newMetrics) })
  },
}))
