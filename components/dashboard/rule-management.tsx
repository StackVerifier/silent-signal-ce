'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield, Zap, GitBranch, FlaskConical, Activity, Users,
  ChevronDown, ChevronRight, ToggleLeft, ToggleRight,
  Clock, AlertTriangle, Search, Filter, Plus, Check,
  ArrowRight
} from 'lucide-react'
import { SectionCard, ScoreBar } from './shared'
import { rules } from '@/lib/mock-data'
import type { Rule } from '@/lib/types'
import { cn } from '@/lib/utils'

// ─── Category Config ──────────────────────────────────────────────────────────

const CATEGORY_META: Record<Rule['category'], { label: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string }> = {
  sprint:    { label: 'Sprint',    icon: Zap,          color: '#6C63FF' },
  release:   { label: 'Release',   icon: GitBranch,    color: '#00D4FF' },
  qa:        { label: 'QA',        icon: FlaskConical, color: '#F59E0B' },
  capacity:  { label: 'Capacity',  icon: Users,        color: '#22C55E' },
  velocity:  { label: 'Velocity',  icon: Activity,     color: '#EF4444' },
}

const ACTION_META: Record<Rule['action'], { label: string; color: string }> = {
  score: { label: 'Score',  color: '#EF4444' },
  alert: { label: 'Alert',  color: '#F59E0B' },
  flag:  { label: 'Flag',   color: '#6C63FF' },
}

// ─── Condition Type Badge ─────────────────────────────────────────────────────

function ConditionBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    IF:  'bg-[#6C63FF]/15 text-[#6C63FF] border-[#6C63FF]/30',
    AND: 'bg-[#00D4FF]/10 text-[#00D4FF] border-[#00D4FF]/20',
    OR:  'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20',
    NOT: 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20',
  }
  return (
    <span className={cn(
      'text-[9px] font-bold font-mono px-1.5 py-0.5 rounded border w-6 text-center inline-block',
      styles[type] || 'bg-[#1E2D4A] text-[#64748B] border-[#1E2D4A]'
    )}>
      {type}
    </span>
  )
}

// ─── Summary Stats ────────────────────────────────────────────────────────────

function RuleSummary({ allRules }: { allRules: Rule[] }) {
  const enabled     = allRules.filter(r => r.enabled).length
  const totalTriggers = allRules.reduce((a, r) => a + r.triggeredCount, 0)
  const byCat = Object.entries(CATEGORY_META).map(([key, meta]) => ({
    ...meta,
    category: key as Rule['category'],
    count: allRules.filter(r => r.category === key).length,
    activeCount: allRules.filter(r => r.category === key && r.enabled).length,
  }))

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: 'Total Rules',    value: allRules.length, color: '#E2E8F0', sub: `${enabled} active` },
        { label: 'Active Rules',   value: enabled,         color: '#22C55E', sub: `${allRules.length - enabled} paused` },
        { label: 'Total Triggers', value: totalTriggers,   color: '#6C63FF', sub: 'all time' },
        { label: 'Categories',     value: 5,               color: '#00D4FF', sub: 'sprint · qa · release' },
      ].map((m, i) => (
        <motion.div
          key={m.label}
          className="bg-[#151D32] border border-[#1E2D4A] rounded-xl p-4"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}
        >
          <p className="text-2xl font-bold" style={{ color: m.color }}>{m.value}</p>
          <p className="text-[10px] text-[#94A3B8] mt-0.5 font-medium">{m.label}</p>
          <p className="text-[10px] text-[#64748B] mt-0.5">{m.sub}</p>
        </motion.div>
      ))}
    </div>
  )
}

// ─── Category Overview ────────────────────────────────────────────────────────

function CategoryBreakdown({ allRules }: { allRules: Rule[] }) {
  const cats = Object.entries(CATEGORY_META).map(([key, meta]) => {
    const catRules = allRules.filter(r => r.category === key)
    const activeCount = catRules.filter(r => r.enabled).length
    const totalTriggers = catRules.reduce((a, r) => a + r.triggeredCount, 0)
    return { key, ...meta, total: catRules.length, active: activeCount, triggers: totalTriggers }
  })

  return (
    <SectionCard title="By Category" subtitle="Rule distribution">
      <div className="p-4 space-y-3">
        {cats.map((cat, i) => (
          <motion.div
            key={cat.key}
            className="space-y-1.5"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.07 }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <cat.icon className="w-3.5 h-3.5" style={{ color: cat.color }} />
                <span className="text-xs text-[#E2E8F0]">{cat.label}</span>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-[#64748B]">
                <span>{cat.active}/{cat.total} active</span>
                <span className="font-mono" style={{ color: cat.color }}>{cat.triggers} triggers</span>
              </div>
            </div>
            <ScoreBar value={cat.active} max={cat.total} color={cat.color} delay={i * 0.1} />
          </motion.div>
        ))}
      </div>
    </SectionCard>
  )
}

// ─── Rule Card ────────────────────────────────────────────────────────────────

function RuleCard({ rule, index }: { rule: Rule; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const [enabled, setEnabled] = useState(rule.enabled)

  const cat = CATEGORY_META[rule.category]
  const action = ACTION_META[rule.action]
  const timeAgo = rule.lastTriggered
    ? (() => {
        const diff = Math.floor((Date.now() - rule.lastTriggered!.getTime()) / 60000)
        if (diff < 60) return `${diff}m ago`
        if (diff < 1440) return `${Math.floor(diff / 60)}h ago`
        return `${Math.floor(diff / 1440)}d ago`
      })()
    : 'Never'

  return (
    <motion.div
      className={cn(
        'bg-[#151D32] border rounded-xl overflow-hidden transition-all duration-200',
        enabled ? 'border-[#1E2D4A]' : 'border-[#1E2D4A]/50 opacity-60'
      )}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: enabled ? 1 : 0.6, y: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        {/* Category icon */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${cat.color}18`, border: `1px solid ${cat.color}30` }}
        >
          <cat.icon className="w-4 h-4" style={{ color: cat.color }} />
        </div>

        {/* Title + desc */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-[#E2E8F0]">{rule.name}</p>
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded border"
              style={{ color: action.color, backgroundColor: `${action.color}15`, borderColor: `${action.color}30` }}
            >
              +{rule.scoreImpact} {action.label.toUpperCase()}
            </span>
          </div>
          <p className="text-[10px] text-[#64748B] mt-0.5 truncate">{rule.description}</p>
        </div>

        {/* Trigger count */}
        <div className="hidden sm:flex flex-col items-end gap-0.5 flex-shrink-0">
          <span className="text-xs font-mono font-bold text-[#E2E8F0]">{rule.triggeredCount}</span>
          <span className="text-[10px] text-[#64748B]">triggers</span>
        </div>

        {/* Last triggered */}
        <div className="hidden md:flex items-center gap-1 text-[10px] text-[#64748B] flex-shrink-0">
          <Clock className="w-3 h-3" />
          {timeAgo}
        </div>

        {/* Toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); setEnabled(!enabled) }}
          className="flex-shrink-0 transition-transform hover:scale-110"
          title={enabled ? 'Disable rule' : 'Enable rule'}
        >
          {enabled ? (
            <ToggleRight className="w-6 h-6 text-[#22C55E]" />
          ) : (
            <ToggleLeft className="w-6 h-6 text-[#64748B]" />
          )}
        </button>

        {/* Expand */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-shrink-0 text-[#64748B] hover:text-[#94A3B8] transition-colors"
        >
          <motion.div
            animate={{ rotate: expanded ? 90 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronRight className="w-4 h-4" />
          </motion.div>
        </button>
      </div>

      {/* Expanded conditions */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="border-t border-[#1E2D4A] px-4 py-4 space-y-3">
              <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-widest">Conditions</p>
              <div className="space-y-2">
                {rule.conditions.map((cond, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <ConditionBadge type={cond.type} />
                    <span className="font-mono text-[#94A3B8] bg-[#111827] px-2 py-1 rounded border border-[#1E2D4A]">
                      {cond.field}
                    </span>
                    <span className="text-[#64748B] font-mono">{cond.operator}</span>
                    <span className="font-mono text-[#00D4FF] bg-[#00D4FF]/10 px-2 py-1 rounded border border-[#00D4FF]/20">
                      {String(cond.value)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-[#1E2D4A]">
                <ArrowRight className="w-3 h-3 text-[#64748B]" />
                <span className="text-[10px] text-[#64748B]">Action:</span>
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded"
                  style={{ color: action.color, backgroundColor: `${action.color}15` }}
                >
                  {action.label} score by +{rule.scoreImpact}
                </span>
                <span className="text-[10px] text-[#64748B] ml-auto">{rule.triggeredCount} times triggered · last {timeAgo}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Rule List ────────────────────────────────────────────────────────────────

function RuleList({ allRules }: { allRules: Rule[] }) {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const categories = ['all', ...Object.keys(CATEGORY_META)] as const

  const filtered = allRules.filter(r => {
    const matchSearch = r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.description.toLowerCase().includes(search.toLowerCase())
    const matchCat = categoryFilter === 'all' || r.category === categoryFilter
    const matchStatus = statusFilter === 'all' ||
      (statusFilter === 'active' && r.enabled) ||
      (statusFilter === 'paused' && !r.enabled)
    return matchSearch && matchCat && matchStatus
  })

  return (
    <SectionCard
      title="Rules"
      subtitle={`${filtered.length} of ${allRules.length} rules`}
      action={
        <button className="flex items-center gap-1.5 text-xs text-[#6C63FF] hover:text-[#8B85FF] transition-colors border border-[#6C63FF]/30 px-3 py-1.5 rounded-lg hover:bg-[#6C63FF]/10">
          <Plus className="w-3.5 h-3.5" />
          New Rule
        </button>
      }
    >
      {/* Filters */}
      <div className="px-5 py-3 border-b border-[#1E2D4A] flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#64748B]" />
          <input
            type="text"
            placeholder="Search rules..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 bg-[#111827] border border-[#1E2D4A] rounded-lg text-xs text-[#E2E8F0] placeholder-[#64748B] focus:outline-none focus:border-[#6C63FF]/50 transition-colors"
          />
        </div>
        {/* Category pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {categories.map(cat => {
            const meta = cat !== 'all' ? CATEGORY_META[cat as Rule['category']] : null
            return (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={cn(
                  'flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg border transition-all capitalize',
                  categoryFilter === cat
                    ? 'bg-[#6C63FF]/15 text-[#6C63FF] border-[#6C63FF]/40'
                    : 'text-[#64748B] border-[#1E2D4A] hover:bg-[#151D32]'
                )}
              >
                {meta && <meta.icon className="w-3 h-3" style={{ color: meta.color }} />}
                {cat}
              </button>
            )
          })}
        </div>
        {/* Status */}
        <div className="flex items-center gap-1">
          {(['all', 'active', 'paused'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'text-[10px] px-2.5 py-1 rounded-lg border transition-all capitalize',
                statusFilter === s
                  ? 'bg-[#00D4FF]/15 text-[#00D4FF] border-[#00D4FF]/40'
                  : 'text-[#64748B] border-[#1E2D4A] hover:bg-[#151D32]'
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Rules */}
      <div className="p-4 space-y-3">
        {filtered.length === 0 ? (
          <div className="py-10 text-center text-sm text-[#64748B]">No rules match your filters</div>
        ) : (
          filtered.map((rule, i) => (
            <RuleCard key={rule.id} rule={rule} index={i} />
          ))
        )}
      </div>
    </SectionCard>
  )
}

// ─── Trigger History ──────────────────────────────────────────────────────────

function TriggerHistory({ allRules }: { allRules: Rule[] }) {
  const recentlyTriggered = [...allRules]
    .filter(r => r.lastTriggered)
    .sort((a, b) => b.lastTriggered!.getTime() - a.lastTriggered!.getTime())
    .slice(0, 6)

  return (
    <SectionCard title="Trigger History" subtitle="Most recently fired">
      <div className="divide-y divide-[#1E2D4A]/50">
        {recentlyTriggered.map((rule, i) => {
          const cat = CATEGORY_META[rule.category]
          const action = ACTION_META[rule.action]
          const diff = Math.floor((Date.now() - rule.lastTriggered!.getTime()) / 60000)
          const ago = diff < 60 ? `${diff}m` : diff < 1440 ? `${Math.floor(diff / 60)}h` : `${Math.floor(diff / 1440)}d`
          return (
            <motion.div
              key={rule.id}
              className="flex items-center gap-3 px-4 py-3 hover:bg-[#1a2440] transition-colors"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${cat.color}18` }}
              >
                <cat.icon className="w-3.5 h-3.5" style={{ color: cat.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#E2E8F0] truncate">{rule.name}</p>
                <p className="text-[10px] text-[#64748B]">{rule.triggeredCount}× total</p>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                  style={{ color: action.color, backgroundColor: `${action.color}15` }}
                >
                  {action.label.toUpperCase()}
                </span>
                <span className="text-[10px] font-mono text-[#64748B]">{ago} ago</span>
              </div>
            </motion.div>
          )
        })}
      </div>
    </SectionCard>
  )
}

// ─── Score Impact Breakdown ───────────────────────────────────────────────────

function ScoreImpactChart({ allRules }: { allRules: Rule[] }) {
  const sorted = [...allRules]
    .filter(r => r.enabled)
    .sort((a, b) => b.scoreImpact - a.scoreImpact)
    .slice(0, 6)
  const max = sorted[0]?.scoreImpact ?? 1

  return (
    <SectionCard title="Score Impact" subtitle="Active rules by weight">
      <div className="p-4 space-y-3">
        {sorted.map((rule, i) => {
          const cat = CATEGORY_META[rule.category]
          return (
            <motion.div
              key={rule.id}
              className="space-y-1"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.07 }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <cat.icon className="w-3 h-3 flex-shrink-0" style={{ color: cat.color }} />
                  <span className="text-[10px] text-[#94A3B8] truncate">{rule.name}</span>
                </div>
                <span className="text-xs font-mono font-bold text-[#EF4444] flex-shrink-0 ml-2">+{rule.scoreImpact}</span>
              </div>
              <ScoreBar value={rule.scoreImpact} max={max} color={cat.color} delay={i * 0.1} />
            </motion.div>
          )
        })}
      </div>
    </SectionCard>
  )
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function RuleManagement() {
  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <motion.div
        className="flex items-center justify-between flex-wrap gap-4"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <h2 className="text-lg font-semibold text-[#E2E8F0]">Rule Management</h2>
          <p className="text-xs text-[#64748B] mt-0.5">Configure scoring logic — no ML, pure deterministic rules</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#22C55E] bg-[#22C55E]/10 border border-[#22C55E]/20 px-3 py-1.5 rounded-lg">
          <Check className="w-3.5 h-3.5" />
          Engine running — all rules evaluated on every sync
        </div>
      </motion.div>

      {/* Stats */}
      <RuleSummary allRules={rules} />

      {/* Main grid: Rule list (left wide) + sidebar charts (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <RuleList allRules={rules} />
        </div>
        <div className="space-y-4">
          <CategoryBreakdown allRules={rules} />
          <TriggerHistory allRules={rules} />
          <ScoreImpactChart allRules={rules} />
        </div>
      </div>
    </div>
  )
}
