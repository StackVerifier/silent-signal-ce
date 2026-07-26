import 'server-only'
import ExcelJS from 'exceljs'
import { INK, RISK_COLOURS } from './theme'
import {
  REPORT_LABELS, type ReportKind, type ReportPack, type ReportSection, type TeamReport,
} from './types'

/**
 * Excel generation.
 *
 * Different job from the PDF. The PDF is for reading and filing; the workbook
 * is for someone who will sort, filter and pivot. So the shapes differ on
 * purpose: the PDF stacks a team's three reports on one page flow, while the
 * workbook gives each report its own sheet with frozen headers and an
 * autofilter, because that is what makes a table workable rather than merely
 * present.
 *
 * Fonts are not embedded in xlsx — a workbook names a font and the reader
 * resolves it. Calibri is Excel's own default on Windows and macOS and covers
 * Turkish; the cell text is UTF-8 in the file regardless, so the characters
 * survive even if a reader substitutes the face.
 */

const FONT = { name: 'Calibri', size: 10 }

/** Sheet names cap at 31 characters, so the tab uses the short form. */
const SHORT_LABELS: Record<ReportKind, string> = {
  sprint: 'Sprint', release: 'Release', qa: 'QA',
}

function styleHeaderRow(row: ExcelJS.Row, team: TeamReport) {
  row.eachCell((cell) => {
    cell.font = { ...FONT, bold: true, color: { argb: `FF${team.theme.onPrimary}` } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${team.theme.primary}` } }
    cell.alignment = { vertical: 'middle', wrapText: true }
    cell.border = { bottom: { style: 'thin', color: { argb: `FF${INK.rule}` } } }
  })
  row.height = 20
}

/**
 * One sheet per team per report.
 *
 * Stacking a team's three reports on one sheet looked tidier and was wrong.
 * Excel allows a single autofilter per sheet, so only the last table would have
 * been filterable — and sorting a sheet holding three tables scrambles the two
 * you were not sorting. A workbook exists to be sorted and pivoted; a layout
 * that breaks the moment someone does that is a layout that only works in a
 * screenshot.
 *
 * So each sheet holds exactly one table, with the team's colour on its tab and
 * banner. Fifteen tabs for five teams reads as a lot until you need the QA
 * queue for one team, at which point it is the only structure that helps.
 */
function addReportSheet(
  workbook: ExcelJS.Workbook, team: TeamReport, section: ReportSection, taken: Set<string>,
) {
  const sheet = workbook.addWorksheet(
    safeSheetName(`${team.teamName} · ${SHORT_LABELS[section.kind]}`, taken),
    { properties: { tabColor: { argb: `FF${team.theme.primary}` } } },
  )

  sheet.columns = section.columns.map((column) => ({ width: column.width }))

  const banner = sheet.addRow([`${team.teamName} — ${section.title}`])
  banner.font = { ...FONT, size: 13, bold: true, color: { argb: `FF${team.theme.onPrimary}` } }
  banner.height = 24
  // Fill the full table width, so the band reads as a band rather than one
  // coloured cell with a long label spilling out of it.
  for (let column = 1; column <= section.columns.length; column += 1) {
    sheet.getRow(banner.number).getCell(column).fill = {
      type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${team.theme.primary}` },
    }
  }
  sheet.mergeCells(banner.number, 1, banner.number, Math.max(section.columns.length, 1))

  const context = [team.workspaceName, section.subtitle].filter(Boolean).join(' · ')
  if (context) {
    sheet.addRow([context]).font = { ...FONT, size: 9, color: { argb: `FF${INK.muted}` } }
  }

  if (section.stats.length > 0) {
    sheet.addRow([])
    const labels = sheet.addRow(section.stats.map((stat) => stat.label))
    labels.eachCell((cell) => {
      cell.font = { ...FONT, size: 8, color: { argb: `FF${INK.muted}` } }
    })
    const values = sheet.addRow(section.stats.map((stat) => stat.value))
    values.eachCell((cell, index) => {
      const stat = section.stats[index - 1]
      const tint = stat?.risk ? RISK_COLOURS[stat.risk] : null
      cell.font = { ...FONT, bold: true, size: 11, color: { argb: `FF${tint?.text ?? INK.heading}` } }
      if (tint) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${tint.fill}` } }
      }
    })
  }

  sheet.addRow([])

  const headerRow = sheet.addRow(section.columns.map((column) => column.label))
  styleHeaderRow(headerRow, team)

  section.rows.forEach((row, index) => {
    const added = sheet.addRow(section.columns.map((column) => {
      const value = row.values[column.key]
      return value === null || value === undefined ? '' : value
    }))

    const tint = row.risk === 'HIGH' ? RISK_COLOURS.HIGH
      : row.risk === 'MEDIUM' ? RISK_COLOURS.MEDIUM
      : null

    added.eachCell((cell, columnIndex) => {
      cell.font = { ...FONT, color: { argb: `FF${tint?.text ?? INK.body}` } }
      cell.alignment = {
        horizontal: section.columns[columnIndex - 1]?.align === 'right' ? 'right' : 'left',
        vertical: 'top',
      }
      if (tint) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${tint.fill}` } }
      } else if (index % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${INK.zebra}` } }
      }
    })
  })

  if (section.rows.length === 0) {
    sheet.addRow([section.emptyMessage]).font = {
      ...FONT, italic: true, color: { argb: `FF${INK.muted}` },
    }
    return
  }

  // Exactly one table on the sheet, so both of these do what they promise.
  sheet.autoFilter = {
    from: { row: headerRow.number, column: 1 },
    to: { row: headerRow.number + section.rows.length, column: section.columns.length },
  }
  sheet.views = [{ state: 'frozen', ySplit: headerRow.number }]
}

/** Excel forbids : \ / ? * [ ] in a sheet name and caps it at 31 characters. */
export function safeSheetName(name: string, taken: Set<string>): string {
  const cleaned = name.replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31) || 'Team'
  if (!taken.has(cleaned)) {
    taken.add(cleaned)
    return cleaned
  }
  for (let suffix = 2; suffix < 100; suffix += 1) {
    const candidate = `${cleaned.slice(0, 31 - String(suffix).length - 1)} ${suffix}`
    if (!taken.has(candidate)) {
      taken.add(candidate)
      return candidate
    }
  }
  return cleaned.slice(0, 28) + Math.floor(Math.random() * 900 + 100)
}

function addSummary(workbook: ExcelJS.Workbook, pack: ReportPack) {
  const sheet = workbook.addWorksheet('Summary', {
    properties: { tabColor: { argb: 'FF0F172A' } },
  })

  sheet.columns = [
    { width: 28 }, { width: 22 }, { width: 14 }, { width: 14 }, { width: 14 },
  ]

  const title = sheet.addRow([`${pack.organizationName} — Delivery Report Pack`])
  title.font = { ...FONT, size: 14, bold: true, color: { argb: `FF${INK.heading}` } }
  sheet.addRow([
    `Generated ${pack.generatedAt.toISOString().replace('T', ' ').slice(0, 16)} UTC by ${pack.generatedBy}`,
  ]).font = { ...FONT, size: 9, color: { argb: `FF${INK.muted}` } }
  sheet.addRow([pack.kinds.map((kind) => REPORT_LABELS[kind]).join(' · ')])
    .font = { ...FONT, size: 9, color: { argb: `FF${INK.muted}` } }
  sheet.addRow([])

  const header = sheet.addRow(['Team', 'Workspace', 'Sprint', 'Release', 'QA'])
  header.eachCell((cell) => {
    cell.font = { ...FONT, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }
  })

  for (const team of pack.teams) {
    const counts = (kind: string) =>
      team.sections.find((section) => section.kind === kind)?.rows.length ?? ''
    const row = sheet.addRow([
      team.teamName, team.workspaceName ?? '',
      counts('sprint'), counts('release'), counts('qa'),
    ])
    // The team's colour on its own name, matching its sheet tab — the reader
    // can jump between the summary and a sheet without reading labels.
    row.getCell(1).font = { ...FONT, bold: true, color: { argb: `FF${team.theme.primary}` } }
    row.getCell(1).fill = {
      type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${team.theme.tint}` },
    }
  }

  sheet.views = [{ state: 'frozen', ySplit: header.number }]
}

export async function renderPackXlsx(pack: ReportPack): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Silent Signal'
  workbook.created = pack.generatedAt

  addSummary(workbook, pack)

  const taken = new Set<string>(['Summary'])
  for (const team of pack.teams) {
    for (const section of team.sections) addReportSheet(workbook, team, section, taken)
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
