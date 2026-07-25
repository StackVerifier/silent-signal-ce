'use client'

import { motion } from 'framer-motion'
import { AlertTriangle, Activity, FlaskConical, Shield, Zap, GitBranch, ArrowRight, Clock } from 'lucide-react'
import Link from 'next/link'
import { RiskCard } from './risk-card'
import { SectionCard, ScoreBar, SeverityDot } from './shared'
import { MetricInfo } from '@/components/ui/tooltip'
import {
  dashboardMetrics, serviceHealth, liveSignals, releases, sprints
} from '@/lib/mock-data'

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0 },
}

const stagger = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.06 } },
}

function SyncIndicator() {
  return (
    <div className="flex items-center gap-2 text-xs text-[#64748B]">
      <span className="w-1.5 h-1.5 bg-[#22C55E] rounded-full pulse-dot" />
      <span>BLE polling active — cache-first</span>
    </div>
  )
}

function TopMetrics() {
  const m = dashboardMetrics
  const tiles = [
    {
      label: 'Release Health',
      value: m.releaseHealth,
      unit: '%',
      color: m.releaseHealth >= 80 ? '#EF4444' : m.releaseHealth >= 60 ? '#F59E0B' : '#22C55E',
      icon: GitBranch,
      href: '/release',
      riskLevel: m.releaseRiskLevel,
      formula: 'Weighted risk of open gates, blockers and days remaining',
      source: 'Jira releases + gate checklist',
    },
    {
      label: 'Sprint Health',
      value: m.sprintHealth,
      unit: '%',
      color: m.sprintHealth < 70 ? '#F59E0B' : '#22C55E',
      icon: Zap,
      href: '/sprint',
      riskLevel: m.sprintRiskLevel,
      formula: 'Completed story points ÷ committed points, adjusted for scope change',
      source: 'Jira board — active sprint',
    },
    {
      label: 'QA Queue',
      value: m.qaQueueSize,
      unit: 'items',
      color: m.qaQueueSize > 15 ? '#EF4444' : '#F59E0B',
      icon: FlaskConical,
      href: '/qa-queue',
      riskLevel: null,
      formula: 'Issues in a QA status with no tester assigned or still in test',
      source: 'Jira issues — QA workflow states',
    },
    {
      label: 'Blocked Issues',
      value: m.blockedIssues,
      unit: 'issues',
      color: m.blockedIssues > 3 ? '#EF4444' : '#F59E0B',
      icon: AlertTriangle,
      href: '/sprint',
      riskLevel: null,
      formula: 'Issues flagged Blocked or with an unresolved blocking link',
      source: 'Jira issue links + flags',
    },
    {
      label: 'Open Risks',
      value: m.openRisks,
      unit: 'signals',
      color: '#6C63FF',
      icon: Activity,
      href: '/risk-timeline',
      riskLevel: null,
      formula: 'Rule triggers in the last 14 days that are not acknowledged',
      source: 'Rule engine evaluations',
    },
    {
      label: 'Active Rules',
      value: m.activeRules,
      unit: 'rules',
      color: '#00D4FF',
      icon: Shield,
      href: '/rules',
      riskLevel: null,
      formula: 'Enabled rules evaluated on every sync',
      source: 'Rule configuration',
    },
  ]

  return (
    <motion.div
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3"
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      {tiles.map((tile, i) => (
        <motion.div key={i} variants={fadeUp}>
          <Link href={tile.href}>
            <div className="bg-[#151D32] border border-[#1E2D4A] rounded-xl p-4 hover:border-[#6C63FF]/40 hover:bg-[#1a2440] hover:shadow-lg hover:shadow-black/20 transition-colors group h-full">
              <div className="flex items-start justify-between mb-3">
                <span className="flex items-center gap-1">
                  <tile.icon aria-hidden="true" className="w-4 h-4" style={{ color: tile.color }} />
                  {tile.formula && (
                    <span
                      className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
                      onClick={(event) => event.preventDefault()}
                    >
                      <MetricInfo
                        formula={tile.formula}
                        source={tile.source ?? 'Jira'}
                        updatedAt={m.lastSyncAt}
                        side="bottom"
                      />
                    </span>
                  )}
                </span>
                {tile.riskLevel && (
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                    tile.riskLevel === 'HIGH' ? 'bg-[#EF4444]/15 text-[#EF4444]' :
                    tile.riskLevel === 'MEDIUM' ? 'bg-[#F59E0B]/15 text-[#F59E0B]' :
                    'bg-[#22C55E]/15 text-[#22C55E]'
                  }`}>
                    {tile.riskLevel}
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold leading-none" style={{ color: tile.color }}>
                {tile.value}
              </p>
              <p className="text-[10px] text-[#64748B] mt-1.5">{tile.unit}</p>
              <p className="text-[10px] font-medium text-[#94A3B8] mt-0.5">{tile.label}</p>
            </div>
          </Link>
        </motion.div>
      ))}
    </motion.div>
  )
}

function RiskRadar() {
  return (
    <SectionCard
      title="Risk Radar"
      subtitle="Service health by rule engine"
      action={
        <Link href="/risk-timeline" className="text-xs text-[#6C63FF] hover:text-[#8B85FF] flex items-center gap-1 transition-colors">
          Timeline <ArrowRight className="w-3 h-3" />
        </Link>
      }
    >
      <div className="p-5 space-y-4">
        {serviceHealth.map((svc, i) => (
          <motion.div
            key={svc.name}
            className="space-y-1.5"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SeverityDot severity={
                  svc.riskLevel === 'HIGH' ? 'critical' :
                  svc.riskLevel === 'MEDIUM' ? 'high' : 'low'
                } />
                <span className="text-xs text-[#E2E8F0]">{svc.name}</span>
                {svc.signals.length > 0 && (
                  <span className="text-[9px] text-[#64748B] bg-[#1E2D4A] px-1.5 py-0.5 rounded-full">
                    {svc.signals.length} signal{svc.signals.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <span className="text-xs font-mono font-bold text-[#E2E8F0]">{svc.riskScore}%</span>
            </div>
            <ScoreBar
              value={svc.riskScore}
              color={svc.riskLevel === 'HIGH' ? '#EF4444' : svc.riskLevel === 'MEDIUM' ? '#F59E0B' : '#22C55E'}
              delay={i * 0.1}
            />
          </motion.div>
        ))}
      </div>
    </SectionCard>
  )
}

function LiveSignalsFeed() {
  const signals = liveSignals

  const timeAgo = (date: Date) => {
    const diff = Math.floor((Date.now() - date.getTime()) / 60000)
    if (diff < 1) return 'just now'
    if (diff < 60) return `${diff}m ago`
    return `${Math.floor(diff / 60)}h ago`
  }

  return (
    <SectionCard
      title="Live Signals"
      subtitle="Real-time rule engine output"
      action={
        <span className="flex items-center gap-1.5 text-[10px] text-[#22C55E]">
          <span className="w-1.5 h-1.5 bg-[#22C55E] rounded-full pulse-dot" />
          Listening
        </span>
      }
    >
      <div className="divide-y divide-[#1E2D4A]/50">
        {signals.map((signal, i) => (
          <motion.div
            key={signal.id}
            className="flex items-start gap-3 px-5 py-3 hover:bg-[#1a2440] transition-colors group"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <SeverityDot severity={signal.severity} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono font-semibold text-[#6C63FF]">{signal.issueKey}</span>
                <span className="text-[10px] text-[#64748B] bg-[#1E2D4A] px-1.5 py-0.5 rounded">{signal.service}</span>
              </div>
              <p className="text-xs text-[#94A3B8] mt-0.5 leading-relaxed">{signal.message}</p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Clock className="w-3 h-3 text-[#64748B]" />
              <span className="text-[10px] text-[#64748B] whitespace-nowrap">{timeAgo(signal.timestamp)}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </SectionCard>
  )
}

function SprintSnapshot() {
  const sprint = sprints[0]
  const completionPct = Math.round((sprint.completedPoints / sprint.totalPoints) * 100)
  const daysLeft = Math.ceil((sprint.endDate.getTime() - Date.now()) / 86400000)

  const issueStatuses = sprint.issues.reduce((acc, issue) => {
    acc[issue.status] = (acc[issue.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <SectionCard
      title={sprint.name}
      subtitle={`${daysLeft} days remaining · ${sprint.team}`}
      action={
        <Link href="/sprint" className="text-xs text-[#6C63FF] hover:text-[#8B85FF] flex items-center gap-1 transition-colors">
          Details <ArrowRight className="w-3 h-3" />
        </Link>
      }
    >
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: 'Completed', value: sprint.completedPoints, color: '#22C55E' },
            { label: 'Remaining', value: sprint.remainingPoints, color: '#F59E0B' },
            { label: 'Blocked', value: sprint.blockedCount, color: '#EF4444' },
          ].map((m, i) => (
            <div key={i} className="bg-[#111827] rounded-lg p-3 text-center">
              <p className="text-lg font-bold" style={{ color: m.color }}>{m.value}</p>
              <p className="text-[10px] text-[#64748B] mt-0.5">{m.label}</p>
            </div>
          ))}
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-[#64748B]">Completion</span>
            <span className="text-xs font-mono text-[#E2E8F0]">{completionPct}%</span>
          </div>
          <ScoreBar value={completionPct} color="#6C63FF" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-[#64748B]">Velocity</span>
            <span className="text-xs font-mono text-[#E2E8F0]">{sprint.velocity} pts <span className="text-[#EF4444]">↓{sprint.previousVelocity - sprint.velocity}</span></span>
          </div>
          <ScoreBar value={sprint.velocity} max={sprint.previousVelocity + 20} color="#00D4FF" delay={0.2} />
        </div>
        {sprint.addedMidSprintCount > 0 && (
          <div className="flex items-center gap-2 text-xs text-[#F59E0B] bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded-lg px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{sprint.addedMidSprintCount} issues added mid-sprint — scope risk</span>
          </div>
        )}
      </div>
    </SectionCard>
  )
}

function ReleaseSnapshot() {
  const release = releases[0]
  return (
    <SectionCard
      title={release.name}
      subtitle={`v${release.version} — ${release.targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
      action={
        <Link href="/release" className="text-xs text-[#6C63FF] hover:text-[#8B85FF] flex items-center gap-1 transition-colors">
          Details <ArrowRight className="w-3 h-3" />
        </Link>
      }
    >
      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-[#64748B] mb-1">Release Confidence</p>
            <p className="text-3xl font-bold text-[#E2E8F0]">{release.confidence}%</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-[#64748B] mb-1">Risk Score</p>
            <p className="text-3xl font-bold text-[#EF4444]">{release.riskScore}</p>
          </div>
        </div>
        <div className="space-y-2">
          {release.gates.map((gate, i) => (
            <div key={gate.name} className="flex items-center gap-3">
              <span className="text-[10px] text-[#64748B] w-20 flex-shrink-0">{gate.name}</span>
              <div className="flex-1">
                <ScoreBar
                  value={gate.percent}
                  color={
                    gate.status === 'complete' ? '#22C55E' :
                    gate.status === 'in-progress' ? '#6C63FF' :
                    gate.status === 'at-risk' ? '#F59E0B' : '#EF4444'
                  }
                  delay={i * 0.1}
                  height="h-1"
                />
              </div>
              <span className="text-[10px] font-mono text-[#64748B] w-8 text-right">{gate.percent}%</span>
            </div>
          ))}
        </div>
        {release.blockingIssues.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] text-[#64748B] font-semibold uppercase tracking-wider">Blocking</p>
            {release.blockingIssues.slice(0, 2).map(issue => (
              <div key={issue.id} className="flex items-center gap-2 text-xs">
                <span className="w-1.5 h-1.5 bg-[#EF4444] rounded-full flex-shrink-0" />
                <span className="font-mono text-[#6C63FF]">{issue.key}</span>
                <span className="text-[#94A3B8] truncate">{issue.title}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </SectionCard>
  )
}

export function ExecutiveDashboard() {
  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <motion.div
        className="flex items-center justify-between"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <h2 className="text-lg font-semibold text-[#E2E8F0] text-balance">Operational Intelligence</h2>
          <p className="text-xs text-[#64748B] mt-0.5">Rule-based delivery risk — no AI, pure logic</p>
        </div>
        <SyncIndicator />
      </motion.div>

      {/* Top metric tiles */}
      <TopMetrics />

      {/* Main content: Risk cards + Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Risk Cards — 2 col */}
        <div className="lg:col-span-2 space-y-4">
          <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-widest">Risk Intelligence</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <RiskCard
              title="Release Risk"
              subtitle="Platform v2.4"
              score={82}
              riskLevel="HIGH"
              trend="up"
              reasons={[
                { rule: 'QA Wait > 5 days', impact: 40, value: '12 tasks waiting in QA' },
                { rule: 'Critical Bug Reopen', impact: 25, value: '3 critical issues reopened' },
                { rule: 'QA Capacity > 90%', impact: 15, value: 'QA team at 94% capacity' },
              ]}
              href="/release"
            />
            <RiskCard
              title="Sprint Risk"
              subtitle="Sprint 42 · Platform"
              score={74}
              riskLevel="MEDIUM"
              trend="up"
              reasons={[
                { rule: 'Velocity drop 22%', impact: 30, value: 'Down from 82 to 67 pts' },
                { rule: 'Mid-sprint additions', impact: 25, value: '5 issues added after start' },
                { rule: 'Blocked issues', impact: 20, value: '3 blocked issues in sprint' },
              ]}
              href="/sprint"
            />
            <RiskCard
              title="QA Queue Risk"
              subtitle="18 items pending"
              score={67}
              riskLevel="MEDIUM"
              trend="up"
              reasons={[
                { rule: 'QA Capacity > 90%', impact: 35, value: 'Team at 94% capacity' },
                { rule: 'Wait > 3 days', impact: 25, value: '5 items over 3 day wait' },
                { rule: 'Unassigned items', impact: 20, value: '4 items unassigned' },
              ]}
              href="/qa-queue"
            />
            <RiskCard
              title="Service Risk"
              subtitle="Payment Service"
              score={87}
              riskLevel="HIGH"
              trend="up"
              reasons={[
                { rule: 'Blocked > 2 days', impact: 40, value: 'PAY-123 blocked 5 days' },
                { rule: 'Critical unresolved', impact: 30, value: '2 critical open issues' },
                { rule: 'Regression incomplete', impact: 17, value: 'Regression at 40%' },
              ]}
              href="/risk-timeline"
            />
          </div>
        </div>

        {/* Risk Radar */}
        <RiskRadar />
      </div>

      {/* Bottom row: Sprint + Release + Live Signals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SprintSnapshot />
        <ReleaseSnapshot />
        <LiveSignalsFeed />
      </div>
    </div>
  )
}
