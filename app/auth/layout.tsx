export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#070B18] via-[#0F1824] to-[#070B18] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-lg bg-[#6C63FF] flex items-center justify-center mx-auto mb-3">
            <div className="w-5 h-5 rounded-full bg-white opacity-90" />
          </div>
          <h1 className="text-2xl font-bold text-[#E2E8F0] tracking-tight">Silent Signal</h1>
          <p className="text-[#64748B] text-sm mt-1">Release Intelligence Platform</p>
        </div>
        {children}
      </div>
    </div>
  )
}
