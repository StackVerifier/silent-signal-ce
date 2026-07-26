'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@/lib/forms/zod-resolver'
import { z } from 'zod'
import { Plus } from 'lucide-react'
import { Dialog, DialogButton } from '@/components/ui/dialog'
import { TextField } from '@/components/forms/fields'
import { useToast } from '@/components/ui/toast'
import { useCreateWorkspace } from '@/lib/query/hooks'

const schema = z.object({
  name: z.string().trim().min(1, 'Give the workspace a name').max(80),
  description: z.string().trim().max(280).optional(),
})

type WorkspaceForm = z.infer<typeof schema>

/**
 * Creating a workspace.
 *
 * The switcher had offered this since the beginning and the button did nothing
 * — no handler, no endpoint. A control that silently does nothing is worse than
 * an absent one, because the person clicking it concludes the product is
 * broken rather than that the feature is missing.
 */
export function CreateWorkspaceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast()
  const createWorkspace = useCreateWorkspace()
  const {
    register, handleSubmit, reset, setError,
    formState: { errors, isSubmitting },
  } = useForm<WorkspaceForm>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '' },
  })

  useEffect(() => {
    if (open) reset({ name: '', description: '' })
  }, [open, reset])

  const onSubmit = handleSubmit(async (values) => {
    try {
      const workspace = await createWorkspace.mutateAsync({
        name: values.name,
        description: values.description || undefined,
      })
      toast.success('Workspace created', `You have been added to ${workspace.name}.`)
      onClose()
    } catch (error) {
      // A duplicate name belongs on the field, not as a page-level failure.
      setError('name', {
        message: error instanceof Error ? error.message : 'Could not create the workspace',
      })
    }
  })

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Create workspace"
      description="A workspace holds its own delivery data, teams and integrations. You are added to it automatically."
      size="sm"
      footer={
        <>
          <DialogButton variant="ghost" type="button" onClick={onClose}>Cancel</DialogButton>
          <DialogButton type="submit" form="create-workspace-form" disabled={isSubmitting}>
            <Plus aria-hidden="true" className="w-3.5 h-3.5" />
            {isSubmitting ? 'Creating…' : 'Create workspace'}
          </DialogButton>
        </>
      }
    >
      <form id="create-workspace-form" onSubmit={onSubmit} className="space-y-4">
        <TextField
          label="Name"
          placeholder="Mobile Delivery"
          error={errors.name?.message}
          {...register('name')}
        />
        <TextField
          label="Description"
          placeholder="Optional — what this workspace covers"
          error={errors.description?.message}
          {...register('description')}
        />
      </form>
    </Dialog>
  )
}
