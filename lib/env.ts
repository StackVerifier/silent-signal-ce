import { z } from 'zod'

/**
 * Runtime-validated environment.
 *
 * Only NEXT_PUBLIC_* values belong here — they are inlined into the client
 * bundle. Integration credentials (Jira tokens, Slack signing secrets) must
 * never appear in this file; they are read server-side in route handlers via
 * `serverEnv` below, which throws if imported from client code.
 */
const clientSchema = z.object({
  /**
   * 'mock'  — services resolve from the in-memory fixtures (current default)
   * 'live'  — services call the API through `services/http.ts`
   */
  NEXT_PUBLIC_API_MODE: z.enum(['mock', 'live']).default('mock'),
  NEXT_PUBLIC_API_BASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
})

const parsed = clientSchema.safeParse({
  NEXT_PUBLIC_API_MODE: process.env.NEXT_PUBLIC_API_MODE,
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
})

if (!parsed.success) {
  // Fail loudly at boot rather than mysteriously at the first fetch.
  throw new Error(
    `Invalid public environment:\n${parsed.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')}`,
  )
}

export const env = parsed.data

export const isMockMode = env.NEXT_PUBLIC_API_MODE === 'mock'

/**
 * Server-only environment. Importing this from a client component is a bug —
 * the guard makes that a hard failure instead of a silent secret leak.
 */
const serverSchema = z.object({
  JIRA_CLIENT_ID: z.string().min(1).optional(),
  JIRA_CLIENT_SECRET: z.string().min(1).optional(),
  JIRA_WEBHOOK_SECRET: z.string().min(1).optional(),
  SLACK_SIGNING_SECRET: z.string().min(1).optional(),
  SLACK_BOT_TOKEN: z.string().min(1).optional(),
  TEAMS_WEBHOOK_SECRET: z.string().min(1).optional(),
  SESSION_SECRET: z.string().min(32).optional(),
  DATABASE_URL: z.string().url().optional(),
})

export function serverEnv() {
  if (typeof window !== 'undefined') {
    throw new Error('serverEnv() must not be called in the browser')
  }
  return serverSchema.parse(process.env)
}
