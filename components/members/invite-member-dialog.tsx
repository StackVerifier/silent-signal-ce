'use client'

import { useEffect, useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@/lib/forms/zod-resolver'
import { z } from 'zod'
import { Send } from 'lucide-react'
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
      await invite.mutateAsync({
        email: values.email,
        roleId: values.roleId as RoleId,
        workspaceId: values.workspaceId,
        teamId: values.teamId || undefined,
      })
      toast.success(
        'Invitation sent',
        `${values.email} will receive a link that expires in ${organization?.settings.invitationExpiryDays ?? 7} days.`,
      )
      onClose()
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
      title="Invite member"
      description="They receive an email invitation and arrive with the workspace, team and role already assigned."
      footer={
        <>
          <DialogButton variant="ghost" type="button" onClick={onClose}>
            Cancel
          </DialogButton>
          <DialogButton type="submit" form="invite-member-form" disabled={isSubmitting}>
            <Send aria-hidden="true" className="w-3.5 h-3.5" />
            {isSubmitting ? 'Sending…' : 'Send invitation'}
          </DialogButton>
        </>
      }
    >
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
    </Dialog>
  )
}
