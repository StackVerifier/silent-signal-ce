'use client'

import { useId, useRef, useState } from 'react'
import { HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

type Side = 'top' | 'bottom' | 'left' | 'right'

const SIDE_CLASSES: Record<Side, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
}

/**
 * Tooltip that is reachable by keyboard and announced to screen readers.
 *
 * Opens on hover *and* focus, closes on Escape, and is wired with
 * aria-describedby — a hover-only title attribute is unusable on touch and
 * inconsistent for assistive technology.
 */
export function Tooltip({
  content,
  side = 'top',
  children,
  className,
}: {
  content: React.ReactNode
  side?: Side
  children: React.ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpen(true), 120)
  }
  const hide = () => {
    if (timer.current) clearTimeout(timer.current)
    setOpen(false)
  }

  return (
    <span
      className={cn('relative inline-flex', className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={hide}
      onKeyDown={(event) => {
        if (event.key === 'Escape') hide()
      }}
    >
      <span aria-describedby={open ? id : undefined} className="inline-flex">
        {children}
      </span>
      {open && (
        <span
          role="tooltip"
          id={id}
          className={cn(
            'absolute z-50 w-max max-w-[min(18rem,calc(100vw-2rem))] rounded-lg border border-[#1E2D4A]',
            'bg-[#111827] px-3 py-2 text-[11px] leading-relaxed text-[#E2E8F0] shadow-2xl',
            'animate-in fade-in-0 zoom-in-95 duration-100 pointer-events-none',
            SIDE_CLASSES[side],
          )}
        >
          {content}
        </span>
      )}
    </span>
  )
}

/**
 * The metric-explainer enterprise users expect: how a number is calculated,
 * where it came from, and when it was last refreshed.
 */
export function MetricInfo({
  formula,
  source,
  updatedAt,
  side = 'top',
}: {
  formula: string
  source: string
  updatedAt?: Date | string | null
  side?: Side
}) {
  return (
    <Tooltip
      side={side}
      content={
        <span className="block space-y-1.5">
          <span className="block">
            <span className="text-[#64748B]">Formula · </span>
            {formula}
          </span>
          <span className="block">
            <span className="text-[#64748B]">Source · </span>
            {source}
          </span>
          <span className="block">
            <span className="text-[#64748B]">Updated · </span>
            {updatedAt ? new Date(updatedAt).toLocaleString() : 'Not synced yet'}
          </span>
        </span>
      }
    >
      <button
        type="button"
        aria-label={`How is this calculated? ${formula}. Source: ${source}.`}
        className="p-0.5 rounded text-[#64748B] hover:text-[#94A3B8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C63FF] transition-colors"
      >
        <HelpCircle aria-hidden="true" className="w-3 h-3" />
      </button>
    </Tooltip>
  )
}
