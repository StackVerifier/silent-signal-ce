import Link from 'next/link'
import {
  Rocket, Plug, ShieldCheck, Settings2, Activity, Mail, Search,
  BookOpen, Clock, ChevronRight, type LucideIcon,
} from 'lucide-react'
import { SettingsPageHeader } from '@/components/settings/page-header'
import { getServerPermissions } from '@/lib/auth-server'
import {
  getCategories, getChannels, getFaqs, listArticles, searchArticles,
} from '@/lib/db/help'

// Content is per-viewer (articles are permission-filtered from the session
// cookie), so this renders per request rather than at build time.
export const dynamic = 'force-dynamic'

const ICONS: Record<string, LucideIcon> = {
  Rocket, Plug, ShieldCheck, Settings2, Activity, Mail, BookOpen,
}

/**
 * Help centre — a Server Component reading from SQLite.
 *
 * Nothing here is a client component, so no article text ships as JavaScript;
 * the page is HTML by the time it reaches the browser, and restricted articles
 * are filtered out server-side rather than hidden with CSS.
 */
export default async function HelpPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q = '' } = await searchParams
  const permissions = await getServerPermissions()

  const query = q.trim()
  const results = query ? searchArticles(query, permissions) : []
  const categories = getCategories(permissions)
  const articles = listArticles(permissions)
  const faqs = getFaqs()
  const channels = getChannels()

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <SettingsPageHeader
        title="Help & Support"
        description={`${articles.length} articles across ${categories.length} categories`}
      />

      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
        <div className="max-w-4xl space-y-8">
          {/* Search — a GET form, so results are linkable and work without JS */}
          <form method="GET" role="search" className="relative">
            <label htmlFor="help-search" className="sr-only">
              Search the help centre
            </label>
            <Search
              aria-hidden="true"
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B] pointer-events-none"
            />
            <input
              id="help-search"
              name="q"
              type="search"
              defaultValue={query}
              placeholder="Search articles — try “field mapping” or “approval”"
              className="w-full h-11 pl-10 pr-4 rounded-xl bg-[#0F1824] border border-[#1E2D4A] text-sm text-[#E2E8F0] placeholder-[#64748B] focus:outline-none focus:border-[#6C63FF] transition-colors"
            />
          </form>

          {query ? (
            <section aria-label="Search results" className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold text-[#E2E8F0]">
                  {results.length} result{results.length === 1 ? '' : 's'} for “{query}”
                </h2>
                <Link href="/help" className="text-[11px] font-medium text-[#6C63FF] hover:text-[#8B85FF]">
                  Clear search
                </Link>
              </div>

              {results.length === 0 ? (
                <div className="rounded-xl bg-[#151D32] border border-[#1E2D4A] px-6 py-12 text-center">
                  <Search aria-hidden="true" className="w-8 h-8 text-[#1E2D4A] mx-auto mb-3" />
                  <p className="text-sm font-medium text-[#E2E8F0]">No articles match that search</p>
                  <p className="text-xs text-[#94A3B8] mt-1.5 max-w-sm mx-auto leading-relaxed">
                    Try a shorter term, or email support and we will answer directly.
                  </p>
                  <a
                    href="mailto:support@silentsignal.io"
                    className="inline-flex items-center gap-1.5 mt-5 px-3.5 py-2 rounded-lg bg-[#6C63FF] text-white text-sm font-medium hover:bg-[#5B52CC] transition-colors"
                  >
                    <Mail aria-hidden="true" className="w-3.5 h-3.5" />
                    Contact support
                  </a>
                </div>
              ) : (
                <ul className="space-y-2">
                  {results.map((article) => (
                    <li key={article.slug}>
                      <ArticleRow
                        slug={article.slug}
                        title={article.title}
                        summary={article.summary}
                        readMinutes={article.readMinutes}
                        meta={article.categoryTitle}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : (
            <>
              {/* Categories */}
              <section aria-label="Browse by category" className="space-y-3">
                <h2 className="text-[10px] font-semibold text-[#64748B] uppercase tracking-widest">
                  Browse
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {categories.map((category) => {
                    const Icon = ICONS[category.icon] ?? BookOpen
                    return (
                      <Link
                        key={category.id}
                        href={`/help/category/${category.slug}`}
                        className="group flex items-start gap-3 p-4 rounded-xl bg-[#151D32] border border-[#1E2D4A] hover:border-[#6C63FF]/40 hover:bg-[#1a2440] transition-colors"
                      >
                        <span className="w-9 h-9 rounded-lg bg-[#6C63FF]/10 border border-[#6C63FF]/20 flex items-center justify-center shrink-0">
                          <Icon aria-hidden="true" className="w-4 h-4 text-[#6C63FF]" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-semibold text-[#E2E8F0]">{category.title}</h3>
                          <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">
                            {category.description}
                          </p>
                          <p className="text-[11px] text-[#64748B] mt-2">
                            {category.articleCount} article{category.articleCount === 1 ? '' : 's'}
                          </p>
                        </div>
                        <ChevronRight
                          aria-hidden="true"
                          className="w-4 h-4 text-[#1E2D4A] group-hover:text-[#6C63FF] transition-colors shrink-0 mt-1"
                        />
                      </Link>
                    )
                  })}
                </div>
              </section>

              {/* FAQs */}
              <section aria-label="Common questions" className="space-y-3">
                <h2 className="text-[10px] font-semibold text-[#64748B] uppercase tracking-widest">
                  Common questions
                </h2>
                <div className="rounded-xl bg-[#151D32] border border-[#1E2D4A] divide-y divide-[#1E2D4A]/60">
                  {faqs.map((faq) => (
                    // <details> gives keyboard and screen-reader behaviour for
                    // free; a custom accordion would only reimplement it worse.
                    <details key={faq.id} className="group">
                      <summary className="flex items-center justify-between gap-3 px-5 py-3.5 cursor-pointer list-none marker:content-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C63FF] focus-visible:ring-inset">
                        <span className="text-sm font-medium text-[#E2E8F0]">{faq.question}</span>
                        <ChevronRight
                          aria-hidden="true"
                          className="w-4 h-4 text-[#64748B] shrink-0 transition-transform group-open:rotate-90"
                        />
                      </summary>
                      <div className="px-5 pb-4 -mt-1">
                        <p className="text-sm text-[#94A3B8] leading-relaxed">{faq.answer}</p>
                        {faq.articleSlug && (
                          <Link
                            href={`/help/${faq.articleSlug}`}
                            className="inline-flex items-center gap-1 mt-2 text-[11px] font-medium text-[#6C63FF] hover:text-[#8B85FF]"
                          >
                            Read the full article
                            <ChevronRight aria-hidden="true" className="w-3 h-3" />
                          </Link>
                        )}
                      </div>
                    </details>
                  ))}
                </div>
              </section>

              {/* Support channels */}
              <section aria-label="Contact" className="space-y-3">
                <h2 className="text-[10px] font-semibold text-[#64748B] uppercase tracking-widest">
                  Still stuck?
                </h2>
                <div className="grid gap-3 sm:grid-cols-3">
                  {channels.map((channel) => {
                    const Icon = ICONS[channel.icon] ?? Mail
                    return (
                      <a
                        key={channel.id}
                        href={channel.href}
                        className="p-4 rounded-xl bg-[#151D32] border border-[#1E2D4A] hover:border-[#6C63FF]/40 transition-colors"
                      >
                        <Icon aria-hidden="true" className="w-4 h-4 text-[#6C63FF]" />
                        <h3 className="text-sm font-medium text-[#E2E8F0] mt-2.5">{channel.label}</h3>
                        <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">
                          {channel.description}
                        </p>
                        <p className="text-[11px] text-[#64748B] mt-2">{channel.availability}</p>
                      </a>
                    )
                  })}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export function ArticleRow({
  slug, title, summary, readMinutes, meta,
}: {
  slug: string
  title: string
  summary: string
  readMinutes: number
  meta?: string
}) {
  return (
    <Link
      href={`/help/${slug}`}
      className="group flex items-start gap-3 p-4 rounded-xl bg-[#151D32] border border-[#1E2D4A] hover:border-[#6C63FF]/40 hover:bg-[#1a2440] transition-colors"
    >
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-[#E2E8F0]">{title}</h3>
        <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">{summary}</p>
        <p className="flex items-center gap-2 text-[11px] text-[#64748B] mt-2">
          {meta && (
            <>
              <span>{meta}</span>
              <span aria-hidden="true">·</span>
            </>
          )}
          <span className="inline-flex items-center gap-1">
            <Clock aria-hidden="true" className="w-3 h-3" />
            {readMinutes} min read
          </span>
        </p>
      </div>
      <ChevronRight
        aria-hidden="true"
        className="w-4 h-4 text-[#1E2D4A] group-hover:text-[#6C63FF] transition-colors shrink-0 mt-1"
      />
    </Link>
  )
}
