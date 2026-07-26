'use client'

import { Fragment } from 'react'
import { ChevronRight } from 'lucide-react'
import { auditEvent } from '@/lib/audit/events'
import type { AuditRecord } from '@/lib/audit/types'
import { SEVERITY_STYLES, StatusBadge } from './severity'
import { cn } from '@/lib/utils'

/**
 * A vertical timeline, grouped by day.
 *
 * The previous screen was a flat list of equally-weighted cards, which is how
 * an activity feed looks. An investigation reads chronologically — "what
 * happened around 02:00 last night" — so the day is the organising unit and the
 * time sits where the eye scans, at the start of the row.
 */

const dayFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
})
const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
})

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function groupByDay(records: AuditRecord[]) {
  const groups: { key: string; date: Date; records: AuditRecord[] }[] = []
  for (const record of records) {
    const date = new Date(record.createdAt)
    const key = dayKey(date)
    const last = groups.at(-1)
    if (last?.key === key) last.records.push(record)
    else groups.push({ key, date, records: [record] })
  }
  return groups
}

/** "Bora Martinez → Hakan Şahin" when there are two ends to the action. */
function targetLabel(record: AuditRecord): string | null {
  if (!record.target) return null
  return record.target.name ?? record.target.email ?? record.target.id ?? null
}

function changeSummary(record: AuditRecord): string | null {
  const entries = Object.entries(record.changes ?? {})
  if (entries.length === 0) return null
  if (entries.length === 1) {
    const [field, change] = entries[0]
    return `${field}: ${format(change.before)} → ${format(change.after)}`
  }
  return `${entries.length} fields changed`
}

function format(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function AuditTimeline({
  records, selectedId, onSelect,
}: {
  records: AuditRecord[]
  selectedId: string | null
  onSelect: (record: AuditRecord) => void
}) {
  const groups = groupByDay(records)

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.key}>
          <div className="sticky top-0 z-10 -mx-1 px-1 py-1.5 bg-[#070B18]/95 backdrop-blur-sm">
            <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-widest">
              {dayFormatter.format(group.date)}
            </p>
          </div>

          <ol className="relative mt-2">
            {/* The spine. Purely decorative, so it is hidden from assistive tech. */}
            <span aria-hidden="true" className="absolute left-[7px] top-2 bottom-2 w-px bg-[#1E2D4A]" />

            {group.records.map((record) => {
              const definition = auditEvent(record.event)
              const style = SEVERITY_STYLES[record.severity]
              const target = targetLabel(record)
              const changes = changeSummary(record)
              const selected = record.id === selectedId

              return (
                <Fragment key={record.id}>
                  <li className="relative pl-7">
                    <span
                      aria-hidden="true"
                      className={cn(
                        'absolute left-0 top-[13px] w-[15px] h-[15px] rounded-full border-2 border-[#070B18]',
                        style.dot,
                      )}
                    />
                    <button
                      onClick={() => onSelect(record)}
                      aria-expanded={selected}
                      className={cn(
                        'w-full text-left rounded-lg px-3 py-2.5 my-0.5 border transition-colors group',
                        selected
                          ? 'bg-[#151D32] border-[#6C63FF]/40'
                          : 'bg-transparent border-transparent hover:bg-[#0F1824] hover:border-[#1E2D4A]',
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <span className="font-mono text-[10px] text-[#64748B] pt-0.5 tabular-nums shrink-0">
                          {timeFormatter.format(new Date(record.createdAt))}
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs font-medium text-[#E2E8F0]">{definition.label}</span>
                            <StatusBadge status={record.status} />
                            {definition.security && (
                              <span className="text-[9px] font-semibold uppercase tracking-wide text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/25 px-1.5 py-0.5 rounded">
                                Security
                              </span>
                            )}
                          </span>

                          <span className="block text-[11px] text-[#94A3B8] mt-0.5">
                            {record.actor.name}
                            {target && <> · <span className="text-[#64748B]">{target}</span></>}
                            {record.workspaceName && <> · <span className="text-[#64748B]">{record.workspaceName}</span></>}
                          </span>

                          {changes && (
                            <span className="block font-mono text-[10px] text-[#64748B] mt-1 truncate">
                              {changes}
                            </span>
                          )}
                        </span>

                        <ChevronRight
                          aria-hidden="true"
                          className="w-3.5 h-3.5 text-[#334155] group-hover:text-[#64748B] shrink-0 mt-0.5 transition-colors"
                        />
                      </div>
                    </button>
                  </li>
                </Fragment>
              )
            })}
          </ol>
        </div>
      ))}
    </div>
  )
}
