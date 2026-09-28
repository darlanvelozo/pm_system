import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'BO Online | 24º BPM', description: 'Sistema de Emissão de Boletins de Ocorrência do 24º BPM', robots: { index: false, follow: false } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
