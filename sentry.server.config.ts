import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN || undefined,
  enabled: false, // re-enable once a valid DSN is set in Vercel env vars
  environment: process.env.NODE_ENV,

  sendDefaultPii: false,

  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 0,

  ignoreErrors: [
    'AbortError',
    'NetworkError',
  ],

  beforeSend(event) {
    scrubServerEvent(event)
    return event
  },

  beforeSendTransaction(event) {
    scrubServerEvent(event)
    return event
  },
})

function scrubServerEvent(event: Sentry.Event) {
  // Request body — highest risk: generation route bodies contain story params;
  // profile route bodies contain user preference data.
  if (event.request?.data !== undefined) {
    event.request.data = '[scrubbed]'
  }

  if (event.request?.headers) {
    const h = event.request.headers as Record<string, string>
    if (h['authorization'])  h['authorization']  = '[scrubbed]'
    if (h['cookie'])         h['cookie']          = '[scrubbed]'
  }

  if (event.request?.query_string) {
    event.request.query_string = '[scrubbed]'
  }

  if (event.user?.email) {
    delete event.user.email
  }

  // Strip local variables — may include story text captured mid-generation
  if (event.exception?.values) {
    for (const ex of event.exception.values) {
      if (ex.stacktrace?.frames) {
        for (const frame of ex.stacktrace.frames) {
          if (frame.vars) frame.vars = {}
        }
      }
    }
  }
}
