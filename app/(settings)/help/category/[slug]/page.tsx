import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { SettingsPageHeader } from '@/components/settings/page-header'
import { ArticleRow } from '../../page'
import { getServerPermissions } from '@/lib/auth-server'
import { getCategories, listArticles } from '@/lib/db/help'

export const dynamic = 'force-dynamic'

export default async function HelpCategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const permissions = await getServerPermissions()

  const category = getCategories(permissions).find((candidate) => candidate.slug === slug)
  if (!category) notFound()

  const articles = listArticles(permissions, slug)

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <SettingsPageHeader title={category.title} description={category.description} />

      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
        <div className="max-w-3xl space-y-4">
          <Link
            href="/help"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-[#6C63FF] hover:text-[#8B85FF] transition-colors"
          >
            <ArrowLeft aria-hidden="true" className="w-3 h-3" />
            All help topics
          </Link>

          <ul className="space-y-2">
            {articles.map((article) => (
              <li key={article.slug}>
                <ArticleRow
                  slug={article.slug}
                  title={article.title}
                  summary={article.summary}
                  readMinutes={article.readMinutes}
                />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
