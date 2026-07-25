interface PageHeaderProps {
  title: string
  description?: string
  action?: React.ReactNode
}

export function SettingsPageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="sticky top-0 z-10 bg-[#070B18] border-b border-[#1E2D4A] px-4 sm:px-8 py-4 sm:py-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-[#E2E8F0]">{title}</h1>
        {description && <p className="text-sm text-[#64748B] mt-1">{description}</p>}
      </div>
      {action}
    </div>
  )
}
