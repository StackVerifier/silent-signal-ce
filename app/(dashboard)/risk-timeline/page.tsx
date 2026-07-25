import { Topbar } from '@/components/layout/topbar'
import { RiskTimeline } from '@/components/dashboard/risk-timeline'

export default function RiskTimelinePage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar title="Risk Timeline" />
      <div className="flex-1 overflow-y-auto">
        <RiskTimeline />
      </div>
    </div>
  )
}
