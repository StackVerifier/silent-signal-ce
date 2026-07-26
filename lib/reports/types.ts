import type { TeamTheme } from './theme'
import type { GateStatus, IssuePriority, RiskLevel } from '@/lib/types'

/**
 * The shape a report is rendered from.
 *
 * Gathered once and handed to both the PDF and the Excel writer, so the two can
 * never disagree about what a report contained — the classic failure being a
 * spreadsheet and a PDF from the same click that show different numbers because
 * each ran its own query.
 */

export const REPORT_KINDS = ['sprint', 'release', 'qa'] as const
export type ReportKind = (typeof REPORT_KINDS)[number]

export const REPORT_LABELS: Record<ReportKind, string> = {
  sprint: 'Sprint Intelligence',
  release: 'Release Readiness',
  qa: 'QA Queue',
}

export interface ReportColumn {
  key: string
  label: string
  /** Character width hint; Excel needs one and the PDF uses it for weighting. */
  width: number
  align?: 'left' | 'right'
}

export interface ReportRow {
  values: Record<string, string | number | null>
  /** Drives the risk tint on the row in both formats. */
  risk?: RiskLevel
}

/** A headline figure printed above the table. */
export interface ReportStat {
  label: string
  value: string
  risk?: RiskLevel
}

export interface ReportSection {
  kind: ReportKind
  title: string
  /** One line explaining what the reader is looking at. */
  subtitle?: string
  stats: ReportStat[]
  columns: ReportColumn[]
  rows: ReportRow[]
  /** Shown in place of a table when there is nothing to show. */
  emptyMessage: string
}

export interface TeamReport {
  teamId: string
  teamName: string
  workspaceName?: string
  theme: TeamTheme
  sections: ReportSection[]
}

export interface ReportPack {
  organizationName: string
  generatedAt: Date
  generatedBy: string
  kinds: ReportKind[]
  teams: TeamReport[]
}

// Re-exported so report builders do not each import from lib/types.
export type { GateStatus, IssuePriority, RiskLevel }
