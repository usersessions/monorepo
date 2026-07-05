import type { MetadataRoute } from 'next'

/** Served at /manifest.webmanifest — makes the dashboard installable as a PWA. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'usersessions — Get your product found',
    short_name: 'usersessions',
    description:
      'A distribution engine for founders: get listed everywhere AI assistants and humans discover software, then watch whether they actually recommend you.',
    start_url: '/',
    display: 'standalone',
    background_color: '#101014',
    theme_color: '#101014',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  }
}
