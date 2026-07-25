import { Topbar } from '@/components/layout/topbar'
import { QAQueueMonitoring } from '@/components/dashboard/qa-queue-monitoring'

export default function QAQueuePage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar title="QA Queue" />
      <div className="flex-1 overflow-y-auto">
        <QAQueueMonitoring />
      </div>
    </div>
  )
}
