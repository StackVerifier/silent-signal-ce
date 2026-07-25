import { Sidebar } from '@/components/layout/sidebar'
import { CommandPalette } from '@/components/layout/command-palette'
import { KeyboardProvider } from '@/components/layout/keyboard-provider'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <KeyboardProvider>
      <div className="flex h-screen overflow-hidden bg-[#070B18]">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          {children}
        </main>
        <CommandPalette />
      </div>
    </KeyboardProvider>
  )
}
