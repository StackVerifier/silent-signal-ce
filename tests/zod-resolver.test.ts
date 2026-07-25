import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { zodResolver } from '@/lib/forms/zod-resolver'

const options = {} as never

describe('zodResolver', () => {
  const schema = z.object({
    email: z.string().email('Enter a valid email'),
    password: z.string().min(10, 'Use at least 10 characters'),
  })

  it('returns parsed values and no errors when the input is valid', async () => {
    const result = await zodResolver(schema)(
      { email: 'a@b.test', password: 'a long enough one' }, undefined, options,
    )
    expect(result.errors).toEqual({})
    expect(result.values).toEqual({ email: 'a@b.test', password: 'a long enough one' })
  })

  it('maps each issue onto its own field', async () => {
    const result = await zodResolver(schema)({ email: 'nope', password: 'short' }, undefined, options)
    expect(result.errors.email?.message).toBe('Enter a valid email')
    expect(result.errors.password?.message).toBe('Use at least 10 characters')
  })

  it('returns no values on failure', async () => {
    // Handing back partially parsed data invites a submit handler to act on a
    // form that did not validate.
    const result = await zodResolver(schema)({ email: 'nope', password: 'short' }, undefined, options)
    expect(result.values).toEqual({})
  })

  it('honours the path a superRefine assigns', async () => {
    // This is what puts "The two passwords do not match" under the second
    // field instead of at the top of the form.
    const confirmed = z
      .object({ password: z.string(), confirm: z.string() })
      .refine((value) => value.password === value.confirm, {
        path: ['confirm'],
        message: 'The two passwords do not match',
      })
    const result = await zodResolver(confirmed)({ password: 'a', confirm: 'b' }, undefined, options)
    expect(result.errors.confirm?.message).toBe('The two passwords do not match')
    expect(result.errors.password).toBeUndefined()
  })

  it('keeps the first issue for a field, not the last', async () => {
    // Later issues are usually consequences of the first; showing them would
    // only add noise under the input.
    const chained = z.object({ url: z.string() }).superRefine((value, ctx) => {
      ctx.addIssue({ code: 'custom', path: ['url'], message: 'first' })
      ctx.addIssue({ code: 'custom', path: ['url'], message: 'second' })
    })
    const result = await zodResolver(chained)({ url: 'x' }, undefined, options)
    expect(result.errors.url?.message).toBe('first')
  })

  it('places a nested issue under its parent rather than at a flattened key', async () => {
    const nested = z.object({ quietHours: z.object({ start: z.string().min(1, 'Required') }) })
    const result = await zodResolver(nested)({ quietHours: { start: '' } }, undefined, options)
    expect(result.errors.quietHours?.start?.message).toBe('Required')
  })

  it('ignores a form-level issue with no path rather than crashing', async () => {
    const formLevel = z.object({ a: z.string() }).superRefine((_value, ctx) => {
      ctx.addIssue({ code: 'custom', message: 'whole form is wrong' })
    })
    const result = await zodResolver(formLevel)({ a: 'x' }, undefined, options)
    expect(result.errors).toEqual({})
  })

  it('supports an async refinement', async () => {
    const asyncSchema = z.object({ name: z.string() }).refine(
      async (value) => value.name !== 'taken',
      { path: ['name'], message: 'That name is taken' },
    )
    expect((await zodResolver(asyncSchema)({ name: 'taken' }, undefined, options)).errors.name?.message)
      .toBe('That name is taken')
    expect((await zodResolver(asyncSchema)({ name: 'free' }, undefined, options)).errors).toEqual({})
  })
})
