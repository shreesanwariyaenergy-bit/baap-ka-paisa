import type { MetadataRoute } from 'next';

// Web app manifest: name, colours (existing tokens: paper #F1EFE6, ink #0C251F) and icons made from the finalised
// logo artwork. The maskable icon keeps the whole logo inside the 80% safe area.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BAAP KA PAISA — The Public Status Register',
    short_name: 'BAAP KA PAISA',
    description: "India's public status board, ranked by locality, city, state and country. Monthly seasons; the record stays.",
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#F1EFE6',
    theme_color: '#0C251F',
    icons: [
      { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/brand/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
