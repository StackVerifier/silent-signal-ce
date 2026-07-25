import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { SESSION_COOKIE } from '@/lib/auth-config'

const PUBLIC_PREFIXES = ['/auth']

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value)
  const isPublic = PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )

  // Signed-in users should never land back on the login screen.
  if (hasSession && isPublic) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  if (!hasSession && !isPublic) {
    const loginUrl = new URL('/auth/login', request.url)
    if (pathname !== '/') {
      loginUrl.searchParams.set('redirect', `${pathname}${search}`)
    }
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  // Everything except Next internals, the favicon and files in /public.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
