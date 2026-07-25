import 'server-only'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

/**
 * Encryption for stored credentials — webhook URLs, and later Jira tokens.
 *
 * A Slack or Teams webhook URL is a bearer credential: anyone holding it can
 * post into that channel. Storing it in plaintext would mean a stolen database
 * file is a stolen posting capability, so it is encrypted at rest with
 * AES-256-GCM (authenticated, so tampering is detected rather than decrypted
 * into garbage).
 *
 * Key source, in order:
 *   1. ENCRYPTION_KEY — 32 bytes, base64 or hex. Use this in production.
 *   2. SESSION_SECRET — derived, for deployments that already set one.
 *   3. data/.encryption-key — generated once, git-ignored. Local development
 *      only: it keeps `pnpm dev` working without configuration, and it is
 *      obviously not a secret-management strategy.
 */

const KEY_FILE = resolve(process.cwd(), 'data/.encryption-key')
const GLOBAL_KEY = Symbol.for('silent-signal.crypto.key')
type KeyGlobal = typeof globalThis & { [GLOBAL_KEY]?: Buffer }

function decodeKey(raw: string): Buffer | null {
  for (const encoding of ['base64', 'hex'] as const) {
    try {
      const buffer = Buffer.from(raw, encoding)
      if (buffer.length === 32) return buffer
    } catch {
      // Try the next encoding.
    }
  }
  return null
}

function loadKey(): Buffer {
  const scope = globalThis as KeyGlobal
  if (scope[GLOBAL_KEY]) return scope[GLOBAL_KEY]

  let key: Buffer | null = null

  if (process.env.ENCRYPTION_KEY) {
    key = decodeKey(process.env.ENCRYPTION_KEY)
    if (!key) {
      throw new Error('ENCRYPTION_KEY must decode to exactly 32 bytes (base64 or hex)')
    }
  } else if (process.env.SESSION_SECRET) {
    key = createHash('sha256').update(process.env.SESSION_SECRET).digest()
  } else {
    if (!existsSync(KEY_FILE)) {
      mkdirSync(dirname(KEY_FILE), { recursive: true })
      // 0600: the key file must not be world-readable even on a dev machine.
      writeFileSync(KEY_FILE, randomBytes(32).toString('base64'), { mode: 0o600 })
    }
    key = decodeKey(readFileSync(KEY_FILE, 'utf8').trim())
    if (!key) throw new Error('data/.encryption-key is corrupt — delete it to regenerate')
  }

  scope[GLOBAL_KEY] = key
  return key
}

/** Returns `v1:<iv>:<tag>:<ciphertext>`, all base64. The prefix allows rotation. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', loadKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`
}

export function decryptSecret(payload: string): string {
  const [version, ivB64, tagB64, dataB64] = payload.split(':')
  if (version !== 'v1' || !ivB64 || !tagB64 || !dataB64) {
    throw new Error('Malformed encrypted value')
  }
  const decipher = createDecipheriv('aes-256-gcm', loadKey(), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8')
}

/**
 * A safe preview for the UI: enough to recognise which URL is configured,
 * never enough to use it.
 *
 *   https://hooks.slack.com/services/T00/B00/XXXXXXXX
 *   → hooks.slack.com/…/XXXX••••
 */
export function maskUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const last = parsed.pathname.split('/').filter(Boolean).pop() ?? ''
    const shown = last.slice(0, 4)
    return `${parsed.host}/…/${shown}${'•'.repeat(Math.min(8, Math.max(4, last.length - 4)))}`
  } catch {
    return '••••••••'
  }
}
