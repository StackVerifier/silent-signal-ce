import { cn } from '@/lib/utils'

/**
 * Base skeleton. Skeletons — not spinners — are the loading vocabulary across
 * the app; they preserve layout, so nothing shifts when data arrives.
 */
export function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-[#1E2D4A]/60', className)}
      {...props}
    />
  )
}

export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number
  className?: string
}) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn('h-3', index === lines - 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  )
}

export function SkeletonMetricTile() {
  return (
    <div className="bg-[#151D32] border border-[#1E2D4A] rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-3 w-8 rounded" />
      </div>
      <Skeleton className="h-7 w-16" />
      <Skeleton className="h-2.5 w-10 mt-2" />
      <Skeleton className="h-2.5 w-20 mt-1.5" />
    </div>
  )
}

export function SkeletonCard({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('bg-[#151D32] border border-[#1E2D4A] rounded-xl overflow-hidden', className)}>
      <div className="px-5 py-4 border-b border-[#1E2D4A]">
        <Skeleton className="h-3.5 w-36" />
        <Skeleton className="h-2.5 w-24 mt-2" />
      </div>
      <div className="p-5 space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
            <div className="flex-1 min-w-0 space-y-1.5">
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-2.5 w-2/3" />
            </div>
            <Skeleton className="h-3 w-12 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function SkeletonChart({ className }: { className?: string }) {
  const heights = ['40%', '65%', '35%', '80%', '55%', '70%', '45%', '90%', '60%', '50%', '75%', '38%']
  return (
    <div className={cn('bg-[#151D32] border border-[#1E2D4A] rounded-xl p-5', className)}>
      <Skeleton className="h-3.5 w-40" />
      <div className="mt-6 flex items-end gap-2 h-40" aria-hidden="true">
        {heights.map((height, index) => (
          <Skeleton key={index} className="flex-1 rounded-t-md" style={{ height }} />
        ))}
      </div>
    </div>
  )
}

export function SkeletonTable({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="bg-[#151D32] border border-[#1E2D4A] rounded-xl overflow-hidden">
      <div className="flex items-center gap-4 px-5 py-3 border-b border-[#1E2D4A]">
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton key={index} className={cn('h-3', index === 0 ? 'w-40' : 'flex-1')} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-4 px-5 py-3.5 border-b border-[#1E2D4A]/50 last:border-0">
          {Array.from({ length: columns }).map((_, columnIndex) => (
            <Skeleton
              key={columnIndex}
              className={cn('h-3', columnIndex === 0 ? 'w-40' : 'flex-1')}
              style={{ opacity: 1 - rowIndex * 0.08 }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
