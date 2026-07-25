import { describe, expect, it } from 'vitest'
import { levelFor, qaCard, releaseCard, riskCards, serviceCard, sprintCard } from '@/lib/dashboard/risk-cards'
import type { QAItem, Release, ServiceHealth, Sprint } from '@/lib/types'

const DAY = 86_400_000
const NOW = Date.UTC(2026, 0, 15)

function sprint(overrides: Partial<Sprint> = {}): Sprint {
  return {
    id: 's1', name: 'Sprint 42', team: 'Platform',
    startDate: new Date(NOW - 10 * DAY), endDate: new Date(NOW + 4 * DAY),
    totalPoints: 100, completedPoints: 50, remainingPoints: 50,
    issues: [], velocity: 67, previousVelocity: 82,
    healthScore: 74, riskLevel: 'MEDIUM', blockedCount: 3, addedMidSprintCount: 5,
    ...overrides,
  }
}

function qaItem(overrides: Partial<QAItem> = {}): QAItem {
  return {
    id: 'q1', issueKey: 'PAY-1', title: 'x', priority: 'High',
    assignee: 'Deniz', waitingDays: 1, status: 'Waiting',
    service: 'Payment', riskScore: 20, reopenCount: 0,
    ...overrides,
  }
}

describe('levelFor', () => {
  it('agrees at the boundaries, so a score and its badge cannot disagree', () => {
    expect(levelFor(80)).toBe('HIGH')
    expect(levelFor(79)).toBe('MEDIUM')
    expect(levelFor(60)).toBe('MEDIUM')
    expect(levelFor(59)).toBe('LOW')
  })
})

describe('release card', () => {
  const release = {
    id: 'r1', name: 'Platform v2.4', version: '2.4.0',
    targetDate: new Date(NOW + 14 * DAY), confidence: 78,
    riskLevel: 'HIGH', riskScore: 82,
    riskReasons: [{ rule: 'QA completion < 80%', impact: 30, value: '12 items pending QA' }],
    gates: [
      { name: 'Development', status: 'complete', percent: 100, issueCount: 0 },
      { name: 'QA', status: 'at-risk', percent: 70, issueCount: 4 },
    ],
    blockingIssues: [], services: [], teamCount: 2,
  } as Release

  it('uses the rule engine decomposition, weights included', () => {
    const card = releaseCard(release)!
    expect(card.score).toBe(82)
    expect(card.riskLevel).toBe('HIGH')
    expect(card.reasons[0]).toEqual({
      rule: 'QA completion < 80%', impact: 30, value: '12 items pending QA',
    })
  })

  it('falls back to counting open gates when the engine gave no reasons', () => {
    const card = releaseCard({ ...release, riskReasons: [] })!
    expect(card.reasons).toHaveLength(1)
    expect(card.reasons[0].value).toBe('1 gates not yet passed')
    // No fabricated weight on a derived reason.
    expect(card.reasons[0].impact).toBeUndefined()
  })

  it('is omitted entirely when there is no release', () => {
    expect(releaseCard(undefined)).toBeNull()
  })
})

describe('sprint card', () => {
  it('inverts health into risk', () => {
    // healthScore is "how well it is going"; the card shows risk.
    const card = sprintCard(sprint({ healthScore: 74 }), NOW)!
    expect(card.score).toBe(26)
    expect(card.riskLevel).toBe('LOW')
  })

  it('lists only the rules that actually fired', () => {
    const card = sprintCard(sprint(), NOW)!
    const rules = card.reasons.map((reason) => reason.rule)
    expect(rules).toContain('Blocked issues')
    expect(rules).toContain('Mid-sprint additions')
    expect(rules).toContain('Velocity drop')

    const calm = sprintCard(
      sprint({ blockedCount: 0, addedMidSprintCount: 1, velocity: 90, previousVelocity: 82, completedPoints: 95 }),
      NOW,
    )!
    expect(calm.reasons).toEqual([])
  })

  it('never carries an invented weight', () => {
    for (const reason of sprintCard(sprint(), NOW)!.reasons) {
      expect(reason.impact).toBeUndefined()
    }
  })

  it('survives a zero-point sprint without dividing by zero', () => {
    const card = sprintCard(sprint({ totalPoints: 0, completedPoints: 0 }), NOW)!
    expect(Number.isFinite(card.score)).toBe(true)
    expect(card.reasons.every((reason) => !reason.value.includes('NaN'))).toBe(true)
  })
})

describe('QA card', () => {
  it('takes the worst item score, not an average', () => {
    // An average would hide one five-day-old critical behind nine healthy ones.
    const card = qaCard(
      [qaItem({ riskScore: 10 }), qaItem({ id: 'q2', riskScore: 88 }), qaItem({ id: 'q3', riskScore: 12 })],
      undefined,
    )!
    expect(card.score).toBe(88)
    expect(card.riskLevel).toBe('HIGH')
  })

  it('counts long waits, unassigned items and regressions', () => {
    const card = qaCard([
      qaItem({ waitingDays: 5 }),
      qaItem({ id: 'q2', assignee: 'Unassigned' }),
      qaItem({ id: 'q3', status: 'Regression' }),
    ], undefined)!
    const values = card.reasons.map((reason) => reason.value)
    expect(values).toContain('1 items over 3 days')
    expect(values).toContain('1 items with no tester')
    expect(values).toContain('1 items back in regression')
  })

  it('is omitted when the queue is empty rather than showing a zero', () => {
    expect(qaCard([], undefined)).toBeNull()
    expect(qaCard(undefined, undefined)).toBeNull()
  })
})

describe('service card', () => {
  const services: ServiceHealth[] = [
    { name: 'Checkout', riskScore: 35, riskLevel: 'LOW', signals: [], trend: 'stable' },
    { name: 'Payment', riskScore: 87, riskLevel: 'HIGH', signals: [], trend: 'up' },
  ]

  it('headlines the riskiest service', () => {
    const card = serviceCard(services)!
    expect(card.subtitle).toBe('Payment')
    expect(card.score).toBe(87)
  })

  it('says so plainly when a score has no open signals behind it', () => {
    expect(serviceCard(services)!.reasons[0].rule).toBe('No open signals')
  })

  it('is omitted when no service health is known', () => {
    expect(serviceCard([])).toBeNull()
  })
})

describe('riskCards', () => {
  it('drops the cards it cannot build instead of padding the grid', () => {
    const cards = riskCards({ sprint: sprint(), now: NOW })
    expect(cards.map((card) => card.key)).toEqual(['sprint'])
  })

  it('returns nothing at all on an empty workspace', () => {
    expect(riskCards({ now: NOW })).toEqual([])
  })
})
