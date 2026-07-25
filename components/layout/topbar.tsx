'use client'

import { Bell, RefreshCw, Wifi } from 'lucide-react'
import { useDashboardStore } from '@/store/dashboard-store'
import { useAuth } from '@/lib/auth-context'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

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

export function Topbar({ title }: { title: string }) {
  const metrics = useDashboardStore((state) => state.metrics)
  const liveSignals = useDashboardStore((state) => state.liveSignals)
  const simulateUpdate = useDashboardStore((state) => state.simulateUpdate)
  const { isGated } = useAuth()
  const syncLabel = useRelativeTime(metrics.lastSyncAt)
  const [syncing, setSyncing] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const criticalSignals = isGated
    ? []
    : liveSignals.filter(s => s.severity === 'critical' || s.severity === 'high')

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
    <header className="h-14 flex items-center justify-between px-6 border-b border-[#1E2D4A] bg-[#070B18]/80 backdrop-blur-sm flex-shrink-0 sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold text-[#E2E8F0]">{title}</h1>
        <div className="flex items-center gap-1.5">
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
          className="flex items-center gap-1.5 text-xs text-[#64748B] hover:text-[#94A3B8] transition-colors px-2 py-1.5 rounded-lg hover:bg-[#151D32]"
          aria-label="Sync data"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Sync</span>
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative flex items-center justify-center w-8 h-8 rounded-lg hover:bg-[#151D32] text-[#64748B] hover:text-[#94A3B8] transition-all"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {criticalSignals.length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-[#EF4444] rounded-full border border-[#070B18]" />
            )}
          </button>

          <AnimatePresence>
            {notifOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-10 w-80 bg-[#111827] border border-[#1E2D4A] rounded-xl shadow-2xl overflow-hidden z-50"
              >
                <div className="px-4 py-3 border-b border-[#1E2D4A] flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#E2E8F0]">Active Signals</span>
                  <span className="text-xs text-[#64748B]">{criticalSignals.length} alerts</span>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {criticalSignals.slice(0, 5).map(s => (
                    <div key={s.id} className="px-4 py-3 border-b border-[#1E2D4A]/50 hover:bg-[#151D32] transition-colors">
                      <div className="flex items-start gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${s.severity === 'critical' ? 'bg-[#EF4444]' : 'bg-[#F59E0B]'}`} />
                        <div>
                          <p className="text-xs font-medium text-[#E2E8F0]">{s.issueKey}</p>
                          <p className="text-xs text-[#64748B] mt-0.5 leading-relaxed">{s.message}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-3 text-center">
                  <button className="text-xs text-[#6C63FF] hover:text-[#8B85FF] transition-colors">
                    View all signals
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </header>
  )
}
