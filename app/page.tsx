'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

export const dynamic = 'force-dynamic'

export default function RootPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading } = useAuth()

  useEffect(() => {
    if (isLoading) return
    if (isAuthenticated) {
      router.push('/(dashboard)')
    } else {
      router.push('/auth/login')
    }
  }, [isAuthenticated, isLoading, router])

  return null
}
