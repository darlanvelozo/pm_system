import { useEffect, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { initialData, type BulletinData } from '@/schemas/bulletin';

export const draftKey = (user: string) => `bo24:draft:v1:${user}`;
export function loadDraft(user: string): BulletinData | null {
  try {
    const saved = JSON.parse(localStorage.getItem(draftKey(user)) || 'null');
    if (!saved || Date.now() - saved.savedAt > 7 * 86400000 || !saved.data?.people || !saved.data?.location) return null;
    if (!['TWO_INVOLVED', 'FOUR_INVOLVED'].includes(saved.data.bulletin_type)) return null;
    return { ...initialData(), ...saved.data };
  } catch { return null; }
}
export function useDraft(form: UseFormReturn<BulletinData>, user: string, enabled = true) {
  const [status, setStatus] = useState('');
  useEffect(() => {
    if (!enabled) return;
    const subscription = form.watch(() => {
      try { localStorage.setItem(draftKey(user), JSON.stringify({ savedAt: Date.now(), data: form.getValues() })); setStatus('Rascunho salvo neste dispositivo'); }
      catch { setStatus('Não foi possível salvar o rascunho neste dispositivo'); }
    });
    return () => subscription.unsubscribe();
  }, [form, user, enabled]);
  return status;
}
