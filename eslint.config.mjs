import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

/**
 * Flat config. eslint-config-next 16 ships flat configs directly, so no
 * FlatCompat shim is needed.
 */
const config = [
  {
    ignores: ['.next/**', 'node_modules/**', 'data/**', 'next-env.d.ts', 'db/content/**'],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // Unused bindings are a real signal; the underscore prefix is the
      // deliberate opt-out. Caught errors are exempt — an ignored catch
      // binding is often the correct way to swallow an expected failure.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      // JSON columns and integration payloads are genuinely dynamic.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
]

export default config
