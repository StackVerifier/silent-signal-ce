'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, LayoutDashboard, Zap, GitBranch, FlaskConical, Clock, Shield, ArrowRight } from 'lucide-react'
import { useDashboardStore } from '@/store/dashboard-store'
import { useRouter } from 'next/navigation'

const commands = [
  { id: 'dashboard',     label: 'Dashboard',          icon: LayoutDashboard, href: '/',              shortcut: '1' },
  { id: 'sprint',        label: 'Sprint Intelligence', icon: Zap,             href: '/sprint',        shortcut: '2' },
  { id: 'release',       label: 'Release Control',     icon: GitBranch,       href: '/release',       shortcut: '3' },
  { id: 'qa-queue',      label: 'QA Queue',            icon: FlaskConical,    href: '/qa-queue',      shortcut: '4' },
  { id: 'risk-timeline', label: 'Risk Timeline',       icon: Clock,           href: '/risk-timeline', shortcut: '5' },
  { id: 'rules',         label: 'Rule Management',     icon: Shield,          href: '/rules',         shortcut: '6' },
]

export function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen } = useDashboardStore()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const router = useRouter()

  const filtered = commands.filter(c =>
    c.label.toLowerCase().includes(query.toLowerCase())
  )

  const navigate = useCallback((href: string) => {
    router.push(href)
    setCommandPaletteOpen(false)
    setQuery('')
    setSelected(0)
  }, [router, setCommandPaletteOpen])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(!commandPaletteOpen)
      }
      if (e.key === 'Escape') setCommandPaletteOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [commandPaletteOpen, setCommandPaletteOpen])

  useEffect(() => {
    if (!commandPaletteOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelected(s => Math.min(s + 1, filtered.length - 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelected(s => Math.max(s - 1, 0))
      }
      if (e.key === 'Enter' && filtered[selected]) {
        navigate(filtered[selected].href)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [commandPaletteOpen, filtered, selected, navigate])

  return (
    <AnimatePresence>
      {commandPaletteOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={() => setCommandPaletteOpen(false)}
          />
          <div className="fixed inset-0 flex items-start justify-center pt-[15vh] z-50 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -16 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-lg mx-4 bg-[#111827] border border-[#1E2D4A] rounded-2xl shadow-2xl overflow-hidden pointer-events-auto"
            >
              {/* Input */}
              <div className="flex items-center gap-3 px-4 py-4 border-b border-[#1E2D4A]">
                <Search className="w-4 h-4 text-[#64748B] flex-shrink-0" />
                <input
                  autoFocus
                  value={query}
                  onChange={e => { setQuery(e.target.value); setSelected(0) }}
                  placeholder="Search pages, actions..."
                  className="flex-1 bg-transparent text-sm text-[#E2E8F0] placeholder-[#64748B] outline-none"
                />
                <kbd className="text-[10px] text-[#64748B] bg-[#1E2D4A] px-2 py-1 rounded font-mono">ESC</kbd>
              </div>

              {/* Results */}
              <div className="py-2 max-h-80 overflow-y-auto">
                {filtered.length > 0 ? (
                  <>
                    <p className="px-4 py-2 text-[10px] font-semibold text-[#64748B] uppercase tracking-widest">Pages</p>
                    {filtered.map((cmd, i) => (
                      <button
                        key={cmd.id}
                        onMouseEnter={() => setSelected(i)}
                        onClick={() => navigate(cmd.href)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left ${
                          selected === i ? 'bg-[#6C63FF]/15 text-[#E2E8F0]' : 'text-[#94A3B8] hover:bg-[#151D32]'
                        }`}
                      >
                        <cmd.icon className={`w-4 h-4 flex-shrink-0 ${selected === i ? 'text-[#6C63FF]' : 'text-[#64748B]'}`} />
                        <span className="flex-1 text-sm">{cmd.label}</span>
                        <div className="flex items-center gap-1">
                          <kbd className="text-[10px] text-[#64748B] bg-[#1E2D4A] px-1.5 py-0.5 rounded font-mono">{cmd.shortcut}</kbd>
                          {selected === i && <ArrowRight className="w-3 h-3 text-[#6C63FF]" />}
                        </div>
                      </button>
                    ))}
                  </>
                ) : (
                  <p className="px-4 py-8 text-center text-sm text-[#64748B]">No results for &quot;{query}&quot;</p>
                )}
              </div>

              <div className="px-4 py-3 border-t border-[#1E2D4A] flex items-center gap-4 text-[10px] text-[#64748B]">
                <span className="flex items-center gap-1"><kbd className="bg-[#1E2D4A] px-1 py-0.5 rounded">↑↓</kbd> navigate</span>
                <span className="flex items-center gap-1"><kbd className="bg-[#1E2D4A] px-1 py-0.5 rounded">↵</kbd> open</span>
                <span className="flex items-center gap-1"><kbd className="bg-[#1E2D4A] px-1 py-0.5 rounded">esc</kbd> close</span>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
