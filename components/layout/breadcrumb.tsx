'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, Home } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { NAV_SECTIONS, navItemForPath } from '@/lib/rbac/navigation'

interface Crumb {
  label: string
  href?: string
}

/**
 * Breadcrumb derived from the navigation registry rather than the raw path, so
 * it shows human labels ("Release Control") and stays correct when routes move.
 * The trailing segment of a detail route is passed in by the page.
 */
export function Breadcrumb({ trailing }: { trailing?: string }) {
  const pathname = usePathname()
  const { workspace } = useAuth()
  const item = navItemForPath(pathname)

  const crumbs: Crumb[] = []
  if (workspace) crumbs.push({ label: workspace.name })

  if (item) {
    const section = NAV_SECTIONS.find((candidate) => candidate.id === item.section)
    if (section && item.href !== '/') crumbs.push({ label: section.label })
    crumbs.push({ label: item.label, href: trailing ? item.href : undefined })
  }

  if (trailing) crumbs.push({ label: trailing })

  if (crumbs.length === 0) return null

  return (
    <nav aria-label="Breadcrumb" className="hidden md:block min-w-0">
      <ol className="flex items-center gap-1.5 text-[11px] text-[#64748B] min-w-0">
        <li className="flex items-center shrink-0">
          <Link
            href="/"
            aria-label="Dashboard"
            className="hover:text-[#94A3B8] transition-colors p-0.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C63FF]"
          >
            <Home aria-hidden="true" className="w-3 h-3" />
          </Link>
        </li>
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1
          return (
            <li key={`${crumb.label}-${index}`} className="flex items-center gap-1.5 min-w-0">
              <ChevronRight aria-hidden="true" className="w-3 h-3 shrink-0 text-[#1E2D4A]" />
              {crumb.href && !isLast ? (
                <Link
                  href={crumb.href}
                  className="truncate hover:text-[#94A3B8] transition-colors rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C63FF]"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span
                  className={`truncate ${isLast ? 'text-[#94A3B8] font-medium' : ''}`}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {crumb.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
