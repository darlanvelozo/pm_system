'use client';
import { useEffect, useState } from 'react';
import { api } from '@/services/api';
import type { User } from '@/types/api';

type Event = { id: string; action: string; user_id: string; bulletin_id: string | null; result: string; created_at: string };
export function Admin({ token, audit = false }: { token: string; audit?: boolean }) {
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
    try { await api('/api/admin/users', token, { method: 'POST', body: JSON.stringify(data) }); form.reset(); setReload(v => v+1); }
    catch(e) { setError(e instanceof Error ? e.message : 'Erro'); } finally { setBusy(false); }
  }
  async function toggle(user: User) {
    try { await api(`/api/admin/users/${user.id}`, token, { method: 'PATCH', body: JSON.stringify({ active: !user.active }) }); setReload(v => v+1); }
    catch(e) { setError(e instanceof Error ? e.message : 'Erro'); }
  }
  return <><div className="page-heading"><div><small className="eyebrow">ADMINISTRAÇÃO</small><h1>{audit ? 'Auditoria' : 'Usuários'}</h1><p>{audit ? 'Histórico de ações e resultados, sem conteúdo dos boletins.' : 'Gerencie quem pode acessar o sistema.'}</p></div></div>{error && <div className="error-box" role="alert">{error}</div>}
    {!audit && <form className="card" onSubmit={create}><h2>Novo usuário</h2><div className="form-grid"><label className="field">Nome<input name="name" required maxLength={150} /></label><label className="field">E-mail<input name="email" type="email" required /></label><label className="field">Senha inicial<input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label><label className="field">Perfil<select name="role"><option value="OPERADOR">Operador</option><option value="ADMIN">Administrador</option></select></label></div><button className="primary" disabled={busy}>Criar usuário</button></form>}
    <div className="card table-card"><div className="table-scroll"><table><thead><tr>{(audit ? ['Data', 'Ação', 'Usuário', 'Resultado'] : ['Nome', 'E-mail', 'Perfil', 'Acesso']).map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{audit ? events.map(e => <tr key={e.id}><td>{new Date(e.created_at).toLocaleString('pt-BR')}</td><td>{e.action}</td><td>{e.user_id}</td><td>{e.result}</td></tr>) : users.map(u => <tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td>{u.role}</td><td><button className="text-button" onClick={() => toggle(u)}>{u.active ? 'Desativar' : 'Ativar'}</button></td></tr>)}</tbody></table></div><div className="pagination"><button className="secondary" disabled={page === 1} onClick={() => setPage(p => p-1)}>Anterior</button><span>Página {page}</span><button className="secondary" disabled={(audit ? events : users).length < 50} onClick={() => setPage(p => p+1)}>Próxima</button></div></div></>;
}
