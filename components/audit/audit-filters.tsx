'use client'

import { Search, X } from 'lucide-react'
import {
  AUDIT_CATEGORIES, AUDIT_SEVERITIES, AUDIT_SOURCES, AUDIT_STATUSES,
} from '@/lib/audit/events'
import type { AuditQuery } from '@/lib/audit/types'
import { useAuditActors } from '@/lib/query/hooks'
import { cn } from '@/lib/utils'

/**
 * The filter bar.
 *
 * An audit log is only useful if a question can be narrowed to an answer, so
 * the filters are the feature — not decoration around a list. They compose:
 * every one is ANDed, and multi-select values within one filter are ORed, which
 * is what "show me critical and warning events in rules and integrations"
 * means when someone says it out loud.
 */

const label = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ')

function Chips<T extends string>({
  values, selected, onChange, tone,
}: {
  values: readonly T[]
  selected: T[] | undefined
  onChange: (next: T[] | undefined) => void
  tone?: (value: T) => string
}) {
  const toggle = (value: T) => {
    const current = selected ?? []
    const next = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value]
    onChange(next.length ? next : undefined)
  }

  return (
    <div className="flex flex-wrap gap-1">
      {values.map((value) => {
        const active = selected?.includes(value) ?? false
        return (
          <button
            key={value}
            onClick={() => toggle(value)}
            aria-pressed={active}
            className={cn(
              'text-[10px] font-medium px-2 py-1 rounded-md border transition-colors',
              active
                ? tone?.(value) ?? 'bg-[#6C63FF]/15 text-[#8B85FF] border-[#6C63FF]/40'
                : 'bg-[#0F1824] text-[#64748B] border-[#1E2D4A] hover:text-[#94A3B8] hover:border-[#2A3B5C]',
            )}
          >
            {label(value)}
          </button>
        )
      })}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-widest">{title}</p>
      {children}
    </div>
  )
}

const SEVERITY_TONE: Record<string, string> = {
  info: 'bg-[#6C63FF]/15 text-[#8B85FF] border-[#6C63FF]/40',
  success: 'bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/40',
  warning: 'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/40',
  critical: 'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/40',
}

export interface AuditFiltersProps {
  query: AuditQuery
  onChange: (next: AuditQuery) => void
  /** Hides filters this viewer cannot use. */
  canReadSensitive: boolean
  total: number
}

/** Counts everything the user has narrowed by, so "Clear all" has a number. */
export function activeFilterCount(query: AuditQuery): number {
  const keys: (keyof AuditQuery)[] = [
    'from', 'to', 'category', 'severity', 'status', 'source', 'event',
    'actorId', 'targetId', 'workspaceId', 'teamId', 'search',
    'hasChanges', 'securityOnly', 'failedOnly',
  ]
  return keys.filter((key) => {
    const value = query[key]
    return Array.isArray(value) ? value.length > 0 : value !== undefined && value !== ''
  }).length
}

export function AuditFilters({ query, onChange, canReadSensitive, total }: AuditFiltersProps) {
  const actors = useAuditActors()
  const patch = (next: Partial<AuditQuery>) => onChange({ ...query, ...next, cursor: undefined })
  const active = activeFilterCount(query)

  return (
    <div className="bg-[#0F1824] border border-[#1E2D4A] rounded-xl p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#64748B] pointer-events-none" />
          <input
            value={query.search ?? ''}
            onChange={(event) => patch({ search: event.target.value || undefined })}
            placeholder="Search people, targets, rules, issue keys, changed values…"
            aria-label="Search the audit log"
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-[#070B18] border border-[#1E2D4A] text-xs text-[#E2E8F0] placeholder-[#64748B] focus:outline-none focus:border-[#6C63FF] transition-colors"
          />
        </div>

        <input
          type="date"
          value={query.from?.slice(0, 10) ?? ''}
          onChange={(event) => patch({ from: event.target.value ? `${event.target.value}T00:00:00.000Z` : undefined })}
          aria-label="From date"
          className="h-9 px-2.5 rounded-lg bg-[#070B18] border border-[#1E2D4A] text-xs text-[#E2E8F0] focus:outline-none focus:border-[#6C63FF]"
        />
        <span className="text-[10px] text-[#64748B]">to</span>
        <input
          type="date"
          value={query.to?.slice(0, 10) ?? ''}
          onChange={(event) => patch({ to: event.target.value ? `${event.target.value}T23:59:59.999Z` : undefined })}
          aria-label="To date"
          className="h-9 px-2.5 rounded-lg bg-[#070B18] border border-[#1E2D4A] text-xs text-[#E2E8F0] focus:outline-none focus:border-[#6C63FF]"
        />

        <select
          value={query.actorId ?? ''}
          onChange={(event) => patch({ actorId: event.target.value || undefined })}
          aria-label="Performed by"
          className="h-9 px-2.5 rounded-lg bg-[#070B18] border border-[#1E2D4A] text-xs text-[#E2E8F0] focus:outline-none focus:border-[#6C63FF]"
        >
          <option value="">Anyone</option>
          {(actors.data ?? []).map((actor) => (
            <option key={actor.id} value={actor.id}>{actor.name}</option>
          ))}
        </select>

        {active > 0 && (
          <button
            onClick={() => onChange({ limit: query.limit })}
            className="h-9 inline-flex items-center gap-1 px-2.5 rounded-lg text-[11px] text-[#94A3B8] border border-[#1E2D4A] hover:text-[#E2E8F0] hover:border-[#2A3B5C] transition-colors"
          >
            <X aria-hidden="true" className="w-3 h-3" />
            Clear {active}
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Section title="Severity">
          <Chips
            values={AUDIT_SEVERITIES}
            selected={query.severity}
            onChange={(severity) => patch({ severity })}
            tone={(value) => SEVERITY_TONE[value]}
          />
        </Section>
        <Section title="Status">
          <Chips values={AUDIT_STATUSES} selected={query.status} onChange={(status) => patch({ status })} />
        </Section>
      </div>

      <Section title="Category">
        <Chips values={AUDIT_CATEGORIES} selected={query.category} onChange={(category) => patch({ category })} />
      </Section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Section title="Source">
          <Chips values={AUDIT_SOURCES} selected={query.source} onChange={(source) => patch({ source })} />
        </Section>
        <Section title="Quick filters">
          <div className="flex flex-wrap gap-1">
            <Toggle
              label="Has changes"
              active={query.hasChanges === true}
              onClick={() => patch({ hasChanges: query.hasChanges ? undefined : true })}
            />
            <Toggle
              label="Failed only"
              active={query.failedOnly === true}
              onClick={() => patch({ failedOnly: query.failedOnly ? undefined : true })}
            />
            {/* Hidden rather than disabled: offering a control that cannot work
                only teaches the reader that the product is broken. */}
            {canReadSensitive && (
              <Toggle
                label="Security only"
                active={query.securityOnly === true}
                onClick={() => patch({ securityOnly: query.securityOnly ? undefined : true })}
              />
            )}
          </div>
        </Section>
      </div>

      <p className="text-[10px] text-[#64748B]">
        {total.toLocaleString()} record{total === 1 ? '' : 's'} match
        {active > 0 ? ' the current filters' : ''}
      </p>
    </div>
  )
}

function Toggle({ label: text, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'text-[10px] font-medium px-2 py-1 rounded-md border transition-colors',
        active
          ? 'bg-[#6C63FF]/15 text-[#8B85FF] border-[#6C63FF]/40'
          : 'bg-[#0F1824] text-[#64748B] border-[#1E2D4A] hover:text-[#94A3B8] hover:border-[#2A3B5C]',
      )}
    >
      {text}
    </button>
  )
}
