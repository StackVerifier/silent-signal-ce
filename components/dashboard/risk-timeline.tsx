'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  TrendingUp, TrendingDown, AlertCircle, CheckCircle,
  GitBranch, Zap, Info, Calendar
} from 'lucide-react'
import { SectionCard } from './shared'
import { useRiskTimeline, useSignals } from '@/lib/query/hooks'
import type { RiskTimelineEvent } from '@/lib/types'
import { cn } from '@/lib/utils'

/** Where the trend line starts before any event is applied. */
const STARTING_RISK_SCORE = 65

function EventIcon({ type }: { type: RiskTimelineEvent['type'] }) {
  switch (type) {
    case 'risk-increase':  return <TrendingUp className="w-4 h-4 text-[#EF4444]" />
    case 'risk-decrease':  return <TrendingDown className="w-4 h-4 text-[#22C55E]" />
    case 'alert':          return <AlertCircle className="w-4 h-4 text-[#F59E0B]" />
    case 'resolved':       return <CheckCircle className="w-4 h-4 text-[#22C55E]" />
    case 'sprint-start':   return <Zap className="w-4 h-4 text-[#6C63FF]" />
    case 'sprint-end':     return <Zap className="w-4 h-4 text-[#64748B]" />
    case 'release':        return <GitBranch className="w-4 h-4 text-[#00D4FF]" />
    default:               return <Info className="w-4 h-4 text-[#64748B]" />
  }
}

function EventDot({ type }: { type: RiskTimelineEvent['type'] }) {
  const colors: Record<string, string> = {
    'risk-increase': '#EF4444',
    'risk-decrease': '#22C55E',
    'alert':         '#F59E0B',
    'resolved':      '#22C55E',
    'sprint-start':  '#6C63FF',
    'sprint-end':    '#64748B',
    'release':       '#00D4FF',
  }
  const color = colors[type] || '#64748B'
  return (
    <div
      className="w-3 h-3 rounded-full border-2 border-[#111827] flex-shrink-0"
      style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}60` }}
    />
  )
}

function RiskScoreChart() {
  const riskTimeline = useRiskTimeline().data ?? []
  // Build timeline risk trend from events (running sum)
  const events = [...riskTimeline].reverse()
  const points = events.reduce<{ date: RiskTimelineEvent['date']; score: number; type: RiskTimelineEvent['type'] }[]>(
    (acc, event) => {
      const previous = acc.at(-1)?.score ?? STARTING_RISK_SCORE
      acc.push({
        date: event.date,
        score: Math.max(0, Math.min(100, previous + event.riskDelta)),
        type: event.type,
      })
      return acc
    },
    [],
  )

  const maxScore = 100
  const width = 100 / (points.length - 1)

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * width}% ${100 - (p.score / maxScore) * 80}%`)
    .join(' ')

  return (
    <SectionCard title="Risk Score Trend" subtitle="Cumulative risk over time">
      <div className="p-5">
        <div className="relative h-32">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            {/* Grid lines */}
            {[25, 50, 75].map(y => (
              <line key={y} x1="0" y1={`${100 - y}%`} x2="100%" y2={`${100 - y}%`}
                stroke="#1E2D4A" strokeWidth="0.5" strokeDasharray="2,2" />
            ))}
            {/* Area fill */}
            <defs>
              <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6C63FF" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#6C63FF" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d={`${points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * width}% ${100 - (p.score / maxScore) * 80}%`).join(' ')} L 100% 100% L 0% 100% Z`}
              fill="url(#riskGrad)"
            />
            {/* Line */}
            <motion.path
              d={pathD}
              fill="none"
              stroke="#6C63FF"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.5, ease: 'easeInOut' }}
              vectorEffect="non-scaling-stroke"
            />
            {/* Dots */}
            {points.map((p, i) => (
              <circle
                key={i}
                cx={`${i * width}%`}
                cy={`${100 - (p.score / maxScore) * 80}%`}
                r="1.5"
                fill={p.score >= 75 ? '#EF4444' : p.score >= 60 ? '#F59E0B' : '#22C55E'}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
          {/* Y labels */}
          <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-[9px] text-[#64748B] pointer-events-none">
            <span>100</span>
            <span>50</span>
            <span>0</span>
          </div>
        </div>
        <div className="flex items-center justify-between mt-2 text-[10px] text-[#64748B]">
          <span>{events[0]?.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          <span>Current: <span className="font-mono text-[#EF4444] font-bold">82</span></span>
          <span>{events[events.length - 1]?.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
        </div>
      </div>
    </SectionCard>
  )
}

function TimelineItem({ event, index }: { event: RiskTimelineEvent; index: number }) {
  const [expanded, setExpanded] = useState(false)

  const isPositive = event.type === 'risk-decrease' || event.type === 'resolved' || event.type === 'release'
  const isNeutral = event.type === 'sprint-start' || event.type === 'sprint-end'

  const formatDate = (d: Date) => d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  })

  return (
    <motion.div
      className="flex gap-4"
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      {/* Timeline spine */}
      <div className="flex flex-col items-center">
        <EventDot type={event.type} />
        <div className="w-px flex-1 bg-[#1E2D4A] mt-2 min-h-[32px]" />
      </div>

      {/* Content */}
      <div className="flex-1 pb-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-left group"
        >
          <div className="flex items-start gap-3 bg-[#151D32] border border-[#1E2D4A] rounded-xl p-3.5 hover:border-[#1E2D4A]/80 hover:bg-[#1a2440] transition-all">
            <EventIcon type={event.type} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xs font-semibold text-[#E2E8F0]">{event.title}</p>
                {event.service && (
                  <span className="text-[9px] text-[#64748B] bg-[#1E2D4A] px-1.5 py-0.5 rounded">{event.service}</span>
                )}
              </div>
              <p className="text-[10px] text-[#64748B] mt-0.5 flex items-center gap-1.5">
                <Calendar className="w-2.5 h-2.5" />
                {formatDate(event.date)}
              </p>
            </div>
            {event.riskDelta !== 0 && (
              <div className={cn(
                'flex items-center gap-0.5 text-xs font-mono font-bold px-2 py-0.5 rounded flex-shrink-0',
                isPositive ? 'text-[#22C55E] bg-[#22C55E]/10' :
                isNeutral ? 'text-[#64748B] bg-[#1E2D4A]' :
                'text-[#EF4444] bg-[#EF4444]/10'
              )}>
                {event.riskDelta > 0 ? '+' : ''}{event.riskDelta}
              </div>
            )}
          </div>
        </button>

        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="mt-2 bg-[#111827] border border-[#1E2D4A] rounded-xl px-4 py-3"
          >
            <p className="text-xs text-[#94A3B8] leading-relaxed">{event.description}</p>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}

function ActiveSignals() {
  const signals = useSignals().data ?? []
  return (
    <SectionCard title="Active Signals" subtitle={`${signals.length} signals from rule engine`}>
      <div className="divide-y divide-[#1E2D4A]/50">
        {signals.map((signal, i) => (
          <motion.div
            key={signal.id}
            className="px-5 py-4"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs font-semibold text-[#E2E8F0]">{signal.title}</p>
                <p className="text-[10px] text-[#64748B] mt-0.5">{signal.description}</p>
              </div>
              <span className={cn(
                'text-lg font-bold font-mono ml-4 flex-shrink-0',
                signal.score >= 70 ? 'text-[#EF4444]' :
                signal.score >= 40 ? 'text-[#F59E0B]' : 'text-[#22C55E]'
              )}>
                {signal.score}
              </span>
            </div>
            <div className="space-y-2">
              {signal.reasons.slice(0, 2).map((r, j) => (
                <div key={j} className="flex items-center justify-between text-[10px]">
                  <span className="text-[#64748B]">{r.rule}</span>
                  <span className="text-[#94A3B8]">{r.value}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-1 mt-3">
              {signal.issueIds.slice(0, 4).map(id => (
                <span key={id} className="text-[9px] font-mono text-[#6C63FF] bg-[#6C63FF]/10 px-1.5 py-0.5 rounded">
                  {id}
                </span>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </SectionCard>
  )
}

export function RiskTimeline() {
  const riskTimeline = useRiskTimeline().data ?? []
  const [filter, setFilter] = useState<string>('all')
  const types = ['all', 'risk-increase', 'alert', 'resolved', 'release']

  const filtered = riskTimeline.filter(e =>
    filter === 'all' || e.type === filter
  )

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#E2E8F0]">Risk Timeline</h2>
          <p className="text-xs text-[#64748B] mt-0.5">Chronological view of risk events</p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {types.map(t => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={cn(
                'text-[10px] px-2.5 py-1 rounded-lg border transition-all capitalize',
                filter === t
                  ? 'bg-[#6C63FF]/15 text-[#6C63FF] border-[#6C63FF]/40'
                  : 'text-[#64748B] border-[#1E2D4A] hover:bg-[#151D32]'
              )}
            >
              {t === 'risk-increase' ? 'Increases' : t === 'risk-decrease' ? 'Decreases' : t}
            </button>
          ))}
        </div>
      </div>

      <RiskScoreChart />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Timeline */}
        <div className="lg:col-span-2 space-y-0">
          <div className="bg-[#151D32] border border-[#1E2D4A] rounded-xl p-5">
            <p className="text-sm font-semibold text-[#E2E8F0] mb-5">Event Log</p>
            <div className="space-y-0">
              {filtered.map((event, i) => (
                <TimelineItem key={event.id} event={event} index={i} />
              ))}
            </div>
          </div>
        </div>
        <ActiveSignals />
      </div>
    </div>
  )
}
