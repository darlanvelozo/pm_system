'use client';
import { useEffect, useState } from 'react';
import { Building2, Mail, PenLine, Activity, RotateCcw, Save, Send, Trash2, Upload } from 'lucide-react';
import { api, ApiError, pdfUrl } from '@/services/api';
import { settingFields, type Diagnostics, type SettingField, type SystemSettings } from '@/types/api';

type Values = Record<SettingField, string>;
const empty = Object.fromEntries(settingFields.map(f => [f, ''])) as Values;
export const settingLabels: Record<SettingField, string> = {unit_name: 'Nome da unidade', unit_short_name: 'Nome abreviado', unit_city: 'Município/UF', footer_address: 'Endereço do rodapé', footer_contact: 'Contato do rodapé', battalion_email: 'E-mail do batalhão', reply_to_email: 'E-mail para respostas (reply-to)', signatory_rank: 'Posto/graduação', signatory_name: 'Nome do signatário', signatory_title: 'Cargo/função'};
const help: Record<SettingField, string> = {
  unit_name: 'Por extenso. Aparece no rodapé do Relatório Analítico, junto do município.',
  unit_short_name: 'Usado no rodapé de cada página do BO (“… • Página N”), no autor dos PDFs e na assinatura dos e-mails.',
  unit_city: 'Ex.: Coroatá/MA. Completa o rodapé do Relatório Analítico.',
  footer_address: 'Primeira linha do rodapé do Relatório Analítico, abaixo do traço. Ex.: endereço, CEP e telefones.',
  footer_contact: 'Segunda linha do rodapé do Relatório Analítico. Ex.: e-mail da unidade. Com as duas vazias, o rodapé usa “unidade · município”.',
  battalion_email: 'Recebe uma cópia de todo BO e Relatório Analítico emitido. Vale para os próximos envios e reenvios.',
  reply_to_email: 'Endereço que recebe as respostas aos e-mails enviados. Quando vazio, só o Brevo usa o padrão do servidor.',
  signatory_rank: 'Ex.: TEN CEL PM. Fica antes do nome no bloco de assinatura do Relatório Analítico.',
  signatory_name: 'Autoridade que assina o Relatório Analítico. A assinatura digitalizada, se houver, fica acima do nome.',
  signatory_title: 'Ex.: Comandante do 24º BPM. Linha abaixo do nome.',
};
const groups: {title: string; icon: React.ReactNode; description: string; fields: SettingField[]}[] = [
  {title: 'Unidade', icon: <Building2 size={20}/>, description: 'Identificação usada em rodapés de PDF e e-mails. O cabeçalho oficial (Estado, PMMA, brasões) não muda.', fields: ['unit_name', 'unit_short_name', 'unit_city', 'footer_address', 'footer_contact']},
  {title: 'E-mail institucional', icon: <Mail size={20}/>, description: 'Destino da cópia institucional e endereço de respostas.', fields: ['battalion_email', 'reply_to_email']},
  {title: 'Signatário do relatório analítico', icon: <PenLine size={20}/>, description: 'Bloco de assinatura impresso no final do Relatório Analítico.', fields: ['signatory_rank', 'signatory_name', 'signatory_title']},
];
const valuesOf = (s: SystemSettings) => Object.fromEntries(settingFields.map(f => [f, s.values[f] || ''])) as Values;

export function Settings({ token, onDirtyChange }: { token: string; onDirtyChange?: (dirty: boolean) => void }) {
  const [data, setData] = useState<SystemSettings>();
  const [form, setForm] = useState<Values>(empty);
  const [diag, setDiag] = useState<Diagnostics>();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [test, setTest] = useState<{sent: boolean; message: string}>();
  const [signature, setSignature] = useState<string>();
  const [signatureMessage, setSignatureMessage] = useState<{ok: boolean; text: string}>();
  const saved = data ? valuesOf(data) : empty;
  const dirty = !!data && settingFields.some(f => form[f].trim() !== saved[f]);
  useEffect(() => {
    let active = true;
    api<SystemSettings>('/api/admin/settings', token).then(v => { if(active) { setData(v); setForm(valuesOf(v)); } }).catch(e => { if(active) setError(e.message); });
    return () => { active = false; };
  }, [token]);
  useEffect(() => {
    let active = true;
    api<Diagnostics>('/api/admin/diagnostics', token).then(v => { if(active) setDiag(v); }).catch(e => { if(active) setError(e.message); });
    return () => { active = false; };
  }, [token]);
  useEffect(() => {
    onDirtyChange?.(dirty);
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  useEffect(() => {
    if (!data?.has_signature) return;
    let active = true, url = '';
    pdfUrl('/api/admin/settings/signature', token).then(u => { url = u; if (active) setSignature(u); else URL.revokeObjectURL(u); }).catch(() => undefined);
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [data?.has_signature, data?.updated_at, token]);
  async function signatureRequest(init: RequestInit, done: string) {
    setBusy(true); setSignatureMessage(undefined);
    try { const result = await api<SystemSettings>('/api/admin/settings/signature', token, init); setData(result); setSignatureMessage({ok: true, text: done}); }
    catch(e) { setSignatureMessage({ok: false, text: e instanceof ApiError && e.status === 422 ? 'Arquivo inválido: envie uma imagem PNG ou JPG.' : e instanceof Error ? e.message : 'Erro ao salvar a assinatura.'}); }
    finally { setBusy(false); }
  }
  async function uploadSignature(file?: File) {
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) return setSignatureMessage({ok: false, text: 'Envie uma imagem PNG ou JPG.'});
    if (file.size > 500 * 1024) return setSignatureMessage({ok: false, text: 'A assinatura deve ter no máximo 500 KB.'});
    const content = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
    await signatureRequest({method: 'PUT', body: JSON.stringify({data_base64: content.split(',')[1] || ''})}, 'Assinatura salva. Vale para as próximas prévias, emissões e correções.');
  }
  function removeSignature() { return signatureRequest({method: 'DELETE'}, 'Assinatura removida. O bloco sai só com posto, nome e cargo.'); }
  function loadDiagnostics() { api<Diagnostics>('/api/admin/diagnostics', token).then(setDiag).catch(e => setError(e.message)); }
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setSuccess('');
    try {
      const result = await api<SystemSettings>('/api/admin/settings', token, {method: 'PUT', body: JSON.stringify(form)});
      setData(result); setForm(valuesOf(result));
      setSuccess(result.changed?.length ? `Configurações salvas (${result.changed.map(f => settingLabels[f]).join(', ')}). Valem para as próximas emissões, revisões e envios.` : 'Nenhuma alteração para salvar.');
      loadDiagnostics();
    } catch(e) { setError(e instanceof ApiError && e.status === 422 ? 'Confira os campos: use e-mails válidos, sem quebras de linha nem os caracteres < e >, e respeite o tamanho máximo.' : e instanceof Error ? e.message : 'Erro ao salvar.'); }
    finally { setBusy(false); }
  }
  async function sendTest(event: React.FormEvent) {
    event.preventDefault(); setTest(undefined); setBusy(true);
    try { setTest(await api<{sent: boolean; message: string}>('/api/admin/diagnostics/test-email', token, {method: 'POST', body: JSON.stringify({email: testTo})})); }
    catch(e) { setTest({sent: false, message: e instanceof ApiError && e.status === 422 ? 'Informe um e-mail válido.' : e instanceof Error ? e.message : 'Erro ao enviar.'}); }
    finally { setBusy(false); }
  }
  const effective = (f: SettingField) => form[f].trim() || data?.defaults[f] || '';
  const footer = [effective('footer_address'), effective('footer_contact')].filter(Boolean);
  const signer = [[effective('signatory_rank'), effective('signatory_name')].filter(Boolean).join(' '), effective('signatory_title')].filter(Boolean);
  return <div className="settings-page"><div className="page-heading"><div><small className="eyebrow">ADMINISTRAÇÃO</small><h1>Configurações</h1><p>Parâmetros de gestão usados nos PDFs e e-mails. Somente administradores acessam esta página.</p></div></div>
    <p className="notice">PDFs já emitidos não mudam: são arquivos guardados. As alterações valem para as <strong>próximas emissões, prévias, correções (nova versão) e envios</strong>. Campo vazio usa o valor padrão do servidor.</p>
    {error && <div className="error-box" role="alert">{error}</div>}
    {!data && !error && <p role="status">Carregando configurações…</p>}
    {data && <form onSubmit={save}>
      {groups.map(g => <section className="card settings-card" key={g.title} aria-labelledby={`settings-${g.fields[0]}`}><div className="settings-card-heading"><span className="stat-icon blue">{g.icon}</span><div><h2 id={`settings-${g.fields[0]}`}>{g.title}</h2><p>{g.description}</p></div></div>
        <div className="form-grid">{g.fields.map(f => <div className={`field ${['unit_name', 'signatory_name', 'footer_address', 'footer_contact'].includes(f) ? 'wide' : ''}`} key={f}><label htmlFor={`setting-${f}`}>{settingLabels[f]}</label><input id={`setting-${f}`} name={f} type={f.endsWith('email') ? 'email' : 'text'} value={form[f]} placeholder={data.defaults[f] || 'Sem valor padrão'} maxLength={{unit_name: 150, unit_short_name: 60, unit_city: 100, footer_address: 200, footer_contact: 200, battalion_email: 254, reply_to_email: 254, signatory_rank: 100, signatory_name: 150, signatory_title: 150}[f]} aria-describedby={`setting-${f}-help setting-${f}-source`} onChange={e => { setForm({...form, [f]: e.target.value}); setSuccess(''); }}/><small id={`setting-${f}-help`} className="hint settings-help">{help[f]}</small><small id={`setting-${f}-source`} className="settings-source">{form[f].trim() ? <span className="badge sent">Valor personalizado</span> : <span className="badge not_sent">Usando valor padrão do servidor{data.defaults[f] ? `: ${data.defaults[f]}` : ' (vazio)'}</span>}{form[f] && <button type="button" className="text-button" onClick={() => setForm({...form, [f]: ''})}><RotateCcw size={14}/> Usar padrão</button>}</small></div>)}</div>
        {g.title.startsWith('Signatário') && <div className="field wide"><label htmlFor="setting-signature">Assinatura digitalizada</label><input id="setting-signature" type="file" accept="image/png,image/jpeg" disabled={busy} aria-describedby="setting-signature-help" onChange={e => { void uploadSignature(e.target.files?.[0]); e.target.value = ''; }}/><small id="setting-signature-help" className="hint settings-help">PNG ou JPG de até 500 KB, de preferência com fundo branco ou transparente. Salva na hora, fica só no banco de dados e sai acima do nome no Relatório Analítico.</small><small className="settings-source">{data.has_signature ? <><span className="badge sent">Assinatura cadastrada</span><button type="button" className="text-button" disabled={busy} onClick={() => void removeSignature()}><Trash2 size={14}/> Remover assinatura</button></> : <span className="badge not_sent"><Upload size={12}/> Nenhuma assinatura: o bloco sai só com posto, nome e cargo</span>}</small>{signatureMessage && <p role="status" className={signatureMessage.ok ? 'notice' : 'error-box'}>{signatureMessage.text}</p>}</div>}
        <div className="settings-preview" aria-live="polite">{g.title === 'Unidade' && <><strong>Prévia</strong><span>Rodapé do BO: “{effective('unit_short_name')} • Página 1”</span>{footer.length ? <span>Rodapé do Relatório Analítico (abaixo do traço): {footer.map(l => `“${l}”`).join(' / ')}</span> : <span>Rodapé do Relatório Analítico: “{[effective('unit_name'), effective('unit_city')].filter(Boolean).join(' · ')}”</span>}<span>E-mails: “Mensagem gerada automaticamente pelo BO Online {effective('unit_short_name')}.”</span></>}{g.title === 'E-mail institucional' && <><strong>Prévia</strong><span>Cópia institucional para: {effective('battalion_email')}</span><span>Respostas para: {form.reply_to_email.trim() || (diag?.email.provider === 'brevo' ? `${data.defaults.reply_to_email} (padrão do Brevo)` : 'remetente do provedor (sem reply-to)')}</span></>}{g.title.startsWith('Signatário') && <><strong>Prévia do bloco de assinatura</strong>{data.has_signature && signature && <>
          {/* eslint-disable-next-line @next/next/no-img-element -- blob URL of the uploaded signature */}
          <img src={signature} alt="Assinatura digitalizada" style={{maxWidth: 150, maxHeight: 45, objectFit: 'contain'}}/></>}{signer.length ? signer.map(l => <span key={l}>{l}</span>) : <span>Sem signatário configurado — o bloco de assinatura sairá em branco.</span>}</>}</div>
      </section>)}
      <div className={`settings-savebar ${dirty ? 'dirty' : ''}`} role="region" aria-label="Salvar configurações"><span role="status">{dirty ? 'Há alterações não salvas.' : data.updated_at ? `Última alteração: ${new Date(data.updated_at).toLocaleString('pt-BR')}${data.updated_by_name ? ` por ${data.updated_by_name}` : ''}` : 'Usando somente os valores padrão do servidor.'}</span><div className="action-row">{dirty && <button type="button" className="secondary" disabled={busy} onClick={() => { setForm(saved); setError(''); }}>Descartar alterações</button>}<button className="primary" disabled={busy || !dirty}><Save size={16}/>{busy ? 'Salvando…' : 'Salvar configurações'}</button></div></div>
      {success && <p role="status" className="notice">{success}</p>}
    </form>}
    <section className="card settings-card" aria-labelledby="settings-diagnostics"><div className="settings-card-heading"><span className="stat-icon green"><Activity size={20}/></span><div><h2 id="settings-diagnostics">Status e diagnóstico</h2><p>Somente leitura. Chaves, senhas e tokens nunca são exibidos.</p></div><button type="button" className="secondary" onClick={loadDiagnostics}>Atualizar</button></div>
      {!diag ? <p role="status">Carregando diagnóstico…</p> : <dl className="diagnostics">
        <div><dt>Provedor de e-mail</dt><dd>{diag.email.provider_label} <span className={`badge ${diag.email.configured ? 'sent' : 'failed'}`}>{diag.email.configured ? 'Configurado' : 'Não configurado'}</span></dd></div>
        <div><dt>Remetente / credenciais</dt><dd><span className={`badge ${diag.email.sender_configured ? 'sent' : 'failed'}`}>Remetente {diag.email.sender_configured ? 'definido' : 'ausente'}</span> <span className={`badge ${diag.email.credentials_configured ? 'sent' : 'failed'}`}>Credenciais {diag.email.credentials_configured ? 'definidas' : 'ausentes'}</span></dd></div>
        <div><dt>Cópia institucional</dt><dd>{diag.email.battalion_email}</dd></div>
        <div><dt>Respostas (reply-to)</dt><dd>{diag.email.reply_to || 'Não definido'}</dd></div>
        <div><dt>Banco de dados</dt><dd><span className={`badge ${diag.database.reachable ? 'sent' : 'failed'}`}>{diag.database.reachable ? 'Acessível' : 'Inacessível'}</span> {diag.database.dialect}</dd></div>
        <div><dt>Migração</dt><dd>{diag.database.revision || 'desconhecida'} {diag.database.up_to_date ? <span className="badge sent">Atualizada</span> : <span className="badge pending">Esperada: {diag.database.head || '—'}</span>}</dd></div>
        <div><dt>Versão</dt><dd>Aplicação {diag.app.version} · Layout BO {diag.app.bo_pdf_layout} · Layout relatório {diag.app.report_pdf_layout}</dd></div>
        <div><dt>Ambiente</dt><dd>{diag.environment}</dd></div>
        <div><dt>Endereço do QR de verificação</dt><dd>{diag.frontend_url}/verificar/…</dd></div>
      </dl>}
      <form className="test-email" onSubmit={sendTest}><h3>Enviar e-mail de teste</h3><p>Envia uma mensagem curta, sem dados de boletins, pelo provedor atual. Limite de 3 testes a cada 10 minutos. O envio fica registrado na auditoria.</p><div className="test-email-row"><label className="field">E-mail de destino do teste<input type="email" required maxLength={254} value={testTo} onChange={e => setTestTo(e.target.value)} placeholder="nome@example.com"/></label><button className="secondary" disabled={busy || !testTo}><Send size={16}/> Enviar e-mail de teste</button></div>{test && <p role="status" className={test.sent ? 'notice' : 'error-box'}>{test.sent ? 'Enviado ao provedor. ' : 'Falha no envio. '}{test.message}</p>}</form>
    </section>
  </div>;
}
