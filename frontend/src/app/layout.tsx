import { Pwa } from '@/components/Pwa';
import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = { manifest: '/manifest.webmanifest', appleWebApp: {capable: true, title: 'BO Online', statusBarStyle: 'default'}, icons: {apple: '/icons/apple-touch-icon.png'}, title: 'BO Online | 24º BPM', description: 'Sistema de Emissão de Boletins de Ocorrência do 24º BPM', robots: { index: false, follow: false } };
export const viewport: Viewport = {themeColor: '#102c49', width: 'device-width', initialScale: 1, viewportFit: 'cover'};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body><Pwa/>{children}</body></html>;
}
