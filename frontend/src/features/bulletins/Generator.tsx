'use client';
import {useEffect,useState} from 'react';
import {CheckCircle2, FilePlus2, FileSpreadsheet, FileText, Shield} from 'lucide-react';
import {api} from '@/services/api';
import type {BulletinList} from '@/types/api';
import type {ReportList} from '@/features/analytical-reports/types';

// Minimal data a "Usuário básico" sees after emission: no content and no PDF.
export type Receipt = {kind: 'bo' | 'report'; number: string | null; status: string; date: string | null};
const when = (value?: string | null) => value ? new Date(value).toLocaleString('pt-BR') : '—';

export function Generator({token,receipt,onDismiss,onNewBulletin,onNewReport,onContinueBulletin,onContinueReport}: {token: string; receipt: Receipt | null; onDismiss: () => void; onNewBulletin: () => void; onNewReport: () => void; onContinueBulletin: (id: string) => void; onContinueReport: (id: string) => void}) {
  const [bulletins,setBulletins] = useState<BulletinList['items']>([]);
  const [reports,setReports] = useState<ReportList['items']>([]);
  const [error,setError] = useState('');
  useEffect(() => {
    let active = true;
    // Only own drafts are listed; the API rejects any other status for this profile.
    Promise.all([api<BulletinList>('/api/bo?status=DRAFT&size=50', token), api<ReportList>('/api/analytical-reports?status=DRAFT&size=50', token)])
      .then(([b, r]) => { if (active) { setBulletins(b.items); setReports(r.items); } }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [token]);
  return <>
    <div className="page-heading"><div><small className="eyebrow">USUÁRIO BÁSICO</small><h1>Registrar documentos</h1><p>Crie e emita boletins e relatórios analíticos. Os documentos emitidos seguem por e-mail e não ficam disponíveis para consulta neste perfil.</p></div></div>
    {error && <div className="error-box" role="alert">{error}</div>}
    {receipt && <section className="card receipt" role="status" aria-label="Comprovante de emissão"><h2><CheckCircle2 size={20} className="result-icon" aria-hidden="true"/> {receipt.kind === 'bo' ? 'Boletim emitido com sucesso' : 'Relatório Analítico emitido com sucesso'}</h2><dl className="review-grid review"><div><dt>{receipt.kind === 'bo' ? 'Protocolo' : 'Número'}</dt><dd><strong>{receipt.number || '—'}</strong></dd></div><div><dt>Situação</dt><dd>{receipt.status === 'ISSUED' ? 'Emitido' : receipt.status}</dd></div><div><dt>Data da emissão</dt><dd>{when(receipt.date)}</dd></div></dl><p>O PDF é enviado pelo sistema ao e-mail do batalhão e ao destinatário informado. Anote o {receipt.kind === 'bo' ? 'protocolo' : 'número'} se precisar solicitar o documento ao administrador.</p><button className="secondary" onClick={onDismiss}>Fechar comprovante</button></section>}
    <div className="model-options basic-actions"><button className="model-option" onClick={onNewBulletin}><strong><FilePlus2 size={18} aria-hidden="true"/> Novo boletim</strong><small>Registrar um Boletim de Ocorrência em 8 etapas.</small></button><button className="model-option" onClick={onNewReport}><strong><FileSpreadsheet size={18} aria-hidden="true"/> Novo Relatório Analítico</strong><small>Registrar um Relatório Analítico de Ocorrência.</small></button></div>
    <section className="card"><h2>Meus rascunhos</h2><p>Rascunhos salvos no servidor por você. Depois da emissão, o documento sai desta lista.</p>
      <h3>Boletins</h3>{bulletins.length ? <ul className="basic-drafts">{bulletins.map(b => <li key={b.id}><span><strong><FileText size={16} aria-hidden="true"/> {b.occurrence_type || 'Tipo não informado'}</strong><small>Etapa {(b.draft_step || 0)+1} de 8 · Atualizado: {when(b.updated_at)}</small></span><button className="secondary" onClick={() => onContinueBulletin(b.id)}>Continuar rascunho</button></li>)}</ul> : <p className="muted">Nenhum rascunho de boletim.</p>}
      <h3>Relatórios Analíticos</h3>{reports.length ? <ul className="basic-drafts">{reports.map(r => <li key={r.id}><span><strong><FileSpreadsheet size={16} aria-hidden="true"/> {r.occurrence_type || 'Tipo não informado'}</strong><small>Atualizado: {when(r.updated_at)}</small></span><button className="secondary" onClick={() => onContinueReport(r.id)}>Continuar rascunho</button></li>)}</ul> : <p className="muted">Nenhum rascunho de relatório.</p>}
    </section>
    <div className="privacy-note"><Shield size={16} /> As informações deste sistema são de acesso restrito. Utilize apenas para atividades de serviço.</div>
  </>;
}
