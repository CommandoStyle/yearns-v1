import type { Metadata, Viewport } from 'next'
import { EB_Garamond, Inter } from 'next/font/google'
import Script from 'next/script'
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration'
import { SmoothScroll } from '@/components/SmoothScroll'
import './globals.css'

const garamond = EB_Garamond({
  subsets: ['latin'],
  variable: '--font-playfair', // keep same CSS var — no component changes needed
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title:       'Yearns',
  description: 'AI-powered personalised erotic fiction for adult women.',
  // No indexing until age gate is fully deployed and live
  robots: { index: false, follow: false },
  // PWA / iOS
  appleWebApp: {
    capable:         true,
    title:           'Yearns',
    statusBarStyle:  'black-translucent',
  },
  icons: {
    icon:  '/icons/icon.svg',
    // apple-touch-icon must be PNG — generate from icon.svg before launch.
    // Command: npx sharp-cli -i public/icons/icon.svg -o public/icons/apple-touch-icon.png resize 180
    apple: '/icons/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  width:            'device-width',
  initialScale:     1,
  // Prevent double-tap zoom on the reading controls
  maximumScale:     1,
  userScalable:     false,
  themeColor:       '#ffffff',
  colorScheme:      'light',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${garamond.variable} ${inter.variable}`}>
      <body className="min-h-screen antialiased bg-white text-black">
        <SmoothScroll>
          {children}
        </SmoothScroll>
        <ServiceWorkerRegistration />
        {process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN && (
          <Script
            defer
            data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN}
            src="https://plausible.io/js/script.js"
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  )
}
