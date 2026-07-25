'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { KeyRound } from 'lucide-react'
import { Dialog, DialogButton } from '@/components/ui/dialog'
import { TextField } from '@/components/forms/fields'
import { useToast } from '@/components/ui/toast'
import { sessionService } from '@/services/session.service'
import { ApiError } from '@/services/http'

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    // Length is what actually matters; composition rules push people towards
    // `Password1!` and no further.
    newPassword: z.string().min(10, 'Use at least 10 characters'),
    confirmPassword: z.string().min(1, 'Repeat the new password'),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'The two passwords do not match',
  })

type PasswordForm = z.infer<typeof schema>

export function ChangePasswordDialog({
  open,
  onClose,
  /** Set when the account still uses a handed-out password. */
  required = false,
}: {
  open: boolean
  onClose: () => void
  required?: boolean
}) {
  const toast = useToast()
  const {
    register, handleSubmit, reset, setError,
    formState: { errors, isSubmitting },
  } = useForm<PasswordForm>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  useEffect(() => {
    if (open) reset({ currentPassword: '', newPassword: '', confirmPassword: '' })
  }, [open, reset])

  const onSubmit = handleSubmit(async (values) => {
    try {
      await sessionService.changePassword(values.currentPassword, values.newPassword)
      toast.success('Password changed', 'Use it the next time you sign in.')
      onClose()
      // The session carries mustChangePassword; reload so the banner clears.
      if (required) window.location.reload()
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Could not change the password'
      // A wrong current password belongs on that field, not as a page error.
      setError(message.toLowerCase().includes('current') ? 'currentPassword' : 'newPassword', {
        message,
      })
    }
  })

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Change password"
      description={
        required
          ? 'This account still uses the password it was created with. Set your own before using it further.'
          : 'Your current password is required — it is what stops a borrowed, unlocked browser from becoming a permanent takeover.'
      }
      size="sm"
      footer={
        <>
          {!required && (
            <DialogButton variant="ghost" type="button" onClick={onClose}>Cancel</DialogButton>
          )}
          <DialogButton type="submit" form="change-password-form" disabled={isSubmitting}>
            <KeyRound aria-hidden="true" className="w-3.5 h-3.5" />
            {isSubmitting ? 'Saving…' : 'Change password'}
          </DialogButton>
        </>
      }
    >
      <form id="change-password-form" onSubmit={onSubmit} className="space-y-4">
        <TextField
          label="Current password"
          type="password"
          autoComplete="current-password"
          error={errors.currentPassword?.message}
          {...register('currentPassword')}
        />
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          hint="At least 10 characters. A passphrase beats a short complex string."
          error={errors.newPassword?.message}
          {...register('newPassword')}
        />
        <TextField
          label="Repeat new password"
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
      </form>
    </Dialog>
  )
}
