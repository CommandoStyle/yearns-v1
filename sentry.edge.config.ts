import * as Sentry from '@sentry/nextjs'

// Edge runtime Sentry config — minimal surface.
// All API routes run in edge; this captures errors from generate, profile,
// billing, and webhook handlers.

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,

  sendDefaultPii: false,

  // Edge runtime doesn't support full tracing — keep at 0
  tracesSampleRate: 0,

  beforeSend(event) {
    if (event.request?.data !== undefined) event.request.data = '[scrubbed]'

    if (event.request?.headers) {
      const h = event.request.headers as Record<string, string>
      if (h['authorization'])  h['authorization']  = '[scrubbed]'
      if (h['cookie'])         h['cookie']          = '[scrubbed]'
    }

    if (event.request?.query_string) {
      event.request.query_string = '[scrubbed]'
    }

    if (event.user?.email) delete event.user.email

    return event
  },
})
