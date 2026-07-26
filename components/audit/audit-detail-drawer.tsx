'use client'

import { useEffect } from 'react'
import { X, ShieldAlert } from 'lucide-react'
import { auditEvent } from '@/lib/audit/events'
import type { AuditRecord } from '@/lib/audit/types'
import { MASK } from '@/lib/audit/redact'
import { useAuditRecord } from '@/lib/query/hooks'
import { SeverityBadge, StatusBadge } from './severity'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Everything known about one record.
 *
 * The list answers "what happened"; this answers "and exactly how". Opening a
 * drawer rather than navigating keeps the reader's place in the timeline —
 * an investigation is a sequence of comparisons, and losing scroll position on
 * every look costs more than it sounds like.
 */

const stamp = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium', timeStyle: 'medium',
})

function Row({ label, value, mono }: { label: string; value?: React.ReactNode; mono?: boolean }) {
  if (value === undefined || value === null || value === '') return null
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-3 py-1.5">
      <dt className="text-[10px] text-[#64748B] uppercase tracking-wide pt-0.5">{label}</dt>
      <dd className={`text-xs text-[#E2E8F0] min-w-0 break-words ${mono ? 'font-mono text-[11px]' : ''}`}>
        {value}
      </dd>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-[#1E2D4A] pt-3">
      <h4 className="text-[10px] font-semibold text-[#64748B] uppercase tracking-widest mb-1">{title}</h4>
      {children}
    </section>
  )
}

function present(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

/**
 * Field-level before/after.
 *
 * "Changed 1 field" is the answer to a question nobody asked. What an
 * investigator needs is the value on each side, which is the whole reason the
 * diff is captured at write time.
 */
function ChangeTable({ changes }: { changes: Record<string, { before: unknown; after: unknown }> }) {
  return (
    <div className="rounded-lg border border-[#1E2D4A] overflow-hidden">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="bg-[#0F1824] text-[#64748B]">
            <th scope="col" className="text-left font-medium px-2.5 py-1.5">Field</th>
            <th scope="col" className="text-left font-medium px-2.5 py-1.5">Before</th>
            <th scope="col" className="text-left font-medium px-2.5 py-1.5">After</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(changes).map(([field, change]) => {
            const masked = change.after === MASK || change.before === MASK
            return (
              <tr key={field} className="border-t border-[#1E2D4A]/70 align-top">
                <td className="px-2.5 py-1.5 text-[#94A3B8] font-medium whitespace-nowrap">{field}</td>
                <td className="px-2.5 py-1.5 font-mono text-[#EF4444]/90 break-all">{present(change.before)}</td>
                <td className="px-2.5 py-1.5 font-mono text-[#22C55E]/90 break-all">
                  {present(change.after)}
                  {masked && (
                    <span className="block text-[9px] text-[#64748B] font-sans mt-0.5">
                      Value is a credential and was never stored
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function AuditDetailDrawer({
  record, onClose, canReadSensitive,
}: {
  record: AuditRecord | null
  onClose: () => void
  canReadSensitive: boolean
}) {
  const detail = useAuditRecord(record?.id ?? null)

  useEffect(() => {
    if (!record) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [record, onClose])

  if (!record) return null

  const definition = auditEvent(record.event)
  const related = detail.data?.related ?? []
  const full = detail.data?.record ?? record

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`${definition.label} — details`}
        className="fixed lg:sticky right-0 top-0 z-50 lg:z-0 h-dvh lg:h-auto lg:max-h-[calc(100dvh-8rem)] w-full max-w-md lg:max-w-none overflow-y-auto bg-[#0F1824] border-l lg:border border-[#1E2D4A] lg:rounded-xl"
      >
        <header className="sticky top-0 bg-[#0F1824] border-b border-[#1E2D4A] px-4 py-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="text-sm font-semibold text-[#E2E8F0]">{definition.label}</h3>
              <SeverityBadge severity={full.severity} />
              <StatusBadge status={full.status} />
            </div>
            <p className="font-mono text-[10px] text-[#64748B] mt-0.5">{full.event}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close details"
            className="p-1.5 rounded-lg text-[#64748B] hover:text-[#E2E8F0] hover:bg-[#151D32] transition-colors shrink-0"
          >
            <X aria-hidden="true" className="w-4 h-4" />
          </button>
        </header>

        <div className="px-4 py-3 space-y-3">
          <dl>
            <Row label="When" value={stamp.format(new Date(full.createdAt))} />
            <Row label="Category" value={definition.category} />
            <Row label="Source" value={full.source} />
          </dl>

          <Section title="Performed by">
            <dl>
              <Row label="Name" value={full.actor.name} />
              <Row label="Email" value={full.actor.email} />
              <Row label="Role then" value={full.actor.roleId} />
            </dl>
          </Section>

          {full.target && (
            <Section title="Target">
              <dl>
                <Row label="Type" value={full.target.type} />
                <Row label="Name" value={full.target.name} />
                <Row label="Email" value={full.target.email} />
                <Row label="ID" value={full.target.id} mono />
              </dl>
            </Section>
          )}

          {(full.workspaceName || full.teamName) && (
            <Section title="Scope">
              <dl>
                <Row label="Workspace" value={full.workspaceName} />
                <Row label="Team" value={full.teamName} />
              </dl>
            </Section>
          )}

          {full.changes && Object.keys(full.changes).length > 0 && (
            <Section title="Changes">
              <ChangeTable changes={full.changes} />
            </Section>
          )}

          {full.relations && Object.values(full.relations).some(Boolean) && (
            <Section title="Related">
              <dl>
                <Row label="Release" value={full.relations.releaseName ?? full.relations.releaseId} />
                <Row label="Sprint" value={full.relations.sprintName ?? full.relations.sprintId} />
                <Row label="Rule" value={full.relations.ruleName ?? full.relations.ruleId} />
                <Row label="Issue" value={full.relations.issueKey} mono />
                <Row label="Channel" value={full.relations.notificationChannel} />
              </dl>
            </Section>
          )}

          {full.metadata && Object.keys(full.metadata).length > 0 && (
            <Section title="Metadata">
              <pre className="text-[10px] font-mono text-[#94A3B8] bg-[#070B18] border border-[#1E2D4A] rounded-lg p-2.5 overflow-x-auto">
                {JSON.stringify(full.metadata, null, 2)}
              </pre>
            </Section>
          )}

          <Section title="Origin">
            {canReadSensitive ? (
              <dl>
                <Row label="IP address" value={full.ipAddress ?? '—'} mono />
                <Row label="Device" value={full.device ?? '—'} />
                <Row label="Session" value={full.sessionId ?? '—'} mono />
                <Row label="Correlation" value={full.correlationId ?? '—'} mono />
              </dl>
            ) : (
              // Saying the fields exist and are withheld beats showing nothing:
              // the reader learns the record is complete and their view is not.
              <p className="flex items-start gap-2 text-[11px] text-[#64748B]">
                <ShieldAlert aria-hidden="true" className="w-3.5 h-3.5 text-[#F59E0B] shrink-0 mt-0.5" />
                IP address, device and session are recorded but need the
                sensitive-audit permission to view.
              </p>
            )}
          </Section>

          {detail.isLoading && <Skeleton className="h-16 w-full" />}

          {related.length > 0 && (
            <Section title={`Same request (${related.length})`}>
              <ul className="space-y-1">
                {related.map((sibling) => (
                  <li key={sibling.id} className="text-[11px] text-[#94A3B8]">
                    <span className="font-mono text-[10px] text-[#64748B] mr-2">
                      {new Date(sibling.createdAt).toISOString().slice(11, 19)}
                    </span>
                    {auditEvent(sibling.event).label}
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </aside>
    </>
  )
}
