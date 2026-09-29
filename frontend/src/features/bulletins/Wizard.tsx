'use client';
import { useState } from 'react';
import { FormProvider, useForm, type FieldPath } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight, Check, Save } from 'lucide-react';
import { bulletinSchema, apiPayload, initialData, normalizeData, type BulletinData } from '@/schemas/bulletin';
import { labels } from '@/components/Fields';
import { positionLabel } from '@/schemas/bulletin';
import { Modal } from '@/components/Modal';
import { draftKey, loadDraft, useDraft } from '@/hooks/useDraft';
import { api } from '@/services/api';
import type { Bulletin, User } from '@/types/api';
import { OccurrenceHeaderForm, LocationForm, InvolvedForm, HistoryForm, SeizedMaterialForm, PoliceTeamForm, DeliveryForm } from './sections';
import { ReviewStep } from './ReviewStep';

const steps = ['Identificação', 'Local', 'Envolvidos', 'Histórico', 'Material', 'Efetivo', 'Entrega', 'Revisão'];
const groups: FieldPath<BulletinData>[][] = [['recipient_email', 'bo_number', 'occurrence_type', 'occurrence_date', 'occurrence_time'], ['location'], ['people'], ['history'], ['seized_material'], ['team'], ['delivery']];
export function Wizard({ user, token, existing, onComplete, onBack }: { user: User; token: string; existing?: Bulletin; onComplete: (b: Bulletin) => void; onBack: () => void }) {
  const [focusPath, setFocusPath] = useState('');
  const [reason, setReason] = useState('');
  const [confirmRevision, setConfirmRevision] = useState(false);
  const [pending, setPending] = useState<{path: string; message: string}[]>([]);
  const [step, setStep] = useState(0);
  const [record, setRecord] = useState(existing);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const [defaults] = useState(() => normalizeData(loadDraft(user.id, existing?.id, existing?.version) || existing?.data || initialData()));
  const form = useForm<BulletinData>({ resolver: zodResolver(bulletinSchema), defaultValues: defaults, mode: 'onBlur' });
  const draftStatus = useDraft(form, user.id, true, record?.id, record?.version);
  async function next() {
    if (await form.trigger(groups[step])) { setPending([]); setStep(s => s+1); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    else { const parsed = bulletinSchema.safeParse(form.getValues()); if (!parsed.success) setPending(parsed.error.issues.filter(i => groups[step].some(g => i.path.join('.').startsWith(g))).map(i => ({path:i.path.join('.'),message:i.message}))); }
  }
  async function persist(emit: boolean) {
    if (!navigator.onLine) { setError('Sem conexão. O rascunho permanece neste dispositivo.'); return; }
    const valid = emit ? await form.trigger() : await form.trigger('bo_number');
    if (!valid) { const parsed = bulletinSchema.safeParse(form.getValues()); if (!parsed.success) setPending(parsed.error.issues.map(i => ({path: i.path.join('.'), message: i.message}))); setError('Revise os campos obrigatórios nas etapas anteriores. O rascunho local continua salvo.'); return; }
    setBusy(true); setError('');
    try {
      const revising = record?.status === 'ISSUED';
      const values = emit ? bulletinSchema.parse(form.getValues()) : form.getValues();
      const data = {...apiPayload(values), occurrence_date: values.occurrence_date || null, occurrence_time: values.occurrence_time || null};
      const result = await api<Bulletin>(revising ? `/api/bo/${record.id}/revise` : record ? `/api/bo/${record.id}` : '/api/bo', token, {
        method: revising || !record ? 'POST' : 'PUT',
        body: JSON.stringify({data, ...(revising ? {reason, version: record.version} : {emit, ...(record ? {version: record.version} : {})})})});
      setRecord(result); form.reset(normalizeData(result.data)); setConfirmRevision(false); setPending([]);
      if (emit) { localStorage.removeItem(draftKey(user.id, record?.id)); localStorage.removeItem(draftKey(user.id)); onComplete(result); }
      else setSaved('Rascunho salvo no servidor');
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao salvar.'); }
    finally { setBusy(false); }
  }
  const sections = [<OccurrenceHeaderForm key="header" />, <LocationForm key="location" />, <InvolvedForm key={`people-${focusPath}`} initialIndex={focusPath.startsWith('people.') ? Number(focusPath.split('.')[1]) : 0} />, <HistoryForm key="history" />, <SeizedMaterialForm key="material" />, <PoliceTeamForm key="team" />, <DeliveryForm key="delivery" />, <ReviewStep key="review" data={form.getValues()} />];
  return <div><div className="page-heading"><div><button className="back-link" onClick={onBack}><ArrowLeft size={15} /> Boletins</button><h1>{record?.status === 'ISSUED' ? 'Corrigir boletim emitido' : record ? 'Editar rascunho' : 'Novo boletim'}</h1><p>Preencha as etapas para registrar uma ocorrência.</p></div><span className="draft-status"><Save size={14} />{saved || draftStatus || 'Preenchimento seguro'}</span></div>
    <div className="mobile-progress">Etapa {step+1} de 8 · {steps[step]}<progress max={8} value={step+1}/></div><ol className="stepper">{steps.map((title, index) => <li key={title} className={index === step ? 'active' : index < step ? 'done' : ''}><button type="button" disabled={index > step} onClick={() => setStep(index)} aria-current={index === step ? 'step' : undefined}><span>{index < step ? <Check size={15} /> : index+1}</span>{title}</button></li>)}</ol>
    <FormProvider {...form}><form className="card wizard-card" onSubmit={e => e.preventDefault()}><div className="card-heading"><div><small>ETAPA {step+1} DE 8</small><h2>{steps[step]}</h2></div><span className="muted">* Campos obrigatórios</span></div>{error && <div role="alert" className="error-box">{error}</div>}{pending.length > 0 && <div className="notice"><h3>Pendências</h3>{pending.map(p => <button className="text-button" type="button" key={`${p.path}:${p.message}`} onClick={() => { setFocusPath(p.path); const root = p.path.split('.')[0]; const target = groups.findIndex(g => g.some(field => field === root)); setStep(target >= 0 ? target : 0); setTimeout(() => document.getElementById(p.path.replaceAll('.', '-'))?.focus(), 100); }}>{p.path.startsWith('people.') ? `Envolvido ${positionLabel(Number(p.path.split('.')[1]))} - ` : ''}{labels[p.path.split('.').at(-1)!] || p.path}: {p.message}</button>)}</div>}{sections[step]}<div className="wizard-actions"><button type="button" className="secondary" onClick={() => step ? setStep(step-1) : onBack()} disabled={busy}><ArrowLeft size={16} />{step ? 'Voltar e corrigir' : 'Voltar'}</button>{record?.status !== 'ISSUED' && <button type="button" className="text-button" onClick={() => persist(false)} disabled={busy}>Salvar no servidor</button>}{step < 7 ? <button type="button" className="primary" onClick={next}>Continuar <ArrowRight size={16} /></button> : <button type="button" className="primary" onClick={() => record?.status === 'ISSUED' ? setConfirmRevision(true) : persist(true)} disabled={busy}>{busy ? 'Gerando boletim…' : record?.status === 'ISSUED' ? 'Confirmar e regenerar PDF' : 'Confirmar e gerar boletim'}</button>}</div></form></FormProvider>
    {confirmRevision && <Modal title="Confirmar correção do boletim" onClose={() => setConfirmRevision(false)}><p>A versão anterior será preservada. O novo PDF não será reenviado automaticamente.</p><label className="field">Motivo da alteração<textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={500}/></label>{error && <p role="alert">{error}</p>}<button className="primary" disabled={busy || reason.trim().length < 3} onClick={() => persist(true)}>Confirmar correção</button></Modal>}
  </div>;
}
