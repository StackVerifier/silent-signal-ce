'use client'

import { useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useDashboardStore } from '@/store/dashboard-store'
import { useAuth } from '@/lib/auth-context'
import { visibleNavItems } from '@/lib/rbac/navigation'

/**
 * Global shortcuts. Destinations come from the RBAC navigation registry, so a
 * shortcut can never jump to a page the member is not allowed to open.
 *
 * ⌘K ownership lives here only — the palette itself handles keys just while it
 * is open, which avoids the double-toggle the two listeners used to cause.
 */
export function useKeyboardShortcuts() {
  const router = useRouter()
  const setCommandPaletteOpen = useDashboardStore((state) => state.setCommandPaletteOpen)
  const commandPaletteOpen = useDashboardStore((state) => state.commandPaletteOpen)
  const { permissions, member } = useAuth()

  const shortcuts = useMemo(() => {
    const status = member?.status ?? 'pending'
    return visibleNavItems(permissions, status).reduce<Record<string, string>>((map, item) => {
      if (item.shortcut) map[item.shortcut] = item.href
      return map
    }, {})
  }, [permissions, member?.status])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) return

      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault()
        setCommandPaletteOpen(!commandPaletteOpen)
        return
      }

      // Never shadow browser or assistive-technology shortcuts.
      if (event.metaKey || event.ctrlKey || event.altKey || commandPaletteOpen) return

      const href = shortcuts[event.key]
      if (href) {
        event.preventDefault()
        router.push(href)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [router, setCommandPaletteOpen, commandPaletteOpen, shortcuts])
}
