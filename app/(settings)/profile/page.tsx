'use client'

import { SettingsPageHeader } from '@/components/settings/page-header'
import { motion } from 'framer-motion'
import { Mail, Calendar, Save, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/ui/toast'
import { MemberStatusBadge } from '@/components/members/member-status-badge'

export default function ProfilePage() {
  const { member, role, organization } = useAuth()
  const toast = useToast()
  if (!member) return null

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <SettingsPageHeader
        title="Profile"
        description="Manage your account settings and preferences"
      />

      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
        <div className="max-w-2xl space-y-6">
          {/* Profile Card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-lg bg-[#0F1824] border border-[#1E2D4A]"
          >
            <div className="flex items-center gap-6 mb-6">
              <div className="w-20 h-20 rounded-lg bg-[#6C63FF] flex items-center justify-center">
                <span className="text-2xl font-bold text-white">{member.avatar ?? member.name.slice(0, 2).toUpperCase()}</span>
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold text-[#E2E8F0] truncate">{member.name}</h2>
                  <MemberStatusBadge status={member.status} />
                </div>
                <p className="text-[#64748B] flex items-center gap-1 mt-1">
                  <Mail aria-hidden="true" className="w-4 h-4" /> {member.email}
                </p>
                <p className="text-xs text-[#64748B] flex items-center gap-1 mt-2">
                  <ShieldCheck aria-hidden="true" className="w-4 h-4" /> {role?.name}
                  {organization && <> · {organization.name}</>}
                </p>
                <p className="text-xs text-[#64748B] flex items-center gap-1 mt-1">
                  <Calendar aria-hidden="true" className="w-4 h-4" /> Joined {new Date(member.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Preferences */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-6 rounded-lg bg-[#0F1824] border border-[#1E2D4A]"
          >
            <h2 className="text-lg font-semibold text-[#E2E8F0] mb-4">Preferences</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#E2E8F0] mb-2">Theme</label>
                <select className="w-full px-3 py-2 rounded-lg bg-[#070B18] border border-[#1E2D4A] text-[#E2E8F0] focus:outline-none focus:border-[#6C63FF]">
                  <option>Light</option>
                  <option>Dark</option>
                  <option>System</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#E2E8F0] mb-2">Language</label>
                <select className="w-full px-3 py-2 rounded-lg bg-[#070B18] border border-[#1E2D4A] text-[#E2E8F0] focus:outline-none focus:border-[#6C63FF]">
                  <option>English</option>
                  <option>Spanish</option>
                  <option>French</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" defaultChecked className="rounded" />
                  <span className="text-sm text-[#E2E8F0]">Email notifications</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" defaultChecked className="rounded" />
                  <span className="text-sm text-[#E2E8F0]">Desktop notifications</span>
                </label>
              </div>
            </div>
          </motion.div>

          {/* Security */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-6 rounded-lg bg-[#0F1824] border border-[#1E2D4A]"
          >
            <h2 className="text-lg font-semibold text-[#E2E8F0] mb-4">Security</h2>
            <button className="px-4 py-2 bg-[#6C63FF]/10 hover:bg-[#6C63FF]/20 text-[#6C63FF] rounded-lg font-medium text-sm transition-colors">
              Change Password
            </button>
          </motion.div>

          {/* Save */}
          <motion.button
            onClick={() =>
              toast.success('Preferences saved', 'Your profile settings have been updated.')
            }
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#6C63FF] hover:bg-[#5B52CC] text-white rounded-lg font-medium transition-colors"
          >
            <Save className="w-4 h-4" />
            Save Changes
          </motion.button>
        </div>
      </div>
    </div>
  )
}
