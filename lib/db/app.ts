import 'server-only'
import { DatabaseSync } from 'node:sqlite'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

/**
 * Writable application database.
 *
 * Scope and its limit, stated plainly: this persists wherever the filesystem
 * persists — `pnpm dev`, `pnpm start`, Docker, a VM. On serverless it does not,
 * because each instance gets a fresh ephemeral disk and instances do not share
 * one. See docs/database.md.
 *
 * The schema is applied on first open (every statement is IF NOT EXISTS), so a
 * fresh clone needs no migration step.
 */

const DB_PATH = resolve(process.cwd(), process.env.APP_DB_PATH ?? 'data/silent-signal.db')
const SCHEMA_PATH = resolve(process.cwd(), 'db/app-schema.sql')

const GLOBAL_KEY = Symbol.for('silent-signal.db.app')
type DbGlobal = typeof globalThis & { [GLOBAL_KEY]?: DatabaseSync }

export function appDb(): DatabaseSync {
  const scope = globalThis as DbGlobal
  if (scope[GLOBAL_KEY]) return scope[GLOBAL_KEY]

  mkdirSync(dirname(DB_PATH), { recursive: true })
  const db = new DatabaseSync(DB_PATH)

  if (existsSync(SCHEMA_PATH)) {
    db.exec(readFileSync(SCHEMA_PATH, 'utf8'))
  }

  scope[GLOBAL_KEY] = db
  return db
}

export function all<T>(sql: string, ...params: unknown[]): T[] {
  return appDb().prepare(sql).all(...(params as never[])) as T[]
}

export function one<T>(sql: string, ...params: unknown[]): T | null {
  return (appDb().prepare(sql).get(...(params as never[])) as T) ?? null
}

export function run(sql: string, ...params: unknown[]): void {
  appDb().prepare(sql).run(...(params as never[]))
}

/**
 * Runs `work` inside a transaction. Multi-statement writes — a mutation plus
 * its audit record — must be atomic, otherwise an action can succeed with no
 * trace of who performed it.
 */
export function transaction<T>(work: () => T): T {
  const db = appDb()
  db.exec('BEGIN IMMEDIATE')
  try {
    const result = work()
    db.exec('COMMIT')
    return result
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

export const nowIso = () => new Date().toISOString()

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

/** SQLite has no boolean type; 0/1 round-trips through these. */
export const toBit = (value: boolean) => (value ? 1 : 0)
export const fromBit = (value: number) => value === 1

export const toIso = (value: Date | string | null | undefined) =>
  value ? new Date(value).toISOString() : null

export const toDate = (value: string | null | undefined) =>
  value ? new Date(value) : undefined
