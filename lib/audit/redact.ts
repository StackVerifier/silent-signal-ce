/**
 * Secret masking for audit records.
 *
 * The audit log is the one table guaranteed to be read by humans, exported to
 * CSV, and kept for years. A webhook URL or API token that reaches it is a
 * credential that has escaped every other control — encryption at rest on the
 * source column buys nothing once the value is copied here in clear.
 *
 * Masking therefore happens on the way *in*, not on the way out. Redacting at
 * read time would leave the plaintext sitting in the database, one forgotten
 * query away from a breach, and every historical row already written would stay
 * exposed.
 */

/**
 * Field names whose values are secret, matched case-insensitively as substrings
 * so `jiraApiToken`, `slack_webhook_url` and `SMTP_PASSWORD` are all caught.
 *
 * Substring matching over an exact list is deliberate: a new field named
 * `refreshTokenExpiry` being masked unnecessarily costs a reader some context,
 * while a new field named `githubAccessToken` slipping through costs a
 * credential. The failure modes are not symmetric.
 */
const SECRET_HINTS = [
  'password', 'passwd', 'secret', 'token', 'apikey', 'api_key',
  'webhook', 'credential', 'authorization', 'auth_header',
  'private_key', 'privatekey', 'client_secret', 'signing',
  'session', 'cookie', 'bearer', 'salt', 'hash',
]

export function isSecretField(name: string): boolean {
  const normalized = name.toLowerCase().replace(/[\s-]/g, '_')
  return SECRET_HINTS.some((hint) => normalized.includes(hint.replace(/[\s-]/g, '_')))
}

/** The placeholder shown in place of a secret. Fixed width — length is a hint. */
export const MASK = '••••••••'

/**
 * Values that look like credentials wherever they appear, including inside a
 * field with an innocuous name — a URL pasted into `description`, a token in a
 * free-text note.
 */
const SECRET_VALUE_PATTERNS: RegExp[] = [
  /https?:\/\/hooks\.slack\.com\/\S+/gi,
  /https?:\/\/[a-z0-9.-]*webhook\.office\.com\/\S+/gi,
  /https?:\/\/[a-z0-9.-]*outlook\.office\.com\/webhook\S*/gi,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/g,          // Slack tokens
  /\bsk_(live|test)_[A-Za-z0-9]{10,}/g,        // Stripe-style secret keys
  /\bgh[pousr]_[A-Za-z0-9]{20,}/g,             // GitHub tokens
  /\bATATT[A-Za-z0-9_\-=]{20,}/g,              // Atlassian API tokens
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, // JWTs
  /\b[A-Fa-f0-9]{40,}\b/g,                     // long hex — keys and digests
]

export function maskSecretsInText(text: string): string {
  return SECRET_VALUE_PATTERNS.reduce((value, pattern) => value.replace(pattern, MASK), text)
}

/**
 * A single value, masked. Objects and arrays are walked so a secret nested in a
 * config blob is caught too.
 */
export function redactValue(value: unknown, fieldName = ''): unknown {
  if (fieldName && isSecretField(fieldName)) {
    // Null stays null: "was not set" and "was set to something secret" are
    // different facts, and flattening them would mislead an investigator.
    return value === null || value === undefined ? value : MASK
  }
  if (typeof value === 'string') return maskSecretsInText(value)
  if (Array.isArray(value)) return value.map((item) => redactValue(item))
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([key, nested]) => [key, redactValue(nested, key)]),
    )
  }
  return value
}

export interface FieldChange {
  before: unknown
  after: unknown
}

/** A change set, with every secret field and secret-looking value masked. */
export function redactChanges(
  changes: Record<string, FieldChange> | undefined,
): Record<string, FieldChange> | undefined {
  if (!changes) return undefined
  return Object.fromEntries(
    Object.entries(changes).map(([field, change]) => [
      field,
      {
        before: redactValue(change.before, field),
        after: redactValue(change.after, field),
      },
    ]),
  )
}

export function redactMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!metadata) return undefined
  return redactValue(metadata) as Record<string, unknown>
}

/**
 * Builds a change set from two snapshots, keeping only fields that differ.
 *
 * Recording unchanged fields would bury the one that moved — the reader is
 * looking for what changed, and a diff of thirty identical rows answers nothing.
 */
export function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields?: string[],
): Record<string, FieldChange> | undefined {
  const keys = fields ?? [...new Set([...Object.keys(before), ...Object.keys(after)])]
  const changes: Record<string, FieldChange> = {}

  for (const key of keys) {
    const from = before[key]
    const to = after[key]
    if (from === undefined && to === undefined) continue
    if (JSON.stringify(from) === JSON.stringify(to)) continue
    changes[key] = { before: from ?? null, after: to ?? null }
  }

  return Object.keys(changes).length > 0 ? redactChanges(changes) : undefined
}
