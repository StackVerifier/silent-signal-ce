'use client'

import { SettingsPageHeader } from '@/components/settings/page-header'
import { mockWorkspace, mockUsers } from '@/lib/mock-data'
import { motion } from 'framer-motion'
import { Users, Trash2, Edit2 } from 'lucide-react'
import { getRoleLabel } from '@/lib/permissions'

export default function MembersPage() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <SettingsPageHeader
        title="Team Members"
        description={`${mockWorkspace.members.length} member${mockWorkspace.members.length !== 1 ? 's' : ''}`}
        action={
          <button className="px-4 py-2 bg-[#6C63FF] hover:bg-[#5B52CC] text-white rounded-lg font-medium text-sm transition-colors">
            Invite Member
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-4xl">
          <div className="space-y-2">
            {mockWorkspace.members.map((member, idx) => (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="flex items-center justify-between p-4 rounded-lg bg-[#0F1824] border border-[#1E2D4A] hover:border-[#6C63FF]/30 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-[#6C63FF]/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-[#6C63FF]">
                      {member.user.name
                        .split(' ')
                        .map(n => n[0])
                        .join('')}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-[#E2E8F0]">{member.user.name}</p>
                    <p className="text-xs text-[#64748B]">{member.user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="px-3 py-1 rounded-full bg-[#6C63FF]/10 text-[#6C63FF] text-xs font-medium">
                    {getRoleLabel(member.role)}
                  </span>
                  <div className="flex items-center gap-2">
                    <button className="p-1.5 hover:bg-[#6C63FF]/10 rounded transition-colors">
                      <Edit2 className="w-4 h-4 text-[#6C63FF]" />
                    </button>
                    <button className="p-1.5 hover:bg-[#EF4444]/10 rounded transition-colors">
                      <Trash2 className="w-4 h-4 text-[#EF4444]" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
