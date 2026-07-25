'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle, AlertTriangle, XCircle, Lock, ChevronDown, ChevronRight, Calendar, Users } from 'lucide-react'
import { SectionCard, ScoreBar, PriorityBadge, GateStatusBadge, RiskLevelBadge } from './shared'
import { releases } from '@/lib/mock-data'
import type { Release, GateStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

function GateStatusIcon({ status }: { status: GateStatus }) {
  if (status === 'complete')     return <CheckCircle className="w-4 h-4 text-[#22C55E]" />
  if (status === 'in-progress')  return <div className="w-4 h-4 rounded-full border-2 border-[#6C63FF] border-t-transparent animate-spin" />
  if (status === 'at-risk')      return <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
  return <Lock className="w-4 h-4 text-[#EF4444]" />
}

function ConfidenceMeter({ value }: { value: number }) {
  const color = value >= 85 ? '#22C55E' : value >= 70 ? '#F59E0B' : '#EF4444'
  const circ = 2 * Math.PI * 56
  return (
    <div className="relative w-36 h-36 flex items-center justify-center mx-auto">
      <svg className="-rotate-90" viewBox="0 0 128 128" width="144" height="144">
        {/* bg track */}
        <circle cx="64" cy="64" r="56" fill="none" stroke="#1E2D4A" strokeWidth="6" />
        {/* filled */}
        <motion.circle
          cx="64" cy="64" r="56" fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - (value / 100) * circ }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 8px ${color}60)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold" style={{ color }}>{value}%</span>
        <span className="text-[10px] text-[#64748B] mt-1">confidence</span>
      </div>
    </div>
  )
}

function ReleaseHeader({ release }: { release: Release }) {
  const daysLeft = Math.ceil((release.targetDate.getTime() - Date.now()) / 86400000)

  return (
    <div className="bg-[#151D32] border border-[#1E2D4A] rounded-xl p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-xl font-bold text-[#E2E8F0]">{release.name}</h2>
            <span className="text-xs font-mono bg-[#1E2D4A] text-[#94A3B8] px-2 py-0.5 rounded">v{release.version}</span>
            <RiskLevelBadge level={release.riskLevel} />
          </div>
          <div className="flex items-center gap-4 text-xs text-[#64748B]">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              {release.targetDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              {release.teamCount} team members
            </span>
            <span className={cn('font-semibold', daysLeft <= 3 ? 'text-[#EF4444]' : daysLeft <= 7 ? 'text-[#F59E0B]' : 'text-[#22C55E]')}>
              {daysLeft} days until release
            </span>
          </div>
        </div>
        <ConfidenceMeter value={release.confidence} />
      </div>

      {/* Risk reasons */}
      <div className="border-t border-[#1E2D4A] pt-4">
        <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider mb-3">Risk Breakdown — Score {release.riskScore}</p>
        <div className="space-y-3">
          {release.riskReasons.map((reason, i) => (
            <motion.div
              key={i}
              className="space-y-1.5"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#94A3B8]">{reason.value}</span>
                <span className="font-mono text-[#64748B]">{reason.impact}%</span>
              </div>
              <ScoreBar
                value={reason.impact}
                color={reason.impact >= 30 ? '#EF4444' : reason.impact >= 20 ? '#F59E0B' : '#6C63FF'}
                delay={i * 0.1}
                height="h-1"
              />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ReleaseGates({ release }: { release: Release }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <SectionCard title="Release Gates" subtitle="Deployment readiness checklist">
      <div className="p-4 space-y-2">
        {release.gates.map((gate, i) => (
          <motion.div
            key={gate.name}
            className="bg-[#111827] border border-[#1E2D4A]/60 rounded-xl overflow-hidden"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <button
              onClick={() => setExpanded(expanded === gate.name ? null : gate.name)}
              className="w-full flex items-center gap-4 p-4 hover:bg-[#151D32] transition-colors"
            >
              <GateStatusIcon status={gate.status} />
              <span className="flex-1 text-sm font-medium text-[#E2E8F0] text-left">{gate.name}</span>
              <div className="flex items-center gap-3">
                <div className="w-24 hidden sm:block">
                  <ScoreBar
                    value={gate.percent}
                    color={gate.status === 'complete' ? '#22C55E' : gate.status === 'at-risk' ? '#F59E0B' : gate.status === 'blocked' ? '#EF4444' : '#6C63FF'}
                    height="h-1"
                  />
                </div>
                <span className="text-xs font-mono text-[#64748B] w-10 text-right">{gate.percent}%</span>
                <GateStatusBadge status={gate.status} />
                {gate.issueCount > 0 && (
                  <span className="text-[10px] text-[#EF4444] bg-[#EF4444]/10 px-1.5 py-0.5 rounded-full">
                    {gate.issueCount}
                  </span>
                )}
                {expanded === gate.name ? (
                  <ChevronDown className="w-3.5 h-3.5 text-[#64748B]" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-[#64748B]" />
                )}
              </div>
            </button>
            {expanded === gate.name && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="border-t border-[#1E2D4A] px-4 py-3 bg-[#0D1526]"
              >
                <p className="text-xs text-[#64748B]">
                  {gate.status === 'complete' && 'All checks passed — gate cleared.'}
                  {gate.status === 'in-progress' && `${gate.issueCount} item${gate.issueCount !== 1 ? 's' : ''} remaining before this gate clears.`}
                  {gate.status === 'at-risk' && `${gate.issueCount} items at risk — needs attention before release.`}
                  {gate.status === 'blocked' && 'Gate blocked — waiting on upstream gates to complete.'}
                </p>
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>
    </SectionCard>
  )
}

function BlockingIssues({ release }: { release: Release }) {
  if (release.blockingIssues.length === 0) {
    return (
      <SectionCard title="Blocking Issues" subtitle="Issues preventing release">
        <div className="p-8 flex items-center justify-center gap-2 text-[#22C55E]">
          <CheckCircle className="w-4 h-4" />
          <span className="text-sm">No blocking issues</span>
        </div>
      </SectionCard>
    )
  }

  return (
    <SectionCard
      title="Blocking Issues"
      subtitle={`${release.blockingIssues.length} issues preventing sign-off`}
    >
      <div className="divide-y divide-[#1E2D4A]/50">
        {release.blockingIssues.map((issue, i) => (
          <motion.div
            key={issue.id}
            className="flex items-start gap-4 px-5 py-4 hover:bg-[#1a2440] transition-colors"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
          >
            <div className="flex items-center justify-center w-6 h-6 rounded bg-[#EF4444]/15 flex-shrink-0 mt-0.5">
              <span className="text-[10px] font-bold text-[#EF4444]">{i + 1}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-xs font-mono font-semibold text-[#6C63FF]">{issue.key}</span>
                <PriorityBadge priority={issue.priority} />
              </div>
              <p className="text-xs text-[#E2E8F0]">{issue.title}</p>
              <div className="flex items-center gap-3 mt-1.5 text-[10px] text-[#64748B]">
                <span>{issue.assignee}</span>
                <span>·</span>
                <span>{issue.daysInStatus} days in {issue.status}</span>
              </div>
            </div>
            <div className="flex-shrink-0">
              <div className="flex items-center gap-1 text-[10px] font-mono">
                <span className="text-[#64748B]">risk</span>
                <span className={cn('font-bold', issue.riskScore >= 70 ? 'text-[#EF4444]' : 'text-[#F59E0B]')}>
                  {issue.riskScore}
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </SectionCard>
  )
}

function ServiceCoverage({ release }: { release: Release }) {
  return (
    <SectionCard title="Service Coverage" subtitle={`${release.services.length} services in scope`}>
      <div className="p-4 grid grid-cols-2 gap-2">
        {release.services.map((service, i) => (
          <motion.div
            key={service}
            className="flex items-center gap-2 bg-[#111827] border border-[#1E2D4A]/60 rounded-lg px-3 py-2.5"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#6C63FF] flex-shrink-0" />
            <span className="text-xs text-[#E2E8F0] truncate">{service}</span>
          </motion.div>
        ))}
      </div>
    </SectionCard>
  )
}

export function ReleaseControl() {
  const [selectedRelease, setSelectedRelease] = useState(releases[0].id)
  const release = releases.find(r => r.id === selectedRelease) || releases[0]

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#E2E8F0]">Release Control</h2>
          <p className="text-xs text-[#64748B] mt-0.5">Gate-based release readiness tracking</p>
        </div>
        <div className="flex items-center gap-2">
          {releases.map(r => (
            <button
              key={r.id}
              onClick={() => setSelectedRelease(r.id)}
              className={cn(
                'text-xs px-3 py-1.5 rounded-lg border transition-all',
                selectedRelease === r.id
                  ? 'bg-[#6C63FF]/15 text-[#6C63FF] border-[#6C63FF]/40'
                  : 'text-[#64748B] border-[#1E2D4A] hover:bg-[#151D32]'
              )}
            >
              {r.name}
            </button>
          ))}
        </div>
      </div>

      {/* Release header card */}
      <ReleaseHeader release={release} />

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <ReleaseGates release={release} />
          <BlockingIssues release={release} />
        </div>
        <div className="space-y-4">
          <ServiceCoverage release={release} />
        </div>
      </div>
    </div>
  )
}
