'use client';
import { useState } from 'react';
import { FormProvider, useForm, type FieldPath } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight, Check, Save } from 'lucide-react';
import { bulletinSchema, apiPayload, initialData, type BulletinData } from '@/schemas/bulletin';
import { draftKey, loadDraft, useDraft } from '@/hooks/useDraft';
import { api } from '@/services/api';
import type { Bulletin, User } from '@/types/api';
import { OccurrenceHeaderForm, LocationForm, InvolvedForm, HistoryForm, SeizedMaterialForm, PoliceTeamForm, DeliveryForm } from './sections';
import { ReviewStep } from './ReviewStep';

const steps = ['Identificação', 'Local', 'Envolvidos', 'Histórico', 'Material', 'Efetivo', 'Entrega', 'Revisão'];
const groups: FieldPath<BulletinData>[][] = [['recipient_email', 'bo_number', 'occurrence_type', 'occurrence_date', 'occurrence_time'], ['location'], ['people'], ['history'], ['seized_material'], ['team'], ['delivery']];
export function Wizard({ user, token, existing, onComplete, onBack }: { user: User; token: string; existing?: Bulletin; onComplete: (b: Bulletin) => void; onBack: () => void }) {
  const [step, setStep] = useState(0);
  const [record, setRecord] = useState(existing);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const [defaults] = useState(() => existing?.data || loadDraft(user.id) || initialData());
  const form = useForm<BulletinData>({ resolver: zodResolver(bulletinSchema), defaultValues: defaults, mode: 'onBlur' });
  const draftStatus = useDraft(form, user.id, !existing);
  async function next() {
    if (await form.trigger(groups[step])) { setStep(s => s+1); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  }
  async function persist(emit: boolean) {
    const valid = await form.trigger();
    if (!valid) { setError('Revise os campos obrigatórios nas etapas anteriores. O rascunho local continua salvo.'); return; }
    setBusy(true); setError('');
    try {
      const result = await api<Bulletin>(record ? `/api/bo/${record.id}` : '/api/bo', token, { method: record ? 'PUT' : 'POST', body: JSON.stringify({ data: apiPayload(bulletinSchema.parse(form.getValues())), emit, ...(record ? { version: record.version } : {}) }) });
      setRecord(result);
      if (emit) { localStorage.removeItem(draftKey(user.id)); onComplete(result); }
      else setSaved('Rascunho salvo no servidor');
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao salvar.'); }
    finally { setBusy(false); }
  }
  const sections = [<OccurrenceHeaderForm key="header" />, <LocationForm key="location" />, <InvolvedForm key="people" />, <HistoryForm key="history" />, <SeizedMaterialForm key="material" />, <PoliceTeamForm key="team" />, <DeliveryForm key="delivery" />, <ReviewStep key="review" data={form.getValues()} />];
  return <div><div className="page-heading"><div><button className="back-link" onClick={onBack}><ArrowLeft size={15} /> Boletins</button><h1>{record ? 'Editar rascunho' : 'Novo boletim'}</h1><p>Preencha as etapas para registrar uma ocorrência.</p></div><span className="draft-status"><Save size={14} />{saved || draftStatus || 'Preenchimento seguro'}</span></div>
    <ol className="stepper">{steps.map((title, index) => <li key={title} className={index === step ? 'active' : index < step ? 'done' : ''}><button type="button" disabled={index > step} onClick={() => setStep(index)} aria-current={index === step ? 'step' : undefined}><span>{index < step ? <Check size={15} /> : index+1}</span>{title}</button></li>)}</ol>
    <FormProvider {...form}><form className="card wizard-card" onSubmit={e => e.preventDefault()}><div className="card-heading"><div><small>ETAPA {step+1} DE 8</small><h2>{steps[step]}</h2></div><span className="muted">* Campos obrigatórios</span></div>{error && <div role="alert" className="error-box">{error}</div>}{sections[step]}<div className="wizard-actions"><button type="button" className="secondary" onClick={() => step ? setStep(step-1) : onBack()} disabled={busy}><ArrowLeft size={16} />{step ? 'Voltar e corrigir' : 'Voltar'}</button><button type="button" className="text-button" onClick={() => persist(false)} disabled={busy}>Salvar no servidor</button>{step < 7 ? <button type="button" className="primary" onClick={next}>Continuar <ArrowRight size={16} /></button> : <button type="button" className="primary" onClick={() => persist(true)} disabled={busy}>{busy ? 'Gerando boletim…' : 'Confirmar e gerar boletim'}</button>}</div></form></FormProvider>
  </div>;
}
