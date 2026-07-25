import { Topbar } from '@/components/layout/topbar'
import { SprintIntelligence } from '@/components/dashboard/sprint-intelligence'

export default function SprintPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar title="Sprint Intelligence" />
      <div className="flex-1 overflow-y-auto">
        <SprintIntelligence />
      </div>
    </div>
  )
}
