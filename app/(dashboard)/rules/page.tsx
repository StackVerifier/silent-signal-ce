import { Topbar } from '@/components/layout/topbar'
import { RuleManagement } from '@/components/dashboard/rule-management'

export default function RulesPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar title="Rule Management" />
      <div className="flex-1 overflow-y-auto">
        <RuleManagement />
      </div>
    </div>
  )
}
