import 'server-only'
import { all, run } from '@/lib/db/driver'
import { writeAudit } from './repository'
import { isValidRetention, readRetentionDays } from './retention-options'

export * from './retention-options'

/**
 * Audit retention.
 *
 * Keeping records forever is not the safe default it sounds like: GDPR and KVKK
 * both require personal data — and an audit log is full of it, names, emails, IP
 * addresses — to be kept only as long as there is a purpose. So the window is a
 * per-organization setting with a defensible range, not an absence of policy.
 *
 * The floor is 30 days because a shorter window makes the log useless for the
 * incident reviews it exists for; the ceiling is 7 years because that is the
 * longest retention any of the regimes this product targets asks for.
 */

export interface PurgeResult {
  deleted: number
  organizations: number
}

/**
 * Deletes records past each organization's window.
 *
 * The cutoff is computed per organization rather than globally, because the
 * setting is per organization — a single global window would quietly apply one
 * tenant's policy to another's data.
 *
 * The purge is itself audited, and that record is written *after* the delete so
 * it cannot be removed by the same pass. Without it the log would silently
 * shrink, which is indistinguishable from tampering.
 */
export async function purgeExpiredAudit(now = new Date()): Promise<PurgeResult> {
  // Retention lives in the organization settings blob, which is the one place
  // the value is edited. Reading it here rather than mirroring it into a column
  // means the job and the settings screen cannot disagree.
  const organizations = await all<{ id: string; settings: string | null }>(
    'SELECT id, settings FROM organization',
  )

  let deleted = 0
  let touched = 0

  for (const organization of organizations) {
    const days = readRetentionDays(organization.settings)
    if (!isValidRetention(days)) continue

    const cutoff = new Date(now.getTime() - days * 86_400_000).toISOString()

    const [{ count } = { count: 0 }] = await all<{ count: number | string }>(
      'SELECT COUNT(*) AS count FROM audit_log WHERE organization_id = ? AND created_at < ?',
      organization.id, cutoff,
    )
    const expiring = Number(count)
    if (expiring === 0) continue

    await run(
      'DELETE FROM audit_log WHERE organization_id = ? AND created_at < ?',
      organization.id, cutoff,
    )

    // Written after the delete, so this record survives its own pass.
    await writeAudit({
      event: 'system.retention_purge',
      organizationId: organization.id,
      actorId: null,
      source: 'scheduler',
      metadata: { retentionDays: days, cutoff, deleted: expiring },
    })

    deleted += expiring
    touched += 1
  }

  return { deleted, organizations: touched }
}
