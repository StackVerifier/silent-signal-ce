'use client'

import { useId } from 'react'
import { cn } from '@/lib/utils'

const CONTROL =
  'w-full h-9 rounded-lg bg-[#0F1824] border border-[#1E2D4A] text-sm text-[#E2E8F0] placeholder-[#64748B] px-3 transition-colors focus:outline-none focus:border-[#6C63FF] disabled:opacity-50'

function FieldShell({
  id, label, hint, error, children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-medium text-[#E2E8F0]">
        {label}
      </label>
      {children}
      {/* Errors are announced, not just coloured. */}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-[11px] text-[#FCA5A5]">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[11px] text-[#64748B] leading-relaxed">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export function TextField({
  label, hint, error, className, ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string
  hint?: string
  error?: string
}) {
  const generated = useId()
  const id = props.id ?? generated
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <input
        {...props}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={cn(CONTROL, error && 'border-[#EF4444]/60', className)}
      />
    </FieldShell>
  )
}

export function TextAreaField({
  label, hint, error, className, ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string
  hint?: string
  error?: string
}) {
  const generated = useId()
  const id = props.id ?? generated
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <textarea
        {...props}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={cn(CONTROL, 'h-auto min-h-[72px] py-2 resize-y', error && 'border-[#EF4444]/60', className)}
      />
    </FieldShell>
  )
}

export function SelectField({
  label, hint, error, options, placeholder, className, ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
  hint?: string
  error?: string
  placeholder?: string
  options: { value: string; label: string; disabled?: boolean }[]
}) {
  const generated = useId()
  const id = props.id ?? generated
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <select
        {...props}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={cn(CONTROL, error && 'border-[#EF4444]/60', className)}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  )
}
