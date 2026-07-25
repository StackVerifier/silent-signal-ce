import { describe, expect, it } from 'vitest'
import { toPositional } from '@/lib/db/driver'

/**
 * Repositories write one dialect of SQL and the driver adapts it. These are the
 * cases where getting the adaptation wrong is silent: the query still runs, it
 * just binds the wrong values or drops a clause.
 */
describe('placeholder translation', () => {
  it('numbers placeholders in order', () => {
    expect(toPositional('SELECT * FROM members WHERE id = ? AND status = ?'))
      .toBe('SELECT * FROM members WHERE id = $1 AND status = $2')
  })

  it('leaves SQL without placeholders untouched', () => {
    expect(toPositional('SELECT 1')).toBe('SELECT 1')
  })

  it('does not touch a question mark inside a string literal', () => {
    // Rewriting this one would corrupt the stored text — and only for rows
    // whose content happened to contain a question mark.
    expect(toPositional("UPDATE a SET title = 'why?' WHERE id = ?"))
      .toBe("UPDATE a SET title = 'why?' WHERE id = $1")
  })

  it('does not touch a question mark inside a quoted identifier', () => {
    expect(toPositional('SELECT "odd?column" FROM t WHERE id = ?'))
      .toBe('SELECT "odd?column" FROM t WHERE id = $1')
  })

  it('keeps counting correctly after a literal', () => {
    expect(toPositional("SELECT ? , 'a?b' , ? FROM t WHERE x = ?"))
      .toBe("SELECT $1 , 'a?b' , $2 FROM t WHERE x = $3")
  })

  it('handles a single quote inside double quotes and vice versa', () => {
    expect(toPositional(`SELECT "it's" FROM t WHERE id = ?`))
      .toBe(`SELECT "it's" FROM t WHERE id = $1`)
    expect(toPositional(`SELECT 'a "b" c' FROM t WHERE id = ?`))
      .toBe(`SELECT 'a "b" c' FROM t WHERE id = $1`)
  })
})
