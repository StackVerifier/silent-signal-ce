'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/lib/auth-context'
import { PERMISSIONS } from '@/lib/rbac/permissions'
import { cn } from '@/lib/utils'

export function WorkspaceSwitcher({ collapsed }: { collapsed: boolean }) {
  const { organization, workspace, workspaces, switchWorkspace, can } = useAuth()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (!organization) return null

  if (collapsed) {
    return (
      <div className="px-3 py-3 border-b border-[#1E2D4A] flex justify-center">
        <div
          title={`${organization.name} · ${workspace?.name ?? 'No workspace'}`}
          className="w-8 h-8 rounded-lg bg-[#6C63FF] flex items-center justify-center text-[11px] font-bold text-white"
        >
          {organization.logo ?? organization.name.slice(0, 2).toUpperCase()}
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative px-3 py-3 border-b border-[#1E2D4A]">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-[#151D32] transition-colors group"
      >
        <div className="w-8 h-8 rounded-lg bg-[#6C63FF] flex items-center justify-center text-[11px] font-bold text-white shrink-0">
          {organization.logo ?? organization.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-xs font-semibold text-[#E2E8F0] truncate">{organization.name}</p>
          <p className="text-[10px] text-[#64748B] truncate">{workspace?.name ?? 'No workspace'}</p>
        </div>
        <ChevronsUpDown
          aria-hidden="true"
          className="w-3.5 h-3.5 text-[#64748B] shrink-0 group-hover:text-[#94A3B8]"
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            role="listbox"
            className="absolute left-3 right-3 top-full z-50 mt-1 bg-[#111827] border border-[#1E2D4A] rounded-xl shadow-2xl overflow-hidden"
          >
            <p className="px-3 pt-3 pb-1.5 text-[10px] font-semibold text-[#64748B] uppercase tracking-widest">
              Workspaces
            </p>
            {workspaces.map((candidate) => (
              <button
                key={candidate.id}
                role="option"
                aria-selected={candidate.id === workspace?.id}
                onClick={() => {
                  switchWorkspace(candidate.id)
                  setOpen(false)
                }}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-left transition-colors',
                  candidate.id === workspace?.id
                    ? 'bg-[#6C63FF]/10 text-[#E2E8F0]'
                    : 'text-[#94A3B8] hover:bg-[#151D32]',
                )}
              >
                <span className="flex-1 min-w-0 text-xs truncate">{candidate.name}</span>
                {candidate.id === workspace?.id && (
                  <Check aria-hidden="true" className="w-3.5 h-3.5 text-[#6C63FF] shrink-0" />
                )}
              </button>
            ))}

            {can(PERMISSIONS.WORKSPACE_WRITE) && (
              <div className="border-t border-[#1E2D4A] mt-1">
                <button className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-[#6C63FF] hover:bg-[#151D32] transition-colors">
                  <Plus aria-hidden="true" className="w-3.5 h-3.5" />
                  Create workspace
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
