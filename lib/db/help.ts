import 'server-only'
import { queryAll, queryOne } from './client'
import type { Block } from '@/db/content/help'
import type { Permission } from '@/lib/rbac/permissions'

export type { Block }

export interface HelpCategoryRecord {
  id: string
  slug: string
  title: string
  description: string
  icon: string
  articleCount: number
}

export interface HelpArticleSummary {
  slug: string
  title: string
  summary: string
  readMinutes: number
  permission: Permission | null
  categorySlug: string
  categoryTitle: string
  updatedAt: string
}

export interface HelpArticleRecord extends HelpArticleSummary {
  body: Block[]
}

export interface HelpFaqRecord {
  id: string
  question: string
  answer: string
  articleSlug: string | null
}

export interface HelpChannelRecord {
  id: string
  label: string
  description: string
  href: string
  icon: string
  availability: string
}

/**
 * Article visibility follows the same permission model as the rest of the app:
 * an article about Jira field mapping is noise for a Viewer who cannot open
 * Integrations. Filtering happens here rather than in the component so a
 * restricted article can never reach the client payload.
 */
function visibleTo(permissions: Permission[]) {
  return (article: { permission: Permission | null }) =>
    article.permission === null || permissions.includes(article.permission)
}

export function getCategories(permissions: Permission[]): HelpCategoryRecord[] {
  const categories = queryAll<Omit<HelpCategoryRecord, 'articleCount'>>(
    'SELECT id, slug, title, description, icon FROM help_category ORDER BY position',
  )
  const articles = listArticles(permissions)

  return categories
    .map((category) => ({
      ...category,
      articleCount: articles.filter((article) => article.categorySlug === category.slug).length,
    }))
    // A category whose every article is restricted would render as an empty shell.
    .filter((category) => category.articleCount > 0)
}

const ARTICLE_SELECT = `
  SELECT a.slug, a.title, a.summary, a.read_minutes AS readMinutes,
         a.permission, a.updated_at AS updatedAt,
         c.slug AS categorySlug, c.title AS categoryTitle
    FROM help_article a
    JOIN help_category c ON c.id = a.category_id
`

export function listArticles(
  permissions: Permission[],
  categorySlug?: string,
): HelpArticleSummary[] {
  const rows = categorySlug
    ? queryAll<HelpArticleSummary>(
        `${ARTICLE_SELECT} WHERE c.slug = ? ORDER BY c.position, a.position`,
        categorySlug,
      )
    : queryAll<HelpArticleSummary>(`${ARTICLE_SELECT} ORDER BY c.position, a.position`)

  return rows.filter(visibleTo(permissions))
}

export function getArticle(
  slug: string,
  permissions: Permission[],
): HelpArticleRecord | null {
  // ARTICLE_SELECT deliberately omits the body — list views should not carry
  // it — so the detail query asks for it explicitly.
  const row = queryOne<HelpArticleSummary & { body: string }>(
    `${ARTICLE_SELECT.replace('SELECT a.slug', 'SELECT a.body, a.slug')} WHERE a.slug = ?`,
    slug,
  )
  if (!row || !visibleTo(permissions)(row)) return null
  return { ...row, body: JSON.parse(row.body) as Block[] }
}

/** Every slug, used by generateStaticParams — permission filtering is per-request. */
export function getAllArticleSlugs(): string[] {
  return queryAll<{ slug: string }>('SELECT slug FROM help_article').map((row) => row.slug)
}

/**
 * FTS5 search. The query is escaped and turned into a prefix match so a partial
 * word still finds something, and so user input can never be interpreted as FTS
 * syntax — an unescaped quote or `NEAR` would otherwise throw.
 */
export function searchArticles(
  term: string,
  permissions: Permission[],
): HelpArticleSummary[] {
  const cleaned = term.trim()
  if (cleaned.length < 2) return []

  const ftsQuery = cleaned
    .split(/\s+/)
    .slice(0, 6)
    .map((word) => `"${word.replace(/"/g, '""')}"*`)
    .join(' ')

  try {
    const matches = queryAll<{ slug: string }>(
      `SELECT slug FROM help_article_fts
        WHERE help_article_fts MATCH ?
        ORDER BY bm25(help_article_fts, 10.0, 5.0, 1.0)
        LIMIT 20`,
      ftsQuery,
    )
    if (matches.length === 0) return []

    const placeholders = matches.map(() => '?').join(', ')
    const rows = queryAll<HelpArticleSummary>(
      `${ARTICLE_SELECT} WHERE a.slug IN (${placeholders})`,
      ...matches.map((match) => match.slug),
    )

    // Preserve the relevance order the index gave us.
    const rank = new Map(matches.map((match, index) => [match.slug, index]))
    return rows
      .filter(visibleTo(permissions))
      .sort((a, b) => (rank.get(a.slug) ?? 0) - (rank.get(b.slug) ?? 0))
  } catch {
    // A malformed FTS expression must degrade to "no results", not a 500.
    return []
  }
}

export function getFaqs(): HelpFaqRecord[] {
  return queryAll<HelpFaqRecord>(
    'SELECT id, question, answer, article_slug AS articleSlug FROM help_faq ORDER BY position',
  )
}

export function getChannels(): HelpChannelRecord[] {
  return queryAll<HelpChannelRecord>(
    'SELECT id, label, description, href, icon, availability FROM help_channel ORDER BY position',
  )
}
