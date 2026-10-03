'use client';
import { useEffect, useState } from 'react';
import {PdfPreview} from '@/components/PdfPreview';
import { api, downloadPdf, pdfUrl } from '@/services/api';
import { Modal } from '@/components/Modal';
import type { Bulletin, EmailStatus, User } from '@/types/api';
import { ReviewStep } from './ReviewStep';

type Revision = {version: number; actor_name: string; actor_username: string; created_at: string; reason: string; involved_count: number};
export function Status({ value }: { value: EmailStatus }) {
  return <span className={`badge ${value.toLowerCase()}`}>{({PENDING: 'Pendente', SENT: 'Enviado', FAILED: 'Falhou', NOT_SENT: 'Não enviado'})[value]}</span>;
}
export function Detail({ initial, token, user, onNew, onEdit }: { initial: Bulletin; token: string; user: User; onNew: () => void; onEdit: (b: Bulletin) => void }) {
  const [pdf,setPdf] = useState('');
  const [copied,setCopied] = useState('');
  const [record, setRecord] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<'cancel' | 'remove' | 'resend-email' | null>(null);
  const [reason, setReason] = useState('');
  const [target, setTarget] = useState('both');
  const [revisions, setRevisions] = useState<Revision[] | null>(null);
  const active = record.status === 'DRAFT' || record.status === 'ISSUED';
  useEffect(() => {
    if (record.status !== 'ISSUED' || (record.recipient_email_status !== 'PENDING' && record.battalion_email_status !== 'PENDING')) return;
    const timer = setInterval(() => { api<Bulletin>(`/api/bo/${record.id}`, token).then(setRecord).catch(e => setError(e.message)); }, 3000);
    return () => clearInterval(timer);
  }, [record.id, record.status, record.recipient_email_status, record.battalion_email_status, token]);
  async function perform() {
    setBusy(true); setError('');
    try {
      setRecord(await api<Bulletin>(`/api/bo/${record.id}/${action}`, token, {method: 'POST', body: JSON.stringify(action === 'resend-email' ? {target} : {reason})}));
      setAction(null); setReason('');
    } catch(e) { setError(e instanceof Error ? e.message : 'Falha na operação'); }
    finally { setBusy(false); }
  }
  const title = {DRAFT: 'Rascunho disponível', ISSUED: 'Boletim gerado com sucesso', CANCELLED: 'Boletim cancelado', REMOVED: 'Boletim removido'}[record.status];
  return <><div className="page-heading"><div><h1>{record.bo_number ? `Boletim ${record.bo_number}` : 'Rascunho sem protocolo'}</h1><p>Registrado por: {record.created_by_name} ({record.created_by_username})</p></div><button className="secondary" onClick={onNew}>Novo boletim</button></div>
    {error && <p role="alert" className="error-box">{error}</p>}
    {pdf && <PdfPreview url={pdf} filename={`BO_${record.bo_number || record.id}_v${record.current_revision}.pdf`} onClose={()=>setPdf('')}/>}<div className="card"><h2>{title}</h2><p>{[record.data.occurrence_type || 'Tipo não informado', record.data.occurrence_summary].filter(Boolean).join(' · ')}</p><p>{[record.data.occurrence_date?.split('-').reverse().join('/') || 'Data não informada', record.data.occurrence_time?.slice(0,5) || 'Hora não informada', record.data.location.city].filter(Boolean).join(' · ')}</p><p>{record.data.people.length} {record.data.people.length === 1 ? 'envolvido' : 'envolvidos'}</p>{record.bo_number && <><button className="secondary" onClick={async()=>{try{await navigator.clipboard.writeText(record.bo_number!);setCopied('Protocolo copiado.');}catch{setCopied('Selecione o protocolo abaixo e use Copiar.');}}}>Copiar protocolo</button>{copied && <p role="status">{copied}<input aria-label="Protocolo para copiar" readOnly value={record.bo_number} onFocus={e=>e.target.select()}/></p>}</>}<p>Versão do PDF: {record.current_revision || 'Ainda não emitido'}</p>
      {record.edited_at && <p>Alterado por: {record.edited_by_name} ({record.edited_by_username}) · {new Date(record.edited_at).toLocaleString('pt-BR')} · {record.edit_reason}</p>}
      {record.cancelled_at && <p>Cancelado por: {record.cancelled_by_name} ({record.cancelled_by_username}) · {new Date(record.cancelled_at).toLocaleString('pt-BR')} · {record.cancellation_reason}</p>}
      {record.deleted_at && <p>Removido por: {record.deleted_by_name} ({record.deleted_by_username}) · {new Date(record.deleted_at).toLocaleString('pt-BR')} · {record.deletion_reason}</p>}
      {record.status === 'ISSUED' && <><div className="delivery-status"><div><span>E-mail institucional</span><Status value={record.battalion_email_status}/></div><div><span>E-mail informado · {record.recipient_email}</span><Status value={record.recipient_email_status}/></div></div>{(record.recipient_email_status === 'FAILED' || record.battalion_email_status === 'FAILED') && <p className="notice">O envio por e-mail falhou. O boletim e o PDF continuam registrados e disponíveis para download{user.role === 'ADMIN' ? '; use “Reenviar e-mail” após verificar a configuração de envio.' : '; solicite o reenvio ao administrador.'}</p>}{record.recipient_email_status === 'NOT_SENT' && <p className="notice">Boletim atualizado. Deseja reenviar o PDF atualizado? Você também pode deixar para depois.</p>}</>}
      <div className="action-row">
        {record.status === 'ISSUED' && <button className="secondary" onClick={()=>pdfUrl(`/api/bo/${record.id}/pdf`,token).then(setPdf).catch(e=>setError(e.message))}>Visualizar PDF</button>}{record.status === 'ISSUED' && <a className="secondary" href={`/verificar/${record.id}?revision=${record.current_revision}`} target="_blank" rel="noopener">Verificar documento</a>}{record.status === 'ISSUED' && <button className="primary" onClick={() => downloadPdf(record.id, token).catch(e => setError(e.message))}>Baixar PDF</button>}
        {active && (record.status === 'DRAFT' || user.role === 'ADMIN') && <button className="secondary" onClick={() => onEdit(record)}>{record.status === 'DRAFT' ? 'Continuar preenchimento' : 'Editar boletim'}</button>}
        {user.role === 'ADMIN' && <>
          {record.status === 'ISSUED' && <button className="secondary" onClick={() => setAction('resend-email')}>Reenviar e-mail</button>}
          {active && <button className="secondary" onClick={() => setAction('cancel')}>Cancelar boletim</button>}
          {record.status !== 'REMOVED' && <button className="secondary" onClick={() => setAction('remove')}>Remover boletim</button>}
          {!!record.current_revision && <button className="secondary" onClick={() => api<Revision[]>(`/api/bo/${record.id}/revisions`, token).then(setRevisions).catch(e => setError(e.message))}>Histórico de versões</button>}
        </>}
      </div>
    </div>
    {revisions && <div className="card"><h2>Histórico de versões</h2>{revisions.map(r => <section className="version-entry" key={r.version}><h3>Versão {r.version} · {r.involved_count} {r.involved_count === 1 ? 'envolvido' : 'envolvidos'}</h3><p>{r.actor_name} ({r.actor_username}) · {new Date(r.created_at).toLocaleString('pt-BR')} · {r.reason}</p><button className="secondary" onClick={() => downloadPdf(record.id, token, r.version).catch(e => setError(e.message))}>Baixar versão {r.version}</button></section>)}</div>}
    <div className="card"><h2>Dados do boletim</h2><ReviewStep data={record.data} notice={false}/></div>
    {action && <Modal title={action === 'resend-email' ? 'Confirmar reenvio' : action === 'cancel' ? 'Cancelar boletim' : 'Remover boletim'} onClose={() => setAction(null)}>
      {action === 'resend-email' ? <label className="field">Destinatários<select value={target} onChange={e => setTarget(e.target.value)}><option value="both">Ambos</option><option value="recipient">Destinatário informado</option><option value="battalion">Batalhão</option></select></label> : <><p>O histórico será preservado. Esta ação não recolhe mensagens já enviadas.</p><label className="field">Motivo<textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={500}/></label></>}
      {error && <p role="alert">{error}</p>}<button className="primary" disabled={busy || (action !== 'resend-email' && reason.trim().length < 3)} onClick={perform}>Confirmar {action === 'resend-email' ? 'reenvio' : action === 'cancel' ? 'cancelamento' : 'remoção'}</button>
    </Modal>}
  </>;
}
