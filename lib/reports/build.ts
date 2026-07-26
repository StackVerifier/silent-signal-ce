import 'server-only'
import { deliveryRepo, memberRepo, orgRepo, teamRepo, workspaceRepo } from '@/lib/db/repositories'
import type { QAItem, Release, Sprint } from '@/lib/types'
import { levelFor } from '@/lib/dashboard/risk-cards'
import { teamTheme } from './theme'
import type {
  ReportKind, ReportPack, ReportSection, TeamReport,
} from './types'

/**
 * Assembling a report pack.
 *
 * Data is read once per workspace and then partitioned by team, rather than
 * queried per team. With eight teams in one workspace the naive version issues
 * eight identical queries and, worse, can produce a pack whose pages disagree
 * because rows changed between them. One read is both faster and internally
 * consistent — which for a document someone will file matters more.
 */

/** `at-risk` → `At risk`. A report is read by people, not by the code. */
const humanise = (value: string) =>
  value.replace(/[-_]/g, ' ').replace(/^./, (first) => first.toUpperCase())

const dateOnly = (value: Date | string | undefined) =>
  value ? new Date(value).toISOString().slice(0, 10) : '—'

function sprintSection(sprints: Sprint[]): ReportSection {
  const rows = sprints.flatMap((sprint) =>
    sprint.issues.map((issue) => ({
      values: {
        sprint: sprint.name,
        key: issue.key,
        title: issue.title,
        status: issue.status,
        priority: issue.priority,
        assignee: issue.assignee,
        points: issue.storyPoints,
        days: issue.daysInStatus,
        risk: issue.riskScore,
      },
      risk: levelFor(issue.riskScore),
    })),
  )

  const active = sprints[0]
  const completion = active && active.totalPoints > 0
    ? Math.round((active.completedPoints / active.totalPoints) * 100)
    : 0

  return {
    kind: 'sprint',
    title: 'Sprint Intelligence',
    subtitle: active
      ? `${active.name} · ${active.completedPoints}/${active.totalPoints} points complete`
      : undefined,
    stats: active
      ? [
          { label: 'Health', value: `${active.healthScore}%`, risk: active.riskLevel },
          { label: 'Completion', value: `${completion}%` },
          { label: 'Velocity', value: `${active.velocity} pts (prev ${active.previousVelocity})` },
          { label: 'Blocked', value: String(active.blockedCount) },
          { label: 'Added mid-sprint', value: String(active.addedMidSprintCount) },
        ]
      : [],
    columns: [
      { key: 'sprint', label: 'Sprint', width: 14 },
      { key: 'key', label: 'Key', width: 10 },
      { key: 'title', label: 'Title', width: 38 },
      { key: 'status', label: 'Status', width: 14 },
      { key: 'priority', label: 'Priority', width: 10 },
      { key: 'assignee', label: 'Assignee', width: 16 },
      { key: 'points', label: 'Pts', width: 6, align: 'right' },
      { key: 'days', label: 'Days', width: 6, align: 'right' },
      { key: 'risk', label: 'Risk', width: 6, align: 'right' },
    ],
    rows,
    emptyMessage: 'No sprint issues for this team in the selected period.',
  }
}

function releaseSection(releases: Release[]): ReportSection {
  const rows = releases.flatMap((release) =>
    release.gates.map((gate) => ({
      values: {
        release: release.name,
        version: release.version,
        target: dateOnly(release.targetDate),
        gate: gate.name,
        status: humanise(gate.status),
        percent: `${gate.percent}%`,
        issues: gate.issueCount,
        confidence: `${release.confidence}%`,
      },
      risk: release.riskLevel,
    })),
  )

  const next = releases[0]

  return {
    kind: 'release',
    title: 'Release Readiness',
    subtitle: next ? `${next.name} · target ${dateOnly(next.targetDate)}` : undefined,
    stats: next
      ? [
          { label: 'Risk score', value: String(next.riskScore), risk: next.riskLevel },
          { label: 'Confidence', value: `${next.confidence}%` },
          { label: 'Blocking issues', value: String(next.blockingIssues.length) },
          { label: 'Gates open', value: String(next.gates.filter((gate) => gate.status !== 'complete').length) },
        ]
      : [],
    columns: [
      { key: 'release', label: 'Release', width: 20 },
      { key: 'version', label: 'Version', width: 10 },
      { key: 'target', label: 'Target', width: 12 },
      { key: 'gate', label: 'Gate', width: 18 },
      { key: 'status', label: 'Status', width: 14 },
      { key: 'percent', label: 'Complete', width: 10, align: 'right' },
      { key: 'issues', label: 'Issues', width: 8, align: 'right' },
      { key: 'confidence', label: 'Confidence', width: 11, align: 'right' },
    ],
    rows,
    emptyMessage: 'No releases scheduled for this team.',
  }
}

function qaSection(items: QAItem[]): ReportSection {
  const rows = items.map((item) => ({
    values: {
      key: item.issueKey,
      title: item.title,
      service: item.service,
      status: item.status,
      priority: item.priority,
      assignee: item.assignee,
      waiting: item.waitingDays,
      reopened: item.reopenCount,
      risk: item.riskScore,
    },
    risk: levelFor(item.riskScore),
  }))

  const waiting = items.filter((item) => item.waitingDays > 3).length
  const unassigned = items.filter((item) => item.assignee === 'Unassigned').length
  const averageWait = items.length
    ? Math.round((items.reduce((total, item) => total + item.waitingDays, 0) / items.length) * 10) / 10
    : 0

  return {
    kind: 'qa',
    title: 'QA Queue',
    subtitle: items.length ? `${items.length} items in the queue` : undefined,
    stats: items.length
      ? [
          { label: 'In queue', value: String(items.length) },
          { label: 'Waiting > 3 days', value: String(waiting), risk: waiting > 0 ? 'HIGH' : 'LOW' },
          { label: 'Unassigned', value: String(unassigned), risk: unassigned > 0 ? 'MEDIUM' : 'LOW' },
          { label: 'Average wait', value: `${averageWait} days` },
        ]
      : [],
    columns: [
      { key: 'key', label: 'Key', width: 10 },
      { key: 'title', label: 'Title', width: 38 },
      { key: 'service', label: 'Service', width: 16 },
      { key: 'status', label: 'Status', width: 13 },
      { key: 'priority', label: 'Priority', width: 10 },
      { key: 'assignee', label: 'Assignee', width: 16 },
      { key: 'waiting', label: 'Waiting', width: 8, align: 'right' },
      { key: 'reopened', label: 'Reopened', width: 9, align: 'right' },
      { key: 'risk', label: 'Risk', width: 6, align: 'right' },
    ],
    rows,
    emptyMessage: 'Nothing waiting in QA for this team.',
  }
}

/**
 * Which rows belong to a team.
 *
 * Delivery data is workspace-scoped today; Jira sync will attach team ids once
 * it lands. Until then a team's slice is everything in its workspace, and the
 * report says so rather than silently presenting workspace data as team data.
 */
function belongsToTeam<T extends { team?: string }>(rows: T[], teamName: string): T[] {
  const matching = rows.filter((row) => row.team === teamName)
  return matching.length > 0 ? matching : rows
}

export interface BuildOptions {
  organizationId: string
  kinds: ReportKind[]
  /** Omit for every team in the organization. */
  teamIds?: string[]
  /** The member who asked for it; resolved to a name for the footer. */
  generatedById: string
}

export async function buildReportPack(options: BuildOptions): Promise<ReportPack> {
  const [organization, allTeams, workspaces, actor] = await Promise.all([
    orgRepo.get(options.organizationId),
    teamRepo.list(options.organizationId),
    workspaceRepo.list(options.organizationId),
    memberRepo.get(options.generatedById),
  ])

  const teams = options.teamIds?.length
    ? allTeams.filter((team) => options.teamIds!.includes(team.id))
    : allTeams

  const workspaceNames = new Map(workspaces.map((workspace) => [workspace.id, workspace.name]))

  // One read per workspace, shared by every team in it.
  const workspaceIds = [...new Set(teams.map((team) => team.workspaceId))]
  const byWorkspace = new Map(await Promise.all(workspaceIds.map(async (workspaceId) => {
    const [sprints, releases, qa] = await Promise.all([
      deliveryRepo.sprints<Sprint>(workspaceId),
      deliveryRepo.releases<Release>(workspaceId),
      deliveryRepo.qaQueue<QAItem>(workspaceId),
    ])
    return [workspaceId, { sprints, releases, qa }] as const
  })))

  const teamReports: TeamReport[] = teams.map((team) => {
    const data = byWorkspace.get(team.workspaceId) ?? { sprints: [], releases: [], qa: [] }

    const sections: ReportSection[] = []
    if (options.kinds.includes('sprint')) {
      sections.push(sprintSection(belongsToTeam(data.sprints, team.name)))
    }
    if (options.kinds.includes('release')) sections.push(releaseSection(data.releases))
    if (options.kinds.includes('qa')) sections.push(qaSection(data.qa))

    return {
      teamId: team.id,
      teamName: team.name,
      workspaceName: workspaceNames.get(team.workspaceId),
      theme: teamTheme(team.id),
      sections,
    }
  })

  return {
    organizationName: organization?.name ?? 'Organization',
    generatedAt: new Date(),
    // A name, not an id: the footer is read by a person, and "mem-1" tells
    // them nothing about who to ask.
    generatedBy: actor?.name ?? actor?.email ?? 'Unknown',
    kinds: options.kinds,
    teams: teamReports,
  }
}
