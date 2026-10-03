'use client';
import {useEffect,useRef,useState} from 'react';
import {api,ApiError,pdfUrl} from '@/services/api';
import {PdfPreview} from '@/components/PdfPreview';
import {Modal} from '@/components/Modal';
import {display,initialReport,normalizeReport,reportLabels,reportPayload,reportSchema,type ReportData} from './schema';
import type {Report} from './types';
const steps=['Identificação','Dados da ocorrência','Pessoas','Materiais / Solução','Viaturas e guarnições','Relato','Providências','Revisão'];
const groups:(keyof ReportData)[][]=[['recipient_email','occurrence_type'],['location','occurrence_date','occurrence_time'],['victims','involved','witnesses'],['seized_material','weapon_type','others','fled','samu','icrim','cause'],['teams'],['narrative'],['measures','closing_location','closing_date']];
const longFields=new Set(['victims','involved','witnesses','seized_material','others','cause','teams','narrative','measures']);
const required=new Set(['recipient_email','occurrence_type','location','occurrence_date','occurrence_time','fled','samu','icrim','narrative','measures']);
export function ReportForm({token,userId,existing,onBack,onComplete}:{token:string;userId:string;existing?:Report;onBack:()=>void;onComplete:(r:Report)=>void}) {
  const key=`bo24:report-draft:${userId}:${existing?.id||'new'}`;
  const [initial]=useState(()=>{try {const saved=JSON.parse(localStorage.getItem(key)||'null'); if(saved && (!existing || saved.version===existing.version)) return saved as {data:ReportData;record?:Report;version?:number};}catch{}return {data:existing?normalizeReport(existing.data):initialReport(),record:existing};});
  const [data,setData]=useState<ReportData>(normalizeReport(initial.data));
  const [record,setRecord]=useState<Report|undefined>(existing||initial.record);
  const [step,setStep]=useState(existing?.status==='ISSUED'?0:initial.data.draft_step||0);
  const [error,setError]=useState('');const [saved,setSaved]=useState('');const [busy,setBusy]=useState(false);
  const [preview,setPreview]=useState('');const [reason,setReason]=useState('');const [confirm,setConfirm]=useState(false);const [conflict,setConflict]=useState(false);
  const lock=useRef(false);
  useEffect(()=>{try {localStorage.setItem(key,JSON.stringify({data:{...data,draft_step:step},record,version:record?.version}));}catch{}},[data,step,key,record]);
  useEffect(()=>{window.scrollTo({top:0});},[step]);
  function validate(fields?: (keyof ReportData)[]) {const parsed=reportSchema.safeParse(data);if(parsed.success)return true; const issues=parsed.error.issues.filter(i=>!fields||fields.includes(i.path[0] as keyof ReportData));setError(issues.map(i=>`${reportLabels[String(i.path[0])]}: ${i.message}`).join(' · '));return !issues.length;}
  async function save(emit=false) {
    if(lock.current || (emit&&!validate())) return;
    lock.current=true;setBusy(true);setError('');
    try {
      if(record?.status==='ISSUED') {
        const result=await api<Report>(`/api/analytical-reports/${record.id}/revise`,token,{method:'POST',body:JSON.stringify({data:reportPayload(data),version:record.version,reason})});
        localStorage.removeItem(key);onComplete(result);return;
      }
      let current=record;
      let attempt=current?localStorage.getItem(`bo24:report-emission:${userId}:${current.id}`):null;
      if(!emit || !attempt) {
        current=await api<Report>(current?`/api/analytical-reports/${current.id}`:'/api/analytical-reports',token,{method:current?'PUT':'POST',body:JSON.stringify({data:reportPayload({...data,draft_step:step}),...(current?{version:current.version}:{})})});
        setRecord(current);setSaved('Rascunho salvo no servidor');
      }
      if(emit && current) {
        const emissionKey=`bo24:report-emission:${userId}:${current.id}`;
        attempt ||= crypto.randomUUID();localStorage.setItem(emissionKey,attempt);
        const result=await api<Report>(`/api/analytical-reports/${current.id}/emit`,token,{method:'POST',headers:{'Idempotency-Key':attempt},body:JSON.stringify({version:current.version})});
        localStorage.removeItem(emissionKey);localStorage.removeItem(key);localStorage.removeItem(`bo24:report-draft:${userId}:${current.id}`);onComplete(result);
      }
    }catch(e){setError(e instanceof Error?e.message:'Falha ao salvar');setConflict(e instanceof ApiError&&e.status===409);}
    finally{lock.current=false;setBusy(false);}
  }
  async function reload(){if(!record)return;try{const r=await api<Report>(`/api/analytical-reports/${record.id}`,token);if(r.status!=='DRAFT'){onComplete(r);return;}setRecord(r);setData(normalizeReport(r.data));setStep(r.data.draft_step);setConflict(false);setError('');}catch(e){setError(e instanceof Error?e.message:'Falha ao recarregar');}}
  async function showPreview(){if(!validate())return;setBusy(true);try{setPreview(await pdfUrl('/api/analytical-reports/preview-pdf',token,reportPayload(data)));}catch(e){setError(e instanceof Error?e.message:'Falha na prévia');}finally{setBusy(false);}}
  return <><div className="page-heading"><div><button className="back-link" onClick={onBack}>Voltar aos relatórios</button><h1>{existing?.status==='ISSUED'?'Corrigir Relatório Analítico':'Novo Relatório Analítico'}</h1><p>{record?.report_number||'Número será gerado automaticamente na emissão'}</p></div></div><p role="status">{saved||'Rascunho local neste dispositivo'}</p><p>Etapa {step+1} de 8 · {steps[step]}</p><progress max={8} value={step+1}/><ol className="stepper">{steps.map((s,i)=><li key={s} className={i===step?'active':''}><button disabled={i>step} onClick={()=>setStep(i)}>{i+1}. {s}</button></li>)}</ol><section className="card wizard-card"><h2>{steps[step]}</h2>{error&&<p className="error-box" role="alert">{error}</p>}{conflict&&<button className="secondary" onClick={reload}>Recarregar versão do servidor</button>}{step<7?<div className="form-grid">{groups[step].map(field=><label className={`field ${longFields.has(field)?'full':''}`} key={field}>{reportLabels[field]}{required.has(field)?' *':''}{['fled','samu','icrim'].includes(field)?<select value={data[field]} onChange={e=>setData({...data,[field]:e.target.value})}><option value="">Selecione</option><option>SIM</option><option>NÃO</option></select>:longFields.has(field)?<textarea rows={field==='narrative'||field==='measures'?12:4} maxLength={field==='narrative'||field==='measures'?80000:20000} value={data[field]} onChange={e=>setData({...data,[field]:e.target.value})}/>:<input type={field.includes('date')?'date':field==='occurrence_time'?'time':field==='recipient_email'?'email':'text'} maxLength={field==='location'?2000:field==='weapon_type'?500:field==='recipient_email'?254:200} value={data[field]} onChange={e=>setData({...data,[field]:e.target.value})}/>}</label>)}</div>:<><dl className="report-review">{Object.entries(reportLabels).map(([field,label])=><div key={field}><dt>{label}</dt><dd>{display(field,data[field as keyof ReportData])}</dd></div>)}</dl><button className="secondary" disabled={busy} onClick={showPreview}>Visualizar prévia do relatório</button></>}{step===0&&<p>Não inclua nomes, documentos ou endereço completo no tipo de ocorrência. Esse campo identifica o e-mail enviado.</p>}{step===6&&<p>A autoridade é configurada pelo responsável pelo sistema. A assinatura manuscrita não é reproduzida. Informe somente o município no local de emissão.</p>}<div className="wizard-actions"><button className="secondary" disabled={busy} onClick={()=>step?setStep(step-1):onBack()}>Voltar</button>{record?.status!=='ISSUED'&&<button className="text-button" disabled={busy} onClick={()=>save()}>Salvar rascunho do relatório</button>}{step<7?<button className="primary" onClick={()=>{if(validate(groups[step]))setStep(step+1);}}>Continuar</button>:<button className="primary" disabled={busy} onClick={()=>record?.status==='ISSUED'?setConfirm(true):save(true)}>{busy?'Processando…':record?.status==='ISSUED'?'Confirmar revisão do relatório':'Emitir Relatório Analítico'}</button>}</div></section>{preview&&<PdfPreview url={preview} filename="previa-relatorio.pdf" onClose={()=>setPreview('')}/ >}{confirm&&<Modal title="Confirmar revisão do relatório" onClose={()=>setConfirm(false)}><p>Preserva a versão anterior. O reenvio é uma ação separada.</p><label className="field">Motivo da revisão<textarea value={reason} maxLength={500} onChange={e=>setReason(e.target.value)}/></label>{error&&<p role="alert">{error}</p>}<button className="primary" disabled={busy||reason.trim().length<3} onClick={()=>save(true)}>Confirmar correção</button></Modal>}</>;
}
