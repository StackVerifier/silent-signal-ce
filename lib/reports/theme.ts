/**
 * Team identity in a report.
 *
 * A pack of reports covering eight teams is unusable if every page looks the
 * same — the reader loses their place, and pages get filed against the wrong
 * team. So each team gets a stable colour used consistently: the section band
 * in the PDF, the sheet tab and header fill in Excel.
 *
 * Three properties matter and they constrain each other:
 *
 *  - **Stable.** Derived from the team id, not from its position in a list, so
 *    the same team is the same colour in this week's pack and next week's even
 *    if a team is added or removed in between.
 *  - **Printable.** Dark enough for white text at 4.5:1 or better, so a header
 *    band stays legible photocopied or printed greyscale.
 *  - **Distinguishable.** Spread around the wheel rather than eight blues, and
 *    chosen to stay separable for the ~8% of men with red–green colour vision
 *    deficiency — which is why the palette pairs differences in lightness with
 *    differences in hue rather than relying on hue alone.
 *
 * Colour is never the only signal: the team name is printed on every band and
 * every sheet, because a reader who cannot see the colour must lose nothing.
 */

export interface TeamTheme {
  /** Header band and sheet tab. */
  primary: string
  /** Zebra fill behind rows, light enough for black text. */
  tint: string
  /** Text on `primary`. */
  onPrimary: string
}

/**
 * Ten colours, ordered so adjacent picks differ in both hue and lightness.
 * Ten is enough to feel varied and few enough that every one was checked
 * against white text rather than assumed.
 */
const PALETTE: TeamTheme[] = [
  { primary: '1F3A8A', tint: 'E8EDFB', onPrimary: 'FFFFFF' }, // indigo
  { primary: '9A3412', tint: 'FDEBE3', onPrimary: 'FFFFFF' }, // burnt orange
  { primary: '166534', tint: 'E4F5EA', onPrimary: 'FFFFFF' }, // forest
  { primary: '86198F', tint: 'FAE8FC', onPrimary: 'FFFFFF' }, // magenta
  { primary: '155E75', tint: 'E2F2F7', onPrimary: 'FFFFFF' }, // teal
  { primary: '854D0E', tint: 'FBF1DD', onPrimary: 'FFFFFF' }, // ochre
  { primary: '3F3F46', tint: 'EFEFF1', onPrimary: 'FFFFFF' }, // graphite
  { primary: '9F1239', tint: 'FDE7EC', onPrimary: 'FFFFFF' }, // crimson
  { primary: '3730A3', tint: 'EAE9FA', onPrimary: 'FFFFFF' }, // violet
  { primary: '115E59', tint: 'E0F1F0', onPrimary: 'FFFFFF' }, // pine
]

/** FNV-1a. Small, deterministic, and no dependency for a hash this trivial. */
function hash(value: string): number {
  let result = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 0x01000193) >>> 0
  }
  return result
}

export function teamTheme(teamId: string): TeamTheme {
  return PALETTE[hash(teamId) % PALETTE.length]
}

/** Severity colours, shared by both formats so a red means one thing. */
export const RISK_COLOURS = {
  HIGH: { fill: 'FDE7EC', text: '9F1239' },
  MEDIUM: { fill: 'FBF1DD', text: '854D0E' },
  LOW: { fill: 'E4F5EA', text: '166534' },
} as const

export const INK = {
  heading: '111827',
  body: '374151',
  muted: '6B7280',
  rule: 'D1D5DB',
  zebra: 'F9FAFB',
} as const

/** `1F3A8A` → `{ r: 0.12, g: 0.23, b: 0.54 }`, which is what pdf-lib wants. */
export function rgbOf(hex: string): { r: number; g: number; b: number } {
  const value = hex.replace('#', '')
  return {
    r: parseInt(value.slice(0, 2), 16) / 255,
    g: parseInt(value.slice(2, 4), 16) / 255,
    b: parseInt(value.slice(4, 6), 16) / 255,
  }
}
