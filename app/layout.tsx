import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { Providers } from './providers'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono-jetbrains',
})

export const metadata: Metadata = {
  title: 'Silent Signal — Release Intelligence',
  description: 'Operational intelligence platform for Jira release risk analysis. Rule-based engineering intelligence without AI.',
  generator: 'v0.app',
  keywords: ['jira', 'release management', 'sprint intelligence', 'qa monitoring', 'risk analysis'],
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#070B18',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} bg-[#070B18] font-sans`}>
      <body className="antialiased font-sans">
        <Providers>{children}</Providers>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
