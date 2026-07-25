'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useDashboardStore } from '@/store/dashboard-store'
import { useAuth } from '@/lib/auth-context'
import { ACCOUNT_NAV_ITEMS, visibleNavItems } from '@/lib/rbac/navigation'

const FOCUSABLE = 'input, button, [href], [tabindex]:not([tabindex="-1"])'

export function CommandPalette() {
  const commandPaletteOpen = useDashboardStore((state) => state.commandPaletteOpen)
  const setCommandPaletteOpen = useDashboardStore((state) => state.setCommandPaletteOpen)
  const { permissions, member } = useAuth()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const router = useRouter()
  const dialogRef = useRef<HTMLDivElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)

  // Only offer destinations this member can actually open.
  const commands = useMemo(() => {
    const status = member?.status ?? 'pending'
    return [
      ...visibleNavItems(permissions, status),
      ...visibleNavItems(permissions, 'approved', ACCOUNT_NAV_ITEMS),
    ]
  }, [permissions, member?.status])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return commands
    return commands.filter(
      (command) =>
        command.label.toLowerCase().includes(term) ||
        command.keywords?.some((keyword) => keyword.includes(term)),
    )
  }, [commands, query])

  const navigate = useCallback(
    (href: string) => {
      router.push(href)
      setCommandPaletteOpen(false)
      setQuery('')
      setSelected(0)
    },
    [router, setCommandPaletteOpen],
  )

  // Remember the trigger so focus can be restored on close (a11y requirement).
  useEffect(() => {
    if (commandPaletteOpen) {
      restoreFocusRef.current = document.activeElement as HTMLElement
    } else {
      restoreFocusRef.current?.focus?.()
    }
  }, [commandPaletteOpen])

  useEffect(() => {
    if (!commandPaletteOpen) return

    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setCommandPaletteOpen(false)
        return
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setSelected((current) => Math.min(current + 1, filtered.length - 1))
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setSelected((current) => Math.max(current - 1, 0))
        return
      }
      if (event.key === 'Enter' && filtered[selected]) {
        event.preventDefault()
        navigate(filtered[selected].href)
        return
      }
      // Focus trap.
      if (event.key === 'Tab' && dialogRef.current) {
        const nodes = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
        if (nodes.length === 0) return
        const first = nodes[0]
        const last = nodes[nodes.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [commandPaletteOpen, filtered, selected, navigate, setCommandPaletteOpen])

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
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-label="Command palette"
              initial={{ opacity: 0, scale: 0.96, y: -16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -16 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-lg mx-4 bg-[#111827] border border-[#1E2D4A] rounded-2xl shadow-2xl overflow-hidden pointer-events-auto"
            >
              <div className="flex items-center gap-3 px-4 py-4 border-b border-[#1E2D4A]">
                <Search aria-hidden="true" className="w-4 h-4 text-[#64748B] flex-shrink-0" />
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setSelected(0)
                  }}
                  aria-label="Search pages and actions"
                  placeholder="Search pages, actions..."
                  className="flex-1 bg-transparent text-sm text-[#E2E8F0] placeholder-[#64748B] outline-none"
                />
                <kbd className="text-[10px] text-[#64748B] bg-[#1E2D4A] px-2 py-1 rounded font-mono">ESC</kbd>
              </div>

              <div className="py-2 max-h-80 overflow-y-auto no-scrollbar">
                {filtered.length > 0 ? (
                  <>
                    <p className="px-4 py-2 text-[10px] font-semibold text-[#64748B] uppercase tracking-widest">
                      Pages
                    </p>
                    {filtered.map((command, index) => (
                      <button
                        key={command.id}
                        onMouseEnter={() => setSelected(index)}
                        onClick={() => navigate(command.href)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left ${
                          selected === index
                            ? 'bg-[#6C63FF]/15 text-[#E2E8F0]'
                            : 'text-[#94A3B8] hover:bg-[#151D32]'
                        }`}
                      >
                        <command.icon
                          aria-hidden="true"
                          className={`w-4 h-4 flex-shrink-0 ${selected === index ? 'text-[#6C63FF]' : 'text-[#64748B]'}`}
                        />
                        <span className="flex-1 min-w-0 text-sm truncate">{command.label}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          {command.shortcut && (
                            <kbd className="text-[10px] text-[#64748B] bg-[#1E2D4A] px-1.5 py-0.5 rounded font-mono">
                              {command.shortcut}
                            </kbd>
                          )}
                          {selected === index && (
                            <ArrowRight aria-hidden="true" className="w-3 h-3 text-[#6C63FF]" />
                          )}
                        </div>
                      </button>
                    ))}
                  </>
                ) : (
                  <p className="px-4 py-8 text-center text-sm text-[#64748B]">
                    No results for &quot;{query}&quot;
                  </p>
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
