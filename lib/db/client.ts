import 'server-only'
import { DatabaseSync } from 'node:sqlite'
import { resolve } from 'node:path'

/**
 * Read-only SQLite connection for help content.
 *
 * Why this is safe on serverless — the usual objection to SQLite — is that
 * nothing ever writes at runtime. `data/help.db` is a build artefact produced
 * by `pnpm db:seed` and committed, so the file ships with the deployment and is
 * opened read-only. The read-only flag is not a nicety: it makes an accidental
 * write a hard error rather than a change that silently vanishes when the
 * instance is recycled.
 *
 * This is deliberately scoped to content. Tenant data must not live here — it
 * would not survive a deploy, and instances would disagree with each other.
 *
 * `node:sqlite` is Node 22's built-in driver, so there is no dependency and no
 * native module to compile. It is still flagged experimental; if that becomes a
 * problem, swapping in better-sqlite3 touches only this file.
 */

const DB_PATH = resolve(process.cwd(), 'data/help.db')

const GLOBAL_KEY = Symbol.for('silent-signal.db.help')
type DbGlobal = typeof globalThis & { [GLOBAL_KEY]?: DatabaseSync }

/**
 * One connection per process, cached on globalThis so dev-server hot reloads
 * reuse it instead of leaking a file handle on every recompile.
 */
export function helpDb(): DatabaseSync {
  const scope = globalThis as DbGlobal
  if (!scope[GLOBAL_KEY]) {
    scope[GLOBAL_KEY] = new DatabaseSync(DB_PATH, { readOnly: true })
  }
  return scope[GLOBAL_KEY]
}

/** Typed `all()` — node:sqlite returns null-prototype rows. */
export function queryAll<T>(sql: string, ...params: unknown[]): T[] {
  return helpDb().prepare(sql).all(...(params as never[])) as T[]
}

export function queryOne<T>(sql: string, ...params: unknown[]): T | null {
  const row = helpDb().prepare(sql).get(...(params as never[]))
  return (row as T) ?? null
}
