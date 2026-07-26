import { route } from '@/lib/api/handler'
import { buildReportPack } from '@/lib/reports/build'
import { REPORT_KINDS, type ReportKind } from '@/lib/reports/types'
import { writeAudit } from '@/lib/audit/repository'
import { PERMISSIONS } from '@/lib/rbac/permissions'

export const dynamic = 'force-dynamic'

/**
 * Generation is measured in seconds for a large pack, so the timeout is raised
 * from the platform default rather than letting a legitimate request be killed
 * halfway through writing a file.
 */
export const maxDuration = 60

const FORMATS = ['pdf', 'xlsx'] as const
type Format = (typeof FORMATS)[number]

const CONTENT_TYPES: Record<Format, string> = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

function csv(value: string | null): string[] | undefined {
  const parts = value?.split(',').map((part) => part.trim()).filter(Boolean)
  return parts?.length ? parts : undefined
}

export const GET = route({ permission: PERMISSIONS.REPORTS_EXPORT }, async (context, request) => {
  const params = new URL(request.url).searchParams

  const requested = params.get('format') ?? 'pdf'
  const format: Format = (FORMATS as readonly string[]).includes(requested)
    ? (requested as Format)
    : 'pdf'

  const requestedKinds = csv(params.get('kinds'))
  const kinds = (requestedKinds?.filter((kind): kind is ReportKind =>
    (REPORT_KINDS as readonly string[]).includes(kind)) ?? [...REPORT_KINDS])

  const pack = await buildReportPack({
    organizationId: context.organizationId,
    kinds: kinds.length ? kinds : [...REPORT_KINDS],
    teamIds: csv(params.get('teams')),
    generatedById: context.memberId,
  })

  // Loading the writer only when its format is asked for keeps the other
  // library — and the megabyte of font it reads — out of the request entirely.
  const body = format === 'pdf'
    ? Buffer.from(await (await import('@/lib/reports/pdf')).renderPackPdf(pack))
    : await (await import('@/lib/reports/xlsx')).renderPackXlsx(pack)

  // A delivery report carries names, assignments and dates out of the product,
  // so who took what and when is worth recording.
  await writeAudit({
    event: 'security.data_exported',
    organizationId: context.organizationId,
    actorId: context.memberId,
    target: { type: 'report', id: 'delivery_pack', name: 'Delivery report pack' },
    metadata: {
      format,
      kinds: pack.kinds,
      teams: pack.teams.length,
      rows: pack.teams.reduce(
        (total, team) => total + team.sections.reduce((sum, section) => sum + section.rows.length, 0),
        0,
      ),
    },
  })

  const stamp = pack.generatedAt.toISOString().slice(0, 10)
  return new Response(body, {
    headers: {
      'Content-Type': CONTENT_TYPES[format],
      'Content-Disposition': `attachment; filename="delivery-report-${stamp}.${format}"`,
      'Content-Length': String(body.byteLength),
      'Cache-Control': 'no-store',
    },
  })
})
