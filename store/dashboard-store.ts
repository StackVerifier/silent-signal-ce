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
  selectedNav: string
  commandPaletteOpen: boolean
  setSelectedNav: (nav: string) => void
  setCommandPaletteOpen: (open: boolean) => void
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
  selectedNav: 'dashboard',
  commandPaletteOpen: false,

  setSelectedNav: (nav) => set({ selectedNav: nav }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

  // BLE-style: only update if hash changed
  simulateUpdate: () => {
    const state = get()
    // Simulate slight metric drift for live feel
    const newMetrics: DashboardMetrics = {
      ...state.metrics,
      lastSyncAt: new Date(),
    }
    const newHash = hashMetrics(newMetrics)
    if (newHash !== state.lastHash) {
      set({ metrics: newMetrics, lastHash: newHash })
    } else {
      // Just update timestamp silently
      set({ metrics: newMetrics })
    }
  },
}))
