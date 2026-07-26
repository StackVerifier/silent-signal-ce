'use client'

import { SettingsPageHeader } from '@/components/settings/page-header'
import { motion } from 'framer-motion'
import { Mail, Calendar, Save, ShieldCheck } from 'lucide-react'
import { useUpdateProfile } from '@/lib/query/hooks'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/ui/toast'
import { useState } from 'react'
import { ChangePasswordDialog } from '@/components/settings/change-password-dialog'
import { MemberStatusBadge } from '@/components/members/member-status-badge'

export default function ProfilePage() {
  const { member, role, organization } = useAuth()
  const [passwordOpen, setPasswordOpen] = useState(false)
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

          {/* Your details */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-6 rounded-lg bg-[#0F1824] border border-[#1E2D4A]"
          >
            <h2 className="text-lg font-semibold text-[#E2E8F0] mb-4">Your details</h2>
            <ProfileForm currentName={member.name} email={member.email} />
          </motion.div>

          {/* Security */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-6 rounded-lg bg-[#0F1824] border border-[#1E2D4A]"
          >
            <h2 className="text-lg font-semibold text-[#E2E8F0] mb-4">Security</h2>
            <button
              onClick={() => setPasswordOpen(true)}
              className="px-4 py-2 bg-[#6C63FF]/10 hover:bg-[#6C63FF]/20 text-[#6C63FF] rounded-lg font-medium text-sm transition-colors"
            >
              Change Password
            </button>
            {member.mustChangePassword && (
              <p className="text-[11px] text-[#F59E0B] mt-2">
                This account still uses the password it was created with.
              </p>
            )}
          </motion.div>

        </div>
      </div>

      <ChangePasswordDialog open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </div>
  )
}

/**
 * The one thing on this page a member can actually change about themselves.
 *
 * This screen previously offered a theme picker, a language picker and two
 * notification toggles, then a Save button that showed "Preferences saved" and
 * wrote nothing. None of the four had anything behind them — no i18n, no push,
 * no mail transport — so they have been removed rather than given somewhere to
 * persist. A stored preference that controls nothing is the same lie one layer
 * down, and harder to notice.
 */
function ProfileForm({ currentName, email }: { currentName: string; email: string }) {
  const toast = useToast()
  const updateProfile = useUpdateProfile()
  const [name, setName] = useState(currentName)

  const dirty = name.trim() !== currentName && name.trim().length > 0

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      await updateProfile.mutateAsync({ name: name.trim() })
      toast.success('Profile updated', 'Your name has been changed.')
    } catch (error) {
      toast.error(
        'Could not save',
        error instanceof Error ? error.message : 'Please try again.',
      )
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div>
        <label htmlFor="profile-name" className="block text-[11px] font-medium text-[#94A3B8] mb-1.5">
          Display name
        </label>
        <input
          id="profile-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={120}
          className="w-full h-10 px-3 rounded-lg bg-[#070B18] border border-[#1E2D4A] text-sm text-[#E2E8F0] focus:outline-none focus:border-[#6C63FF] transition-colors"
        />
        <p className="text-[10px] text-[#64748B] mt-1">
          Shown on your activity and in the audit log.
        </p>
      </div>

      <div>
        <label htmlFor="profile-email" className="block text-[11px] font-medium text-[#94A3B8] mb-1.5">
          Email
        </label>
        <input
          id="profile-email"
          value={email}
          readOnly
          aria-readonly="true"
          className="w-full h-10 px-3 rounded-lg bg-[#070B18] border border-[#1E2D4A] text-sm text-[#64748B] cursor-not-allowed"
        />
        <p className="text-[10px] text-[#64748B] mt-1">
          {/* Changing it needs a verification round trip, which needs an email
              provider. Rather than accept a new address and never confirm it,
              the field stays read-only. */}
          Changing your email needs administrator help for now.
        </p>
      </div>

      <button
        type="submit"
        disabled={!dirty || updateProfile.isPending}
        className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#6C63FF] hover:bg-[#5B52CC] disabled:bg-[#151D32] disabled:text-[#334155] text-white text-sm font-medium transition-colors"
      >
        <Save aria-hidden="true" className="w-4 h-4" />
        {updateProfile.isPending ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  )
}
