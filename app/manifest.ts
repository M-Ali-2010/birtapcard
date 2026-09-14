import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BirTapCard — Аналитика',
    short_name: 'BirTapCard',
    description: 'NFC и QR аналитика для ресторанов Узбекистана',
    start_url: '/dashboard',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#060A14',
    theme_color: '#060A14',
    lang: 'ru',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  }
}
