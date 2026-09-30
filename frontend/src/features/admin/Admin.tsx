'use client';
import { useEffect, useState } from 'react';
import { Modal } from '@/components/Modal';
import { api } from '@/services/api';
import type { User } from '@/types/api';

type Event = { id: string; action: string; user_id: string; user_name: string | null; username: string | null; bulletin_id: string | null; result: string; created_at: string };
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
    event.preventDefault(); const form = event.currentTarget; const data = Object.fromEntries(new FormData(form)); setBusy(true); setError('');
    try { await api('/api/admin/users', token, { method: 'POST', body: JSON.stringify(data) }); form.reset(); setSuccess('Usuário criado. Ele já pode entrar com o login e a senha informados.'); setPage(1); setReload(v => v+1); }
    catch(e) { setError(e instanceof Error ? e.message : 'Erro'); } finally { setBusy(false); }
  }
  async function edit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editing) return;
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true); setError('');
    try {
      await api(`/api/admin/users/${editing.id}`, token, {method: 'PATCH', body: JSON.stringify({...data, active: data.active === 'true'})});
      setEditing(null); setReload(v => v+1); setSuccess('Cadastro atualizado.');
    } catch(e) { setError(e instanceof Error ? e.message : 'Erro ao atualizar'); }
    finally { setBusy(false); }
  }
  async function toggle(user: User) {
    try { await api(`/api/admin/users/${user.id}`, token, { method: 'PATCH', body: JSON.stringify({ active: !user.active }) }); setReload(v => v+1); }
    catch(e) { setError(e instanceof Error ? e.message : 'Erro'); }
  }
  return <><div className="page-heading"><div><small className="eyebrow">ADMINISTRAÇÃO</small><h1>{audit ? 'Auditoria' : 'Usuários'}</h1><p>{audit ? 'Histórico de ações e resultados, sem conteúdo dos boletins.' : 'Gerencie quem pode acessar o sistema.'}</p></div></div>{error && <div className="error-box" role="alert">{error}</div>}
    {success && <p role="status" className="notice">{success}</p>}
    {editing && <Modal title="Editar usuário" onClose={() => setEditing(null)}><form onSubmit={edit}>{error && <p role="alert">{error}</p>}<label className="field">Nome completo<input name="name" defaultValue={editing.name} required maxLength={150}/></label><label className="field">Nome de usuário (login)<input name="username" defaultValue={editing.username || ''} required minLength={3} maxLength={64}/></label><label className="field">Perfil<select name="role" defaultValue={editing.role}><option value="OPERADOR">Operador</option><option value="ADMIN">Administrador</option><option value="GERADOR">Usuário simples</option></select></label><label className="field">Acesso<select name="active" defaultValue={String(editing.active)}><option value="true">Ativo</option><option value="false">Inativo</option></select></label><label className="field">Nova senha (opcional, mínimo 12 caracteres)<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128}/></label><p>Deixe a senha vazia para manter a atual.</p><button className="primary" disabled={busy}>Salvar alterações</button></form></Modal>}
    {!audit && <form className="card" onSubmit={create}><h2>Novo usuário</h2><div className="form-grid"><label className="field">Nome completo<input name="name" autoComplete="name" required maxLength={150} /></label><label className="field">Nome de usuário (login)<input name="username" autoComplete="off" required minLength={3} maxLength={64} pattern="[a-zA-Z0-9_.\-]+" title="Use letras, numeros, ponto, hifen ou sublinhado; sem espacos." /></label><label className="field">Senha inicial (mínimo 12 caracteres)<input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label><label className="field">Perfil<select name="role"><option value="OPERADOR">Operador</option><option value="ADMIN">Administrador</option><option value="GERADOR">Usuário simples</option></select></label></div><button className="primary" disabled={busy}>Criar usuário</button></form>}
    <div className="card table-card"><div className="table-scroll"><table><thead><tr>{(audit ? ['Data', 'Ação', 'Nome completo', 'Login', 'Resultado'] : ['Nome completo', 'Login', 'Perfil', 'Acesso']).map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{audit ? events.map(e => <tr key={e.id}><td>{new Date(e.created_at).toLocaleString('pt-BR')}</td><td>{e.action}</td><td>{e.user_name || 'Usuário indisponível'}</td><td>{e.username || '—'}</td><td>{e.result}</td></tr>) : users.map(u => <tr key={u.id}><td>{u.name}</td><td>{u.username || u.email}</td><td>{({ADMIN:'Administrador',OPERADOR:'Operador',GERADOR:'Usuário simples'})[u.role]}</td><td><button className="secondary" onClick={() => {setError(''); setEditing(u);}}>Editar</button><button className="text-button" onClick={() => toggle(u)}>{u.active ? 'Desativar' : 'Ativar'}</button></td></tr>)}</tbody></table></div><div className="pagination"><button className="secondary" disabled={page === 1} onClick={() => setPage(p => p-1)}>Anterior</button><span>Página {page}</span><button className="secondary" disabled={(audit ? events : users).length < 50} onClick={() => setPage(p => p+1)}>Próxima</button></div></div></>;
}
