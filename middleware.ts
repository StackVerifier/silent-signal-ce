import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { SESSION_COOKIE, decodeClaims } from '@/lib/auth-config'
import { STATUS_CAN_AUTHENTICATE, STATUS_GRANTS_DATA_ACCESS } from '@/lib/rbac/access'
import { requiredPermissionsForPath } from '@/lib/rbac/navigation'
import { resolveRole } from '@/lib/rbac/roles'

const PUBLIC_PREFIXES = ['/auth']
/** Reachable by any authenticated member, whatever their status or role. */
const STATUS_PAGES = ['/account-status', '/no-access']

function isPrefixed(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

/**
 * Authorization at the edge — the first of two enforcement layers.
 *
 * This blocks navigation. It is NOT the security boundary on its own: every
 * data-returning route handler must re-check permissions server-side, because a
 * client can always call the API directly.
 */
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  // Verifying the signature is what makes these claims worth reading at all.
  // An unsigned cookie is attacker input, and treating it as identity is a
  // complete authentication bypass.
  const claims = await decodeClaims(request.cookies.get(SESSION_COOKIE)?.value ?? '')
  const isPublic = isPrefixed(pathname, PUBLIC_PREFIXES)

  if (!claims) {
    if (isPublic) return NextResponse.next()
    const loginUrl = new URL('/auth/login', request.url)
    if (pathname !== '/') loginUrl.searchParams.set('redirect', `${pathname}${search}`)
    const response = NextResponse.redirect(loginUrl)
    // Drop a stale/tampered cookie so the loop cannot repeat.
    response.cookies.delete(SESSION_COOKIE)
    return response
  }

  // Statuses that must not hold a session at all.
  if (!STATUS_CAN_AUTHENTICATE[claims.status]) {
    const response = NextResponse.redirect(new URL('/auth/login?reason=inactive', request.url))
    response.cookies.delete(SESSION_COOKIE)
    return response
  }

  if (isPublic) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Suspended members get one destination and nothing else.
  if (claims.status === 'suspended') {
    return pathname === '/account-status'
      ? NextResponse.next()
      : NextResponse.redirect(new URL('/account-status', request.url))
  }

  if (isPrefixed(pathname, STATUS_PAGES)) return NextResponse.next()

  // Pending members keep full navigation but no data — every allowed page
  // renders in its locked, skeleton state (enforced in the data layer).
  if (!STATUS_GRANTS_DATA_ACCESS[claims.status]) {
    return NextResponse.next()
  }

  const required = requiredPermissionsForPath(pathname)
  if (required && required.length > 0) {
    const permissions = resolveRole(claims.roleId).permissions
    const allowed = required.some((permission) => permissions.includes(permission))
    if (!allowed) {
      const deniedUrl = new URL('/no-access', request.url)
      deniedUrl.searchParams.set('from', pathname)
      return NextResponse.redirect(deniedUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  // Everything except Next internals, static assets and /api.
  //
  // API routes are excluded deliberately: their callers are machines, not
  // sessions. The cron trigger carries a bearer secret and has no cookie, so a
  // session redirect here would 307 every scheduled run to the login page.
  // Each route handler authorizes its own caller.
  matcher: [
    // `_vercel` is the platform's own namespace (analytics, speed insights).
    // Redirecting it to the login page turns every request into a 404 that the
    // browser then refuses as an HTML document served where a script belongs.
    '/((?!api/|_next/static|_next/image|_vercel/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
