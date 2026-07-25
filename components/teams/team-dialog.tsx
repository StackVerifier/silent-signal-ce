'use client'

import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogButton } from '@/components/ui/dialog'
import { SelectField, TextAreaField, TextField } from '@/components/forms/fields'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/lib/auth-context'
import { useCreateTeam, useMembers, useUpdateTeam, useWorkspaces } from '@/lib/query/hooks'
import type { Team } from '@/lib/rbac/types'

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(60, 'Keep the name under 60 characters'),
  workspaceId: z.string().min(1, 'Choose a workspace'),
  description: z.string().max(160, 'Keep the description under 160 characters').optional(),
  releaseManagerId: z.string().optional(),
  qaLeadId: z.string().optional(),
})

type TeamForm = z.infer<typeof schema>

/** Create and edit share a form: the fields and validation are identical. */
export function TeamDialog({
  open,
  onClose,
  team,
}: {
  open: boolean
  onClose: () => void
  team?: Team | null
}) {
  const { workspace } = useAuth()
  const createTeam = useCreateTeam()
  const updateTeam = useUpdateTeam()
  const toast = useToast()
  const workspaces = useWorkspaces()
  const members = useMembers()

  const isEditing = Boolean(team)

  const workspaceOptions = (workspaces.data ?? [])
    .filter((item) => item.status === 'active')
    .map((item) => ({ value: item.id, label: item.name }))

  const memberOptions = useMemo(
    () =>
      (members.data?.data ?? [])
        .filter((member) => member.status === 'approved')
        .map((member) => ({ value: member.id, label: `${member.name} · ${member.email}` })),
    [members.data],
  )

  const {
    register, handleSubmit, reset, setError,
    formState: { errors, isSubmitting },
  } = useForm<TeamForm>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', workspaceId: workspace?.id ?? '', description: '' },
  })

  useEffect(() => {
    if (!open) return
    reset({
      name: team?.name ?? '',
      workspaceId: team?.workspaceId ?? workspace?.id ?? '',
      description: team?.description ?? '',
      releaseManagerId: team?.releaseManagerId ?? '',
      qaLeadId: team?.qaLeadId ?? '',
    })
  }, [open, team, reset, workspace?.id])

  const onSubmit = handleSubmit(async (values) => {
    const payload = {
      name: values.name,
      workspaceId: values.workspaceId,
      description: values.description || undefined,
      releaseManagerId: values.releaseManagerId || undefined,
      qaLeadId: values.qaLeadId || undefined,
    }

    try {
      if (team) {
        await updateTeam.mutateAsync({ teamId: team.id, patch: payload })
        toast.success('Team updated', `${values.name} has been saved.`)
      } else {
        await createTeam.mutateAsync(payload)
        toast.success('Team created', `${values.name} is ready for members.`)
      }
      onClose()
    } catch (error) {
      // A duplicate name is a problem with the name field specifically.
      setError('name', {
        message: error instanceof Error ? error.message : 'Could not save the team',
      })
    }
  })

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEditing ? 'Edit team' : 'Create team'}
      description="Teams group members inside a workspace and carry release and QA ownership."
      footer={
        <>
          <DialogButton variant="ghost" type="button" onClick={onClose}>
            Cancel
          </DialogButton>
          <DialogButton type="submit" form="team-form" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : isEditing ? 'Save changes' : 'Create team'}
          </DialogButton>
        </>
      }
    >
      <form id="team-form" onSubmit={onSubmit} className="space-y-4">
        <TextField
          label="Team name"
          placeholder="Backend Team"
          error={errors.name?.message}
          {...register('name')}
        />

        <SelectField
          label="Workspace"
          placeholder="Select a workspace"
          options={workspaceOptions}
          error={errors.workspaceId?.message}
          {...register('workspaceId')}
        />

        <TextAreaField
          label="Description"
          placeholder="What this team owns"
          hint="Optional. Shown on the team card."
          error={errors.description?.message}
          {...register('description')}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Release manager"
            placeholder="Unassigned"
            options={memberOptions}
            error={errors.releaseManagerId?.message}
            {...register('releaseManagerId')}
          />
          <SelectField
            label="QA lead"
            placeholder="Unassigned"
            options={memberOptions}
            error={errors.qaLeadId?.message}
            {...register('qaLeadId')}
          />
        </div>
      </form>
    </Dialog>
  )
}
