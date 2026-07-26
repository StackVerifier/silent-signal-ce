import 'server-only'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { INK, RISK_COLOURS, rgbOf } from './theme'
import { REPORT_LABELS, type ReportPack, type ReportSection, type TeamReport } from './types'

/**
 * PDF generation.
 *
 * The font is embedded rather than referenced. A PDF reader is only required to
 * have the 14 standard fonts, all of which are limited to WinAnsi encoding —
 * which does not contain `ş`, `ğ`, `İ` or `ı`. A report about a Turkish
 * delivery team set in Helvetica loses those characters, and loses them
 * silently. Embedding means the glyphs travel inside the file and the document
 * renders identically on a machine that has never heard of DejaVu.
 *
 * pdf-lib subsets on embed, so a typical pack carries tens of kilobytes of font
 * rather than the full 1.5 MB.
 */

const A4_LANDSCAPE: [number, number] = [841.89, 595.28]
const MARGIN = 32
const FONT_DIR = resolve(process.cwd(), 'assets/fonts')

/** Read once per process; the files never change at runtime. */
let cached: { regular: Buffer; bold: Buffer } | null = null
function fontFiles() {
  if (!cached) {
    cached = {
      regular: readFileSync(resolve(FONT_DIR, 'DejaVuSans.ttf')),
      bold: readFileSync(resolve(FONT_DIR, 'DejaVuSans-Bold.ttf')),
    }
  }
  return cached
}

interface Ctx {
  doc: PDFDocument
  page: PDFPage
  y: number
  regular: PDFFont
  bold: PDFFont
  pageNumber: number
  pack: ReportPack
  team: TeamReport
  /** The cover carries no team, so its footer must not claim one. */
  onCover: boolean
}

const colour = (hex: string) => {
  const { r, g, b } = rgbOf(hex)
  return rgb(r, g, b)
}

/**
 * Truncates to fit a column.
 *
 * Measured with the real font rather than by character count: `İstanbul
 * Ödeme Servisi` and `iiiiiiiiiiiiiiii` have the same length and very different
 * widths, and guessing produces either overflow or wasted space.
 */
function fit(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text
  let low = 0
  let high = text.length
  while (low < high) {
    const mid = Math.ceil((low + high) / 2)
    const candidate = `${text.slice(0, mid)}…`
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) low = mid
    else high = mid - 1
  }
  return low > 0 ? `${text.slice(0, low)}…` : ''
}

function drawFooter(context: Ctx, team?: TeamReport) {
  const { page, regular, pack } = context
  const [width] = [page.getWidth()]
  const stamp = pack.generatedAt.toISOString().replace('T', ' ').slice(0, 16)

  page.drawLine({
    start: { x: MARGIN, y: 30 },
    end: { x: width - MARGIN, y: 30 },
    thickness: 0.5,
    color: colour(INK.rule),
  })
  page.drawText(team ? `${pack.organizationName} · ${team.teamName}` : pack.organizationName, {
    x: MARGIN, y: 18, size: 7, font: regular, color: colour(INK.muted),
  })
  const right = `Generated ${stamp} UTC by ${pack.generatedBy} · page ${context.pageNumber}`
  page.drawText(right, {
    x: width - MARGIN - regular.widthOfTextAtSize(right, 7),
    y: 18, size: 7, font: regular, color: colour(INK.muted),
  })
}

function newPage(context: Ctx, withBand = true) {
  // The cover names no team; every page after it does.
  if (context.pageNumber > 0) drawFooter(context, context.onCover ? undefined : context.team)
  context.onCover = !withBand
  context.page = context.doc.addPage(A4_LANDSCAPE)
  context.pageNumber += 1
  context.y = context.page.getHeight() - MARGIN

  if (withBand) {
    // The team band repeats on every page. A pack covering eight teams gets
    // separated, stapled and passed around; a page that does not say which team
    // it belongs to gets filed against the wrong one.
    const width = context.page.getWidth()
    context.page.drawRectangle({
      x: 0, y: context.y - 28, width, height: 40,
      color: colour(context.team.theme.primary),
    })
    context.page.drawText(context.team.teamName, {
      x: MARGIN, y: context.y - 14, size: 14, font: context.bold,
      color: colour(context.team.theme.onPrimary),
    })
    const scope = context.team.workspaceName ?? ''
    if (scope) {
      context.page.drawText(scope, {
        x: MARGIN + context.bold.widthOfTextAtSize(context.team.teamName, 14) + 10,
        y: context.y - 13, size: 9, font: context.regular,
        color: colour(context.team.theme.onPrimary),
      })
    }
    const kinds = context.pack.kinds.map((kind) => REPORT_LABELS[kind]).join(' · ')
    context.page.drawText(kinds, {
      x: width - MARGIN - context.regular.widthOfTextAtSize(kinds, 9),
      y: context.y - 13, size: 9, font: context.regular,
      color: colour(context.team.theme.onPrimary),
    })
    context.y -= 52
  }
}

function ensureSpace(context: Ctx, needed: number) {
  if (context.y - needed < 46) newPage(context)
}

function drawStats(context: Ctx, section: ReportSection) {
  if (section.stats.length === 0) return
  const { page, regular, bold } = context
  const available = page.getWidth() - MARGIN * 2
  const cardWidth = Math.min(150, available / section.stats.length - 8)

  section.stats.forEach((stat, index) => {
    const x = MARGIN + index * (cardWidth + 8)
    const tint = stat.risk ? RISK_COLOURS[stat.risk] : null

    page.drawRectangle({
      x, y: context.y - 34, width: cardWidth, height: 34,
      color: colour(tint?.fill ?? INK.zebra),
      borderColor: colour(INK.rule), borderWidth: 0.5,
    })
    page.drawText(fit(stat.label.toUpperCase(), regular, 6.5, cardWidth - 12), {
      x: x + 6, y: context.y - 12, size: 6.5, font: regular, color: colour(INK.muted),
    })
    page.drawText(fit(stat.value, bold, 12, cardWidth - 12), {
      x: x + 6, y: context.y - 28, size: 12, font: bold,
      color: colour(tint?.text ?? INK.heading),
    })
  })

  context.y -= 46
}

function drawTable(context: Ctx, section: ReportSection) {
  const { page } = context
  const available = page.getWidth() - MARGIN * 2
  const totalWeight = section.columns.reduce((sum, column) => sum + column.width, 0)
  const widths = section.columns.map((column) => (column.width / totalWeight) * available)

  const drawHeader = () => {
    const { page: current, bold } = context
    current.drawRectangle({
      x: MARGIN, y: context.y - 16, width: available, height: 16,
      color: colour(context.team.theme.tint),
    })
    let x = MARGIN
    section.columns.forEach((column, index) => {
      const width = widths[index]
      const text = fit(column.label, bold, 7.5, width - 8)
      const offset = column.align === 'right' ? width - 4 - bold.widthOfTextAtSize(text, 7.5) : 4
      current.drawText(text, {
        x: x + offset, y: context.y - 11.5, size: 7.5, font: bold, color: colour(INK.heading),
      })
      x += width
    })
    context.y -= 16
  }

  ensureSpace(context, 40)
  drawHeader()

  if (section.rows.length === 0) {
    context.page.drawText(section.emptyMessage, {
      x: MARGIN + 4, y: context.y - 12, size: 8,
      font: context.regular, color: colour(INK.muted),
    })
    context.y -= 24
    return
  }

  section.rows.forEach((row, rowIndex) => {
    if (context.y - 14 < 46) {
      newPage(context)
      drawHeader()
    }

    const tint = row.risk === 'HIGH' ? RISK_COLOURS.HIGH.fill
      : row.risk === 'MEDIUM' ? RISK_COLOURS.MEDIUM.fill
      : rowIndex % 2 === 1 ? INK.zebra : null

    if (tint) {
      context.page.drawRectangle({
        x: MARGIN, y: context.y - 14, width: available, height: 14, color: colour(tint),
      })
    }

    let x = MARGIN
    section.columns.forEach((column, index) => {
      const width = widths[index]
      const raw = row.values[column.key]
      const text = fit(raw === null || raw === undefined ? '—' : String(raw), context.regular, 7.5, width - 8)
      const offset = column.align === 'right'
        ? width - 4 - context.regular.widthOfTextAtSize(text, 7.5)
        : 4
      context.page.drawText(text, {
        x: x + offset, y: context.y - 10, size: 7.5,
        font: context.regular, color: colour(INK.body),
      })
      x += width
    })

    context.y -= 14
  })

  context.y -= 10
}

function drawSection(context: Ctx, section: ReportSection) {
  ensureSpace(context, 90)
  context.page.drawText(section.title, {
    x: MARGIN, y: context.y - 12, size: 11, font: context.bold, color: colour(INK.heading),
  })
  if (section.subtitle) {
    context.page.drawText(section.subtitle, {
      x: MARGIN + context.bold.widthOfTextAtSize(section.title, 11) + 8,
      y: context.y - 11, size: 8, font: context.regular, color: colour(INK.muted),
    })
  }
  context.y -= 22
  drawStats(context, section)
  drawTable(context, section)
}

function drawCover(context: Ctx) {
  newPage(context, false)
  const { page, bold, regular, pack } = context
  const width = page.getWidth()

  page.drawRectangle({ x: 0, y: page.getHeight() - 140, width, height: 140, color: colour('0F172A') })
  page.drawText('Delivery Report Pack', {
    x: MARGIN, y: page.getHeight() - 70, size: 26, font: bold, color: rgb(1, 1, 1),
  })
  page.drawText(pack.organizationName, {
    x: MARGIN, y: page.getHeight() - 96, size: 13, font: regular, color: colour('94A3B8'),
  })
  page.drawText(
    `${pack.kinds.map((kind) => REPORT_LABELS[kind]).join(' · ')} — ${pack.teams.length} team${pack.teams.length === 1 ? '' : 's'}`,
    { x: MARGIN, y: page.getHeight() - 118, size: 10, font: regular, color: colour('CBD5E1') },
  )

  context.y = page.getHeight() - 172

  // A colour key on the cover, so the bands mean something before the reader
  // reaches the first team page.
  page.drawText('Teams in this pack', {
    x: MARGIN, y: context.y, size: 10, font: bold, color: colour(INK.heading),
  })
  context.y -= 18

  pack.teams.forEach((team) => {
    if (context.y < 60) newPage(context, false)
    page.drawRectangle({
      x: MARGIN, y: context.y - 11, width: 14, height: 14, color: colour(team.theme.primary),
    })
    context.page.drawText(team.teamName, {
      x: MARGIN + 22, y: context.y - 7, size: 9, font: bold, color: colour(INK.heading),
    })
    if (team.workspaceName) {
      context.page.drawText(team.workspaceName, {
        x: MARGIN + 22 + bold.widthOfTextAtSize(team.teamName, 9) + 8,
        y: context.y - 7, size: 8, font: regular, color: colour(INK.muted),
      })
    }
    const counts = team.sections
      .map((section) => `${REPORT_LABELS[section.kind]}: ${section.rows.length}`)
      .join('   ')
    context.page.drawText(counts, {
      x: width - MARGIN - regular.widthOfTextAtSize(counts, 8),
      y: context.y - 7, size: 8, font: regular, color: colour(INK.muted),
    })
    context.y -= 20
  })

  context.y -= 6
  page.drawText(
    `Generated ${pack.generatedAt.toISOString().replace('T', ' ').slice(0, 16)} UTC by ${pack.generatedBy}.`,
    { x: MARGIN, y: 44, size: 8, font: regular, color: colour(INK.muted) },
  )
}

export async function renderPackPdf(pack: ReportPack): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)

  const files = fontFiles()
  const regular = await doc.embedFont(files.regular, { subset: true })
  const bold = await doc.embedFont(files.bold, { subset: true })

  doc.setTitle(`${pack.organizationName} — Delivery Report Pack`)
  doc.setCreator('Silent Signal')
  doc.setProducer('Silent Signal')
  doc.setCreationDate(pack.generatedAt)

  const context: Ctx = {
    doc,
    page: undefined as unknown as PDFPage,
    y: 0,
    regular,
    bold,
    pageNumber: 0,
    onCover: true,
    pack,
    team: pack.teams[0] ?? {
      teamId: '', teamName: '—', theme: { primary: '1F3A8A', tint: 'E8EDFB', onPrimary: 'FFFFFF' },
      sections: [],
    },
  }

  drawCover(context)

  for (const team of pack.teams) {
    context.team = team
    // Each team starts on its own page: packs get split and distributed, and a
    // team's report should be separable without cutting another's in half.
    newPage(context)
    for (const section of team.sections) drawSection(context, section)
  }

  drawFooter(context, context.onCover ? undefined : context.team)
  return doc.save()
}
