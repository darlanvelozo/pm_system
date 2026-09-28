'use client';
import { useEffect, useState } from 'react';
import { CheckCircle2, Download, RefreshCw } from 'lucide-react';
import { api, downloadPdf } from '@/services/api';
import type { Bulletin, EmailStatus, User } from '@/types/api';
import { ReviewStep } from './ReviewStep';

export function Status({ value }: { value: EmailStatus }) {
  return <span className={`badge ${value.toLowerCase()}`}>{({ PENDING: 'Pendente', SENT: 'Enviado', FAILED: 'Falhou' })[value]}</span>;
}
export function Detail({ initial, token, user, onNew, onEdit }: { initial: Bulletin; token: string; user: User; onNew: () => void; onEdit: (b: Bulletin) => void }) {
  const [record, setRecord] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (record.status !== 'ISSUED' || (record.recipient_email_status !== 'PENDING' && record.battalion_email_status !== 'PENDING')) return;
    const timer = setInterval(() => { api<Bulletin>(`/api/bo/${record.id}`, token).then(setRecord).catch(e => setError(e.message)); }, 3000);
    return () => clearInterval(timer);
  }, [record.id, record.status, record.recipient_email_status, record.battalion_email_status, token]);
  async function resend(target: string) {
    setBusy(true); setError('');
    try { setRecord(await api<Bulletin>(`/api/bo/${record.id}/resend-email`, token, { method: 'POST', body: JSON.stringify({ target }) })); }
    catch(e) { setError(e instanceof Error ? e.message : 'Falha no reenvio'); }
    finally { setBusy(false); }
  }
  return <><div className="page-heading"><div><small className="eyebrow">REGISTRO DA OCORRÊNCIA</small><h1>Boletim {record.bo_number}</h1><p>{record.status === 'ISSUED' ? 'Documento emitido e armazenado com segurança.' : 'Rascunho salvo no servidor.'}</p></div><button className="secondary" onClick={onNew}>Novo boletim</button></div>
    {error && <div role="alert" className="error-box">{error}</div>}
    <div className="card result-card"><CheckCircle2 className="result-icon" size={32} /><h2>{record.status === 'ISSUED' ? 'Boletim gerado com sucesso' : 'Rascunho disponível'}</h2><div className="delivery-status"><div><span>PDF</span><strong>{record.pdf_generated_at ? 'Gerado' : 'Não emitido'}</strong></div><div><span>E-mail institucional · 24º BPM</span><Status value={record.battalion_email_status} /></div><div><span>E-mail informado · {record.recipient_email}</span><Status value={record.recipient_email_status} /></div></div>
    <div className="action-row">{record.status === 'ISSUED' ? <button className="primary" onClick={() => downloadPdf(record.id, token).catch(e => setError(e.message))}><Download size={16} /> Baixar PDF</button> : <button className="primary" onClick={() => onEdit(record)}>Continuar preenchimento</button>}
    {user.role === 'ADMIN' && record.status === 'ISSUED' && <><select aria-label="Destino do reenvio" id="resend-target" defaultValue="both"><option value="both">Ambos os destinatários</option><option value="recipient">E-mail informado</option><option value="battalion">Batalhão</option></select><button className="secondary" disabled={busy} onClick={() => resend((document.getElementById('resend-target') as HTMLSelectElement).value)}><RefreshCw size={15} /> Reenviar e-mail</button></>}</div></div>
    <div className="card"><h2>Dados do boletim</h2><ReviewStep data={record.data} /></div></>;
}
