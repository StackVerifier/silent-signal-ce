/**
 * Retention constants, kept free of server-only imports so the settings screen
 * can use the same list the purge job enforces. One definition means the UI
 * cannot offer a window the server would reject.
 */

export const RETENTION_OPTIONS = [30, 90, 180, 365, 1095, 2555] as const
export type RetentionDays = (typeof RETENTION_OPTIONS)[number]

export const DEFAULT_RETENTION_DAYS: RetentionDays = 365

export function retentionLabel(days: number): string {
  if (days < 365) return `${days} days`
  const years = Math.round(days / 365)
  return `${years} year${years === 1 ? '' : 's'}`
}

export function isValidRetention(days: number): days is RetentionDays {
  return (RETENTION_OPTIONS as readonly number[]).includes(days)
}

/**
 * Retention from an organization's settings blob.
 *
 * A malformed or missing value falls back to the default rather than throwing:
 * a parse error must not stop the purge for every other tenant, and it must
 * certainly not be read as "keep nothing".
 */
export function readRetentionDays(settings: string | null | undefined): number {
  if (!settings) return DEFAULT_RETENTION_DAYS
  try {
    const parsed = JSON.parse(settings) as { dataRetentionDays?: unknown }
    const days = Number(parsed.dataRetentionDays)
    return isValidRetention(days) ? days : DEFAULT_RETENTION_DAYS
  } catch {
    return DEFAULT_RETENTION_DAYS
  }
}
