'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {ReportsWorkspace} from '@/features/analytical-reports/Workspace';
import {ReportForm} from '@/features/analytical-reports/Form';
import type {Report} from '@/features/analytical-reports/types';
import {Generator, type Receipt} from '@/features/bulletins/Generator';
import { ArrowRight, BarChart3, ClipboardList, FilePlus2, FileText, FileSpreadsheet, LayoutDashboard, LogOut, Shield, Search, Download, CircleHelp, Users, Settings as SettingsIcon } from 'lucide-react';
import { api, downloadPdf } from '@/services/api';
import { roleLabel, type Bulletin, type BulletinList, type User } from '@/types/api';
import { Wizard } from '@/features/bulletins/Wizard';
import { Detail, Status } from '@/features/bulletins/Detail';
import {Verification} from '@/features/bulletins/Verification';
import {Stats} from '@/features/admin/Stats';
import { Admin } from '@/features/admin/Admin';
import { Settings } from '@/features/admin/Settings';
import { Guide } from '@/features/guide/Guide';
import { bulletinProfiles } from '@/schemas/bulletin';
import { clearUserDrafts } from '@/hooks/useDraft';

type Session = { access_token: string; user: User };
type View = 'dashboard' | 'new' | 'detail' | 'users' | 'audit' | 'stats' | 'reports' | 'report-new' | 'settings' | 'guide';
export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [view, setView] = useState<View>('dashboard');
  const [settingsDirty, setSettingsDirty] = useState(false);
  // Leaving Configurações with unsaved edits asks for confirmation.
  const leave = () => !settingsDirty || window.confirm('Há alterações não salvas em Configurações. Descartar e sair?');
  const [record, setRecord] = useState<Bulletin>();
  // Usuário básico: report draft being continued and the last emission receipt.
  const [report, setReport] = useState<Report>();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [list, setList] = useState<BulletinList>({ items: [], total: 0, page: 1, size: 20 });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [filters,setFilters] = useState({date_from:'',date_to:'',occurrence_type:'',city:'',created_by:'',revision:''});
  useEffect(() => { window.scrollTo({ top: 0 }); }, [view]);
  useEffect(() => {
    // Mobile drawer: focus stays inside the menu until Escape, backdrop or navigation closes it.
    if (!menuOpen || !matchMedia('(max-width: 768px)').matches) return;
    const items = () => [menuButton.current, ...(sidebar.current?.querySelectorAll<HTMLElement>('button, a[href]') || [])].filter((e): e is HTMLElement => !!e);
    sidebar.current?.querySelector<HTMLElement>('nav button')?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMenuOpen(false); menuButton.current?.focus(); return; }
      if (event.key !== 'Tab') return;
      // Focus moves manually: Safari skips buttons in the default tab order.
      event.preventDefault();
      const list = items(); const index = list.indexOf(document.activeElement as HTMLElement);
      list[(index + (event.shiftKey ? -1 : 1) + list.length) % list.length]?.focus();
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [menuOpen]);
  useEffect(() => {
    const expire = () => { setSession(null); setView('dashboard'); setRecord(undefined); setError('Sessão expirada. Entre novamente; o rascunho deste dispositivo foi preservado.'); };
    window.addEventListener('bo24:session-expired', expire);
    return () => window.removeEventListener('bo24:session-expired', expire);
  }, []);
  useEffect(() => {
    if (!session || view !== 'dashboard' || session.user.role === 'BASICO') return;
    let active = true;
    api<BulletinList>(`/api/bo?page=${page}&search=${encodeURIComponent(query)}${status ? `&status=${status}` : ''}&${new URLSearchParams(Object.entries(filters).filter(([,value])=>value))}`, session.access_token).then(data => { if(active) setList(data); }).catch(e => { if(active) setError(e.message); });
    return () => { active = false; };
  }, [session, view, page, query, status, filters]);
  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    try { setSession(await api<Session>('/api/auth/login', undefined, { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) })); }
    catch(e) { setError(e instanceof Error ? e.message : 'Erro ao entrar'); } finally { setBusy(false); }
  }
  function go(next: View) { if (!leave()) return; setError(''); setMenuOpen(false); setAccountOpen(false); setView(next); }
  function newReport() { setReport(undefined); go('report-new'); }
  async function continueDraft(kind: 'bo' | 'report', id: string) {
    if (!session) return;
    try {
      if (kind === 'bo') { setRecord(await api<Bulletin>(`/api/bo/${id}`, session.access_token)); setView('new'); }
      else { setReport(await api<Report>(`/api/analytical-reports/${id}`, session.access_token)); setView('report-new'); }
      setReceipt(null); setError('');
    } catch(e) { setError(e instanceof Error ? e.message : 'Erro ao abrir rascunho'); }
  }
  function issued(kind: Receipt['kind'], number: string | null, status: string, date?: string | null) { setReceipt({kind, number, status, date: date || null}); setRecord(undefined); setReport(undefined); setView('dashboard'); }
  function newBulletin() { if (!leave()) return; setRecord(undefined); setError(''); setMenuOpen(false); setAccountOpen(false); setView('new'); }
  async function open(id: string) {
    if (!session) return;
    try { setRecord(await api<Bulletin>(`/api/bo/${id}`, session.access_token)); setView('detail'); }
    catch(e) { setError(e instanceof Error ? e.message : 'Erro ao consultar'); }
  }
  function logout() {
    if (!leave()) return;
    if (session) clearUserDrafts(session.user.id);
    setSession(null); setView('dashboard'); setRecord(undefined); setReport(undefined); setReceipt(null); setError('');
  }
  if (!session) return <main className="login-page"><section className="login-brand"><div className="brand"><Image src="/24bpm-official.png" width={64} height={64} alt="Brasão oficial do 24º BPM"/><div>BO Online<strong>24º BPM · PMMA</strong></div></div><div className="login-intro"><small>SISTEMA DE REGISTRO DE OCORRÊNCIAS</small><h1>Mais organização.<br />Mais tempo para<br /><em>servir e proteger.</em></h1><p>Registro, emissão e envio de boletins de ocorrência em um só lugar.</p><div className="login-rule" /></div><span>POLÍCIA MILITAR DO MARANHÃO</span></section><section className="login-panel"><form onSubmit={login}><span className="eyebrow">ACESSO INSTITUCIONAL</span><h2>Bem-vindo ao BO Online</h2><p>Entre com suas credenciais para continuar.</p>{error && <div className="error-box" role="alert">{error}</div>}<label className="field">Usuário<input name="username" type="text" autoComplete="username" placeholder="Seu usuário" required /></label><label className="field">Senha<input name="password" type="password" autoComplete="current-password" placeholder="Digite sua senha" required /></label><button className="primary" disabled={busy}>{busy ? 'Entrando…' : 'Acessar sistema'}<ArrowRight size={17} /></button><p className="login-help"><Shield size={16} /> Acesso restrito a usuários autorizados.<br />Use as credenciais fornecidas pelo administrador.</p></form><footer>24º Batalhão de Polícia Militar <nav aria-label="Links institucionais"><Link href="/sobre">BoletimON</Link> | <Link href="/privacidade">Privacidade</Link> | <Link href="/termos">Termos de uso</Link> | <Link href="/guia">Guia de uso</Link></nav></footer></section></main>;
  const verification = window.location.pathname.match(/^\/verificar\/([a-f0-9-]+)$/i);
  if(verification) return <Verification id={verification[1]} revision={new URLSearchParams(window.location.search).get('revision') || '1'} token={session.access_token}/>;
  const filtered = list.items;
  const filtering = !!(query || status || Object.values(filters).some(Boolean));
  const basic = session.user.role === 'BASICO';
  return <div className="app-shell"><button ref={menuButton} className="mobile-menu secondary" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-controls="app-menu">Menu</button>{menuOpen && <div className="mobile-backdrop" aria-hidden="true" onClick={() => setMenuOpen(false)}/>}<aside id="app-menu" ref={sidebar} className={`sidebar ${menuOpen ? 'mobile-open' : ''}`} onClick={() => setMenuOpen(false)}><div className="brand"><Image src="/24bpm-official.png" width={44} height={44} alt="Brasão oficial do 24º BPM"/><div>BO Online<strong>24º BPM · PMMA</strong></div></div><small className="nav-label">ÁREA DE TRABALHO</small><nav>{basic ? <><button className={view === 'dashboard' ? 'active' : ''} onClick={() => go('dashboard')}><LayoutDashboard size={18} /> Início</button><button className={view === 'new' ? 'active' : ''} onClick={newBulletin}><FilePlus2 size={18} /> Novo boletim</button><button className={view === 'report-new' ? 'active' : ''} onClick={newReport}><FileSpreadsheet size={18} /> Novo Relatório Analítico</button></> : <><button className={view === 'dashboard' ? 'active' : ''} onClick={() => go('dashboard')}><LayoutDashboard size={18} /> Painel de boletins</button><button className={view === 'new' ? 'active' : ''} onClick={newBulletin}><FilePlus2 size={18} /> Novo boletim</button><small className="nav-label">RELATÓRIOS ANALÍTICOS</small><button className={view === 'reports' ? 'active' : ''} onClick={() => go('reports')}><FileSpreadsheet size={18} /> Relatórios Analíticos</button><button className={view === 'report-new' ? 'active' : ''} onClick={() => go('report-new')}><FilePlus2 size={18} /> Novo Relatório Analítico</button></>}<small className="nav-label">AJUDA</small><button className={view === 'guide' ? 'active' : ''} onClick={() => go('guide')}><CircleHelp size={18} /> Ajuda / Guia de uso</button>{session.user.role === 'ADMIN' && <><small className="nav-label">ADMINISTRAÇÃO</small><button className={view === 'stats' ? 'active' : ''} onClick={() => go('stats')}><BarChart3 size={18} /> Estatísticas</button><button className={view === 'users' ? 'active' : ''} onClick={() => go('users')}><Users size={18} /> Usuários</button><button className={view === 'audit' ? 'active' : ''} onClick={() => go('audit')}><ClipboardList size={18} /> Auditoria</button><button className={view === 'settings' ? 'active' : ''} onClick={() => go('settings')}><SettingsIcon size={18} /> Configurações</button></>}</nav><div className="sidebar-bottom"><div className="help-box"><CircleHelp size={20} /><strong>Precisa de orientação?</strong><p>Consulte o <button type="button" className="help-link" onClick={() => go('guide')}>guia de uso</button> ou procure o administrador do sistema na sua unidade.</p></div><span className="sidebar-seal"><Shield size={15} /> Polícia Militar do Maranhão</span></div></aside>
    <div className="workspace"><header className="topbar"><span>24º Batalhão de Polícia Militar <span className="topbar-divider">/</span> <strong>Boletins de ocorrência</strong></span><div className="user-menu"><div className="avatar">{session.user.name.slice(0,2).toUpperCase()}</div><div><strong>{session.user.name}</strong><small>{roleLabel(session.user.role)}</small></div><button title="Sair e limpar rascunho local" aria-label="Sair" onClick={logout}><LogOut size={18} /></button></div></header>
    <main className="content">{error && <div className="error-box" role="alert">{error}</div>}{view === 'dashboard' && basic && <Generator token={session.access_token} receipt={receipt} onDismiss={() => setReceipt(null)} onNewBulletin={newBulletin} onNewReport={newReport} onContinueBulletin={id => continueDraft('bo', id)} onContinueReport={id => continueDraft('report', id)}/>}{view === 'dashboard' && !basic && <><div className="page-heading"><div><small className="eyebrow">VISÃO GERAL</small><h1>Painel de boletins</h1><p>Registre ocorrências e acompanhe a emissão dos documentos.</p></div><button className="primary" onClick={newBulletin}><FilePlus2 size={18} /> Novo boletim</button></div><div className="stats"><div className="stat-card"><span className="stat-icon blue"><FileText /></span><div><span>Boletins acessíveis</span><strong>{list.total}</strong><small>Total de registros</small></div></div><div className="stat-card"><span className="stat-icon green"><Shield /></span><div><span>Emitidos nesta página</span><strong>{list.items.filter(b => b.status === 'ISSUED').length}</strong><small>Documentos disponíveis</small></div></div><div className="stat-card"><span className="stat-icon amber"><ClipboardList /></span><div><span>Envios com falha nesta página</span><strong>{list.items.filter(b => b.battalion_email_status === 'FAILED' || b.recipient_email_status === 'FAILED').length}</strong><small>Solicite reenvio ao administrador</small></div></div></div>
    <section className="card table-card"><div className="table-heading"><div><h2>Boletins de ocorrência</h2><p>Consulte seus registros e baixe os documentos.</p></div><label className="field">Status<select aria-label="Filtrar status" value={status} onChange={e => {setStatus(e.target.value); setPage(1);}}><option value="">Todos</option><option value="DRAFT">Rascunhos</option><option value="ISSUED">Emitidos</option><option value="CANCELLED">Cancelados</option>{session.user.role === 'ADMIN' && <option value="REMOVED">Removidos</option>}</select></label><label className="search"><Search size={17} /><input aria-label="Buscar por BO, ocorrência ou responsável" placeholder="Buscar por BO, ocorrência ou responsável…" value={query} onChange={e => {setQuery(e.target.value); setPage(1);}} /></label></div><div className="filter-bar"><button className="secondary" onClick={() => {setStatus('DRAFT');setFilters({...filters,created_by:session.user.id});setPage(1);}}>Meus rascunhos</button><button className="text-button" onClick={() => {setStatus('');setQuery('');setFilters({date_from:'',date_to:'',occurrence_type:'',city:'',created_by:'',revision:''});setPage(1);}}>Limpar filtros</button><details><summary>Mais filtros</summary><div className="form-grid">{(['date_from','date_to','occurrence_type','city','revision'] as const).map(key=><label className="field" key={key}>{({date_from:'Data inicial da ocorrência',date_to:'Data final da ocorrência',occurrence_type:'Tipo de ocorrência',city:'Município',revision:'Versão'})[key]}<input type={key.startsWith('date')?'date':key==='revision'?'number':'text'} min={key==='revision'?0:undefined} value={filters[key]} onChange={e=>{setFilters({...filters,[key]:e.target.value});setPage(1);}}/></label>)}</div><p>Para filtrar por responsável, informe nome ou login na busca.</p></details></div><div className="bulletin-cards">{filtered.map(b => <article className="card" key={b.id}><h3>{b.bo_number || 'Rascunho sem protocolo'}</h3><p>{b.occurrence_type} {b.occurrence_summary}</p><p>{b.involved_count} {b.involved_count === 1 ? 'envolvido' : 'envolvidos'} · Versão {b.current_revision || 0}</p>{b.status === 'DRAFT' && <p>{b.complete_count} completos · {b.pending_count} com pendência · Etapa {(b.draft_step || 0)+1} de 8 · Atualizado: {new Date(b.updated_at).toLocaleString('pt-BR')}</p>}<p>{b.occurrence_date?.split('-').reverse().join('/') || 'Data não informada'}</p><p>Registrado por: {b.created_by_name} ({b.created_by_username})</p><p>{({DRAFT:'Rascunho',ISSUED:'Emitido',CANCELLED:'Cancelado',REMOVED:'Removido'})[b.status]}</p>{b.status !== 'DRAFT' && <p>E-mail batalhão: <Status value={b.battalion_email_status} /> · E-mail informado: <Status value={b.recipient_email_status} /></p>}<button className="secondary" onClick={() => open(b.id)}>Abrir boletim {b.bo_number || 'Rascunho sem protocolo'}</button></article>)}</div><div className="table-scroll desktop-bulletins"><table><thead><tr><th>Nº BO / Ocorrência</th><th>Data / Modelo</th><th>Usuário</th><th>PDF</th><th>E-mail batalhão</th><th>E-mail informado</th><th>Ações</th></tr></thead><tbody>{filtered.map(b => <tr key={b.id}><td><button className="record-link" onClick={() => open(b.id)}>{b.bo_number || 'Rascunho sem protocolo'}</button><small>{b.occurrence_type} {b.occurrence_summary}</small><small>{b.involved_count} {b.involved_count === 1 ? 'envolvido' : 'envolvidos'} · Versão {b.current_revision || 0}</small>{b.status === 'DRAFT' && <small className="draft-progress">{b.complete_count} completos · {b.pending_count} com pendência · Etapa {(b.draft_step || 0)+1} de 8 · {new Date(b.updated_at).toLocaleString('pt-BR')}</small>}</td><td>{b.occurrence_date?.split('-').reverse().join('/') || 'Não informada'}<small>{bulletinProfiles[b.bulletin_type].title}</small></td><td><span title={b.created_by_username}>{b.created_by_name} ({b.created_by_username})</span></td><td><span className={`badge ${b.pdf_generated_at ? 'sent' : 'pending'}`}>{b.status === 'REMOVED' ? 'Removido' : b.status === 'CANCELLED' ? 'Cancelado' : b.pdf_generated_at ? 'Gerado' : 'Rascunho'}</span></td><td>{b.status === 'DRAFT' ? <span className="muted">—</span> : <Status value={b.battalion_email_status} />}</td><td>{b.status === 'DRAFT' ? <span className="muted">—</span> : <Status value={b.recipient_email_status} />}</td><td><div className="row-actions"><button aria-label={`Visualizar ${b.bo_number || 'Rascunho sem protocolo'}`} onClick={() => open(b.id)}><Search size={17} /></button>{b.pdf_generated_at && b.status === 'ISSUED' && <button aria-label={`Baixar ${b.bo_number || 'Rascunho sem protocolo'}`} onClick={() => downloadPdf(b.id, session.access_token).catch(e => setError(e.message))}><Download size={17} /></button>}</div></td></tr>)}</tbody></table></div>{!filtered.length && <div className="empty"><FileText size={36} /><h3>{filtering ? 'Nenhum boletim encontrado com estes filtros' : 'Nenhum boletim por aqui'}</h3><p>{filtering ? 'Altere ou limpe os filtros para ver outros registros.' : 'Os boletins registrados aparecerão nesta lista.'}</p>{!filtering && <button className="secondary" onClick={newBulletin}>Criar primeiro boletim</button>}</div>}<div className="pagination"><span>{list.total} {list.total === 1 ? 'registro' : 'registros'} · Página {page}</span><div><button className="secondary" disabled={page <= 1} onClick={() => setPage(p => p-1)}>Anterior</button><button className="secondary" disabled={page * list.size >= list.total} onClick={() => setPage(p => p+1)}>Próxima</button></div></div></section><div className="privacy-note"><Shield size={16} /> As informações deste sistema são de acesso restrito. Utilize apenas para atividades de serviço.</div></>}
    {basic && view === 'report-new' && <ReportForm key={report?.id || 'new'} token={session.access_token} userId={session.user.id} existing={report} backLabel="Início" onBack={() => go('dashboard')} onComplete={r => issued('report', r.report_number, r.status, r.pdf_generated_at)}/>}
    {!basic && (view === 'reports' || view === 'report-new') && <ReportsWorkspace key={view} token={session.access_token} user={session.user} startNew={view === 'report-new'}/>}
    {session.user.role === 'ADMIN' && view === 'stats' && <Stats token={session.access_token}/>}
    {view === 'new' && <Wizard key={record?.id || 'new'} existing={record} user={session.user} token={session.access_token} onBack={() => setView('dashboard')} onComplete={b => basic ? issued('bo', b.bo_number, b.status, b.pdf_generated_at) : (setRecord(b), setView('detail'))} />}
    {!basic && view === 'detail' && record && <Detail key={record.id} initial={record} user={session.user} token={session.access_token} onNew={newBulletin} onEdit={b => { setRecord(b); setView('new'); }} />}
    {session.user.role === 'ADMIN' && (view === 'users' || view === 'audit') && <Admin key={view} token={session.access_token} audit={view === 'audit'} />}
    {view === 'guide' && <Guide audience={session.user.role === 'ADMIN' ? 'admin' : basic ? 'basic' : 'common'} />}
    {view === 'settings' && session.user.role === 'ADMIN' && <Settings token={session.access_token} onDirtyChange={setSettingsDirty} />}
    </main><footer className="app-footer">BO Online · 24º BPM<span>Sistema de Emissão de Boletins de Ocorrência</span></footer><nav className="mobile-bottom" aria-label="Navegação rápida"><button onClick={() => go('dashboard')} aria-current={view === 'dashboard' ? 'page' : undefined}>Início</button><button onClick={newBulletin} aria-current={view === 'new' && !record ? 'page' : undefined}>Novo boletim</button>{basic ? <button onClick={newReport} aria-current={view === 'report-new' ? 'page' : undefined}>Novo relatório</button> : <button onClick={() => go('dashboard')}>Boletins</button>}<button onClick={() => setAccountOpen(!accountOpen)} aria-expanded={accountOpen}>Conta</button></nav>{accountOpen && <div className="mobile-account card"><p>{session.user.name} ({session.user.username})<br/><small>{roleLabel(session.user.role)}</small></p><button className="secondary" onClick={() => go('guide')}><CircleHelp size={16} /> Ajuda / Guia de uso</button><button className="secondary" onClick={() => {setAccountOpen(false); logout();}}>Sair</button><button className="text-button" onClick={() => setAccountOpen(false)}>Fechar</button></div>}</div></div>;
}
