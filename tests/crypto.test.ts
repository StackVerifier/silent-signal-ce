import { beforeAll, describe, expect, it } from 'vitest'
import { randomBytes } from 'node:crypto'

// Set before the module loads, so the test never touches data/.encryption-key.
process.env.ENCRYPTION_KEY = randomBytes(32).toString('base64')

let encryptSecret: (value: string) => string
let decryptSecret: (value: string) => string
let maskUrl: (url: string) => string

beforeAll(async () => {
  ({ encryptSecret, decryptSecret, maskUrl } = await import('@/lib/db/crypto'))
})

const WEBHOOK = 'https://hooks.slack.com/services/T00000000/B00000000/abcdef1234567890'

describe('credential encryption', () => {
  it('round-trips a value', () => {
    expect(decryptSecret(encryptSecret(WEBHOOK))).toBe(WEBHOOK)
  })

  it('never stores the plaintext', () => {
    const stored = encryptSecret(WEBHOOK)
    expect(stored).not.toContain('hooks.slack.com')
    expect(stored).not.toContain('abcdef1234567890')
  })

  it('uses a fresh nonce, so identical secrets do not look identical at rest', () => {
    // Repeated ciphertext would leak that two workspaces post to the same
    // channel, without anyone decrypting anything.
    expect(encryptSecret(WEBHOOK)).not.toBe(encryptSecret(WEBHOOK))
  })

  it('rejects tampered ciphertext rather than returning garbage', () => {
    const stored = encryptSecret(WEBHOOK)
    const flipped = stored.slice(0, -2) + (stored.endsWith('A') ? 'B' : 'A')
    expect(() => decryptSecret(flipped)).toThrow()
  })

  it('round-trips unicode and an empty string', () => {
    expect(decryptSecret(encryptSecret('şifre — çok gizli'))).toBe('şifre — çok gizli')
    expect(decryptSecret(encryptSecret(''))).toBe('')
  })
})

describe('maskUrl', () => {
  it('shows the host and a hint of the path, never the secret part', () => {
    const masked = maskUrl(WEBHOOK)
    expect(masked).toContain('hooks.slack.com')
    expect(masked).not.toContain('abcdef1234567890')
    expect(masked).toContain('•')
  })

  it('returns dots rather than throwing on something that is not a URL', () => {
    expect(maskUrl('not a url')).toBe('••••••••')
  })
})
