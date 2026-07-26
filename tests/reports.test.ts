import { describe, expect, it } from 'vitest'
import { RISK_COLOURS, rgbOf, teamTheme } from '@/lib/reports/theme'
import { REPORT_KINDS, REPORT_LABELS } from '@/lib/reports/types'
import { safeSheetName } from '@/lib/reports/xlsx'

/**
 * Contrast ratio per WCAG 2.1. Report bands get printed and photocopied, so
 * "looks fine on my monitor" is not the bar.
 */
function relativeLuminance(hex: string): number {
  const channel = (value: number) => {
    const scaled = value / 255
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4
  }
  const { r, g, b } = rgbOf(hex)
  return 0.2126 * channel(r * 255) + 0.7152 * channel(g * 255) + 0.0722 * channel(b * 255)
}

function contrast(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

describe('team theme', () => {
  it('is stable for a team id', () => {
    // The same team must be the same colour in this week's pack and next
    // week's, even if a team is added or removed in between — which rules out
    // deriving it from a list position.
    expect(teamTheme('team-3')).toEqual(teamTheme('team-3'))
    expect(teamTheme('team-3')).not.toEqual(teamTheme('team-3 '))
  })

  it('spreads colours across ids rather than collapsing to one', () => {
    const ids = Array.from({ length: 20 }, (_, index) => `team-${index}`)
    const distinct = new Set(ids.map((id) => teamTheme(id).primary))
    expect(distinct.size).toBeGreaterThanOrEqual(6)
  })

  it('keeps header text legible on every band, printed or photocopied', () => {
    const ids = Array.from({ length: 40 }, (_, index) => `t${index}`)
    for (const id of ids) {
      const theme = teamTheme(id)
      // 4.5:1 is the WCAG AA floor for body text.
      expect(contrast(theme.primary, theme.onPrimary), theme.primary)
        .toBeGreaterThanOrEqual(4.5)
      // The tint sits behind near-black table text.
      expect(contrast(theme.tint, '111827'), theme.tint).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('keeps risk text readable on its own tint', () => {
    for (const [level, colours] of Object.entries(RISK_COLOURS)) {
      expect(contrast(colours.fill, colours.text), level).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('parses hex into the 0–1 channels pdf-lib expects', () => {
    expect(rgbOf('FFFFFF')).toEqual({ r: 1, g: 1, b: 1 })
    expect(rgbOf('#000000')).toEqual({ r: 0, g: 0, b: 0 })
    const mid = rgbOf('808080')
    expect(mid.r).toBeCloseTo(0.502, 2)
  })
})

describe('report kinds', () => {
  it('labels every kind', () => {
    for (const kind of REPORT_KINDS) {
      expect(REPORT_LABELS[kind], kind).toBeTruthy()
    }
  })
})

describe('sheet names', () => {
  it('strips the characters Excel forbids', () => {
    const taken = new Set<string>()
    // Excel rejects the whole file rather than the name, so this is not
    // cosmetic — one team called "Web / Mobile" would break the download.
    expect(safeSheetName('Web / Mobile [EU]', taken)).toBe('Web   Mobile  EU')
  })

  it('caps at 31 characters', () => {
    const taken = new Set<string>()
    expect(safeSheetName('A'.repeat(60), taken)).toHaveLength(31)
  })

  it('deduplicates, because two teams may share a name', () => {
    const taken = new Set<string>()
    expect(safeSheetName('Mobile Team', taken)).toBe('Mobile Team')
    expect(safeSheetName('Mobile Team', taken)).toBe('Mobile Team 2')
    expect(safeSheetName('Mobile Team', taken)).toBe('Mobile Team 3')
  })

  it('keeps a deduplicated long name within the limit', () => {
    const taken = new Set<string>()
    const long = 'Very Long Team Name That Exceeds The Limit'
    const first = safeSheetName(long, taken)
    const second = safeSheetName(long, taken)
    expect(first).toHaveLength(31)
    expect(second.length).toBeLessThanOrEqual(31)
    expect(second).not.toBe(first)
  })

  it('never returns an empty name', () => {
    expect(safeSheetName('///', new Set())).toBe('Team')
  })
})
