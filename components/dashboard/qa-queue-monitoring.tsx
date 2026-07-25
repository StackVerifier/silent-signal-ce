'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Clock, RefreshCw, User } from 'lucide-react'
import { SectionCard, ScoreBar, PriorityBadge } from './shared'
import { useQaQueue, useQaTesters } from '@/lib/query/hooks'
import type { QAItem } from '@/lib/types'
import { cn } from '@/lib/utils'

const STATUS_COLORS: Record<QAItem['status'], string> = {
  Waiting:     '#F59E0B',
  'In Progress': '#6C63FF',
  Regression:  '#EF4444',
  Blocked:     '#EF4444',
}

function QAMetrics() {
  const qaQueue = useQaQueue().data ?? []
  const waitingCount = qaQueue.filter(i => i.status === 'Waiting').length
  const inProgressCount = qaQueue.filter(i => i.status === 'In Progress').length
  const regressionCount = qaQueue.filter(i => i.status === 'Regression').length
  const unassignedCount = qaQueue.filter(i => i.assignee === 'Unassigned').length

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {[
        { label: 'Total Queue', value: qaQueue.length, color: '#E2E8F0', bg: '#1E2D4A' },
        { label: 'Waiting', value: waitingCount, color: '#F59E0B', bg: '#F59E0B18' },
        { label: 'In Progress', value: inProgressCount, color: '#6C63FF', bg: '#6C63FF18' },
        { label: 'Regression', value: regressionCount, color: '#EF4444', bg: '#EF444418' },
        { label: 'Unassigned', value: unassignedCount, color: '#EF4444', bg: '#EF444418' },
      ].map((m, i) => (
        <motion.div
          key={m.label}
          className="rounded-xl p-4 border border-[#1E2D4A]"
          style={{ backgroundColor: '#151D32' }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}
        >
          <p className="text-2xl font-bold" style={{ color: m.color }}>{m.value}</p>
          <p className="text-[10px] text-[#64748B] mt-1">{m.label}</p>
        </motion.div>
      ))}
    </div>
  )
}

function TesterCapacity() {
  const qaTesters = useQaTesters().data ?? []
  return (
    <SectionCard title="Tester Capacity" subtitle="Current workload by tester">
      <div className="p-4 space-y-4">
        {qaTesters.map((tester, i) => (
          <motion.div
            key={tester.name}
            className="space-y-2"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[#6C63FF]/20 border border-[#6C63FF]/30 flex items-center justify-center text-[10px] font-bold text-[#6C63FF]">
                  {tester.avatar}
                </div>
                <span className="text-xs text-[#E2E8F0]">{tester.name}</span>
              </div>
              <div className="flex items-center gap-3 text-[10px]">
                <span className="text-[#64748B]">{tester.assigned} active</span>
                <span className={cn(
                  'font-mono font-bold',
                  tester.capacity >= 90 ? 'text-[#EF4444]' :
                  tester.capacity >= 70 ? 'text-[#F59E0B]' : 'text-[#22C55E]'
                )}>{tester.capacity}%</span>
              </div>
            </div>
            <ScoreBar
              value={tester.capacity}
              color={tester.capacity >= 90 ? '#EF4444' : tester.capacity >= 70 ? '#F59E0B' : '#22C55E'}
              delay={i * 0.1}
            />
          </motion.div>
        ))}
      </div>
    </SectionCard>
  )
}

function WaitTimeChart() {
  const qaQueue = useQaQueue().data ?? []
  const maxWait = Math.max(...qaQueue.map(i => i.waitingDays))
  return (
    <SectionCard title="Wait Time Distribution" subtitle="Days waiting per issue">
      <div className="p-4 space-y-2">
        {qaQueue.sort((a, b) => b.waitingDays - a.waitingDays).map((item, i) => (
          <motion.div
            key={item.id}
            className="flex items-center gap-3"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <span className="text-[10px] font-mono text-[#6C63FF] w-16 flex-shrink-0">{item.issueKey}</span>
            <div className="flex-1">
              <ScoreBar
                value={item.waitingDays}
                max={maxWait + 1}
                color={item.waitingDays >= 4 ? '#EF4444' : item.waitingDays >= 2 ? '#F59E0B' : '#22C55E'}
                delay={i * 0.05}
                height="h-1.5"
              />
            </div>
            <span className={cn('text-[10px] font-mono w-10 text-right flex-shrink-0',
              item.waitingDays >= 4 ? 'text-[#EF4444]' : item.waitingDays >= 2 ? 'text-[#F59E0B]' : 'text-[#22C55E]'
            )}>
              {item.waitingDays}d
            </span>
          </motion.div>
        ))}
      </div>
    </SectionCard>
  )
}

function QAQueueTable() {
  const qaQueue = useQaQueue().data ?? []
  const [filter, setFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'risk' | 'wait' | 'priority'>('risk')

  const filters = ['all', 'Waiting', 'In Progress', 'Regression', 'Blocked']

  const filtered = qaQueue
    .filter(i => filter === 'all' || i.status === filter)
    .sort((a, b) => {
      if (sortBy === 'risk')   return b.riskScore - a.riskScore
      if (sortBy === 'wait')   return b.waitingDays - a.waitingDays
      const pOrder = { Critical: 4, High: 3, Medium: 2, Low: 1 }
      return pOrder[b.priority] - pOrder[a.priority]
    })

  return (
    <SectionCard
      title="QA Queue"
      subtitle={`${filtered.length} items`}
      action={
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            {filters.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'text-[10px] px-2 py-1 rounded-lg border transition-all capitalize',
                  filter === f
                    ? 'bg-[#6C63FF]/15 text-[#6C63FF] border-[#6C63FF]/40'
                    : 'text-[#64748B] border-[#1E2D4A] hover:bg-[#151D32]'
                )}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[#64748B]">Sort:</span>
            {(['risk', 'wait', 'priority'] as const).map(s => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={cn(
                  'text-[10px] px-2 py-1 rounded-lg border transition-all capitalize',
                  sortBy === s
                    ? 'bg-[#00D4FF]/15 text-[#00D4FF] border-[#00D4FF]/40'
                    : 'text-[#64748B] border-[#1E2D4A] hover:bg-[#151D32]'
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      }
    >
      <div>
        {/* Header */}
        <div className="hidden sm:grid grid-cols-12 gap-3 px-5 py-3 border-b border-[#1E2D4A] bg-[#111827] text-[10px] text-[#64748B] uppercase tracking-wider">
          <span className="col-span-2">Key</span>
          <span className="col-span-3">Title</span>
          <span className="col-span-1">Priority</span>
          <span className="col-span-2">Assignee</span>
          <span className="col-span-1">Wait</span>
          <span className="col-span-1">Status</span>
          <span className="col-span-1">Service</span>
          <span className="col-span-1 text-right">Risk</span>
        </div>

        <div className="divide-y divide-[#1E2D4A]/50">
          {filtered.map((item, i) => (
            <motion.div
              key={item.id}
              className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-3 px-4 sm:px-5 py-3.5 hover:bg-[#1a2440] transition-colors sm:items-center"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <div className="col-span-2 flex items-center gap-2">
                {item.reopenCount > 0 && (
                  <span title={`Reopened ${item.reopenCount}x`}>
                  <RefreshCw className="w-3 h-3 text-[#EF4444] flex-shrink-0" />
                </span>
                )}
                <span className="text-xs font-mono font-semibold text-[#6C63FF]">{item.issueKey}</span>
              </div>

              <div className="col-span-3">
                <span className="text-xs text-[#E2E8F0] line-clamp-1">{item.title}</span>
                <span className="text-[10px] text-[#64748B] sm:hidden">{item.service}</span>
              </div>

              <div className="col-span-1">
                <PriorityBadge priority={item.priority} />
              </div>

              <div className="col-span-2 flex items-center gap-1.5">
                {item.assignee === 'Unassigned' ? (
                  <span className="flex items-center gap-1 text-[10px] text-[#EF4444]">
                    <User className="w-3 h-3" />
                    Unassigned
                  </span>
                ) : (
                  <span className="text-xs text-[#94A3B8]">{item.assignee}</span>
                )}
              </div>

              <div className="col-span-1">
                <span className={cn('flex items-center gap-1 text-xs font-mono',
                  item.waitingDays >= 4 ? 'text-[#EF4444]' :
                  item.waitingDays >= 2 ? 'text-[#F59E0B]' : 'text-[#22C55E]'
                )}>
                  <Clock className="w-3 h-3" />
                  {item.waitingDays}d
                </span>
              </div>

              <div className="col-span-1">
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded"
                  style={{
                    color: STATUS_COLORS[item.status],
                    backgroundColor: `${STATUS_COLORS[item.status]}18`,
                  }}
                >
                  {item.status}
                </span>
              </div>

              <div className="col-span-1">
                <span className="text-[10px] text-[#64748B] bg-[#1E2D4A] px-1.5 py-0.5 rounded truncate block">{item.service}</span>
              </div>

              <div className="col-span-1 text-right">
                <span className={cn('text-xs font-mono font-bold',
                  item.riskScore >= 70 ? 'text-[#EF4444]' :
                  item.riskScore >= 40 ? 'text-[#F59E0B]' : 'text-[#22C55E]'
                )}>
                  {item.riskScore}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </SectionCard>
  )
}

export function QAQueueMonitoring() {
  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-[1600px] mx-auto">
      <div>
        <h2 className="text-lg font-semibold text-[#E2E8F0]">QA Queue Monitoring</h2>
        <p className="text-xs text-[#64748B] mt-0.5">Bottleneck detection via rule engine</p>
      </div>

      <QAMetrics />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <WaitTimeChart />
        </div>
        <TesterCapacity />
      </div>

      <QAQueueTable />
    </div>
  )
}
