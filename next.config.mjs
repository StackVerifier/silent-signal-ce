/** @type {import('next').NextConfig} */

/**
 * Security headers.
 *
 * The CSP is deliberately strict about where scripts and connections may come
 * from. Next needs 'unsafe-inline' for its bootstrap and, in development,
 * 'unsafe-eval' for React Refresh — so the development policy is looser by
 * exactly that much and no more.
 */
const isDev = process.env.NODE_ENV === 'development'

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // Outbound calls are same-origin; webhook delivery happens server-side.
  `connect-src 'self'${isDev ? ' ws: http://localhost:*' : ''}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  // Only meaningful over HTTPS; harmless locally.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
]

const nextConfig = {
  // Type errors used to be ignored at build time, which meant a broken build
  // could ship silently. `pnpm typecheck` runs the same check in CI.
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // API responses are per-session and must never be cached by a proxy.
      {
        source: '/api/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, must-revalidate' }],
      },
    ]
  },
}

export default nextConfig
