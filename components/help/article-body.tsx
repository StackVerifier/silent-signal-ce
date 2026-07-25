import { Info, AlertTriangle, ShieldAlert } from 'lucide-react'
import type { Block } from '@/db/content/help'
import { cn } from '@/lib/utils'

const CALLOUT_STYLES = {
  info: { className: 'bg-[#6C63FF]/8 border-[#6C63FF]/25', accent: 'text-[#6C63FF]', Icon: Info },
  warning: { className: 'bg-[#F59E0B]/8 border-[#F59E0B]/25', accent: 'text-[#F59E0B]', Icon: AlertTriangle },
  danger: { className: 'bg-[#EF4444]/8 border-[#EF4444]/25', accent: 'text-[#EF4444]', Icon: ShieldAlert },
} as const

/**
 * Renders the structured blocks stored in SQLite.
 *
 * Content is a discriminated union rather than HTML or markdown, so this is a
 * switch over known shapes — there is no path by which stored content can
 * inject markup, and no sanitiser to keep correct.
 */
export function ArticleBody({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-4">
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'heading':
            return (
              <h2 key={index} className="text-sm font-semibold text-[#E2E8F0] pt-2">
                {block.text}
              </h2>
            )

          case 'paragraph':
            return (
              <p key={index} className="text-sm text-[#94A3B8] leading-relaxed">
                {block.text}
              </p>
            )

          case 'list': {
            const List = block.ordered ? 'ol' : 'ul'
            return (
              <List
                key={index}
                className={cn(
                  'space-y-1.5 pl-5 text-sm text-[#94A3B8] leading-relaxed',
                  block.ordered ? 'list-decimal' : 'list-disc',
                  'marker:text-[#6C63FF]',
                )}
              >
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{item}</li>
                ))}
              </List>
            )
          }

          case 'steps':
            return (
              <ol key={index} className="space-y-3">
                {block.items.map((step, stepIndex) => (
                  <li key={stepIndex} className="flex gap-3">
                    <span className="w-6 h-6 shrink-0 rounded-full bg-[#6C63FF]/15 border border-[#6C63FF]/30 text-[11px] font-bold text-[#6C63FF] flex items-center justify-center">
                      {stepIndex + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#E2E8F0]">{step.title}</p>
                      <p className="text-sm text-[#94A3B8] mt-0.5 leading-relaxed">{step.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )

          case 'code':
            return (
              <pre
                key={index}
                className="overflow-x-auto rounded-lg bg-[#0F1824] border border-[#1E2D4A] p-4 text-[12px] leading-relaxed"
              >
                <code className="font-mono text-[#94A3B8] whitespace-pre">{block.code}</code>
              </pre>
            )

          case 'callout': {
            const style = CALLOUT_STYLES[block.tone]
            return (
              <div
                key={index}
                className={cn('flex gap-3 rounded-lg border p-4', style.className)}
              >
                <style.Icon aria-hidden="true" className={cn('w-4 h-4 shrink-0 mt-0.5', style.accent)} />
                <div className="min-w-0">
                  <p className={cn('text-xs font-semibold', style.accent)}>{block.title}</p>
                  <p className="text-sm text-[#94A3B8] mt-1 leading-relaxed">{block.text}</p>
                </div>
              </div>
            )
          }

          case 'table':
            return (
              // Wide tables scroll inside their own container so the page body
              // never scrolls horizontally on a phone.
              <div key={index} className="overflow-x-auto rounded-lg border border-[#1E2D4A]">
                <table className="w-full min-w-[32rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#1E2D4A] bg-[#0F1824]">
                      {block.headers.map((header) => (
                        <th
                          key={header}
                          scope="col"
                          className="px-4 py-2.5 text-[10px] font-semibold text-[#64748B] uppercase tracking-widest"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rowIndex) => (
                      <tr key={rowIndex} className="border-b border-[#1E2D4A]/50 last:border-0">
                        {row.map((cell, cellIndex) => (
                          <td
                            key={cellIndex}
                            className={cn(
                              'px-4 py-2.5 align-top leading-relaxed',
                              cellIndex === 0 ? 'text-[#E2E8F0] font-medium' : 'text-[#94A3B8]',
                            )}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )

          default:
            return null
        }
      })}
    </div>
  )
}
