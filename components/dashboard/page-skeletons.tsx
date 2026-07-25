import { Skeleton, SkeletonCard, SkeletonChart, SkeletonMetricTile, SkeletonTable } from '@/components/ui/skeleton'

const shell = 'p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-[1600px] mx-auto'

/**
 * Page-shaped skeletons. Each mirrors the real layout of its page so the
 * transition to data causes no reflow — and so a pending member sees the
 * structure of what they are waiting for.
 */
export function DashboardSkeleton() {
  return (
    <div className={shell}>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <SkeletonMetricTile key={index} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <SkeletonChart className="lg:col-span-2" />
        <SkeletonCard rows={4} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonCard rows={5} />
        <SkeletonCard rows={5} />
      </div>
    </div>
  )
}

export function SprintSkeleton() {
  return (
    <div className={shell}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonMetricTile key={index} />
        ))}
      </div>
      <SkeletonChart />
      <SkeletonTable rows={6} columns={5} />
    </div>
  )
}

export function ReleaseSkeleton() {
  return (
    <div className={shell}>
      <div className="bg-[#151D32] border border-[#1E2D4A] rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="space-y-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-3 w-64" />
          </div>
          <Skeleton className="h-32 w-32 rounded-full" />
        </div>
        <div className="mt-6 space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-2 w-full" />
          ))}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <SkeletonCard rows={5} className="lg:col-span-2" />
        <SkeletonCard rows={4} />
      </div>
    </div>
  )
}

export function QueueSkeleton() {
  return (
    <div className={shell}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonMetricTile key={index} />
        ))}
      </div>
      <SkeletonTable rows={8} columns={6} />
    </div>
  )
}

export function TimelineSkeleton() {
  return (
    <div className={shell}>
      <SkeletonChart />
      <SkeletonCard rows={6} />
    </div>
  )
}

export function RulesSkeleton() {
  return (
    <div className={shell}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonMetricTile key={index} />
        ))}
      </div>
      <SkeletonCard rows={3} />
      <SkeletonTable rows={6} columns={4} />
    </div>
  )
}
