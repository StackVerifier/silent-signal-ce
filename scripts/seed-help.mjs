/**
 * Builds `data/help.db` from `db/content/help.ts`.
 *
 * Run with `pnpm db:seed`. It also runs on `prebuild`, so a content change can
 * never ship without the database that serves it.
 *
 * The database is rebuilt from scratch every time rather than migrated: help
 * content has no user-authored state, so the file is a build artefact whose
 * source of truth is the TypeScript module.
 */
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dbPath = resolve(root, 'data/help.db')
const schemaPath = resolve(root, 'db/schema.sql')

// The content file stays TypeScript; Node 22 strips the annotations natively
// (--experimental-strip-types), so no transpiler dependency is needed.
const content = await import(pathToFileURL(resolve(root, 'db/content/help.ts')).href)
const { categories, articles, faqs, channels } = content

mkdirSync(dirname(dbPath), { recursive: true })
rmSync(dbPath, { force: true })

const db = new DatabaseSync(dbPath)
db.exec(readFileSync(schemaPath, 'utf8'))

/** Flattens structured blocks into plain text for the search index. */
function blocksToText(blocks) {
  return blocks
    .map((block) => {
      switch (block.type) {
        case 'paragraph':
        case 'heading':
          return block.text
        case 'list':
          return block.items.join(' ')
        case 'steps':
          return block.items.map((item) => `${item.title} ${item.detail}`).join(' ')
        case 'code':
          return block.code
        case 'callout':
          return `${block.title} ${block.text}`
        case 'table':
          return [block.headers.join(' '), ...block.rows.map((row) => row.join(' '))].join(' ')
        default:
          return ''
      }
    })
    .join('\n')
}

const insertCategory = db.prepare(
  'INSERT INTO help_category (id, slug, title, description, icon, position) VALUES (?, ?, ?, ?, ?, ?)',
)
const insertArticle = db.prepare(
  `INSERT INTO help_article
     (id, category_id, slug, title, summary, body, read_minutes, permission, position, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
)
const insertFts = db.prepare(
  'INSERT INTO help_article_fts (slug, title, summary, body_text) VALUES (?, ?, ?, ?)',
)
const insertFaq = db.prepare(
  'INSERT INTO help_faq (id, question, answer, article_slug, position) VALUES (?, ?, ?, ?, ?)',
)
const insertChannel = db.prepare(
  'INSERT INTO help_channel (id, label, description, href, icon, availability, position) VALUES (?, ?, ?, ?, ?, ?, ?)',
)

db.exec('BEGIN')
try {
  for (const category of categories) {
    insertCategory.run(
      category.id, category.slug, category.title,
      category.description, category.icon, category.position,
    )
  }

  const categoryIds = new Set(categories.map((category) => category.id))
  for (const article of articles) {
    // Fail the build rather than shipping an article no category can reach.
    if (!categoryIds.has(article.categoryId)) {
      throw new Error(`Article "${article.slug}" references unknown category "${article.categoryId}"`)
    }
    insertArticle.run(
      article.id, article.categoryId, article.slug, article.title, article.summary,
      JSON.stringify(article.body), article.readMinutes,
      article.permission ?? null, article.position, article.updatedAt,
    )
    insertFts.run(article.slug, article.title, article.summary, blocksToText(article.body))
  }

  const articleSlugs = new Set(articles.map((article) => article.slug))
  for (const faq of faqs) {
    if (faq.articleSlug && !articleSlugs.has(faq.articleSlug)) {
      throw new Error(`FAQ "${faq.id}" links to unknown article "${faq.articleSlug}"`)
    }
    insertFaq.run(faq.id, faq.question, faq.answer, faq.articleSlug ?? null, faq.position)
  }

  for (const channel of channels) {
    insertChannel.run(
      channel.id, channel.label, channel.description,
      channel.href, channel.icon, channel.availability, channel.position,
    )
  }

  db.exec('COMMIT')
} catch (error) {
  db.exec('ROLLBACK')
  throw error
}

db.exec('VACUUM')
db.close()

console.log(
  `help.db built — ${categories.length} categories, ${articles.length} articles, ` +
  `${faqs.length} FAQs, ${channels.length} channels`,
)
