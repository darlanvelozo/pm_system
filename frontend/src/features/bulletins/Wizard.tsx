'use client';
import { useState, useRef, useEffect } from 'react';
import { FormProvider, useForm, type FieldPath } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight, Check, Save } from 'lucide-react';
import { bulletinSchema, apiPayload, initialData, normalizeData, type BulletinData } from '@/schemas/bulletin';
import { labels } from '@/components/Fields';
import { positionLabel } from '@/schemas/bulletin';
import { Modal } from '@/components/Modal';
import { draftKey, loadDraft, useDraft } from '@/hooks/useDraft';
import { api, ApiError, pdfUrl } from '@/services/api';
import {PdfPreview} from '@/components/PdfPreview';
import type { Bulletin, User } from '@/types/api';
import { OccurrenceHeaderForm, LocationForm, InvolvedForm, HistoryForm, SeizedMaterialForm, PoliceTeamForm, DeliveryForm } from './sections';
import { ReviewStep } from './ReviewStep';

const steps = ['Identificação', 'Local', 'Envolvidos', 'Histórico', 'Material', 'Efetivo', 'Entrega', 'Revisão'];
const groups: FieldPath<BulletinData>[][] = [['recipient_email', 'occurrence_summary', 'occurrence_type', 'occurrence_date', 'occurrence_time'], ['location'], ['people'], ['history'], ['seized_material'], ['team'], ['delivery']];
export function Wizard({ user, token, existing, onComplete, onBack }: { user: User; token: string; existing?: Bulletin; onComplete: (b: Bulletin) => void; onBack: () => void }) {
  const [previewUrl, setPreviewUrl] = useState('');
  const [conflict, setConflict] = useState(false);
  const [network, setNetwork] = useState('');
  const [operational, setOperational] = useState<{occurrence_types:string[]; team:BulletinData['team']; delivery:Pick<BulletinData['delivery'],'unit'>} | null>(null);
  const lock = useRef(false);
  const attemptKey = `bo24:emission:${user.id}:${existing?.id || 'new'}`;
  const emissionKey = useRef<string | null>(null);
  useEffect(() => {
    // Usuário básico has no access to suggestions taken from previous records.
    if (user.role !== 'BASICO') api<typeof operational>('/api/operational-options', token).then(setOperational).catch(() => {});
    const offline = () => setNetwork('Sem conexão — trabalhando com rascunho local');
    const online = () => setNetwork('Conexão restabelecida');
    if(!navigator.onLine) offline();
    window.addEventListener('offline',offline); window.addEventListener('online',online);
    return () => {window.removeEventListener('offline',offline); window.removeEventListener('online',online);};
  }, [token, user.role]);
  const [focusPath, setFocusPath] = useState('');
  const [reason, setReason] = useState('');
  const [confirmRevision, setConfirmRevision] = useState(false);
  const [pending, setPending] = useState<{path: string; message: string}[]>([]);
  const [step, setStep] = useState(() => existing?.status === 'ISSUED' ? 0 : (loadDraft(user.id,existing?.id,existing?.version)?.draft_step || existing?.data.draft_step || 0));
  const [record, setRecord] = useState(existing);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const [defaults] = useState(() => {const data = normalizeData(loadDraft(user.id, existing?.id, existing?.version) || existing?.data || initialData()); if(!existing) data.bo_number=null; return data;});
  const form = useForm<BulletinData>({ resolver: zodResolver(bulletinSchema), defaultValues: defaults, mode: 'onBlur' });
  const draftStatus = useDraft(form, user.id, true, record?.id, record?.version);
  useEffect(() => {form.setValue('draft_step',step);}, [form,step]);
  async function preview() {
    if(!await form.trigger()) {setError('Revise as pendências antes da prévia.'); return;}
    setBusy(true);
    try {setPreviewUrl(await pdfUrl('/api/bo/preview-pdf',token,apiPayload(bulletinSchema.parse(form.getValues()))));}
    catch(e) {setError(e instanceof Error ? e.message : 'Falha na prévia');}
    finally {setBusy(false);}
  }
  async function reloadServer() {
    if(!record) return;
    try {const current = await api<Bulletin>(`/api/bo/${record.id}`,token); if(current.status !== 'DRAFT') {onComplete(current); return;} setRecord(current); form.reset(normalizeData(current.data)); setConflict(false); setError(''); setStep(current.data.draft_step || 0);}
    catch(e) {setError(e instanceof Error ? e.message : 'Falha ao recarregar');}
  }
  async function next() {
    if (await form.trigger(groups[step])) { setPending([]); setStep(s => s+1); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    else { const parsed = bulletinSchema.safeParse(form.getValues()); if (!parsed.success) setPending(parsed.error.issues.filter(i => groups[step].some(g => i.path.join('.').startsWith(g))).map(i => ({path:i.path.join('.'),message:i.message}))); }
  }
  async function persist(emit: boolean) {
    if(lock.current) return;
    if (!navigator.onLine) { setError('Sem conexão. O rascunho permanece neste dispositivo.'); return; }
    const valid = emit ? await form.trigger() : true;
    if (!valid) { const parsed = bulletinSchema.safeParse(form.getValues()); if (!parsed.success) setPending(parsed.error.issues.map(i => ({path: i.path.join('.'), message: i.message}))); setError('Revise os campos obrigatórios nas etapas anteriores. O rascunho local continua salvo.'); return; }
    if(lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const revising = record?.status === 'ISSUED';
      if(emit && !revising) {
        emissionKey.current ||= localStorage.getItem(attemptKey) || crypto.randomUUID();
        localStorage.setItem(attemptKey,emissionKey.current);
      }
      const values = emit ? bulletinSchema.parse(form.getValues()) : form.getValues();
      const data = {...apiPayload(values), occurrence_date: values.occurrence_date || null, occurrence_time: values.occurrence_time || null};
      const result = await api<Bulletin>(revising ? `/api/bo/${record.id}/revise` : record ? `/api/bo/${record.id}` : '/api/bo', token, {
        method: revising || !record ? 'POST' : 'PUT',
        headers: emit && !revising ? {'Idempotency-Key':emissionKey.current!} : {},
        body: JSON.stringify({data, ...(revising ? {reason, version: record.version} : {emit, ...(record ? {version: record.version} : {})})})});
      // Usuário básico receives only a receipt (no data) after emission.
      if (user.role !== 'BASICO' || !emit) { setRecord(result); form.reset(normalizeData(result.data)); } setConfirmRevision(false); setPending([]);
      if (emit) { localStorage.removeItem(attemptKey); localStorage.removeItem(draftKey(user.id, record?.id)); localStorage.removeItem(draftKey(user.id)); onComplete(result); }
      else {
        localStorage.setItem(draftKey(user.id,result.id),JSON.stringify({version:result.version,savedAt:Date.now(),data:result.data}));
        if(!record) localStorage.removeItem(draftKey(user.id));
        setSaved('Rascunho salvo no servidor');
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao salvar.'); if(e instanceof ApiError && e.status === 409) setConflict(true); }
    finally { lock.current = false; setBusy(false); }
  }
  const sections = [<OccurrenceHeaderForm key="header" suggestions={operational?.occurrence_types} />, <LocationForm key="location" />, <InvolvedForm key={`people-${focusPath}`} initialIndex={focusPath.startsWith('people.') ? Number(focusPath.split('.')[1]) : 0} />, <HistoryForm key="history" />, <SeizedMaterialForm key="material" />, <PoliceTeamForm key="team" />, <DeliveryForm key="delivery" />, <ReviewStep key="review" data={form.getValues()} />];
  return <div><div className="page-heading"><div><button className="back-link" onClick={onBack}><ArrowLeft size={15} /> {user.role === 'BASICO' ? 'Início' : 'Boletins'}</button><h1>{record?.status === 'ISSUED' ? 'Corrigir boletim emitido' : record ? 'Editar rascunho' : 'Novo boletim'}</h1><p>Preencha as etapas para registrar uma ocorrência.</p></div><span className="draft-status"><Save size={14} />{saved || draftStatus || 'Preenchimento seguro'}</span></div>
    <div className="mobile-progress">Etapa {step+1} de 8 · {steps[step]}<progress max={8} value={step+1}/></div><ol className="stepper">{steps.map((title, index) => <li key={title} className={index === step ? 'active' : index < step ? 'done' : ''}><button type="button" disabled={index > step} onClick={() => setStep(index)} aria-current={index === step ? 'step' : undefined}><span>{index < step ? <Check size={15} /> : index+1}</span>{title}</button></li>)}</ol>
    <FormProvider {...form}><form className="card wizard-card" onSubmit={e => e.preventDefault()}><div className="card-heading"><div><small>ETAPA {step+1} DE 8</small><h2>{steps[step]}</h2></div><span className="muted">* Campos obrigatórios</span></div>{error && <div role="alert" className="error-box">{error}</div>}{pending.length > 0 && <div className="notice"><h3>Pendências</h3>{pending.map(p => <button className="text-button" type="button" key={`${p.path}:${p.message}`} onClick={() => { setFocusPath(p.path); const root = p.path.split('.')[0]; const target = groups.findIndex(g => g.some(field => field === root)); setStep(target >= 0 ? target : 0); setTimeout(() => document.getElementById(p.path.replaceAll('.', '-'))?.focus(), 100); }}>{p.path.startsWith('people.') ? `Envolvido ${positionLabel(Number(p.path.split('.')[1]))} - ` : ''}{labels[p.path.split('.').at(-1)!] || p.path}: {p.message}</button>)}</div>}{conflict && <button type="button" className="secondary" onClick={reloadServer}>Recarregar versão do servidor</button>}{network && <p role="status">{network} {navigator.onLine && record?.status !== 'ISSUED' && <button type="button" onClick={() => persist(false)}>Sincronizar rascunho</button>}</p>}{step === 5 && !!operational?.team.length && <button type="button" className="secondary" onClick={() => form.setValue('team',operational.team,{shouldDirty:true})}>Reutilizar meu último efetivo (substitui as equipes atuais)</button>}{step === 6 && operational?.delivery.unit && <button type="button" className="secondary" onClick={() => form.setValue('delivery.unit',operational.delivery.unit,{shouldDirty:true})}>Reutilizar minha última unidade de entrega: {operational.delivery.unit}</button>}{sections[step]}{step === 7 && <button type="button" className="secondary" disabled={busy} onClick={preview}>Visualizar prévia do PDF</button>}<div className="wizard-actions"><button type="button" className="secondary" onClick={() => step ? setStep(step-1) : onBack()} disabled={busy}><ArrowLeft size={16} />{step ? 'Voltar e corrigir' : 'Voltar'}</button>{record?.status !== 'ISSUED' && <button type="button" className="text-button" onClick={() => persist(false)} disabled={busy}>Salvar no servidor</button>}{step < 7 ? <button type="button" className="primary" onClick={next}>Continuar <ArrowRight size={16} /></button> : <button type="button" className="primary" onClick={() => record?.status === 'ISSUED' ? setConfirmRevision(true) : persist(true)} disabled={busy}>{busy ? 'Gerando boletim…' : record?.status === 'ISSUED' ? 'Confirmar e regenerar PDF' : 'Confirmar e gerar boletim'}</button>}</div></form></FormProvider>
    {previewUrl && <PdfPreview url={previewUrl} filename="previa-boletim.pdf" onClose={() => setPreviewUrl('')}/>}
    {confirmRevision && <Modal title="Confirmar correção do boletim" onClose={() => setConfirmRevision(false)}><p>A versão anterior será preservada. O novo PDF não será reenviado automaticamente.</p><label className="field">Motivo da alteração<textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={500}/></label>{error && <p role="alert">{error}</p>}<button className="primary" disabled={busy || reason.trim().length < 3} onClick={() => persist(true)}>Confirmar correção</button></Modal>}
  </div>;
}
