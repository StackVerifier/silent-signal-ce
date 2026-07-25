import { z } from 'zod'
import { parseBody, route } from '@/lib/api/handler'
import { webhookRepo } from '@/lib/db/repositories'
import { PERMISSIONS } from '@/lib/rbac/permissions'
import { checkWebhookUrl } from '@/lib/notifications/webhook-url'

export const dynamic = 'force-dynamic'

export const GET = route({ permission: PERMISSIONS.NOTIFICATIONS_READ }, async (context) =>
  await webhookRepo.list(context.workspaceId))

const quietHoursSchema = z
  .object({
    start: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM'),
    end: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM'),
    timezone: z.string().min(1),
  })
  .nullable()
  .optional()

const createSchema = z.object({
  channel: z.enum(['slack', 'teams', 'email']),
  label: z.string().min(1, 'Give this destination a name').max(80),
  url: z.string().min(1, 'Enter a webhook URL'),
  minimumLevel: z.enum(['low', 'medium', 'high', 'critical']),
  enabled: z.boolean().default(true),
  quietHours: quietHoursSchema,
}).superRefine((value, ctx) => {
  // The host check is the security-relevant part and lives in one module, so
  // the browser and this handler can never drift apart on what is acceptable.
  const problem = checkWebhookUrl(value.channel, value.url)
  if (problem) ctx.addIssue({ code: 'custom', path: ['url'], message: problem.message })
})

export const POST = route({ permission: PERMISSIONS.NOTIFICATIONS_WRITE }, async (context, request) => {
  const input = await parseBody(request, createSchema)
  return await webhookRepo.create(
    {
      workspaceId: context.workspaceId,
      organizationId: context.organizationId,
      channel: input.channel,
      label: input.label,
      url: input.url,
      minimumLevel: input.minimumLevel,
      enabled: input.enabled,
      quietHours: input.quietHours ?? null,
    },
    context.memberId,
  )
})
