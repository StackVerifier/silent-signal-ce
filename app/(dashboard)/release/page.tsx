import { Topbar } from '@/components/layout/topbar'
import { ReleaseControl } from '@/components/dashboard/release-control'

export default function ReleasePage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar title="Release Control" />
      <div className="flex-1 overflow-y-auto">
        <ReleaseControl />
      </div>
    </div>
  )
}
