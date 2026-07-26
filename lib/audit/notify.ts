import 'server-only'
import { all } from '@/lib/db/driver'
import { buildAlert, shouldAlert } from './alerts'
import type { AuditRecord } from './types'

/**
 * Fans a severe audit event out to the workspace's notification destinations.
 *
 * Two properties this must have, and they pull in the same direction:
 *
 *  - It never throws. An unreachable Slack workspace must not roll back the
 *    member suspension that triggered the alert. Delivery is best-effort;
 *    the audit record is the durable fact.
 *
 *  - It never blocks the request. Sending happens after the response, so a slow
 *    webhook cannot make the product feel slow.
 */
export async function notifyAuditEvent(record: AuditRecord): Promise<void> {
  if (!shouldAlert(record)) return
  if (!record.workspaceId) return

  try {
    const [{ webhookRepo }, { deliver, meetsThreshold, inQuietHours }, { notificationRepo }] =
      await Promise.all([
        import('@/lib/db/repositories'),
        import('@/lib/notifications/dispatch'),
        import('@/lib/db/repositories'),
      ])

    const alert = buildAlert(record)
    const outbound = { level: alert.level, title: alert.title, message: alert.message, link: alert.link }
    const endpoints = await webhookRepo.list(record.workspaceId)

    await Promise.all(endpoints.map(async (endpoint) => {
      if (!endpoint.enabled) return
      if (!meetsThreshold(outbound, endpoint.minimumLevel)) return
      // Quiet hours are for noise, not for security. A critical audit event is
      // exactly what someone asked to be woken for.
      if (record.severity !== 'critical' && inQuietHours(endpoint.quietHours)) return

      // Decrypted only at the moment of sending, so the plaintext never sits in
      // a list that might be logged or serialised.
      const url = await webhookRepo.getUrl(endpoint.id)
      if (!url) return

      const result = await deliver(endpoint.channel, url, outbound)
      await webhookRepo.recordTest(endpoint.id, result.ok, result.error).catch(() => undefined)
    }))

    // In-app notification for the administrators who can act on it.
    const admins = await all<{ id: string }>(
      `SELECT id FROM member
        WHERE organization_id = ? AND status = 'approved'
          AND role_id IN ('org_owner', 'org_admin', 'platform_admin')`,
      record.organizationId,
    )
    await Promise.all(admins.map((admin) =>
      notificationRepo.create({
        memberId: admin.id,
        workspaceId: record.workspaceId!,
        type: 'admin',
        level: alert.level,
        title: alert.title,
        message: alert.message,
        link: alert.link,
      }).catch(() => undefined)))
  } catch {
    // Delivery is best-effort by design; the audit record already exists.
  }
}
