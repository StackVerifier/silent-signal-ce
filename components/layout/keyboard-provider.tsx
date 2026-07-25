'use client'

import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'

export function KeyboardProvider({ children }: { children: React.ReactNode }) {
  useKeyboardShortcuts()
  return <>{children}</>
}
