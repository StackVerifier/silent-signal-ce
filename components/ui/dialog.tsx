'use client'

import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Modal dialog with the accessibility behaviour a form needs: focus moves in on
 * open, is trapped while open, and returns to the trigger on close. Escape and
 * backdrop click dismiss it, and body scroll is locked underneath.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    if (!open) {
      restoreFocusRef.current?.focus?.()
      return
    }

    restoreFocusRef.current = document.activeElement as HTMLElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Focus the first field rather than the close button — the user came to type.
    const timer = setTimeout(() => {
      const nodes = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE)
      const firstField = Array.from(nodes ?? []).find(
        (node) => !node.hasAttribute('data-dialog-close'),
      )
      ;(firstField ?? nodes?.[0])?.focus()
    }, 30)

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return

      const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
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

    document.addEventListener('keydown', onKeyDown)
    return () => {
      clearTimeout(timer)
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden="true"
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className={cn(
              'relative w-full bg-[#111827] border border-[#1E2D4A] shadow-2xl',
              // Sheet on phones, centred dialog from sm upward.
              'rounded-t-2xl sm:rounded-2xl max-h-[92dvh] sm:max-h-[85dvh] flex flex-col',
              size === 'sm' && 'sm:max-w-sm',
              size === 'md' && 'sm:max-w-lg',
              size === 'lg' && 'sm:max-w-2xl',
            )}
          >
            <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-[#1E2D4A]">
              <div className="min-w-0">
                <h2 id={titleId} className="text-sm font-semibold text-[#E2E8F0]">
                  {title}
                </h2>
                {description && (
                  <p id={descriptionId} className="text-xs text-[#64748B] mt-1 leading-relaxed">
                    {description}
                  </p>
                )}
              </div>
              <button
                type="button"
                data-dialog-close
                onClick={onClose}
                aria-label="Close dialog"
                className="p-1.5 -mr-1 -mt-0.5 rounded-lg text-[#64748B] hover:text-[#E2E8F0] hover:bg-[#151D32] transition-colors shrink-0"
              >
                <X aria-hidden="true" className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar px-5 py-4">{children}</div>

            {footer && (
              <div className="px-5 py-4 border-t border-[#1E2D4A] flex flex-wrap items-center justify-end gap-2">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export function DialogButton({
  variant = 'primary',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  return (
    <button
      {...props}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C63FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#111827]',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variant === 'primary' && 'bg-[#6C63FF] text-white hover:bg-[#5B52CC]',
        variant === 'ghost' && 'border border-[#1E2D4A] text-[#94A3B8] hover:text-[#E2E8F0] hover:border-[#6C63FF]/40',
        variant === 'danger' && 'bg-[#EF4444]/15 text-[#EF4444] hover:bg-[#EF4444]/25',
        className,
      )}
    />
  )
}
