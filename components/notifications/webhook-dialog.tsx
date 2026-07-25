'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogButton } from '@/components/ui/dialog'
import { SelectField, TextField } from '@/components/forms/fields'
import { useToast } from '@/components/ui/toast'
import { useSaveWebhook } from '@/lib/query/hooks'
import type { WebhookEndpoint } from '@/services/notification.service'

/**
 * Host allow-list, mirrored from the server.
 *
 * The server is the authority — this copy exists so a typo is caught before a
 * round trip, not instead of one. Without it a mistyped Slack URL would POST
 * alert contents, including issue titles, to whatever host was pasted.
 */
const HOST_HINT: Record<string, { pattern: RegExp; message: string; placeholder: string }> = {
  slack: {
    pattern: /^hooks\.slack\.com$/i,
    message: 'A Slack webhook URL must be on hooks.slack.com',
    placeholder: 'https://hooks.slack.com/services/T000/B000/xxxxxxxx',
  },
  teams: {
    pattern: /(^|\.)(office|microsoft|office365|webhook\.office)\.com$/i,
    message: 'A Teams webhook URL must be on an Office 365 host',
    placeholder: 'https://outlook.office.com/webhook/…',
  },
}

const schema = z
  .object({
    channel: z.enum(['slack', 'teams']),
    label: z.string().min(1, 'Give this destination a name').max(80),
    url: z.string().optional(),
    minimumLevel: z.enum(['low', 'medium', 'high', 'critical']),
    enabled: z.enum(['true', 'false']),
    quietStart: z.string().optional(),
    quietEnd: z.string().optional(),
    timezone: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    // On edit the URL may be left blank to keep the stored one; the caller
    // passes `requireUrl` through the resolver context instead of duplicating
    // the schema, so this only enforces shape.
    if (!value.url) return
    if (!value.url.startsWith('https://')) {
      ctx.addIssue({ code: 'custom', path: ['url'], message: 'The URL must use https' })
      return
    }
    const host = (() => { try { return new URL(value.url).host } catch { return '' } })()
    const hint = HOST_HINT[value.channel]
    if (hint && !hint.pattern.test(host)) {
      ctx.addIssue({ code: 'custom', path: ['url'], message: hint.message })
    }
    if (Boolean(value.quietStart) !== Boolean(value.quietEnd)) {
      ctx.addIssue({
        code: 'custom', path: ['quietEnd'],
        message: 'Set both a start and an end, or neither',
      })
    }
  })

type WebhookForm = z.infer<typeof schema>

export function WebhookDialog({
  open,
  onClose,
  endpoint,
}: {
  open: boolean
  onClose: () => void
  endpoint?: WebhookEndpoint | null
}) {
  const save = useSaveWebhook()
  const toast = useToast()
  const isEditing = Boolean(endpoint)

  const {
    register, handleSubmit, watch, reset, setError,
    formState: { errors, isSubmitting },
  } = useForm<WebhookForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      channel: 'slack', label: '', url: '', minimumLevel: 'high', enabled: 'true',
      quietStart: '', quietEnd: '', timezone: 'Europe/Istanbul',
    },
  })

  const channel = watch('channel')

  useEffect(() => {
    if (!open) return
    reset({
      channel: (endpoint?.channel === 'teams' ? 'teams' : 'slack'),
      label: endpoint?.label ?? '',
      url: '',
      minimumLevel: endpoint?.minimumLevel ?? 'high',
      enabled: endpoint ? String(endpoint.enabled) as 'true' | 'false' : 'true',
      quietStart: endpoint?.quietHours?.start ?? '',
      quietEnd: endpoint?.quietHours?.end ?? '',
      timezone: endpoint?.quietHours?.timezone
        ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    })
  }, [open, endpoint, reset])

  const onSubmit = handleSubmit(async (values) => {
    if (!isEditing && !values.url) {
      setError('url', { message: 'Paste the webhook URL' })
      return
    }

    const quietHours = values.quietStart && values.quietEnd
      ? {
          start: values.quietStart,
          end: values.quietEnd,
          timezone: values.timezone || 'UTC',
        }
      : null

    try {
      await save.mutateAsync({
        id: endpoint?.id,
        input: {
          channel: values.channel,
          label: values.label,
          minimumLevel: values.minimumLevel,
          enabled: values.enabled === 'true',
          quietHours,
          // Omitted on edit means "keep the stored URL".
          ...(values.url ? { url: values.url } : {}),
        },
      })
      toast.success(
        isEditing ? 'Destination updated' : 'Destination added',
        'Send a test message to confirm it is wired correctly.',
      )
      onClose()
    } catch (error) {
      setError('url', {
        message: error instanceof Error ? error.message : 'Could not save this destination',
      })
    }
  })

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEditing ? 'Edit destination' : 'Add delivery destination'}
      description="Alerts at or above the severity floor are posted here. The URL is encrypted at rest and never shown again."
      footer={
        <>
          <DialogButton variant="ghost" type="button" onClick={onClose}>Cancel</DialogButton>
          <DialogButton type="submit" form="webhook-form" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : isEditing ? 'Save changes' : 'Add destination'}
          </DialogButton>
        </>
      }
    >
      <form id="webhook-form" onSubmit={onSubmit} className="space-y-4">
        <SelectField
          label="Channel"
          options={[
            { value: 'slack', label: 'Slack' },
            { value: 'teams', label: 'Microsoft Teams' },
          ]}
          error={errors.channel?.message}
          {...register('channel')}
        />

        <TextField
          label="Name"
          placeholder={channel === 'slack' ? '#release-risk' : 'Delivery / Alerts'}
          hint="Shown in the destination list; it does not have to match the channel name."
          error={errors.label?.message}
          {...register('label')}
        />

        <TextField
          label={isEditing ? 'Webhook URL (leave blank to keep the current one)' : 'Webhook URL'}
          type="url"
          autoComplete="off"
          placeholder={HOST_HINT[channel]?.placeholder}
          hint={
            isEditing
              ? `Currently ${endpoint?.urlHint}. Paste a new URL only if it changed.`
              : 'Create it in the channel’s Incoming Webhooks settings.'
          }
          error={errors.url?.message}
          {...register('url')}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Severity floor"
            hint="Only alerts at or above this level are delivered."
            options={[
              { value: 'critical', label: 'Critical only' },
              { value: 'high', label: 'High and above' },
              { value: 'medium', label: 'Medium and above' },
              { value: 'low', label: 'Everything' },
            ]}
            error={errors.minimumLevel?.message}
            {...register('minimumLevel')}
          />
          <SelectField
            label="Status"
            options={[
              { value: 'true', label: 'Active' },
              { value: 'false', label: 'Paused' },
            ]}
            {...register('enabled')}
          />
        </div>

        <fieldset className="rounded-lg border border-[#1E2D4A] p-3.5">
          <legend className="px-1 text-xs font-medium text-[#E2E8F0]">Quiet hours</legend>
          <p className="text-[11px] text-[#64748B] leading-relaxed mb-3">
            Delivery is suppressed in this window. Alerts still appear in the app, so nothing is
            lost — they simply do not page anyone overnight.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <TextField label="From" type="time" error={errors.quietStart?.message} {...register('quietStart')} />
            <TextField label="To" type="time" error={errors.quietEnd?.message} {...register('quietEnd')} />
            <TextField label="Timezone" placeholder="Europe/Istanbul" {...register('timezone')} />
          </div>
        </fieldset>
      </form>
    </Dialog>
  )
}
