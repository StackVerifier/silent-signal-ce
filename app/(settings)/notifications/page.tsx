'use client'

import { SettingsPageHeader } from '@/components/settings/page-header'
import { mockNotifications } from '@/lib/mock-data'
import { motion } from 'framer-motion'
import { Bell, AlertCircle, Check, Trash2 } from 'lucide-react'

export default function NotificationsPage() {
  const unread = mockNotifications.filter(n => !n.read).length

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <SettingsPageHeader
        title="Notifications"
        description={`${unread} unread notification${unread !== 1 ? 's' : ''}`}
      />

      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
        <div className="space-y-3 max-w-3xl">
          {mockNotifications.length === 0 ? (
            <div className="py-12 text-center">
              <Bell className="w-12 h-12 text-[#64748B]/30 mx-auto mb-3" />
              <p className="text-[#64748B]">No notifications yet</p>
            </div>
          ) : (
            mockNotifications.map((notif, idx) => (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`flex items-start gap-4 p-4 rounded-lg border transition-all ${
                  notif.read
                    ? 'bg-[#0F1824] border-[#1E2D4A]'
                    : 'bg-[#6C63FF]/5 border-[#6C63FF]/20'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  notif.level === 'critical' ? 'bg-[#EF4444]/10 text-[#FCA5A5]' :
                  notif.level === 'high' ? 'bg-[#F97316]/10 text-[#FDBA74]' :
                  'bg-[#3B82F6]/10 text-[#93C5FD]'
                }`}>
                  <AlertCircle className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-[#E2E8F0]">{notif.title}</h3>
                  <p className="text-sm text-[#64748B] mt-1">{notif.message}</p>
                  <p className="text-xs text-[#64748B]/60 mt-2">
                    {new Date(notif.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {!notif.read && (
                    <button className="p-1.5 hover:bg-[#6C63FF]/10 rounded transition-colors">
                      <Check className="w-4 h-4 text-[#6C63FF]" />
                    </button>
                  )}
                  <button className="p-1.5 hover:bg-[#EF4444]/10 rounded transition-colors">
                    <Trash2 className="w-4 h-4 text-[#EF4444]" />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
