import { z } from 'zod'
import { parseBody, route } from '@/lib/api/handler'
import { webhookRepo } from '@/lib/db/repositories'
import { PERMISSIONS } from '@/lib/rbac/permissions'

export const dynamic = 'force-dynamic'

export const GET = route({ permission: PERMISSIONS.NOTIFICATIONS_READ }, (context) =>
  webhookRepo.list(context.workspaceId))

const quietHoursSchema = z
  .object({
    start: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM'),
    end: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM'),
    timezone: z.string().min(1),
  })
  .nullable()
  .optional()

/**
 * A webhook URL must be https and must belong to the provider it claims to be.
 * Without the host check, a mistyped Slack URL would silently POST the alert —
 * including issue titles — to whatever host was pasted.
 */
const HOST_PATTERNS: Record<string, RegExp> = {
  slack: /^hooks\.slack\.com$/i,
  teams: /(^|\.)(office|microsoft|office365|webhook\.office)\.com$/i,
}

const urlSchema = z.string().url('Enter a valid URL').refine(
  (value) => value.startsWith('https://'),
  'The URL must use https',
)

const createSchema = z.object({
  channel: z.enum(['slack', 'teams', 'email']),
  label: z.string().min(1, 'Give this destination a name').max(80),
  url: urlSchema,
  minimumLevel: z.enum(['low', 'medium', 'high', 'critical']),
  enabled: z.boolean().default(true),
  quietHours: quietHoursSchema,
}).superRefine((value, ctx) => {
  const pattern = HOST_PATTERNS[value.channel]
  if (!pattern) return
  const host = (() => { try { return new URL(value.url).host } catch { return '' } })()
  if (!pattern.test(host)) {
    ctx.addIssue({
      code: 'custom',
      path: ['url'],
      message: value.channel === 'slack'
        ? 'A Slack webhook URL must be on hooks.slack.com'
        : 'A Teams webhook URL must be on an Office 365 host',
    })
  }
})

export const POST = route({ permission: PERMISSIONS.NOTIFICATIONS_WRITE }, async (context, request) => {
  const input = await parseBody(request, createSchema)
  return webhookRepo.create(
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
