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
      { src: '/favicon.ico', sizes: 'any', type: 'image/x-icon' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  }
}
