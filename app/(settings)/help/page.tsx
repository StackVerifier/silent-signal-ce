'use client'

import { SettingsPageHeader } from '@/components/settings/page-header'
import { motion } from 'framer-motion'
import { HelpCircle, MessageSquare, FileText, ExternalLink } from 'lucide-react'

const HELP_RESOURCES = [
  { title: 'Getting Started', description: 'Learn the basics of Silent Signal', icon: FileText },
  { title: 'Documentation', description: 'Complete API and feature documentation', icon: FileText },
  { title: 'FAQ', description: 'Frequently asked questions', icon: HelpCircle },
  { title: 'Status Page', description: 'System status and uptime', icon: ExternalLink },
]

export default function HelpPage() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <SettingsPageHeader
        title="Help & Support"
        description="Get help and contact our support team"
      />

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-3xl space-y-6">
          {/* Contact Support */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-lg bg-gradient-to-br from-[#6C63FF]/10 to-[#6C63FF]/5 border border-[#6C63FF]/20"
          >
            <div className="flex items-start gap-4">
              <MessageSquare className="w-6 h-6 text-[#6C63FF] flex-shrink-0 mt-1" />
              <div>
                <h2 className="text-lg font-semibold text-[#E2E8F0] mb-2">Need Help?</h2>
                <p className="text-[#64748B] mb-4">
                  Our support team is available 24/7 to help you with any questions or issues.
                </p>
                <button className="px-4 py-2 bg-[#6C63FF] hover:bg-[#5B52CC] text-white rounded-lg font-medium text-sm transition-colors">
                  Contact Support
                </button>
              </div>
            </div>
          </motion.div>

          {/* Resources */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h2 className="text-lg font-semibold text-[#E2E8F0] mb-4">Resources</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {HELP_RESOURCES.map((resource, idx) => {
                const Icon = resource.icon
                return (
                  <motion.button
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 + idx * 0.05 }}
                    className="p-4 rounded-lg bg-[#0F1824] border border-[#1E2D4A] hover:border-[#6C63FF]/30 transition-colors text-left"
                  >
                    <div className="flex items-start gap-3">
                      <Icon className="w-5 h-5 text-[#6C63FF] flex-shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-semibold text-[#E2E8F0]">{resource.title}</h3>
                        <p className="text-xs text-[#64748B] mt-1">{resource.description}</p>
                      </div>
                    </div>
                  </motion.button>
                )
              })}
            </div>
          </motion.div>

          {/* FAQ */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-6 rounded-lg bg-[#0F1824] border border-[#1E2D4A]"
          >
            <h2 className="text-lg font-semibold text-[#E2E8F0] mb-4">Common Questions</h2>
            <div className="space-y-4">
              {[
                { q: 'How do I create a new rule?', a: 'Go to Rule Management and click "Create Rule" to set up custom risk scoring rules.' },
                { q: 'Can I export my data?', a: 'Yes, team members with export permissions can export data from any page.' },
                { q: 'How often is data synced?', a: 'Integrations sync every 5 minutes by default. Enterprise plans can customize sync frequency.' },
              ].map((item, idx) => (
                <div key={idx} className="border-b border-[#1E2D4A] last:border-0 pb-4 last:pb-0">
                  <p className="font-medium text-[#E2E8F0]">{item.q}</p>
                  <p className="text-sm text-[#64748B] mt-1">{item.a}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
