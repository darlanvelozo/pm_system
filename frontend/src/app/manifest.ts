import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return { id: '/', name: 'BO Online 24º BPM', short_name: 'BO Online',
    description: 'Sistema de Emissão de Boletins de Ocorrência do 24º BPM', start_url: '/', scope: '/',
    display: 'standalone', orientation: 'any', theme_color: '#102c49', background_color: '#f5f7fa',
    icons: [{src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png'},
      {src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png'},
      {src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable'}] };
}
