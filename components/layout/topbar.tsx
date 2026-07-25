'use client'

import { RefreshCw, Wifi, Menu } from 'lucide-react'
import { useDashboardStore } from '@/store/dashboard-store'
import { useAuth } from '@/lib/auth-context'
import { useEffect, useState } from 'react'
import { Breadcrumb } from './breadcrumb'
import { NotificationCenter } from '@/components/notifications/notification-center'

function useRelativeTime(date: Date) {
  const [label, setLabel] = useState('')
  useEffect(() => {
    const update = () => {
      const diff = Math.floor((Date.now() - date.getTime()) / 1000)
      if (diff < 5)   setLabel('just now')
      else if (diff < 60)  setLabel(`${diff}s ago`)
      else if (diff < 3600) setLabel(`${Math.floor(diff / 60)}m ago`)
      else             setLabel(`${Math.floor(diff / 3600)}h ago`)
    }
    update()
    const t = setInterval(update, 5000)
    return () => clearInterval(t)
  }, [date])
  return label
}

export function Topbar({ title, trailing }: { title: string; trailing?: string }) {
  const metrics = useDashboardStore((state) => state.metrics)
  const simulateUpdate = useDashboardStore((state) => state.simulateUpdate)
  const { isGated } = useAuth()
  const syncLabel = useRelativeTime(metrics.lastSyncAt)
  const [syncing, setSyncing] = useState(false)
  const setMobileNavOpen = useDashboardStore((state) => state.setMobileNavOpen)

  const handleSync = () => {
    setSyncing(true)
    setTimeout(() => {
      simulateUpdate()
      setSyncing(false)
    }, 800)
  }

  // BLE-style: poll every 30s
  useEffect(() => {
    const interval = setInterval(simulateUpdate, 30000)
    return () => clearInterval(interval)
  }, [simulateUpdate])


  return (
    <header className="h-14 flex items-center justify-between gap-3 px-4 sm:px-6 border-b border-[#1E2D4A] bg-[#070B18]/80 backdrop-blur-sm flex-shrink-0 sticky top-0 z-10">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open navigation"
          aria-controls="app-sidebar"
          className="lg:hidden -ml-1 flex items-center justify-center w-11 h-11 rounded-lg text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#151D32] transition-colors"
        >
          <Menu aria-hidden="true" className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <h1 className="text-sm font-semibold text-[#E2E8F0] truncate">{title}</h1>
          <Breadcrumb trailing={trailing} />
        </div>

        <div className="hidden sm:flex items-center gap-1.5 shrink-0">
          {isGated ? (
            <span className="inline-flex items-center gap-1 text-[10px] text-[#F59E0B] bg-[#F59E0B]/10 border border-[#F59E0B]/20 px-2 py-0.5 rounded-full">
              Locked
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] text-[#22C55E] bg-[#22C55E]/10 border border-[#22C55E]/20 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] pulse-dot inline-block" />
              Live
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Sync info */}
        <div className="hidden sm:flex items-center gap-2 text-xs text-[#64748B]">
          <Wifi className="w-3.5 h-3.5" />
          <span>Synced {syncLabel}</span>
        </div>

        {/* Manual sync */}
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center justify-center gap-1.5 text-xs text-[#64748B] hover:text-[#94A3B8] transition-colors min-h-11 sm:min-h-0 px-2.5 sm:py-1.5 rounded-lg hover:bg-[#151D32]"
          aria-label="Sync data"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Sync</span>
        </button>

        <NotificationCenter />

      </div>
    </header>
  )
}
