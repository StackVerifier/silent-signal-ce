import { Topbar } from '@/components/layout/topbar'
import { ExecutiveDashboard } from '@/components/dashboard/executive-dashboard'

export default function DashboardPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar title="Executive Dashboard" />
      <div className="flex-1 overflow-y-auto">
        <ExecutiveDashboard />
      </div>
    </div>
  )
}
