import { MetadataRoute } from 'next'
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Jai Jinendra Kirana Store',
    short_name: 'Jai Jinendra',
    description: 'Your premium local grocery store.',
    start_url: '/',
    display: 'standalone', // <--- THIS IS THE MAGIC WORD! It hides the browser search bar.
    background_color: '#fff7ed', // Tailwind orange-50 (matches your new theme!)
    theme_color: '#ea580c', // Tailwind orange-600
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}