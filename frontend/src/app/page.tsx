'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ClipboardList, FilePlus2, FileText, LayoutDashboard, LogOut, Shield, Users, Search, Download, CircleHelp } from 'lucide-react';
import { api, downloadPdf } from '@/services/api';
import type { Bulletin, BulletinList, User } from '@/types/api';
import { Wizard } from '@/features/bulletins/Wizard';
import { Detail, Status } from '@/features/bulletins/Detail';
import { Admin } from '@/features/admin/Admin';
import { bulletinProfiles } from '@/schemas/bulletin';
import { draftKey } from '@/hooks/useDraft';

type Session = { access_token: string; user: User };
type View = 'dashboard' | 'new' | 'detail' | 'users' | 'audit';
export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [view, setView] = useState<View>('dashboard');
  const [record, setRecord] = useState<Bulletin>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [list, setList] = useState<BulletinList>({ items: [], total: 0, page: 1, size: 20 });
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  useEffect(() => { window.scrollTo({ top: 0 }); }, [view]);
  useEffect(() => {
    if (!session || view !== 'dashboard') return;
    let active = true;
    api<BulletinList>(`/api/bo?page=${page}`, session.access_token).then(data => { if(active) setList(data); }).catch(e => { if(active) setError(e.message); });
    return () => { active = false; };
  }, [session, view, page]);
  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    try { setSession(await api<Session>('/api/auth/login', undefined, { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) })); }
    catch(e) { setError(e instanceof Error ? e.message : 'Erro ao entrar'); } finally { setBusy(false); }
  }
  function newBulletin() { setRecord(undefined); setError(''); setView('new'); }
  async function open(id: string) {
    if (!session) return;
    try { setRecord(await api<Bulletin>(`/api/bo/${id}`, session.access_token)); setView('detail'); }
    catch(e) { setError(e instanceof Error ? e.message : 'Erro ao consultar'); }
  }
  function logout() {
    if (session) localStorage.removeItem(draftKey(session.user.id));
    setSession(null); setView('dashboard'); setRecord(undefined); setError('');
  }
  if (!session) return <main className="login-page"><section className="login-brand"><div className="brand"><div className="brand-icon"><Shield /></div><div>BO Online<strong>24º BPM · PMMA</strong></div></div><div className="login-intro"><small>SISTEMA DE REGISTRO DE OCORRÊNCIAS</small><h1>Mais organização.<br />Mais tempo para<br /><em>servir e proteger.</em></h1><p>Registro, emissão e envio de boletins de ocorrência em um só lugar.</p><div className="login-rule" /></div><span>POLÍCIA MILITAR DO MARANHÃO</span></section><section className="login-panel"><form onSubmit={login}><span className="eyebrow">ACESSO INSTITUCIONAL</span><h2>Bem-vindo ao BO Online</h2><p>Entre com suas credenciais para continuar.</p>{error && <div className="error-box" role="alert">{error}</div>}<label className="field">E-mail<input name="email" type="email" autoComplete="username" placeholder="seu.email@exemplo.com" required /></label><label className="field">Senha<input name="password" type="password" autoComplete="current-password" placeholder="Digite sua senha" required /></label><button className="primary" disabled={busy}>{busy ? 'Entrando…' : 'Acessar sistema'}<ArrowRight size={17} /></button><p className="login-help"><Shield size={16} /> Acesso restrito a usuários autorizados.<br />Para obter acesso, contate o administrador.</p></form><footer>24º Batalhão de Polícia Militar <nav aria-label="Links institucionais"><Link href="/sobre">BoletimON</Link> | <Link href="/privacidade">Privacidade</Link> | <Link href="/termos">Termos de uso</Link></nav></footer></section></main>;
  const filtered = list.items.filter(b => `${b.bo_number} ${b.occurrence_type}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-icon"><Shield size={25} /></div><div>BO Online<strong>24º BPM · PMMA</strong></div></div><small className="nav-label">ÁREA DE TRABALHO</small><nav><button className={view === 'dashboard' ? 'active' : ''} onClick={() => { setView('dashboard'); setError(''); }}><LayoutDashboard size={18} /> Painel de boletins</button><button className={view === 'new' ? 'active' : ''} onClick={newBulletin}><FilePlus2 size={18} /> Novo boletim</button>{session.user.role === 'ADMIN' && <><small className="nav-label">ADMINISTRAÇÃO</small><button className={view === 'users' ? 'active' : ''} onClick={() => setView('users')}><Users size={18} /> Usuários</button><button className={view === 'audit' ? 'active' : ''} onClick={() => setView('audit')}><ClipboardList size={18} /> Auditoria</button></>}</nav><div className="sidebar-bottom"><div className="help-box"><CircleHelp size={20} /><strong>Precisa de orientação?</strong><p>Procure o administrador do sistema na sua unidade.</p></div><span className="sidebar-seal"><Shield size={15} /> Polícia Militar do Maranhão</span></div></aside>
    <div className="workspace"><header className="topbar"><span>24º Batalhão de Polícia Militar <span className="topbar-divider">/</span> <strong>Boletins de ocorrência</strong></span><div className="user-menu"><div className="avatar">{session.user.name.slice(0,2).toUpperCase()}</div><div><strong>{session.user.name}</strong><small>{session.user.role === 'ADMIN' ? 'Administrador' : 'Operador'}</small></div><button title="Sair e limpar rascunho local" aria-label="Sair" onClick={logout}><LogOut size={18} /></button></div></header>
    <main className="content">{error && <div className="error-box" role="alert">{error}</div>}{view === 'dashboard' && <><div className="page-heading"><div><small className="eyebrow">VISÃO GERAL</small><h1>Painel de boletins</h1><p>Registre ocorrências e acompanhe a emissão dos documentos.</p></div><button className="primary" onClick={newBulletin}><FilePlus2 size={18} /> Novo boletim</button></div><div className="stats"><div className="stat-card"><span className="stat-icon blue"><FileText /></span><div><span>Boletins acessíveis</span><strong>{list.total}</strong><small>Total de registros</small></div></div><div className="stat-card"><span className="stat-icon green"><Shield /></span><div><span>Emitidos nesta página</span><strong>{list.items.filter(b => b.status === 'ISSUED').length}</strong><small>Documentos disponíveis</small></div></div><div className="stat-card"><span className="stat-icon amber"><ClipboardList /></span><div><span>Envios com falha nesta página</span><strong>{list.items.filter(b => b.battalion_email_status === 'FAILED' || b.recipient_email_status === 'FAILED').length}</strong><small>Solicite reenvio ao administrador</small></div></div></div>
    <section className="card table-card"><div className="table-heading"><div><h2>Boletins de ocorrência</h2><p>Consulte seus registros e baixe os documentos.</p></div><label className="search"><Search size={17} /><input aria-label="Buscar nesta página" placeholder="Buscar nesta página…" value={query} onChange={e => setQuery(e.target.value)} /></label></div><div className="table-scroll"><table><thead><tr><th>Nº BO / Ocorrência</th><th>Data / Modelo</th><th>Usuário</th><th>PDF</th><th>E-mail batalhão</th><th>E-mail informado</th><th>Ações</th></tr></thead><tbody>{filtered.map(b => <tr key={b.id}><td><button className="record-link" onClick={() => open(b.id)}>{b.bo_number}</button><small>{b.occurrence_type}</small></td><td>{b.occurrence_date.split('-').reverse().join('/')}<small>{bulletinProfiles[b.bulletin_type].title}</small></td><td><span title={b.created_by}>{b.created_by === session.user.id ? session.user.name : b.created_by.slice(0,8)}</span></td><td><span className={`badge ${b.pdf_generated_at ? 'sent' : 'pending'}`}>{b.pdf_generated_at ? 'Gerado' : 'Rascunho'}</span></td><td><Status value={b.battalion_email_status} /></td><td><Status value={b.recipient_email_status} /></td><td><div className="row-actions"><button aria-label={`Visualizar ${b.bo_number}`} onClick={() => open(b.id)}><Search size={17} /></button>{b.pdf_generated_at && <button aria-label={`Baixar ${b.bo_number}`} onClick={() => downloadPdf(b.id, session.access_token).catch(e => setError(e.message))}><Download size={17} /></button>}</div></td></tr>)}</tbody></table>{!filtered.length && <div className="empty"><FileText size={36} /><h3>{query ? 'Nenhum resultado nesta página' : 'Nenhum boletim por aqui'}</h3><p>Os boletins registrados aparecerão nesta lista.</p>{!query && <button className="secondary" onClick={newBulletin}>Criar primeiro boletim</button>}</div>}</div><div className="pagination"><span>{list.total} registros · Página {page}</span><div><button className="secondary" disabled={page <= 1} onClick={() => setPage(p => p-1)}>Anterior</button><button className="secondary" disabled={page * list.size >= list.total} onClick={() => setPage(p => p+1)}>Próxima</button></div></div></section><div className="privacy-note"><Shield size={16} /> As informações deste sistema são de acesso restrito. Utilize apenas para atividades de serviço.</div></>}
    {view === 'new' && <Wizard key={record?.id || 'new'} existing={record?.status === 'DRAFT' ? record : undefined} user={session.user} token={session.access_token} onBack={() => setView('dashboard')} onComplete={b => { setRecord(b); setView('detail'); }} />}
    {view === 'detail' && record && <Detail key={record.id} initial={record} user={session.user} token={session.access_token} onNew={newBulletin} onEdit={b => { setRecord(b); setView('new'); }} />}
    {(view === 'users' || view === 'audit') && <Admin key={view} token={session.access_token} audit={view === 'audit'} />}
    </main><footer className="app-footer">BO Online · 24º BPM<span>Sistema de Emissão de Boletins de Ocorrência</span></footer></div></div>;
}
