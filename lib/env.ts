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
  // Jira — mode A: API token (Basic auth, single service account)
  JIRA_BASE_URL: z.string().url().optional(),
  JIRA_EMAIL: z.string().email().optional(),
  JIRA_API_TOKEN: z.string().min(1).optional(),
  // Jira — mode B: OAuth 2.0 (3LO, per-customer consent)
  JIRA_CLIENT_ID: z.string().min(1).optional(),
  JIRA_CLIENT_SECRET: z.string().min(1).optional(),
  JIRA_REDIRECT_URI: z.string().url().optional(),
  JIRA_WEBHOOK_SECRET: z.string().min(1).optional(),

  SLACK_BOT_TOKEN: z.string().min(1).optional(),
  SLACK_SIGNING_SECRET: z.string().min(1).optional(),
  SLACK_WEBHOOK_URL: z.string().url().optional(),

  TEAMS_WEBHOOK_URL: z.string().url().optional(),
  TEAMS_WEBHOOK_SECRET: z.string().min(1).optional(),

  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASSWORD: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).optional(),

  SESSION_SECRET: z.string().min(32).optional(),
  DATABASE_URL: z.string().url().optional(),
})

export type ServerEnv = z.infer<typeof serverSchema>

export function serverEnv(): ServerEnv {
  if (typeof window !== 'undefined') {
    throw new Error('serverEnv() must not be called in the browser')
  }
  return serverSchema.parse(process.env)
}

export type JiraAuth =
  | { mode: 'api-token'; baseUrl: string; email: string; apiToken: string }
  | { mode: 'oauth'; clientId: string; clientSecret: string; redirectUri: string }

/**
 * Resolves which Jira auth mode is configured, rejecting half-filled setups.
 *
 * A partially configured integration is the failure that costs the most time to
 * debug — it looks connected and then 401s on the first real call, so it is
 * caught here instead.
 */
export function resolveJiraAuth(source: ServerEnv = serverEnv()): JiraAuth | null {
  const { JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN } = source
  const { JIRA_CLIENT_ID, JIRA_CLIENT_SECRET, JIRA_REDIRECT_URI } = source

  const tokenFields = [JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN]
  const oauthFields = [JIRA_CLIENT_ID, JIRA_CLIENT_SECRET, JIRA_REDIRECT_URI]
  const tokenSet = tokenFields.filter(Boolean).length
  const oauthSet = oauthFields.filter(Boolean).length

  if (tokenSet > 0 && tokenSet < tokenFields.length) {
    throw new Error(
      'Incomplete Jira API-token config: JIRA_BASE_URL, JIRA_EMAIL and JIRA_API_TOKEN are all required together',
    )
  }
  if (oauthSet > 0 && oauthSet < oauthFields.length) {
    throw new Error(
      'Incomplete Jira OAuth config: JIRA_CLIENT_ID, JIRA_CLIENT_SECRET and JIRA_REDIRECT_URI are all required together',
    )
  }

  // OAuth wins when both are present: per-customer consent is the multi-tenant
  // path, and a stray service-account token must not silently take precedence.
  if (oauthSet === oauthFields.length) {
    return {
      mode: 'oauth',
      clientId: JIRA_CLIENT_ID!,
      clientSecret: JIRA_CLIENT_SECRET!,
      redirectUri: JIRA_REDIRECT_URI!,
    }
  }
  if (tokenSet === tokenFields.length) {
    return {
      mode: 'api-token',
      baseUrl: JIRA_BASE_URL!,
      email: JIRA_EMAIL!,
      apiToken: JIRA_API_TOKEN!,
    }
  }
  return null
}

/** Basic auth header for Jira API-token mode. Server-side use only. */
export function jiraBasicAuthHeader(auth: Extract<JiraAuth, { mode: 'api-token' }>): string {
  return `Basic ${Buffer.from(`${auth.email}:${auth.apiToken}`).toString('base64')}`
}
