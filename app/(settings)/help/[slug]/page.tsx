import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Clock, Mail } from 'lucide-react'
import { SettingsPageHeader } from '@/components/settings/page-header'
import { ArticleBody } from '@/components/help/article-body'
import { getServerPermissions } from '@/lib/auth-server'
import { getAllArticleSlugs, getArticle, listArticles } from '@/lib/db/help'

export const dynamic = 'force-dynamic'

/** Pre-resolves the route segments; visibility is still checked per request. */
export function generateStaticParams() {
  return getAllArticleSlugs().map((slug) => ({ slug }))
}

export default async function HelpArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const permissions = await getServerPermissions()
  const article = getArticle(slug, permissions)

  // A restricted article is indistinguishable from a missing one, so the 404
  // does not confirm that content the viewer cannot read exists.
  if (!article) notFound()

  const related = listArticles(permissions, article.categorySlug)
    .filter((candidate) => candidate.slug !== article.slug)
    .slice(0, 3)

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <SettingsPageHeader title={article.title} description={article.summary} />

      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
        <div className="max-w-3xl space-y-8">
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#64748B]">
            <Link
              href={`/help/category/${article.categorySlug}`}
              className="inline-flex items-center gap-1 font-medium text-[#6C63FF] hover:text-[#8B85FF] transition-colors"
            >
              <ArrowLeft aria-hidden="true" className="w-3 h-3" />
              {article.categoryTitle}
            </Link>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <Clock aria-hidden="true" className="w-3 h-3" />
              {article.readMinutes} min read
            </span>
            <span aria-hidden="true">·</span>
            <span>Updated {new Date(article.updatedAt).toLocaleDateString()}</span>
          </div>

          <article className="rounded-xl bg-[#151D32] border border-[#1E2D4A] p-5 sm:p-6">
            <ArticleBody blocks={article.body} />
          </article>

          {related.length > 0 && (
            <section aria-label="Related articles" className="space-y-3">
              <h2 className="text-[10px] font-semibold text-[#64748B] uppercase tracking-widest">
                More in {article.categoryTitle}
              </h2>
              <ul className="space-y-2">
                {related.map((candidate) => (
                  <li key={candidate.slug}>
                    <Link
                      href={`/help/${candidate.slug}`}
                      className="block p-4 rounded-xl bg-[#151D32] border border-[#1E2D4A] hover:border-[#6C63FF]/40 transition-colors"
                    >
                      <h3 className="text-sm font-medium text-[#E2E8F0]">{candidate.title}</h3>
                      <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">{candidate.summary}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-[#0F1824] border border-[#1E2D4A] px-5 py-4">
            <p className="text-xs text-[#94A3B8] flex-1 min-w-0">
              Did this answer your question?
            </p>
            <a
              href={`mailto:support@silentsignal.io?subject=${encodeURIComponent(`Help: ${article.title}`)}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#1E2D4A] text-xs font-medium text-[#94A3B8] hover:text-[#E2E8F0] hover:border-[#6C63FF]/40 transition-colors"
            >
              <Mail aria-hidden="true" className="w-3.5 h-3.5" />
              Ask support
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
