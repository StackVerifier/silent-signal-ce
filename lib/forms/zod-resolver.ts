import type { FieldErrors, FieldValues, Resolver } from 'react-hook-form'
import type { ZodType } from 'zod'

/**
 * React Hook Form resolver for a Zod schema.
 *
 * This replaces `@hookform/resolvers`, which is compiled against a specific
 * Zod minor and therefore has to be upgraded in lockstep with it — a coupling
 * that broke the build when the two drifted apart. The adapter itself is about
 * twenty lines, so owning it costs less than keeping the versions aligned.
 *
 * `safeParseAsync` rather than `safeParse`: a schema may grow an async refine,
 * and discovering that through a thrown "async in sync parse" at runtime is a
 * poor trade for the microtask.
 */
export function zodResolver<TInput extends FieldValues, TOutput = TInput>(
  schema: ZodType<TOutput, TInput>,
): Resolver<TInput, unknown, TOutput> {
  return async (values) => {
    const result = await schema.safeParseAsync(values)
    if (result.success) return { values: result.data, errors: {} }

    const errors: FieldErrors<TInput> = {}
    for (const issue of result.error.issues) {
      if (issue.path.length === 0) continue
      // The first issue for a field is the one shown; later ones are usually
      // consequences of the first and would only add noise under the input.
      assignFirst(errors, issue.path.map(String), {
        type: issue.code ?? 'validation',
        message: issue.message,
      })
    }

    // Empty values on failure: handing back partially-parsed data invites a
    // submit handler to act on a form that did not validate.
    return { values: {}, errors }
  }
}

/** Writes `error` at `path`, creating containers, and never overwriting. */
function assignFirst(target: Record<string, unknown>, path: string[], error: unknown): void {
  let node = target
  for (let i = 0; i < path.length - 1; i += 1) {
    const key = path[i]
    if (typeof node[key] !== 'object' || node[key] === null) node[key] = {}
    node = node[key] as Record<string, unknown>
  }
  const leaf = path[path.length - 1]
  if (node[leaf] === undefined) node[leaf] = error
}
