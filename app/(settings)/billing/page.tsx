'use client'

import { useNow } from '@/hooks/use-now'
import { SettingsPageHeader } from '@/components/settings/page-header'
import { useBilling } from '@/lib/query/hooks'
import { motion } from 'framer-motion'
import { CreditCard, CheckCircle, AlertCircle } from 'lucide-react'

const PLAN_FEATURES: Record<string, string[]> = {
  pro: ['Up to 50 rules', '10 team members', 'Email support', 'SSO', 'Audit logs'],
  enterprise: ['Unlimited rules', 'Unlimited team', '24/7 support', 'Advanced SSO', 'Full audit logs', 'Custom integrations'],
}

export default function BillingPage() {
  const now = useNow()
  const billing = useBilling().data
  if (!billing) return null
  const daysUntilNextBilling = Math.ceil(
    (new Date(billing.nextBillingDate || now).getTime() - now) / (1000 * 60 * 60 * 24)
  )

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <SettingsPageHeader
        title="Billing"
        description="Manage your subscription and usage"
      />

      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
        <div className="max-w-3xl space-y-6">
          {/* Current Plan */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-lg bg-gradient-to-br from-[#6C63FF]/10 to-[#6C63FF]/5 border border-[#6C63FF]/20"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-[#E2E8F0] flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-[#6C63FF]" />
                  {billing.plan.charAt(0).toUpperCase() + billing.plan.slice(1)} Plan
                </h2>
                <p className="text-sm text-[#64748B] mt-2">
                  {billing.status === 'active' ? (
                    <>
                      <CheckCircle className="w-4 h-4 inline mr-1 text-[#10B981]" />
                      Active subscription
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 inline mr-1 text-[#EF4444]" />
                      Subscription {billing.status}
                    </>
                  )}
                </p>
              </div>
              {/* No payment provider is wired up, so there is no checkout to
                  open. A button that silently does nothing reads as a broken
                  product; an email link is small but real. */}
              <a
                href={`mailto:sales@silentsignal.io?subject=${encodeURIComponent('Plan change request')}`}
                className="px-4 py-2 bg-[#6C63FF] hover:bg-[#5B52CC] text-white rounded-lg font-medium text-sm transition-colors"
              >
                Change plan
              </a>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-[#6C63FF]/20">
              <div>
                <p className="text-xs text-[#64748B] uppercase tracking-widest">Billing Period</p>
                <p className="font-semibold text-[#E2E8F0] mt-1">
                  {new Date(billing.currentPeriodStart).toLocaleDateString()} -{' '}
                  {new Date(billing.currentPeriodEnd).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#64748B] uppercase tracking-widest">Next Billing</p>
                <p className="font-semibold text-[#E2E8F0] mt-1">{daysUntilNextBilling} days away</p>
              </div>
              <div>
                <p className="text-xs text-[#64748B] uppercase tracking-widest">Price</p>
                <p className="font-semibold text-[#E2E8F0] mt-1">$299/month</p>
              </div>
            </div>
          </motion.div>

          {/* Usage */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-6 rounded-lg bg-[#0F1824] border border-[#1E2D4A]"
          >
            <h2 className="text-lg font-semibold text-[#E2E8F0] mb-4">Current Usage</h2>
            <div className="space-y-4">
              {Object.entries(billing.usage).map(([key, value]) => (
                <div key={key}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-[#E2E8F0] capitalize">{key}</span>
                    <span className="text-sm font-semibold text-[#6C63FF]">{value}</span>
                  </div>
                  <div className="h-1 bg-[#1E2D4A] rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-[#6C63FF] to-[#7D72FF]"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min((value / (key === 'rules' ? 50 : key === 'team' ? 50 : 100)) * 100, 100)}%` }}
                      transition={{ duration: 1, delay: 0.2 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Features */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-6 rounded-lg bg-[#0F1824] border border-[#1E2D4A]"
          >
            <h2 className="text-lg font-semibold text-[#E2E8F0] mb-4">Included Features</h2>
            <ul className="space-y-2">
              {PLAN_FEATURES[billing.plan]?.map((feature, idx) => (
                <li key={idx} className="flex items-center gap-2 text-[#E2E8F0]">
                  <CheckCircle className="w-4 h-4 text-[#10B981] flex-shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
