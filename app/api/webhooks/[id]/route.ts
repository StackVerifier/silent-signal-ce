import { z } from 'zod'
import { jsonError, parseBody, route } from '@/lib/api/handler'
import { webhookRepo } from '@/lib/db/repositories'
import { PERMISSIONS } from '@/lib/rbac/permissions'
import { deliver } from '@/lib/notifications/dispatch'

export const dynamic = 'force-dynamic'

const idOf = (request: Request) => {
  const segments = new URL(request.url).pathname.split('/').filter(Boolean)
  // .../webhooks/<id> or .../webhooks/<id>/test
  return segments[segments.length - 1] === 'test'
    ? segments[segments.length - 2]
    : segments[segments.length - 1]
}

async function assertOwned(workspaceId: string, webhookId: string) {
  const found = (await webhookRepo.list(workspaceId)).find((item) => item.id === webhookId)
  // A webhook from another workspace is reported as missing, not forbidden.
  if (!found) throw Object.assign(new Error('Webhook not found'), { statusCode: 404 })
  return found
}

const patchSchema = z.object({
  label: z.string().min(1).max(80).optional(),
  // Omitted means "keep the stored URL" — editing a label must not require
  // pasting the secret again.
  url: z.string().url().optional(),
  minimumLevel: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  enabled: z.boolean().optional(),
  quietHours: z
    .object({ start: z.string(), end: z.string(), timezone: z.string() })
    .nullable()
    .optional(),
})

export const PATCH = route({ permission: PERMISSIONS.NOTIFICATIONS_WRITE }, async (context, request) => {
  const id = idOf(request)
  await assertOwned(context.workspaceId, id)
  const patch = await parseBody(request, patchSchema)
  return await webhookRepo.update(id, patch, context.memberId, context.organizationId)
})

export const DELETE = route({ permission: PERMISSIONS.NOTIFICATIONS_WRITE }, async (context, request) => {
  const id = idOf(request)
  await assertOwned(context.workspaceId, id)
  await webhookRepo.remove(id, context.memberId, context.organizationId)
  return { ok: true }
})

/** Sends a real test message, so wiring is proven before an incident tests it. */
export const POST = route({ permission: PERMISSIONS.NOTIFICATIONS_WRITE }, async (context, request) => {
  const id = idOf(request)
  const endpoint = await assertOwned(context.workspaceId, id)

  const url = await webhookRepo.getUrl(id)
  if (!url) {
    await webhookRepo.recordTest(id, false, 'Stored URL could not be decrypted')
    return jsonError('Stored URL could not be decrypted — re-enter it', 409, 'decrypt_failed')
  }

  const result = await deliver(endpoint.channel, url, {
    level: 'medium',
    title: 'Silent Signal test alert',
    message: `If you can read this, ${endpoint.label} is wired correctly.`,
  })

  await webhookRepo.recordTest(id, result.ok, result.error)
  return { ok: result.ok, error: result.error ?? null }
})
