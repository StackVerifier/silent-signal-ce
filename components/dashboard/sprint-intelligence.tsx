'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, CheckCircle, Clock, Zap, TrendingDown, Plus } from 'lucide-react'
import { SectionCard, ScoreBar, PriorityBadge, RiskLevelBadge } from './shared'
import { sprints } from '@/lib/mock-data'
import type { Issue, IssueStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

const STATUS_COLORS: Record<IssueStatus, string> = {
  'To Do':           '#64748B',
  'In Progress':     '#6C63FF',
  'Development Done':'#00D4FF',
  'In Review':       '#F59E0B',
  'QA':              '#A78BFA',
  'Done':            '#22C55E',
  'Blocked':         '#EF4444',
}

function IssueRow({ issue, index }: { issue: Issue; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const statusColor = STATUS_COLORS[issue.status]

  return (
    <motion.div
      className="border-b border-[#1E2D4A]/50 last:border-0"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-[#1a2440] transition-colors text-left group"
      >
        {/* Risk indicator */}
        <div className="w-1.5 h-6 rounded-full flex-shrink-0" style={{
          backgroundColor: issue.riskScore >= 70 ? '#EF4444' : issue.riskScore >= 40 ? '#F59E0B' : '#22C55E'
        }} />

        {/* Key */}
        <span className="text-xs font-mono font-semibold text-[#6C63FF] w-20 flex-shrink-0">{issue.key}</span>

        {/* Title */}
        <span className="flex-1 text-xs text-[#E2E8F0] truncate">{issue.title}</span>

        {/* Badges */}
        <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
          <PriorityBadge priority={issue.priority} />
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded"
            style={{ color: statusColor, backgroundColor: `${statusColor}18` }}
          >
            {issue.status}
          </span>
          {issue.daysInStatus > 3 && (
            <span className="flex items-center gap-1 text-[10px] text-[#EF4444] bg-[#EF4444]/10 px-2 py-0.5 rounded">
              <Clock className="w-2.5 h-2.5" />
              {issue.daysInStatus}d
            </span>
          )}
        </div>

        {/* Points */}
        <span className="text-[10px] font-mono text-[#64748B] w-8 text-right flex-shrink-0">{issue.storyPoints}pt</span>
      </button>

      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="px-5 pb-4 bg-[#111827]"
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
            <div>
              <p className="text-[10px] text-[#64748B] mb-1">Assignee</p>
              <p className="text-xs text-[#E2E8F0]">{issue.assignee}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#64748B] mb-1">Days in Status</p>
              <p className="text-xs text-[#E2E8F0]">{issue.daysInStatus} days</p>
            </div>
            <div>
              <p className="text-[10px] text-[#64748B] mb-1">Risk Score</p>
              <p className="text-xs font-mono" style={{
                color: issue.riskScore >= 70 ? '#EF4444' : issue.riskScore >= 40 ? '#F59E0B' : '#22C55E'
              }}>{issue.riskScore}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#64748B] mb-1">Labels</p>
              <div className="flex flex-wrap gap-1">
                {issue.labels.map(l => (
                  <span key={l} className="text-[9px] text-[#64748B] bg-[#1E2D4A] px-1.5 py-0.5 rounded">{l}</span>
                ))}
              </div>
            </div>
          </div>
          {issue.blockedBy && issue.blockedBy.length > 0 && (
            <div className="mt-3 flex items-center gap-2 text-xs text-[#EF4444] bg-[#EF4444]/10 rounded-lg px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Blocked by: {issue.blockedBy.join(', ')}</span>
            </div>
          )}
          <div className="mt-3">
            <p className="text-[10px] text-[#64748B] mb-1.5">Risk Level</p>
            <ScoreBar
              value={issue.riskScore}
              color={issue.riskScore >= 70 ? '#EF4444' : issue.riskScore >= 40 ? '#F59E0B' : '#22C55E'}
            />
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}

function SprintHealthPanel({ sprint }: { sprint: typeof sprints[0] }) {
  const completionPct = Math.round((sprint.completedPoints / sprint.totalPoints) * 100)
  const daysLeft = Math.max(0, Math.ceil((sprint.endDate.getTime() - Date.now()) / 86400000))
  const totalDays = Math.ceil((sprint.endDate.getTime() - sprint.startDate.getTime()) / 86400000)
  const elapsedPct = Math.round(((totalDays - daysLeft) / totalDays) * 100)
  const velocityDelta = sprint.velocity - sprint.previousVelocity
  const velocityPct = Math.round((sprint.velocity / sprint.previousVelocity) * 100)

  const rules = [
    { triggered: sprint.blockedCount > 0, text: `${sprint.blockedCount} blocked issues`, severity: 'critical' as const },
    { triggered: sprint.addedMidSprintCount > 3, text: `${sprint.addedMidSprintCount} mid-sprint additions`, severity: 'high' as const },
    { triggered: velocityDelta < 0, text: `Velocity ${Math.abs(velocityDelta)} pts below previous`, severity: 'medium' as const },
    { triggered: completionPct < elapsedPct, text: 'Completion behind time elapsed', severity: 'medium' as const },
  ].filter(r => r.triggered)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* Health Score */}
      <SectionCard title="Sprint Health" subtitle={`${daysLeft} days remaining`}>
        <div className="p-5">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative w-16 h-16">
              <svg className="-rotate-90" viewBox="0 0 64 64" width="64" height="64">
                <circle cx="32" cy="32" r="26" fill="none" stroke="#1E2D4A" strokeWidth="5" />
                <motion.circle
                  cx="32" cy="32" r="26" fill="none"
                  stroke={sprint.healthScore >= 80 ? '#22C55E' : sprint.healthScore >= 60 ? '#F59E0B' : '#EF4444'}
                  strokeWidth="5" strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 26}
                  initial={{ strokeDashoffset: 2 * Math.PI * 26 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 26 * (1 - sprint.healthScore / 100) }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold text-[#E2E8F0]">{sprint.healthScore}</span>
              </div>
            </div>
            <div>
              <RiskLevelBadge level={sprint.riskLevel} />
              <p className="text-xs text-[#64748B] mt-1">{sprint.name}</p>
              <p className="text-[10px] text-[#64748B]">{sprint.team} team</p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[#64748B]">Completion</span>
                <span className="text-[#E2E8F0] font-mono">{completionPct}%</span>
              </div>
              <ScoreBar value={completionPct} color="#6C63FF" />
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[#64748B]">Time elapsed</span>
                <span className="text-[#E2E8F0] font-mono">{elapsedPct}%</span>
              </div>
              <ScoreBar value={elapsedPct} color="#00D4FF" delay={0.1} />
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[#64748B]">Velocity</span>
                <span className={cn('font-mono text-xs', velocityDelta < 0 ? 'text-[#EF4444]' : 'text-[#22C55E]')}>
                  {sprint.velocity} pts ({velocityDelta > 0 ? '+' : ''}{velocityDelta})
                </span>
              </div>
              <ScoreBar value={velocityPct} color={velocityPct >= 90 ? '#22C55E' : '#F59E0B'} delay={0.2} />
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Rule Triggers */}
      <SectionCard title="Rule Engine" subtitle={`${rules.length} rules triggered`}>
        <div className="p-5">
          {rules.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-[#22C55E]">
              <CheckCircle className="w-4 h-4" />
              <span>All rules passing — sprint on track</span>
            </div>
          ) : (
            <div className="space-y-2">
              {rules.map((rule, i) => (
                <motion.div
                  key={i}
                  className="flex items-start gap-2 bg-[#111827] rounded-lg px-3 py-2.5"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                >
                  <AlertTriangle className={cn('w-3.5 h-3.5 mt-0.5 flex-shrink-0',
                    rule.severity === 'critical' ? 'text-[#EF4444]' : 'text-[#F59E0B]'
                  )} />
                  <span className="text-xs text-[#94A3B8]">{rule.text}</span>
                </motion.div>
              ))}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-[#1E2D4A] grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: 'Total', value: sprint.totalPoints, color: '#E2E8F0' },
              { label: 'Done', value: sprint.completedPoints, color: '#22C55E' },
              { label: 'Left', value: sprint.remainingPoints, color: '#F59E0B' },
            ].map((m, i) => (
              <div key={i} className="bg-[#111827] rounded-lg p-3 text-center">
                <p className="text-sm font-bold" style={{ color: m.color }}>{m.value}</p>
                <p className="text-[10px] text-[#64748B]">pts {m.label}</p>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>
    </div>
  )
}

export function SprintIntelligence() {
  const sprint = sprints[0]
  const [selectedSprint, setSelectedSprint] = useState(sprint.id)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const statuses = ['all', 'Blocked', 'In Progress', 'Development Done', 'QA', 'Done']

  const filteredIssues = sprint.issues.filter(i =>
    statusFilter === 'all' || i.status === statusFilter
  ).sort((a, b) => b.riskScore - a.riskScore)

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#E2E8F0]">Sprint Intelligence</h2>
          <p className="text-xs text-[#64748B] mt-0.5">Rule-based sprint health analysis</p>
        </div>
        <div className="flex items-center gap-2">
          {sprints.map(sp => (
            <button
              key={sp.id}
              onClick={() => setSelectedSprint(sp.id)}
              className={cn(
                'text-xs px-3 py-1.5 rounded-lg border transition-all',
                selectedSprint === sp.id
                  ? 'bg-[#6C63FF]/15 text-[#6C63FF] border-[#6C63FF]/40'
                  : 'text-[#64748B] border-[#1E2D4A] hover:bg-[#151D32]'
              )}
            >
              {sp.name}
            </button>
          ))}
        </div>
      </div>

      {/* Health panels */}
      <SprintHealthPanel sprint={sprint} />

      {/* Issue board */}
      <SectionCard
        title="Sprint Issues"
        subtitle={`${sprint.issues.length} issues · sorted by risk score`}
        action={
          <div className="flex items-center gap-1.5">
            {statuses.map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'text-[10px] px-2.5 py-1 rounded-lg border transition-all capitalize',
                  statusFilter === s
                    ? 'bg-[#6C63FF]/15 text-[#6C63FF] border-[#6C63FF]/40'
                    : 'text-[#64748B] border-[#1E2D4A] hover:bg-[#151D32]'
                )}
              >
                {s}
              </button>
            ))}
          </div>
        }
      >
        <div>
          {/* Table header */}
          <div className="hidden sm:flex items-center gap-3 px-5 py-2.5 border-b border-[#1E2D4A] bg-[#111827]">
            <div className="w-1.5 flex-shrink-0" />
            <span className="text-[10px] text-[#64748B] uppercase tracking-wider w-20 flex-shrink-0">Key</span>
            <span className="text-[10px] text-[#64748B] uppercase tracking-wider flex-1">Title</span>
            <span className="text-[10px] text-[#64748B] uppercase tracking-wider flex-shrink-0 w-32">Priority</span>
            <span className="text-[10px] text-[#64748B] uppercase tracking-wider flex-shrink-0 w-32">Status</span>
            <span className="text-[10px] text-[#64748B] uppercase tracking-wider flex-shrink-0 w-8 text-right">Pts</span>
          </div>
          {filteredIssues.map((issue, i) => (
            <IssueRow key={issue.id} issue={issue} index={i} />
          ))}
        </div>
      </SectionCard>
    </div>
  )
}
