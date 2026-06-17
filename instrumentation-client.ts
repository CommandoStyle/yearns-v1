import * as Sentry from '@sentry/nextjs'

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  // ── Privacy / PII ──────────────────────────────────────────────────────────
  // sendDefaultPii: false prevents Sentry from automatically attaching
  // IP addresses, cookies, and user agent strings to every event.
  sendDefaultPii: false,

  // ── Sampling ───────────────────────────────────────────────────────────────
  tracesSampleRate:          process.env.NODE_ENV === 'production' ? 0.05 : 0,
  // Session replay is intentionally disabled — it would capture story text
  // displayed in the reader, which is private erotic content.
  replaysSessionSampleRate:  0,
  replaysOnErrorSampleRate:  0,

  // ── Expected errors — don't clutter the dashboard ─────────────────────────
  ignoreErrors: [
    'AbortError',          // user cancelled generation — expected
    'NetworkError',        // connectivity — not actionable
    'Non-Error promise rejection captured',
  ],

  // ── Data scrubbing ─────────────────────────────────────────────────────────
  beforeSend(event) {
    scrubEvent(event)
    return event
  },

  beforeSendTransaction(event) {
    scrubEvent(event)
    return event
  },
})

function scrubEvent(event: Sentry.Event) {
  // Request body — may contain generation params, auth tokens, or story text
  if (event.request?.data !== undefined) {
    event.request.data = '[scrubbed]'
  }

  // Auth + session headers
  if (event.request?.headers) {
    const h = event.request.headers as Record<string, string>
    if (h['authorization'])  h['authorization']  = '[scrubbed]'
    if (h['cookie'])         h['cookie']          = '[scrubbed]'
    if (h['x-auth-token'])   h['x-auth-token']    = '[scrubbed]'
  }

  // Query string — may contain tokens in redirect flows (e.g. /auth/callback?code=)
  if (event.request?.query_string) {
    event.request.query_string = '[scrubbed]'
  }

  // User — keep id for debugging, strip email
  if (event.user?.email) {
    delete event.user.email
  }

  // Drop all breadcrumbs — they may contain console output with story fragments,
  // fetch URLs with auth params, or user interaction data.
  // Stack traces in the exception are sufficient for debugging.
  if (event.breadcrumbs) {
    event.breadcrumbs = []
  }
}
