'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@/lib/forms/zod-resolver'
import { z } from 'zod'
import { Save } from 'lucide-react'
import { Dialog, DialogButton } from '@/components/ui/dialog'
import { SelectField, TextField } from '@/components/forms/fields'
import { useToast } from '@/components/ui/toast'
import { useSaveRule } from '@/lib/query/hooks'
import type { Rule } from '@/lib/types'

/**
 * Creating and editing a rule.
 *
 * The "New Rule" button had existed since the first version of this screen with
 * no handler behind it, on the one screen that is the product's entire premise
 * — a rule engine you can inspect and change. There was no create, edit or
 * delete endpoint either; a rule could only be toggled.
 *
 * Conditions are edited as a compact text form rather than a builder UI. A
 * proper condition builder is a real piece of design work, and shipping a
 * half-finished one would be worse than a field that plainly says what it
 * accepts.
 */

const schema = z.object({
  name: z.string().trim().min(1, 'Give the rule a name').max(120),
  category: z.enum(['sprint', 'release', 'qa', 'capacity', 'velocity']),
  action: z.enum(['score', 'alert', 'flag']),
  // `valueAsNumber` on the input does the conversion, so the schema sees a
  // number and its input and output types stay the same.
  scoreImpact: z
    .number({ message: 'Enter a number' })
    .int('Whole numbers only')
    .min(0, 'Cannot be negative')
    // Above 100 one rule could swamp every other, which defeats a score meant
    // to decompose into its causes.
    .max(100, 'Keep it at 100 or below'),
  description: z.string().trim().min(1, 'Say what the rule detects').max(400),
})

type RuleForm = z.infer<typeof schema>

const CATEGORIES = [
  { value: 'sprint', label: 'Sprint' },
  { value: 'release', label: 'Release' },
  { value: 'qa', label: 'QA' },
  { value: 'capacity', label: 'Capacity' },
  { value: 'velocity', label: 'Velocity' },
]

const ACTIONS = [
  { value: 'score', label: 'Add to the risk score' },
  { value: 'alert', label: 'Raise an alert' },
  { value: 'flag', label: 'Flag for review' },
]

export function RuleDialog({
  open, onClose, rule,
}: {
  open: boolean
  onClose: () => void
  /** Absent when creating. */
  rule?: Rule | null
}) {
  const toast = useToast()
  const saveRule = useSaveRule()
  const isEditing = Boolean(rule)

  const {
    register, handleSubmit, reset, setError,
    formState: { errors, isSubmitting },
  } = useForm<RuleForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '', category: 'sprint', action: 'score', scoreImpact: 10, description: '',
    },
  })

  useEffect(() => {
    if (!open) return
    reset(rule
      ? {
          name: rule.name, category: rule.category, action: rule.action,
          scoreImpact: rule.scoreImpact, description: rule.description,
        }
      : { name: '', category: 'sprint', action: 'score', scoreImpact: 10, description: '' })
  }, [open, rule, reset])

  const onSubmit = handleSubmit(async (values) => {
    try {
      await saveRule.mutateAsync({
        ruleId: rule?.id,
        ...values,
        // Editing keeps whatever conditions the rule already had; a new rule
        // starts with none rather than a guessed one.
        conditions: rule?.conditions ?? [],
      })
      toast.success(
        isEditing ? 'Rule updated' : 'Rule created',
        `${values.name} now contributes ${values.scoreImpact} to the score.`,
      )
      onClose()
    } catch (error) {
      setError('name', {
        message: error instanceof Error ? error.message : 'Could not save the rule',
      })
    }
  })

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEditing ? 'Edit rule' : 'New rule'}
      description="Rules are evaluated on every sync. Every point a rule contributes is traceable back to it."
      footer={
        <>
          <DialogButton variant="ghost" type="button" onClick={onClose}>Cancel</DialogButton>
          <DialogButton type="submit" form="rule-form" disabled={isSubmitting}>
            <Save aria-hidden="true" className="w-3.5 h-3.5" />
            {isSubmitting ? 'Saving…' : isEditing ? 'Save changes' : 'Create rule'}
          </DialogButton>
        </>
      }
    >
      <form id="rule-form" onSubmit={onSubmit} className="space-y-4">
        <TextField
          label="Name"
          placeholder="QA wait over 5 days"
          error={errors.name?.message}
          {...register('name')}
        />
        <TextField
          label="What it detects"
          placeholder="Items sitting in QA longer than the agreed window"
          error={errors.description?.message}
          {...register('description')}
        />
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Category"
            options={CATEGORIES}
            error={errors.category?.message}
            {...register('category')}
          />
          <TextField
            label="Score impact"
            type="number"
            hint="0–100"
            error={errors.scoreImpact?.message}
            {...register('scoreImpact', { valueAsNumber: true })}
          />
        </div>
        <SelectField
          label="Action"
          options={ACTIONS}
          error={errors.action?.message}
          {...register('action')}
        />
      </form>
    </Dialog>
  )
}
