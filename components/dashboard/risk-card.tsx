'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, TrendingUp, TrendingDown, Minus, Info } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { RiskLevel, RiskReason } from '@/lib/types'

interface RiskCardProps {
  title: string
  score: number
  riskLevel: RiskLevel
  reasons: RiskReason[]
  href: string
  trend?: 'up' | 'down' | 'stable'
  subtitle?: string
  className?: string
}

function RiskBadge({ level }: { level: RiskLevel }) {
  const styles = {
    HIGH:   'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30',
    MEDIUM: 'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30',
    LOW:    'bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/30',
  }
  return (
    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wide', styles[level])}>
      {level}
    </span>
  )
}

function ScoreRing({ score, level }: { score: number; level: RiskLevel }) {
  const radius = 28
  const circ = 2 * Math.PI * radius
  const filled = (score / 100) * circ
  const colors = { HIGH: '#EF4444', MEDIUM: '#F59E0B', LOW: '#22C55E' }
  const color = colors[level]

  return (
    <div className="relative w-20 h-20 flex items-center justify-center flex-shrink-0">
      <svg className="-rotate-90" width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={radius} fill="none" stroke="#1E2D4A" strokeWidth="4" />
        <motion.circle
          cx="36" cy="36" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - filled }}
          transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
          style={{ filter: `drop-shadow(0 0 6px ${color}60)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-lg font-bold text-[#E2E8F0] leading-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {score}
        </motion.span>
        <span className="text-[9px] text-[#64748B] mt-0.5">risk</span>
      </div>
    </div>
  )
}

export function RiskCard({ title, score, riskLevel, reasons, href, trend, subtitle, className }: RiskCardProps) {
  const [hovered, setHovered] = useState(false)

  const glowClass = {
    HIGH:   'hover:shadow-[0_0_24px_rgba(239,68,68,0.2)]',
    MEDIUM: 'hover:shadow-[0_0_24px_rgba(245,158,11,0.15)]',
    LOW:    'hover:shadow-[0_0_24px_rgba(34,197,94,0.15)]',
  }[riskLevel]

  const borderHover = {
    HIGH:   'hover:border-[#EF4444]/40',
    MEDIUM: 'hover:border-[#F59E0B]/40',
    LOW:    'hover:border-[#22C55E]/40',
  }[riskLevel]

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  const trendColor = trend === 'up' ? 'text-[#EF4444]' : trend === 'down' ? 'text-[#22C55E]' : 'text-[#64748B]'

  return (
    <motion.div
      className={cn(
        'relative bg-[#151D32] border border-[#1E2D4A] rounded-xl overflow-hidden transition-all duration-300 cursor-pointer',
        glowClass, borderHover, className
      )}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
    >
      {/* Normal state */}
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-[#64748B] mb-1">{title}</p>
            {subtitle && <p className="text-[10px] text-[#64748B]/60 truncate">{subtitle}</p>}
            <div className="flex items-center gap-2 mt-1.5">
              <RiskBadge level={riskLevel} />
              {trend && (
                <TrendIcon className={cn('w-3.5 h-3.5', trendColor)} />
              )}
            </div>
          </div>
          <ScoreRing score={score} level={riskLevel} />
        </div>

        {/* Hover expansion */}
        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="pt-4 border-t border-[#1E2D4A] space-y-3">
                <div className="flex items-center gap-1.5">
                  <Info className="w-3 h-3 text-[#64748B]" />
                  <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">Risk Factors</p>
                </div>
                {reasons.slice(0, 3).map((r, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#94A3B8]">{r.value}</span>
                      <span className="text-[#64748B] font-mono">{r.impact}%</span>
                    </div>
                    <div className="h-1 bg-[#1E2D4A] rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{
                          background: riskLevel === 'HIGH' ? '#EF4444' : riskLevel === 'MEDIUM' ? '#F59E0B' : '#22C55E',
                        }}
                        initial={{ width: 0 }}
                        animate={{ width: `${r.impact}%` }}
                        transition={{ duration: 0.5, delay: i * 0.1 }}
                      />
                    </div>
                  </div>
                ))}
                <Link
                  href={href}
                  className="flex items-center gap-1.5 text-xs text-[#6C63FF] hover:text-[#8B85FF] transition-colors mt-2 group"
                  onClick={e => e.stopPropagation()}
                >
                  <span>View risk analysis</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
