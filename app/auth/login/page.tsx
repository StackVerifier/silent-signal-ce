'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { DEFAULT_DEMO_ACCOUNT } from '@/lib/auth-config'
import { Mail, Lock, ArrowRight, ShieldCheck } from 'lucide-react'
import { motion } from 'framer-motion'

export const dynamic = 'force-dynamic'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login, isLoading } = useAuth()
  const [email, setEmail] = useState(DEFAULT_DEMO_ACCOUNT.email)
  const [password, setPassword] = useState(DEFAULT_DEMO_ACCOUNT.password)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await login(email, password)
      const redirect = searchParams.get('redirect')
      router.replace(redirect && redirect.startsWith('/') ? redirect : '/')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-[#E2E8F0] mb-1.5">
            Email Address
          </label>
          <div className="relative">
            <Mail
              aria-hidden="true"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B] pointer-events-none"
            />
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-[#0F1824] border border-[#1E2D4A] text-[#E2E8F0] placeholder-[#64748B] focus:outline-none focus:border-[#6C63FF] transition-colors"
              required
              disabled={isLoading}
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-[#E2E8F0] mb-1.5">
            Password
          </label>
          <div className="relative">
            <Lock
              aria-hidden="true"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B] pointer-events-none"
            />
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-[#0F1824] border border-[#1E2D4A] text-[#E2E8F0] placeholder-[#64748B] focus:outline-none focus:border-[#6C63FF] transition-colors"
              required
              disabled={isLoading}
            />
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="p-3 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/20 text-[#FCA5A5] text-sm"
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-[#6C63FF] hover:bg-[#5B52CC] disabled:bg-[#64748B] text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C63FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#070B18]"
        >
          {isLoading ? 'Signing in...' : <>Sign In<ArrowRight aria-hidden="true" className="w-4 h-4" /></>}
        </button>
      </form>

      <div className="mt-6 p-3 rounded-lg bg-[#0F1824] border border-[#1E2D4A]">
        <p className="flex items-center gap-2 text-xs font-medium text-[#94A3B8]">
          <ShieldCheck aria-hidden="true" className="w-3.5 h-3.5 text-[#6C63FF]" />
          Demo account — role: Administrator
        </p>
        <dl className="mt-2 space-y-1 text-xs text-[#64748B] font-mono">
          <div className="flex gap-2">
            <dt className="w-16 shrink-0">email</dt>
            <dd className="text-[#E2E8F0] break-all">{DEFAULT_DEMO_ACCOUNT.email}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-16 shrink-0">password</dt>
            <dd className="text-[#E2E8F0]">{DEFAULT_DEMO_ACCOUNT.password}</dd>
          </div>
        </dl>
      </div>
    </motion.div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="h-64" />}>
      <LoginForm />
    </Suspense>
  )
}
