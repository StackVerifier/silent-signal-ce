import type {
  DashboardMetrics,
  QAItem,
  Release,
  RiskLevel,
  ServiceHealth,
  Sprint,
} from '@/lib/types'

/**
 * The four headline risk cards, derived from data.
 *
 * These were previously four literals in JSX — scores, rule names, "PAY-123
 * blocked 5 days", all invented and identical on every install. For a product
 * whose claim is that every score decomposes into the rules that produced it,
 * a fabricated decomposition is the one thing that must not ship.
 *
 * `impact` is optional here, unlike the domain `RiskReason`. A release carries
 * real weights from the rule engine; the other three are derived from counts,
 * and attaching a made-up percentage to them would recreate the same problem in
 * a subtler form. The card renders the contribution bar only where a weight is
 * actually known.
 *
 * Each builder returns null when its inputs are missing, so a card is omitted
 * rather than rendered with zeros that read as real measurements.
 */

export interface CardReason {
  rule: string
  value: string
  /** Percentage contribution, when the rule engine supplies one. */
  impact?: number
}

export interface RiskCardModel {
  key: string
  title: string
  subtitle: string
  score: number
  riskLevel: RiskLevel
  trend: 'up' | 'down' | 'stable'
  reasons: CardReason[]
  href: string
}

/** Shared thresholds, so a score and its badge cannot disagree. */
export function levelFor(score: number): RiskLevel {
  if (score >= 80) return 'HIGH'
  if (score >= 60) return 'MEDIUM'
  return 'LOW'
}

export function releaseCard(release: Release | undefined): RiskCardModel | null {
  if (!release) return null
  const openGates = release.gates?.filter((gate) => gate.status !== 'complete').length ?? 0
  return {
    key: 'release',
    title: 'Release Risk',
    subtitle: release.name,
    score: release.riskScore,
    riskLevel: release.riskLevel,
    trend: release.riskScore >= 60 ? 'up' : 'stable',
    // The rule engine's own decomposition, weights included.
    reasons: release.riskReasons?.length
      ? release.riskReasons.map((reason) => ({
          rule: reason.rule, value: reason.value, impact: reason.impact,
        }))
      : [{ rule: 'Open gates', value: `${openGates} gates not yet passed` }],
    href: '/release',
  }
}

export function sprintCard(sprint: Sprint | undefined, now: number): RiskCardModel | null {
  if (!sprint) return null

  const totalDays = Math.max(
    1,
    Math.ceil((sprint.endDate.getTime() - sprint.startDate.getTime()) / 86_400_000),
  )
  const daysLeft = Math.max(0, Math.ceil((sprint.endDate.getTime() - now) / 86_400_000))
  const elapsedPct = Math.round(((totalDays - daysLeft) / totalDays) * 100)
  const completionPct = sprint.totalPoints > 0
    ? Math.round((sprint.completedPoints / sprint.totalPoints) * 100)
    : 0
  const velocityDelta = sprint.velocity - sprint.previousVelocity

  // The same four rules the Sprint Intelligence page evaluates, so the two
  // screens can never disagree about why a sprint is at risk.
  const reasons: CardReason[] = [
    sprint.blockedCount > 0 && {
      rule: 'Blocked issues', value: `${sprint.blockedCount} blocked in sprint`,
    },
    sprint.addedMidSprintCount > 3 && {
      rule: 'Mid-sprint additions', value: `${sprint.addedMidSprintCount} issues added after start`,
    },
    velocityDelta < 0 && {
      rule: 'Velocity drop', value: `${Math.abs(velocityDelta)} pts below previous sprint`,
    },
    completionPct < elapsedPct && {
      rule: 'Behind schedule', value: `${completionPct}% done, ${elapsedPct}% elapsed`,
    },
  ].filter(Boolean) as CardReason[]

  return {
    key: 'sprint',
    title: 'Sprint Risk',
    subtitle: `${sprint.name} · ${sprint.team}`,
    // healthScore is "how well it is going"; the card shows risk.
    score: 100 - sprint.healthScore,
    riskLevel: levelFor(100 - sprint.healthScore),
    trend: velocityDelta < 0 ? 'up' : velocityDelta > 0 ? 'down' : 'stable',
    reasons,
    href: '/sprint',
  }
}

export function qaCard(
  queue: QAItem[] | undefined,
  metrics: DashboardMetrics | undefined,
): RiskCardModel | null {
  if (!queue?.length) return null

  const waitingOver3 = queue.filter((item) => item.waitingDays > 3).length
  const unassigned = queue.filter((item) => item.assignee === 'Unassigned').length
  const regressions = queue.filter((item) => item.status === 'Regression').length
  const avgWait = metrics?.qaWaitAvgDays
    ?? Math.round((queue.reduce((total, item) => total + item.waitingDays, 0) / queue.length) * 10) / 10

  // The queue's own risk scores are what the rule engine produced per item;
  // the queue's risk is the worst of them, not an average that hides a
  // five-day-old critical behind nine healthy ones.
  const score = Math.max(...queue.map((item) => item.riskScore))

  const reasons: CardReason[] = [
    waitingOver3 > 0 && { rule: 'Wait > 3 days', value: `${waitingOver3} items over 3 days` },
    unassigned > 0 && { rule: 'Unassigned', value: `${unassigned} items with no tester` },
    regressions > 0 && { rule: 'Regression', value: `${regressions} items back in regression` },
    { rule: 'Average wait', value: `${avgWait} days across the queue` },
  ].filter(Boolean) as CardReason[]

  return {
    key: 'qa',
    title: 'QA Queue Risk',
    subtitle: `${queue.length} items pending`,
    score,
    riskLevel: levelFor(score),
    trend: waitingOver3 > 0 ? 'up' : 'stable',
    reasons,
    href: '/qa-queue',
  }
}

export function serviceCard(services: ServiceHealth[] | undefined): RiskCardModel | null {
  if (!services?.length) return null

  // The riskiest service is the one worth a headline card; the rest are in the
  // radar beside it.
  const worst = [...services].sort((a, b) => b.riskScore - a.riskScore)[0]

  return {
    key: 'service',
    title: 'Service Risk',
    subtitle: worst.name,
    score: worst.riskScore,
    riskLevel: worst.riskLevel,
    trend: worst.trend,
    reasons: worst.signals.length
      ? worst.signals.slice(0, 3).map((signal) => ({
          rule: signal.title, value: signal.description,
        }))
      : [{ rule: 'No open signals', value: 'Score reflects historical rule triggers' }],
    href: '/risk-timeline',
  }
}

export function riskCards(input: {
  release?: Release
  sprint?: Sprint
  queue?: QAItem[]
  services?: ServiceHealth[]
  metrics?: DashboardMetrics
  now: number
}): RiskCardModel[] {
  return [
    releaseCard(input.release),
    sprintCard(input.sprint, input.now),
    qaCard(input.queue, input.metrics),
    serviceCard(input.services),
  ].filter((card): card is RiskCardModel => card !== null)
}
