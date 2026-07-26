'use client'

import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@/lib/forms/zod-resolver'
import { z } from 'zod'
import { AlertTriangle, Check, Copy, Send } from 'lucide-react'
import { Dialog, DialogButton } from '@/components/ui/dialog'
import { SelectField, TextField } from '@/components/forms/fields'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/lib/auth-context'
import { useInviteMember, useTeams, useWorkspaces } from '@/lib/query/hooks'
import { assignableRoles } from '@/lib/rbac/roles'
import type { RoleId } from '@/lib/rbac/types'

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  roleId: z.string().min(1, 'Choose a role'),
  workspaceId: z.string().min(1, 'Choose a workspace'),
  teamId: z.string().optional(),
})

type InviteForm = z.infer<typeof schema>

/**
 * Invitation form.
 *
 * The role list is derived from the actor's own tier, so the UI cannot even
 * offer a privilege escalation — an admin can never invite an owner.
 */
export function InviteMemberDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { role, workspace, organization } = useAuth()
  const invite = useInviteMember()
  const toast = useToast()
  const [issued, setIssued] = useState<{ email: string; url: string } | null>(null)

  // Clearing the issued link on close stops a reopened dialog from showing the
  // previous invitation's link.
  const close = () => { setIssued(null); onClose() }
  const workspaces = useWorkspaces()
  const teams = useTeams()

  const roleOptions = useMemo(
    () => (role ? assignableRoles(role.id).map((item) => ({ value: item.id, label: item.name })) : []),
    [role],
  )
  const workspaceOptions = (workspaces.data ?? [])
    .filter((item) => item.status === 'active')
    .map((item) => ({ value: item.id, label: item.name }))

  const {
    register, handleSubmit, control, reset, setError,
    formState: { errors, isSubmitting },
  } = useForm<InviteForm>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', roleId: 'developer', workspaceId: workspace?.id ?? '', teamId: '' },
  })

  // `useWatch` subscribes to one field; `watch()` returns a fresh function each
  // render, which the compiler cannot memoize safely.
  const selectedWorkspace = useWatch({ control, name: 'workspaceId' })
  const teamOptions = (teams.data ?? [])
    .filter((team) => team.workspaceId === selectedWorkspace)
    .map((team) => ({ value: team.id, label: team.name }))

  useEffect(() => {
    if (open) reset({ email: '', roleId: 'developer', workspaceId: workspace?.id ?? '', teamId: '' })
  }, [open, reset, workspace?.id])

  const onSubmit = handleSubmit(async (values) => {
    try {
      const created = await invite.mutateAsync({
        email: values.email,
        roleId: values.roleId as RoleId,
        workspaceId: values.workspaceId,
        teamId: values.teamId || undefined,
      })
      // The link is shown rather than emailed, because there is no email
      // provider configured. Claiming "invitation sent" while nothing was sent
      // is how an invited person ends up waiting for a message that will never
      // arrive.
      setIssued({ email: values.email, url: created.acceptUrl })
    } catch (error) {
      // Duplicate email and already-a-member are field-level problems, not
      // page-level failures, so they belong on the input.
      const message = error instanceof Error ? error.message : 'Could not send the invitation'
      setError('email', { message })
    }
  })

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={issued ? 'Invitation ready' : 'Invite member'}
      description={
        issued
          ? 'Send this link to them. It is shown once and cannot be recovered afterwards.'
          : 'They arrive with the workspace, team and role already assigned.'
      }
      footer={
        issued ? (
          <DialogButton type="button" onClick={close}>Done</DialogButton>
        ) : (
          <>
            <DialogButton variant="ghost" type="button" onClick={close}>
              Cancel
            </DialogButton>
            <DialogButton type="submit" form="invite-member-form" disabled={isSubmitting}>
              <Send aria-hidden="true" className="w-3.5 h-3.5" />
              {isSubmitting ? 'Creating…' : 'Create invitation'}
            </DialogButton>
          </>
        )
      }
    >
      {issued ? (
        <InviteLink
          email={issued.email}
          url={issued.url}
          expiryDays={organization?.settings.invitationExpiryDays ?? 7}
          onCopied={() => toast.success('Link copied', 'Send it to them however you like.')}
        />
      ) : (
      <form id="invite-member-form" onSubmit={onSubmit} className="space-y-4">
        <TextField
          label="Email address"
          type="email"
          autoComplete="off"
          placeholder="name@company.com"
          error={errors.email?.message}
          {...register('email')}
        />

        <SelectField
          label="Role"
          hint="You can only assign roles below your own."
          options={roleOptions}
          error={errors.roleId?.message}
          {...register('roleId')}
        />

        <SelectField
          label="Workspace"
          placeholder="Select a workspace"
          options={workspaceOptions}
          error={errors.workspaceId?.message}
          {...register('workspaceId')}
        />

        <SelectField
          label="Team"
          placeholder={teamOptions.length ? 'No team (assign later)' : 'No teams in this workspace'}
          hint="Optional — a member can be added to a team at any time."
          options={teamOptions}
          error={errors.teamId?.message}
          disabled={teamOptions.length === 0}
          {...register('teamId')}
        />
      </form>
      )}
    </Dialog>
  )
}

/**
 * The generated link, shown once.
 *
 * Until an email provider is configured the inviter is the delivery mechanism,
 * so the link has to be visible and easy to copy. It is deliberately not
 * recoverable later: only a hash of the token is stored, and a list endpoint
 * that could reproduce invitation links would be a standing way in.
 */
function InviteLink({
  email, url, expiryDays, onCopied,
}: {
  email: string
  url: string
  expiryDays: number
  onCopied: () => void
}) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      onCopied()
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access can be refused; the field is selectable either way.
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-[#94A3B8]">
        Invitation for <span className="text-[#E2E8F0] font-medium">{email}</span>, valid for{' '}
        {expiryDays} day{expiryDays === 1 ? '' : 's'}.
      </p>

      <div className="flex gap-2">
        <input
          readOnly
          value={url}
          onFocus={(event) => event.currentTarget.select()}
          aria-label="Invitation link"
          className="flex-1 min-w-0 h-9 px-2.5 rounded-lg bg-[#070B18] border border-[#1E2D4A] font-mono text-[11px] text-[#E2E8F0]"
        />
        <button
          type="button"
          onClick={copy}
          className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-[#6C63FF] hover:bg-[#5B52CC] text-white text-xs font-medium transition-colors"
        >
          {copied
            ? <Check aria-hidden="true" className="w-3.5 h-3.5" />
            : <Copy aria-hidden="true" className="w-3.5 h-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <p className="flex items-start gap-2 text-[10px] text-[#F59E0B] bg-[#F59E0B]/5 border border-[#F59E0B]/20 rounded-lg px-2.5 py-2">
        <AlertTriangle aria-hidden="true" className="w-3 h-3 shrink-0 mt-0.5" />
        Anyone holding this link can join as that role. Send it directly to
        {' '}{email}, and nowhere else. It cannot be shown again — use Resend to
        issue a new one, which invalidates this.
      </p>
    </div>
  )
}
