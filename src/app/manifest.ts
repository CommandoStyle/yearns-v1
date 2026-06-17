import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             'Yearns',
    short_name:       'Yearns',
    description:      'Your intimate erotic fantasies. In words. In context. Anytime.',
    start_url:        '/',
    display:          'standalone',   // no browser chrome — immersive reading
    orientation:      'portrait',
    background_color: '#2D0A3E',      // yearns-plum — shown during splash screen
    theme_color:      '#2D0A3E',
    icons: [
      {
        // SVG scales perfectly to any size — supported on all modern Android/Chrome
        src:   '/icons/icon.svg',
        sizes: 'any',
        type:  'image/svg+xml',
      },
      {
        // PNG fallback for older Android / PWA install prompts
        // Generate from icon.svg: npx sharp-cli -i public/icons/icon.svg -o public/icons/icon-192.png resize 192
        src:   '/icons/icon-192.png',
        sizes: '192x192',
        type:  'image/png',
      },
      {
        src:   '/icons/icon-512.png',
        sizes: '512x512',
        type:  'image/png',
        // 'maskable' allows Android adaptive icon masking (safe zone = centre 80%)
        purpose: 'maskable',
      },
    ],
  }
}
