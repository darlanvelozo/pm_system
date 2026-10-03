'use client';
import { useEffect, useState } from 'react';
import { Modal } from '@/components/Modal';
import { api } from '@/services/api';
import { roleLabel, type SettingField, type User } from '@/types/api';
import { settingLabels } from './Settings';

type Event = { id: string; action: string; user_id: string; user_name: string | null; username: string | null; bulletin_id: string | null; result: string; details?: {fields?: string[]} | null; created_at: string };
const actionLabels: Record<string, string> = {USER_LOGIN: 'Login', USER_CREATED: 'Usuário criado', USER_UPDATED: 'Usuário alterado', USER_ACTIVATED: 'Usuário ativado', USER_DEACTIVATED: 'Usuário desativado', USER_PASSWORD_RESET: 'Senha redefinida', BO_CREATED: 'BO criado', BO_UPDATED: 'Rascunho de BO alterado', BO_ADMIN_EDITED: 'BO corrigido (ADMIN)', BO_CANCELLED: 'BO cancelado', BO_REMOVED: 'BO removido', PDF_GENERATED: 'PDF do BO gerado', PDF_REGENERATED: 'PDF do BO regerado', PDF_DOWNLOADED: 'PDF do BO baixado', EMAIL_RESEND_REQUESTED: 'Reenvio de e-mail do BO solicitado', ANALYTICAL_REPORT_CREATED: 'Relatório criado', ANALYTICAL_REPORT_UPDATED: 'Rascunho de relatório alterado', ANALYTICAL_REPORT_PREVIEWED: 'Prévia de relatório', ANALYTICAL_REPORT_EMITTED: 'Relatório emitido', ANALYTICAL_REPORT_PDF_GENERATED: 'PDF do relatório gerado', ANALYTICAL_REPORT_PDF_DOWNLOADED: 'PDF do relatório baixado', ANALYTICAL_REPORT_REVISED: 'Relatório revisado', ANALYTICAL_REPORT_CANCELLED: 'Relatório cancelado', ANALYTICAL_REPORT_REMOVED: 'Relatório removido', ANALYTICAL_REPORT_EMAIL_RESEND_REQUESTED: 'Reenvio de e-mail do relatório solicitado', ANALYTICAL_REPORT_EMAIL_SENT: 'E-mail do relatório enviado', ANALYTICAL_REPORT_EMAIL_FAILED: 'Falha no e-mail do relatório', EMAIL_TO_RECIPIENT_SENT: 'E-mail do BO enviado ao destinatário', EMAIL_TO_RECIPIENT_FAILED: 'Falha no e-mail do BO ao destinatário', EMAIL_TO_BATTALION_SENT: 'E-mail do BO enviado ao batalhão', EMAIL_TO_BATTALION_FAILED: 'Falha no e-mail do BO ao batalhão', SETTINGS_UPDATED: 'Configurações alteradas', SETTINGS_TEST_EMAIL_SENT: 'E-mail de teste aceito pelo provedor', SETTINGS_TEST_EMAIL_FAILED: 'Falha no e-mail de teste'};
const resultLabels: Record<string, string> = {SUCCESS: 'Sucesso', SENT: 'Enviado', FAILED: 'Falha', FAILURE: 'Falha'};
export function Admin({ token, audit = false }: { token: string; audit?: boolean }) {
  const [editing, setEditing] = useState<User | null>(null);
  const [success, setSuccess] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    (audit ? api<Event[]>(`/api/admin/audit?page=${page}`, token).then(v => { if(active) setEvents(v); }) : api<User[]>(`/api/admin/users?page=${page}`, token).then(v => { if(active) setUsers(v); })).catch(e => { if(active) setError(e.message); });
    return () => { active = false; };
  }, [token, audit, page, reload]);
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = Object.fromEntries(new FormData(form)); setBusy(true); setError(''); setSuccess('');
    try { await api('/api/admin/users', token, { method: 'POST', body: JSON.stringify(data) }); form.reset(); setSuccess('Usuário criado. Ele já pode entrar com o login e a senha informados.'); setPage(1); setReload(v => v+1); }
    catch(e) { setError(e instanceof Error ? e.message : 'Erro'); } finally { setBusy(false); }
  }
  async function edit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editing) return;
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true); setError(''); setSuccess('');
    try {
      await api(`/api/admin/users/${editing.id}`, token, {method: 'PATCH', body: JSON.stringify({...data, active: data.active === 'true'})});
      setEditing(null); setReload(v => v+1); setSuccess('Cadastro atualizado.');
    } catch(e) { setError(e instanceof Error ? e.message : 'Erro ao atualizar'); }
    finally { setBusy(false); }
  }
  async function toggle(user: User) {
    setError(''); setSuccess('');
    try { await api(`/api/admin/users/${user.id}`, token, { method: 'PATCH', body: JSON.stringify({ active: !user.active }) }); setReload(v => v+1); setSuccess(user.active ? 'Acesso desativado.' : 'Acesso ativado.'); }
    catch(e) { setError(e instanceof Error ? e.message : 'Erro'); }
  }
  return <><div className="page-heading"><div><small className="eyebrow">ADMINISTRAÇÃO</small><h1>{audit ? 'Auditoria' : 'Usuários'}</h1><p>{audit ? 'Histórico de ações e resultados, sem conteúdo dos boletins.' : 'Gerencie quem pode acessar o sistema.'}</p></div></div>{error && <div className="error-box" role="alert">{error}</div>}
    {success && <p role="status" className="notice">{success}</p>}
    {editing && <Modal title="Editar usuário" onClose={() => setEditing(null)}><form onSubmit={edit}>{error && <p role="alert">{error}</p>}<label className="field">Nome completo<input name="name" defaultValue={editing.name} required maxLength={150}/></label><label className="field">Nome de usuário (login)<input name="username" defaultValue={editing.username || ''} required minLength={3} maxLength={64}/></label><label className="field">Perfil<select name="role" defaultValue={editing.role}><option value="OPERADOR">Usuário comum</option><option value="ADMIN">Administrador</option></select></label><label className="field">Acesso<select name="active" defaultValue={String(editing.active)}><option value="true">Ativo</option><option value="false">Inativo</option></select></label><label className="field">Nova senha (opcional, mínimo 12 caracteres)<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128}/></label><p>Deixe a senha vazia para manter a atual.</p><button className="primary" disabled={busy}>Salvar alterações</button></form></Modal>}
    {!audit && <form className="card" onSubmit={create}><h2>Novo usuário</h2><div className="form-grid"><label className="field">Nome completo<input name="name" autoComplete="name" required maxLength={150} /></label><label className="field">Nome de usuário (login)<input name="username" autoComplete="off" required minLength={3} maxLength={64} pattern="[a-zA-Z0-9_.\-]+" title="Use letras, números, ponto, hífen ou sublinhado; sem espaços." /></label><label className="field">Senha inicial (mínimo 12 caracteres)<input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label><label className="field">Perfil<select name="role"><option value="OPERADOR">Usuário comum</option><option value="ADMIN">Administrador</option></select></label></div><button className="primary" disabled={busy}>Criar usuário</button></form>}
    <div className="card table-card"><div className="table-scroll"><table className="stack-table"><thead><tr>{(audit ? ['Data', 'Ação', 'Nome completo', 'Login', 'Resultado'] : ['Nome completo', 'Login', 'Perfil', 'Acesso']).map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{audit ? events.map(e => <tr key={e.id}><td data-label="Data">{new Date(e.created_at).toLocaleString('pt-BR')}</td><td data-label="Ação" title={e.action}>{actionLabels[e.action] || e.action}{e.details?.fields?.length ? <small>{e.details.fields.map(f => settingLabels[f as SettingField] || f).join(', ')}</small> : null}</td><td data-label="Nome completo">{e.user_name || 'Usuário indisponível'}</td><td data-label="Login">{e.username || '—'}</td><td data-label="Resultado">{resultLabels[e.result] || e.result}</td></tr>) : users.map(u => <tr key={u.id}><td data-label="Nome completo">{u.name}</td><td data-label="Login">{u.username || u.email}</td><td data-label="Perfil">{roleLabel(u.role)}</td><td data-label="Acesso"><div className="action-row"><span className={`badge ${u.active ? 'sent' : 'failed'}`}>{u.active ? 'Ativo' : 'Inativo'}</span> <button className="secondary" onClick={() => {setError(''); setSuccess(''); setEditing(u);}}>Editar</button><button className="text-button" onClick={() => toggle(u)}>{u.active ? 'Desativar' : 'Ativar'}</button></div></td></tr>)}</tbody></table></div><div className="pagination"><button className="secondary" disabled={page === 1} onClick={() => setPage(p => p-1)}>Anterior</button><span>Página {page}</span><button className="secondary" disabled={(audit ? events : users).length < 50} onClick={() => setPage(p => p+1)}>Próxima</button></div></div></>;
}
