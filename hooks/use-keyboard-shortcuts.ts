'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useDashboardStore } from '@/store/dashboard-store'

const PAGE_SHORTCUTS: Record<string, string> = {
  '1': '/',
  '2': '/sprint',
  '3': '/release',
  '4': '/qa-queue',
  '5': '/risk-timeline',
  '6': '/rules',
}

export function useKeyboardShortcuts() {
  const router = useRouter()
  const { setCommandPaletteOpen, commandPaletteOpen } = useDashboardStore()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip when typing in an input/textarea/contenteditable
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) return

      // ⌘K / Ctrl+K — command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(!commandPaletteOpen)
        return
      }

      // Skip modified keys (avoid clash with browser shortcuts)
      if (e.metaKey || e.ctrlKey || e.altKey) return

      // 1–6 number shortcuts for pages
      if (PAGE_SHORTCUTS[e.key] && !commandPaletteOpen) {
        e.preventDefault()
        router.push(PAGE_SHORTCUTS[e.key])
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [router, setCommandPaletteOpen, commandPaletteOpen])
}
