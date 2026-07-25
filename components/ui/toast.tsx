'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, AlertTriangle, Info, X } from 'lucide-react'

type ToastTone = 'success' | 'error' | 'info'

interface Toast {
  id: string
  tone: ToastTone
  title: string
  description?: string
}

interface ToastContextValue {
  toast: (input: Omit<Toast, 'id'>) => void
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const TONE = {
  success: { icon: Check, className: 'text-[#22C55E] bg-[#22C55E]/10 border-[#22C55E]/25' },
  error: { icon: AlertTriangle, className: 'text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/25' },
  info: { icon: Info, className: 'text-[#6C63FF] bg-[#6C63FF]/10 border-[#6C63FF]/25' },
} as const

/**
 * Confirmation surface for mutations. Without it a successful write is
 * indistinguishable from a no-op — the user is left guessing whether the invite
 * actually went out.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id))
  }, [])

  const toast = useCallback(
    (input: Omit<Toast, 'id'>) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      setToasts((current) => [...current.slice(-2), { ...input, id }])
      setTimeout(() => dismiss(id), input.tone === 'error' ? 7000 : 4000)
    },
    [dismiss],
  )

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (title, description) => toast({ tone: 'success', title, description }),
      error: (title, description) => toast({ tone: 'error', title, description }),
    }),
    [toast],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Announced politely so a screen reader hears the result without losing focus. */}
      <div
        role="status"
        aria-live="polite"
        className="fixed bottom-4 right-4 left-4 sm:left-auto z-[70] flex flex-col items-end gap-2 pointer-events-none"
      >
        <AnimatePresence initial={false}>
          {toasts.map((item) => {
            const tone = TONE[item.tone]
            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.97 }}
                transition={{ duration: 0.16 }}
                className="w-full sm:w-[22rem] pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl bg-[#111827] border border-[#1E2D4A] shadow-2xl"
              >
                <span className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${tone.className}`}>
                  <tone.icon aria-hidden="true" className="w-3.5 h-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-[#E2E8F0]">{item.title}</p>
                  {item.description && (
                    <p className="text-[11px] text-[#94A3B8] mt-0.5 leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => dismiss(item.id)}
                  aria-label="Dismiss notification"
                  className="p-1 -mr-1 rounded text-[#64748B] hover:text-[#E2E8F0] transition-colors shrink-0"
                >
                  <X aria-hidden="true" className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within a ToastProvider')
  return context
}
