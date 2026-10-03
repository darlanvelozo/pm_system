import type { Metadata } from 'next';
import { Guide } from '@/features/guide/Guide';
export const metadata: Metadata = { title: 'Guia de uso | BO Online 24º BPM' };
export default function GuidePage() {
  return <Guide audience="public"/>;
}
