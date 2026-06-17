'use client'

// Catches unhandled errors in the root layout — the last resort error boundary.
// Must include <html> and <body> since the normal layout is unavailable.

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en">
      <body style={{ background: '#ffffff', margin: 0, minHeight: '100vh',
                     display: 'flex', alignItems: 'center', justifyContent: 'center',
                     fontFamily: 'Georgia, serif' }}>
        <div style={{ textAlign: 'center', padding: '0 24px' }}>
          <p style={{ color: '#111111', fontSize: '1.25rem', marginBottom: '1.5rem' }}>
            Something went wrong.
          </p>
          <button
            onClick={reset}
            style={{ border: '1px solid #999999', color: '#333333',
                     background: 'transparent', padding: '12px 32px', cursor: 'pointer',
                     fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
