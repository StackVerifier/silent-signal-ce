import 'server-only'
import { DatabaseSync } from 'node:sqlite'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

/**
 * Storage driver.
 *
 * `DATABASE_URL` decides: set it to a postgres:// URL and the application uses
 * Postgres; leave it unset and it uses the local SQLite file. Nothing above
 * this module knows which is in play — repositories issue the same SQL either
 * way, with `?` placeholders translated for Postgres here.
 *
 * The interface is async because Postgres is. SQLite is synchronous underneath
 * and simply resolves immediately; paying a microtask to keep one interface is
 * far cheaper than maintaining two.
 */

export type DriverKind = 'sqlite' | 'postgres'

export interface Driver {
  kind: DriverKind
  all<T>(sql: string, params?: unknown[]): Promise<T[]>
  one<T>(sql: string, params?: unknown[]): Promise<T | null>
  run(sql: string, params?: unknown[]): Promise<void>
  transaction<T>(work: () => Promise<T>): Promise<T>
  close(): Promise<void>
}

const SQLITE_PATH = resolve(process.cwd(), process.env.APP_DB_PATH ?? 'data/silent-signal.db')

export function selectedDriver(): DriverKind {
  return process.env.DATABASE_URL ? 'postgres' : 'sqlite'
}

// ─── SQLite ───────────────────────────────────────────────────────────────────

function createSqliteDriver(): Driver {
  mkdirSync(dirname(SQLITE_PATH), { recursive: true })
  const db = new DatabaseSync(SQLITE_PATH)

  const schemaPath = resolve(process.cwd(), 'db/app-schema.sql')
  if (existsSync(schemaPath)) db.exec(readFileSync(schemaPath, 'utf8'))

  return {
    kind: 'sqlite',
    async all<T>(sql: string, params: unknown[] = []) {
      return db.prepare(sql).all(...(params as never[])) as T[]
    },
    async one<T>(sql: string, params: unknown[] = []) {
      return (db.prepare(sql).get(...(params as never[])) as T) ?? null
    },
    async run(sql: string, params: unknown[] = []) {
      db.prepare(sql).run(...(params as never[]))
    },
    async transaction<T>(work: () => Promise<T>) {
      db.exec('BEGIN IMMEDIATE')
      try {
        const result = await work()
        db.exec('COMMIT')
        return result
      } catch (error) {
        db.exec('ROLLBACK')
        throw error
      }
    },
    async close() {
      db.close()
    },
  }
}

// ─── Postgres ─────────────────────────────────────────────────────────────────

/**
 * Rewrites `?` placeholders into `$1, $2, …`.
 *
 * Question marks inside string literals must be left alone, so the scan tracks
 * whether it is inside a quote rather than blindly replacing.
 */
export function toPositional(sql: string): string {
  let index = 0
  let inSingle = false
  let inDouble = false
  let output = ''

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i]
    if (char === "'" && !inDouble) inSingle = !inSingle
    else if (char === '"' && !inSingle) inDouble = !inDouble

    if (char === '?' && !inSingle && !inDouble) {
      index += 1
      output += `$${index}`
    } else {
      output += char
    }
  }
  return output
}

/** SQLite-isms that Postgres spells differently. */
function translate(sql: string): string {
  let text = sql.replace(/\bAUTOINCREMENT\b/gi, '')
  if (/\bINSERT OR IGNORE\b/i.test(text)) {
    // Dropping the clause would turn a benign duplicate into a constraint
    // violation, so it becomes ON CONFLICT DO NOTHING instead.
    text = text.replace(/\bINSERT OR IGNORE\b/gi, 'INSERT') + ' ON CONFLICT DO NOTHING'
  }
  return toPositional(text)
}

async function createPostgresDriver(): Promise<Driver> {
  const { Pool } = await import('pg')
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Managed Postgres almost always requires TLS; a local one almost never has it.
    ssl: process.env.DATABASE_URL?.includes('localhost') ||
         process.env.DATABASE_URL?.includes('127.0.0.1')
      ? undefined
      : { rejectUnauthorized: false },
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
  })

  const schemaPath = resolve(process.cwd(), 'db/app-schema.postgres.sql')
  if (existsSync(schemaPath)) {
    await pool.query(readFileSync(schemaPath, 'utf8'))
  }

  // A transaction must run on one connection, so it is tracked per async call.
  let transactionClient: import('pg').PoolClient | null = null

  const exec = async (sql: string, params: unknown[]) => {
    const text = translate(sql)
    if (transactionClient) return transactionClient.query(text, params)
    return pool.query(text, params)
  }

  return {
    kind: 'postgres',
    async all<T>(sql: string, params: unknown[] = []) {
      return (await exec(sql, params)).rows as T[]
    },
    async one<T>(sql: string, params: unknown[] = []) {
      return ((await exec(sql, params)).rows[0] as T) ?? null
    },
    async run(sql: string, params: unknown[] = []) {
      await exec(sql, params)
    },
    async transaction<T>(work: () => Promise<T>) {
      const client = await pool.connect()
      transactionClient = client
      try {
        await client.query('BEGIN')
        const result = await work()
        await client.query('COMMIT')
        return result
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        transactionClient = null
        client.release()
      }
    },
    async close() {
      await pool.end()
    },
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

const GLOBAL_KEY = Symbol.for('silent-signal.db.driver')
type DriverGlobal = typeof globalThis & { [GLOBAL_KEY]?: Promise<Driver> }

export function db(): Promise<Driver> {
  const scope = globalThis as DriverGlobal
  if (!scope[GLOBAL_KEY]) {
    scope[GLOBAL_KEY] = selectedDriver() === 'postgres'
      ? createPostgresDriver()
      : Promise.resolve(createSqliteDriver())
  }
  return scope[GLOBAL_KEY]
}

export async function all<T>(sql: string, ...params: unknown[]): Promise<T[]> {
  return (await db()).all<T>(sql, params)
}

export async function one<T>(sql: string, ...params: unknown[]): Promise<T | null> {
  return (await db()).one<T>(sql, params)
}

export async function run(sql: string, ...params: unknown[]): Promise<void> {
  return (await db()).run(sql, params)
}

export async function transaction<T>(work: () => Promise<T>): Promise<T> {
  return (await db()).transaction(work)
}

export const nowIso = () => new Date().toISOString()

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

/**
 * SQLite stores booleans as 0/1; Postgres has a real BOOLEAN and rejects an
 * integer for it. The parameter shape therefore follows the active driver.
 */
export const toBit = (value: boolean) =>
  selectedDriver() === 'postgres' ? value : value ? 1 : 0
export const fromBit = (value: number | boolean) => value === true || value === 1

export const toDate = (value: string | Date | null | undefined) =>
  value ? new Date(value) : undefined
