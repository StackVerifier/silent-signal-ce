'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@/lib/forms/zod-resolver'
import { z } from 'zod'
import { AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react'
import { TextField } from '@/components/forms/fields'
import { getRoleLabel } from '@/lib/rbac/roles'
import type { RoleId } from '@/lib/rbac/types'

/**
 * Accepting an invitation.
 *
 * The last missing step of an invitation-only product: the invitation existed,
 * the token existed, and there was nowhere to redeem it — so an invited person
 * could not get in at all.
 *
 * The email is fixed by the invitation and shown read-only. Letting someone
 * change it would turn a link sent to one address into an account for another,
 * which is the whole security property an invitation has.
 */

const schema = z
  .object({
    name: z.string().trim().min(1, 'Enter your name'),
    // Length is what matters; the server enforces the same rule.
    password: z.string().min(10, 'Use at least 10 characters'),
    confirm: z.string().min(1, 'Repeat the password'),
  })
  .refine((value) => value.password === value.confirm, {
    path: ['confirm'],
    message: 'The two passwords do not match',
  })

type AcceptForm = z.infer<typeof schema>

interface Preview {
  email: string
  organizationName: string
  roleId: string
  invitedBy: string
}

function AcceptInvitation() {
  const router = useRouter()
  const token = useSearchParams().get('token') ?? ''

  const [preview, setPreview] = useState<Preview | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // A missing token is knowable during render; only the fetch result needs an
  // effect, and writing both from one would cost a second render.
  const loadError = token ? fetchError : 'This link is missing its invitation token.'

  const {
    register, handleSubmit, setError,
    formState: { errors, isSubmitting },
  } = useForm<AcceptForm>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', password: '', confirm: '' },
  })

  useEffect(() => {
    if (!token) return
    let cancelled = false
    fetch(`/api/invitations/accept?token=${encodeURIComponent(token)}`)
      .then(async (response) => {
        const body = await response.json().catch(() => ({}))
        if (cancelled) return
        if (!response.ok) setFetchError(body.error ?? 'That invitation link is not valid any more')
        else setPreview(body as Preview)
      })
      .catch(() => { if (!cancelled) setFetchError('Could not reach the server.') })
    return () => { cancelled = true }
  }, [token])

  const onSubmit = handleSubmit(async (values) => {
    const response = await fetch('/api/invitations/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, name: values.name, password: values.password }),
    })
    const body = await response.json().catch(() => ({}))

    if (!response.ok) {
      setError('password', { message: body.error ?? 'Could not accept the invitation' })
      return
    }
    setDone(true)
    // A moment on the confirmation, then the login screen — signing in proves
    // the password works before they come to depend on it.
    setTimeout(() => router.push('/auth/login'), 1800)
  })

  if (loadError) {
    return (
      <Panel>
        <div className="flex items-start gap-3">
          <AlertTriangle aria-hidden="true" className="w-5 h-5 text-[#F59E0B] shrink-0 mt-0.5" />
          <div>
            <h1 className="text-sm font-semibold text-[#E2E8F0]">Invitation unavailable</h1>
            <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">{loadError}</p>
            <p className="text-xs text-[#64748B] mt-3">
              Ask whoever invited you to send a new link — invitations expire, and
              each one can only be used once.
            </p>
            <Link href="/auth/login" className="inline-block text-xs text-[#6C63FF] hover:text-[#8B85FF] mt-3">
              Back to sign in
            </Link>
          </div>
        </div>
      </Panel>
    )
  }

  if (done) {
    return (
      <Panel>
        <div className="flex items-start gap-3">
          <CheckCircle2 aria-hidden="true" className="w-5 h-5 text-[#22C55E] shrink-0 mt-0.5" />
          <div>
            <h1 className="text-sm font-semibold text-[#E2E8F0]">Account created</h1>
            <p className="text-xs text-[#94A3B8] mt-1">Taking you to the sign-in screen…</p>
          </div>
        </div>
      </Panel>
    )
  }

  if (!preview) {
    return (
      <Panel>
        <div className="h-24 flex items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#1E2D4A] border-t-[#6C63FF]" />
        </div>
      </Panel>
    )
  }

  return (
    <Panel>
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck aria-hidden="true" className="w-4 h-4 text-[#6C63FF]" />
        <h1 className="text-base font-semibold text-[#E2E8F0]">
          Join {preview.organizationName}
        </h1>
      </div>
      <p className="text-xs text-[#64748B] leading-relaxed">
        {preview.invitedBy} invited you as{' '}
        <span className="text-[#E2E8F0]">{getRoleLabel(preview.roleId as RoleId)}</span>.
        Choose a password to finish setting up your account.
      </p>

      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <div>
          <label className="block text-[11px] font-medium text-[#94A3B8] mb-1.5">Email</label>
          <input
            value={preview.email}
            readOnly
            aria-readonly="true"
            className="w-full h-10 px-3 rounded-lg bg-[#070B18] border border-[#1E2D4A] text-xs text-[#64748B] cursor-not-allowed"
          />
          <p className="text-[10px] text-[#64748B] mt-1">
            Fixed by the invitation — it is what makes this link yours.
          </p>
        </div>

        <TextField
          label="Your name"
          autoComplete="name"
          error={errors.name?.message}
          {...register('name')}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 10 characters. A passphrase beats a short complex string."
          error={errors.password?.message}
          {...register('password')}
        />
        <TextField
          label="Repeat password"
          type="password"
          autoComplete="new-password"
          error={errors.confirm?.message}
          {...register('confirm')}
        />

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-10 rounded-lg bg-[#6C63FF] hover:bg-[#5B52CC] disabled:opacity-60 text-white text-sm font-medium transition-colors"
        >
          {isSubmitting ? 'Creating your account…' : 'Accept invitation'}
        </button>
      </form>
    </Panel>
  )
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-[#070B18] px-4">
      <div className="w-full max-w-sm rounded-xl border border-[#1E2D4A] bg-[#0F1824] p-6">
        {children}
      </div>
    </div>
  )
}

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={<Panel><div className="h-24" /></Panel>}>
      <AcceptInvitation />
    </Suspense>
  )
}
