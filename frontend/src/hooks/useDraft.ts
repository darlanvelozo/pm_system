import { useEffect, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { initialData, type BulletinData } from '@/schemas/bulletin';

export const draftKey = (user: string, record?: string) => `bo24:draft:v1:${user}${record ? `:${record}` : ''}`;
export function loadDraft(user: string, record?: string, version?: number): BulletinData | null {
  try {
    const saved = JSON.parse(localStorage.getItem(draftKey(user, record)) || 'null');
    if (record && saved?.version !== version) return null;
    if (!saved || Date.now() - saved.savedAt > 7 * 86400000 || !saved.data?.people || !saved.data?.location) return null;
    if (!['DYNAMIC', 'TWO_INVOLVED', 'FOUR_INVOLVED'].includes(saved.data.bulletin_type)) return null;
    return { ...initialData(), ...saved.data };
  } catch { return null; }
}
export function useDraft(form: UseFormReturn<BulletinData>, user: string, enabled = true, record?: string, version?: number) {
  const [status, setStatus] = useState('');
  useEffect(() => {
    if (!enabled) return;
    const subscription = form.watch(() => {
      try { localStorage.setItem(draftKey(user, record), JSON.stringify({ version, savedAt: Date.now(), data: form.getValues() })); setStatus('Rascunho salvo neste dispositivo'); }
      catch { setStatus('Não foi possível salvar o rascunho neste dispositivo'); }
    });
    return () => subscription.unsubscribe();
  }, [form, user, enabled, record, version]);
  return status;
}

export function clearUserDrafts(user: string) {
  const prefix = draftKey(user);
  for (const key of Object.keys(localStorage)) if (key === prefix || key.startsWith(prefix + ':')) localStorage.removeItem(key);
  for (const key of Object.keys(localStorage)) if(key.startsWith(`bo24:emission:${user}:`)) localStorage.removeItem(key);
}
