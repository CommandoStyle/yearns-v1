import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [],
  },
}

export default withSentryConfig(nextConfig, {
  // Sentry organisation and project (set in env for source map uploads)
  org:     process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Auth token for uploading source maps to Sentry (CI/CD only)
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Suppress build output unless running in CI
  silent: !process.env.CI,

  // Upload source maps so stack traces in Sentry show original TypeScript.
  // Maps are deleted from the server bundle after upload — not exposed to clients.
  widenClientFileUpload: true,
  hideSourceMaps:        true,

  webpack: {
    automaticVercelMonitors: false,
    // Tree-shake Sentry logger statements from the production bundle
    treeshake: { removeDebugLogging: true },
  },
})
