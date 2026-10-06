'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, BookOpen, Download, Info, Lightbulb, Printer, ShieldCheck, X } from 'lucide-react';
import shots from './screenshots.json';

type Shot = { src: string; width: number; height: number };
const manifest = shots as Record<string, Shot>;
type Zoom = { src: string; alt: string } | null;
export type Audience = 'common' | 'admin' | 'public' | 'basic';

function Lightbox({ zoom, onClose }: { zoom: NonNullable<Zoom>; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; d?.showModal(); return () => d?.close(); }, []);
  return <dialog ref={ref} className="lightbox" aria-label={zoom.alt} onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <button type="button" className="secondary" onClick={onClose}><X size={18} aria-hidden="true"/> Fechar imagem</button>
    {/* eslint-disable-next-line @next/next/no-img-element -- full-size static screenshot */}
    <img src={zoom.src} alt={zoom.alt}/></dialog>;
}
function Callout({ kind = 'tip', title, children }: { kind?: 'tip' | 'warn' | 'info'; title: string; children: React.ReactNode }) {
  const Icon = kind === 'warn' ? AlertTriangle : kind === 'info' ? Info : Lightbulb;
  return <aside className={`guide-callout ${kind}`} role="note"><Icon size={18} aria-hidden="true"/><div><strong>{title}</strong>{children}</div></aside>;
}
function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return <section id={id} className="guide-section" aria-labelledby={`${id}-title`}><h2 id={`${id}-title`}>{title}</h2>{children}<p className="guide-top no-print"><a href="#guia-indice">Voltar ao índice</a></p></section>;
}
function Figure({ name, alt, caption, onZoom, narrow }: { name: string; alt: string; caption: string; onZoom: (z: Zoom) => void; narrow?: boolean }) {
  const shot = manifest[name];
  if (!shot) return null;
  return <figure className={`guide-figure ${narrow ? 'narrow' : ''}`}><a href={shot.src} target="_blank" rel="noopener" onClick={e => { e.preventDefault(); onZoom({ src: shot.src, alt }); }} aria-label={`${alt} — ampliar imagem`}>
    {/* eslint-disable-next-line @next/next/no-img-element -- static screenshots served as-is, sizes from the capture manifest */}
    <img src={shot.src} width={shot.width} height={shot.height} alt={alt} loading="lazy" decoding="async"/></a><figcaption>{caption} <span className="no-print">(toque ou clique para ampliar)</span></figcaption></figure>;
}
function Toc({ items }: { items: [string, string][] }) {
  return <nav id="guia-indice" className="guide-toc" aria-label="Índice do guia"><h2>Índice</h2><ol>{items.map(([id, title]) => <li key={id}><a href={`#${id}`}>{title}</a></li>)}</ol></nav>;
}

const commonToc: [string, string][] = [
  ['guia-acesso', 'Primeiro acesso, login e sessão'], ['guia-painel', 'Painel de boletins e filtros'], ['guia-novo-bo', 'Criar um BO passo a passo'],
  ['guia-rascunho', 'Rascunhos: no aparelho e no servidor'], ['guia-previa', 'Prévia do PDF'], ['guia-emitir', 'Emitir e número do protocolo'],
  ['guia-email', 'Status de e-mail e falhas de envio'], ['guia-baixar', 'Baixar o PDF'], ['guia-verificar', 'Verificar autenticidade (QR)'],
  ['guia-relatorios', 'Relatórios Analíticos passo a passo'], ['guia-celular', 'Uso no celular e instalação como app'],
  ['guia-privacidade', 'Privacidade e boas práticas'], ['guia-faq', 'Perguntas frequentes e problemas'], ['guia-anexos', 'Anexos para download'],
  ['guia-basico', 'Perfil Usuário básico'],
];
const adminToc: [string, string][] = [
  ['admin-usuarios', 'Gerenciar usuários'], ['admin-corrigir', 'Corrigir BO emitido'], ['admin-cancelar', 'Cancelar e remover'],
  ['admin-reenviar', 'Reenviar e-mail'], ['admin-auditoria', 'Auditoria'], ['admin-estatisticas', 'Estatísticas'],
  ['admin-configuracoes', 'Configurações'], ['admin-rotina', 'Rotina operacional'], ['admin-faq', 'Perguntas frequentes do administrador'],
];

function CommonGuide({ zoom, publicView }: { zoom: (z: Zoom) => void; publicView: boolean }) {
  return <>
    <Toc items={commonToc}/>
    <Section id="guia-acesso" title="1. Primeiro acesso, login e sessão">
      <p>O acesso é individual. O administrador da unidade cria sua conta e informa o <strong>nome de usuário</strong> e a <strong>senha inicial</strong>. Não existe cadastro público nem recuperação de senha por e-mail.</p>
      <ol className="guide-steps"><li>Abra o endereço do BO Online no navegador.</li><li>Informe <strong>Usuário</strong> e <strong>Senha</strong>.</li><li>Toque em <strong>Acessar sistema</strong>. O painel de boletins aparece.</li></ol>
      <Figure name="login" alt="Tela de login do BO Online com campos Usuário e Senha" caption="Tela de acesso." onZoom={zoom}/>
      <Callout kind="warn" title="Sessão de 30 minutos"><p>Por segurança, a sessão expira em 30 minutos e <strong>recarregar a página encerra a sessão</strong> (a credencial fica só na memória). Entre novamente: o rascunho que estava sendo preenchido neste aparelho é recuperado.</p></Callout>
      <Callout title="Esqueceu a senha?"><p>Peça ao administrador para redefini-la em Administração → Usuários. Ao terminar o serviço, use <strong>Sair</strong>, principalmente em aparelhos compartilhados.</p></Callout>
    </Section>
    <Section id="guia-painel" title="2. Painel de boletins e filtros">
      <p>O painel lista os boletins que você pode ver: o <strong>Usuário comum</strong> vê os próprios registros; o Administrador vê todos. Cada linha mostra protocolo, tipo, data, responsável, situação do PDF e dos dois e-mails.</p>
      <Figure name="painel" alt="Painel de boletins com cartões de resumo e lista de boletins fictícios" caption="Painel de boletins com resumo e lista." onZoom={zoom}/>
      <ul><li><strong>Buscar</strong>: por número do BO, tipo, descrição breve ou responsável.</li><li><strong>Status</strong>: rascunhos, emitidos ou cancelados.</li><li><strong>Meus rascunhos</strong>: mostra só seus rascunhos, com a etapa em que pararam.</li><li><strong>Mais filtros</strong>: período da ocorrência, tipo, município e versão.</li><li><strong>Limpar filtros</strong> volta à lista completa.</li></ul>
      <Figure name="filtros" alt="Área Mais filtros aberta com datas, tipo, município e versão" caption="“Mais filtros” abre a busca detalhada." onZoom={zoom}/>
    </Section>
    <Section id="guia-novo-bo" title="3. Criar um BO passo a passo">
      <p>Toque em <strong>Novo boletim</strong>. O formulário tem 8 etapas; a barra no topo mostra “Etapa X de 8”. Campos com <span className="required">*</span> são obrigatórios. <strong>Continuar</strong> só avança quando a etapa está correta; <strong>Voltar e corrigir</strong> retorna sem perder nada.</p>
      <ol className="guide-steps detailed">
        <li><strong>Identificação</strong> — e-mail que receberá o PDF, descrição breve, tipo de ocorrência, data e hora. O número do BO <em>não</em> é digitado: ele é gerado na emissão.<Figure name="bo-etapa-1" alt="Etapa 1 Identificação com e-mail, descrição breve, tipo, data e hora" caption="Etapa 1 — Identificação." onZoom={zoom}/></li>
        <li><strong>Local</strong> — logradouro e município são obrigatórios; número, bairro, complemento, CEP, referência e tipo de local ajudam a localizar.<Figure name="bo-etapa-2" alt="Etapa 2 Local com logradouro, número, bairro e município" caption="Etapa 2 — Local." onZoom={zoom}/></li>
        <li><strong>Envolvidos</strong> — começa com o envolvido A. Use <strong>Adicionar envolvido</strong> para B, C, D… (não há limite). Para cada pessoa informe classificação (autor, vítima, testemunha…) e nome; os demais dados são opcionais. O <strong>CPF é opcional</strong>, mas, se informado, precisa ser válido. Use <strong>Editar envolvido</strong> para voltar a uma pessoa e remover com confirmação.<Figure name="bo-etapa-3" alt="Etapa 3 Envolvidos com o envolvido A preenchido e botão Adicionar envolvido" caption="Etapa 3 — Envolvidos dinâmicos." onZoom={zoom}/></li>
        <li><strong>Histórico</strong> — o relato da ocorrência. Textos longos continuam em páginas extras do PDF; nada é cortado.<Figure name="bo-etapa-4" alt="Etapa 4 Histórico com relato fictício" caption="Etapa 4 — Histórico." onZoom={zoom}/></li>
        <li><strong>Material</strong> — material apreendido, se houver. Pode ficar em branco.</li>
        <li><strong>Efetivo</strong> — viatura, comandante e patrulheiro de cada equipe. O botão “Reutilizar meu último efetivo” copia a equipe do seu último BO.<Figure name="bo-etapa-6" alt="Etapa 6 Efetivo com viatura e comandante" caption="Etapa 6 — Efetivo." onZoom={zoom}/></li>
        <li><strong>Entrega</strong> — unidade, data, hora e responsável pelo recebimento, quando houver.</li>
        <li><strong>Revisão</strong> — confira tudo. Se algo estiver pendente, a lista “Pendências” leva direto ao campo. Daqui você abre a prévia e emite.<Figure name="bo-etapa-8" alt="Etapa 8 Revisão com resumo dos dados e botão de prévia" caption="Etapa 8 — Revisão final." onZoom={zoom}/></li>
      </ol>
      <Callout kind="warn" title="Descrição breve sem dados pessoais"><p>Descrição breve e tipo de ocorrência aparecem no assunto e no corpo do e-mail. Não coloque nomes, CPF, telefone ou endereço nesses campos.</p></Callout>
    </Section>
    <Section id="guia-rascunho" title="4. Rascunhos: no aparelho e no servidor">
      <ul><li><strong>Rascunho automático local</strong>: enquanto você digita, o formulário é guardado <em>neste navegador</em>, separado por usuário, por até 7 dias. É apagado ao emitir ou ao usar Sair.</li><li><strong>Salvar no servidor</strong>: guarda o rascunho na sua conta, mesmo incompleto e sem número. Use para continuar em outro aparelho ou antes de uma pausa longa.</li></ul>
      <p>Para retomar, abra o rascunho no painel (botão <strong>Meus rascunhos</strong>) e toque em <strong>Continuar preenchimento</strong>.</p>
      <Callout kind="info" title="Alterado em outro aparelho?"><p>Se o mesmo rascunho foi salvo em outro dispositivo, aparece “Recarregar versão do servidor”. Nada é mesclado automaticamente: confira antes de recarregar.</p></Callout>
    </Section>
    <Section id="guia-previa" title="5. Prévia do PDF">
      <p>Na etapa Revisão, toque em <strong>Visualizar prévia do PDF</strong>. A prévia mostra “PRÉVIA — NÃO EMITIDO” e número “PENDENTE”: não gera protocolo, não fica registrada e não envia e-mail.</p>
      <Figure name="previa" alt="Janela de prévia do PDF do boletim no computador" caption="Prévia no computador: o PDF abre dentro da janela." onZoom={zoom}/>
      <p><strong>No celular</strong>, o navegador não mostra PDF dentro da página: use <strong>Abrir PDF</strong> (abre no visualizador do aparelho) ou <strong>Baixar PDF</strong>.</p>
      <Figure name="mobile-previa" alt="Prévia no celular com os botões Abrir PDF e Baixar PDF" caption="Prévia no celular." onZoom={zoom} narrow/>
    </Section>
    <Section id="guia-emitir" title="6. Emitir e número do protocolo">
      <ol className="guide-steps"><li>Na Revisão, toque em <strong>Confirmar e gerar boletim</strong> (um toque basta; toques repetidos não criam outro BO).</li><li>O sistema gera o PDF definitivo e o <strong>protocolo</strong> no formato <code>AAAAMMDD-NN</code> (data da emissão + sequência do dia, ex.: 20261002-03).</li><li>A tela “Boletim gerado com sucesso” mostra o protocolo, o botão <strong>Copiar protocolo</strong> e o andamento dos e-mails.</li></ol>
      <Figure name="emitido" alt="Tela Boletim gerado com sucesso com protocolo e status dos e-mails" caption="BO emitido, com protocolo e status de envio." onZoom={zoom}/>
      <Callout kind="warn" title="Emitido não se edita"><p>Depois de emitido, o BO não pode ser alterado pelo Usuário comum. Se houver erro, peça ao administrador uma correção: ela gera nova versão e preserva a anterior.</p></Callout>
    </Section>
    <Section id="guia-email" title="7. Status de e-mail e falhas de envio">
      <p>Cada BO emitido é enviado em duas mensagens independentes, com o mesmo PDF: para o <strong>e-mail institucional</strong> do batalhão e para o <strong>e-mail informado</strong> na etapa 1.</p>
      <table className="guide-table"><thead><tr><th>Status</th><th>Significado</th></tr></thead><tbody><tr><td><span className="badge pending">Pendente</span></td><td>Envio em andamento. A tela atualiza sozinha.</td></tr><tr><td><span className="badge sent">Enviado</span></td><td>O provedor aceitou a mensagem (não garante leitura).</td></tr><tr><td><span className="badge failed">Falhou</span></td><td>O envio não foi aceito. O BO e o PDF continuam válidos e disponíveis.</td></tr><tr><td><span className="badge not_sent">Não enviado</span></td><td>Versão corrigida ainda não reenviada.</td></tr></tbody></table>
      <Callout title="Quando aparece “Falhou”"><p>Baixe o PDF e entregue por outro meio se for urgente, e avise o administrador: ele confere a configuração e usa <strong>Reenviar e-mail</strong>. Não emita outro BO para a mesma ocorrência.</p></Callout>
    </Section>
    <Section id="guia-baixar" title="8. Baixar o PDF">
      <p>No painel, use o ícone de download da linha, ou abra o boletim e toque em <strong>Baixar PDF</strong> (ou <strong>Visualizar PDF</strong>). O arquivo recebe o nome <code>BO_protocolo.pdf</code>.</p>
      <Figure name="detalhe" alt="Detalhe do boletim emitido com botões Visualizar PDF, Baixar PDF e Verificar documento" caption="Ações do boletim emitido." onZoom={zoom}/>
    </Section>
    <Section id="guia-verificar" title="9. Verificar autenticidade (QR)">
      <p>Todo PDF definitivo traz no rodapé a versão e um <strong>QR code</strong>. Ao ler o QR (ou tocar em <strong>Verificar documento</strong>), abre-se a página de verificação — é preciso estar logado e ter acesso ao BO.</p>
      <Figure name="verificar" alt="Página Verificação documental com protocolo, versão, status e hash SHA-256" caption="Página de verificação." onZoom={zoom}/>
      <p>A página mostra protocolo, versão, situação (emitido, cancelado…) e o <strong>SHA-256</strong> do arquivo guardado. Para conferir uma cópia recebida, compare o SHA-256 dela com o exibido.</p>
      <Callout kind="info" title="Limites"><p>O QR não contém dados pessoais e não é assinatura digital ICP-Brasil. Ele confirma o registro no sistema; a integridade de uma cópia externa depende da comparação do hash.</p></Callout>
    </Section>
    <Section id="guia-relatorios" title="10. Relatórios Analíticos passo a passo">
      <p>O Relatório Analítico de Ocorrência é um documento separado do BO, com numeração própria por ano (ex.: <code>12/2026</code>).</p>
      <ol className="guide-steps"><li>No menu, toque em <strong>Novo Relatório Analítico</strong>.</li><li>Preencha as 8 etapas: Identificação, Dados da ocorrência, Pessoas, Materiais / Solução (EVADIU-SE, SAMU, ICRIM), Viaturas e guarnições, Relato, Providências (com município e data de emissão) e Revisão.</li><li>Na Revisão, use <strong>Visualizar prévia do relatório</strong>.</li><li>Toque em <strong>Emitir Relatório Analítico</strong>. O número é gerado e os dois e-mails são enviados, como no BO.</li><li>Em <strong>Relatórios Analíticos</strong> você filtra, abre e baixa os PDFs.</li></ol>
      <Figure name="relatorio-form" alt="Formulário de novo Relatório Analítico na etapa Identificação" caption="Novo Relatório Analítico." onZoom={zoom}/>
      <Figure name="relatorio-detalhe" alt="Relatório Analítico emitido com status e botões de PDF" caption="Relatório emitido." onZoom={zoom}/>
      <Callout kind="warn" title="Tipo de ocorrência identifica o e-mail"><p>Não inclua nomes, documentos ou endereço completo no tipo de ocorrência. Em “Local de emissão” informe apenas o município.</p></Callout>
    </Section>
    <Section id="guia-celular" title="11. Uso no celular e instalação como app">
      <p>No celular, use <strong>Menu</strong> (canto superior) para todas as áreas e a barra inferior para Início, Novo boletim, Boletins e Conta. O guia fica em Menu → <strong>Ajuda / Guia de uso</strong> e em <strong>Conta</strong>.</p>
      <div className="guide-pair"><Figure name="mobile-painel" alt="Painel no celular com boletins em cartões e barra inferior" caption="Painel no celular." onZoom={zoom} narrow/><Figure name="mobile-menu" alt="Menu lateral aberto no celular" caption="Menu no celular." onZoom={zoom} narrow/><Figure name="mobile-wizard" alt="Formulário do BO no celular com Etapa 1 de 8" caption="Formulário no celular." onZoom={zoom} narrow/></div>
      <ul><li><strong>Android (Chrome)</strong>: toque em “Instalar BO Online” quando o aviso aparecer, ou menu ⋮ → Instalar app.</li><li><strong>iPhone (Safari)</strong>: Compartilhar → <strong>Adicionar à Tela de Início</strong>.</li><li>Quando houver nova versão, aparece “Atualizar”. Salve o trabalho antes; depois da atualização é preciso entrar de novo.</li></ul>
      <Callout kind="info" title="Sem internet"><p>O app instalado não guarda boletins nem PDFs no aparelho. Sem conexão você continua digitando (rascunho local), mas emissão e consulta exigem internet.</p></Callout>
    </Section>
    <Section id="guia-privacidade" title="12. Privacidade e boas práticas">
      <ul><li>Registre somente dados necessários à ocorrência.</li><li><strong>Não coloque dados pessoais</strong> (nomes, CPF, telefone, endereço) na descrição breve nem no tipo de ocorrência — eles vão para o e-mail.</li><li>Confira o e-mail de recebimento antes de emitir.</li><li>Use <strong>Sair</strong> ao terminar; isso também apaga o rascunho local daquele usuário.</li><li>Não compartilhe sua senha. Cada ação fica registrada em auditoria com seu nome.</li></ul>
    </Section>
    <Section id="guia-faq" title="13. Perguntas frequentes e problemas">
      <div className="guide-faq">
        <details><summary>Recarreguei a página e voltei ao login. Perdi o BO?</summary><p>Não. Entre de novo com o mesmo usuário neste aparelho: o rascunho local é recuperado. Para garantir, use “Salvar no servidor” antes de pausas.</p></details>
        <details><summary>Apareceu “Sessão expirada”.</summary><p>A sessão dura 30 minutos. Entre novamente; o rascunho do aparelho foi preservado.</p></details>
        <details><summary>O botão Continuar não avança.</summary><p>Há campo obrigatório vazio ou inválido na etapa (veja a mensagem em vermelho). CPF informado precisa ser válido; deixe vazio se não souber.</p></details>
        <details><summary>O e-mail ficou “Falhou”.</summary><p>O BO está emitido e o PDF disponível. Baixe-o se precisar e avise o administrador para reenviar. Não emita de novo.</p></details>
        <details><summary>Digitei algo errado e já emiti.</summary><p>Peça ao administrador a correção. Ela gera nova versão do PDF, mantém o mesmo número e guarda a versão anterior.</p></details>
        <details><summary>A prévia não abre no celular.</summary><p>Use “Abrir PDF” ou “Baixar PDF” na janela da prévia. Se o aparelho bloquear, permita downloads para o site.</p></details>
        <details><summary>“Não foi possível conectar à API”.</summary><p>Verifique a internet. O rascunho foi preservado; tente novamente quando a conexão voltar (“Sincronizar rascunho”).</p></details>
        <details><summary>Não encontro um boletim no painel.</summary><p>Clique em “Limpar filtros”. Usuário comum vê apenas os próprios registros; boletins removidos ficam visíveis só para o administrador.</p></details>
      </div>
    </Section>
    <Section id="guia-anexos" title="14. Anexos para download">
      <p>Exemplos gerados pelo próprio sistema com <strong>dados inteiramente fictícios</strong> (prévias, sem protocolo real):</p>
      <ul className="guide-downloads">
        <li><a href="/guia/anexos/exemplo-boletim-de-ocorrencia.pdf" download><Download size={16} aria-hidden="true"/> Exemplo de Boletim de Ocorrência (PDF)</a></li>
        <li><a href="/guia/anexos/exemplo-relatorio-analitico.pdf" download><Download size={16} aria-hidden="true"/> Exemplo de Relatório Analítico (PDF)</a></li>
        <li><a href="/guia/anexos/guia-rapido.pdf" download><Download size={16} aria-hidden="true"/> Guia rápido de 1 página para imprimir (PDF)</a> {publicView ? <>· <Link href="/guia/rapido">ver online</Link></> : <>· <a href="/guia/rapido" target="_blank" rel="noopener">ver online</a></>}</li>
      </ul>
    </Section>
    <Section id="guia-basico" title="15. Perfil Usuário básico">
      <p>O <strong>Usuário básico</strong> registra documentos, mas não consulta os que já foram emitidos. A tela inicial mostra apenas <strong>Novo boletim</strong>, <strong>Novo Relatório Analítico</strong> e <strong>Meus rascunhos</strong>.</p>
      <ul><li>Pode preencher, salvar e continuar os <strong>próprios rascunhos</strong> de BO e de Relatório Analítico, ver a prévia do PDF e emitir.</li><li>Após emitir, aparece somente o <strong>comprovante</strong>: protocolo/número, situação e data. Os dados e o PDF seguem por e-mail para o batalhão e para o destinatário informado.</li><li>Não vê painel de boletins, lista de relatórios, documentos emitidos ou cancelados (nem os próprios), PDFs, versões, sugestões de registros anteriores, estatísticas ou Administração.</li></ul>
      <Callout kind="info" title="Precisa consultar um documento emitido?"><p>Anote o protocolo do comprovante e peça ao administrador ou a um Usuário comum responsável.</p></Callout>
    </Section>
  </>;
}

function AdminGuide({ zoom }: { zoom: (z: Zoom) => void }) {
  return <>
    <Toc items={adminToc}/>
    <Section id="admin-usuarios" title="A1. Gerenciar usuários">
      <p>Em <strong>Administração → Usuários</strong>:</p>
      <ol className="guide-steps"><li><strong>Criar</strong>: nome completo, nome de usuário (login, sem espaços), senha inicial (mínimo 12 caracteres) e perfil. Entregue login e senha pessoalmente.</li><li><strong>Perfis</strong>: <em>Usuário básico</em> só cria e emite BOs e Relatórios (continua os próprios rascunhos, mas não consulta nem baixa documentos emitidos); <em>Usuário comum</em> cria e emite BOs e Relatórios e vê os próprios; <em>Administrador</em> vê tudo e acessa Administração.</li><li><strong>Editar</strong>: altere nome, login, perfil, acesso ou defina nova senha (em branco mantém a atual).</li><li><strong>Desativar</strong>: bloqueia o acesso imediatamente, preservando o histórico do usuário.</li></ol>
      <Figure name="admin-usuarios" alt="Tela Usuários com formulário Novo usuário e lista de usuários fictícios" caption="Cadastro e lista de usuários." onZoom={zoom}/>
      <Figure name="admin-editar-usuario" alt="Janela Editar usuário com perfil, acesso e nova senha" caption="Editar usuário e redefinir senha." onZoom={zoom}/>
      <Callout kind="warn" title="Último administrador"><p>O sistema impede desativar ou rebaixar o último administrador ativo e impede que você remova o próprio acesso administrativo. Mantenha ao menos dois administradores.</p></Callout>
    </Section>
    <Section id="admin-corrigir" title="A2. Corrigir BO emitido">
      <ol className="guide-steps"><li>Abra o BO e toque em <strong>Editar boletim</strong>.</li><li>Ajuste os dados nas etapas e vá até a Revisão.</li><li>Toque em <strong>Confirmar e regenerar PDF</strong>, informe o <strong>motivo</strong> e confirme.</li></ol>
      <p>O número é mantido, um novo PDF é gerado como nova versão e a versão anterior fica em <strong>Histórico de versões</strong>, com autor, data, motivo e SHA-256. O novo PDF fica “Não enviado” até você reenviar.</p>
      <Figure name="admin-acoes-bo" alt="Detalhe do boletim com ações de administrador: editar, versões, reenviar, cancelar e remover" caption="Ações do administrador no boletim." onZoom={zoom}/>
    </Section>
    <Section id="admin-cancelar" title="A3. Cancelar e remover">
      <ul><li><strong>Cancelar boletim</strong>: exige motivo. O BO continua consultável, marcado como cancelado.</li><li><strong>Remover boletim</strong>: exige motivo; é remoção lógica. Some da lista padrão e do Usuário comum; você o encontra no filtro Status → Removidos.</li></ul>
      <Callout kind="info" title="Nada é apagado"><p>Cancelamento e remoção preservam PDFs, versões e auditoria. O número nunca é reutilizado. O mesmo vale para Relatórios Analíticos.</p></Callout>
    </Section>
    <Section id="admin-reenviar" title="A4. Reenviar e-mail">
      <p>No BO emitido, toque em <strong>Reenviar e-mail</strong> e escolha: destinatário informado, batalhão ou ambos. O mesmo PDF e número são reutilizados. Antes, confira em Configurações → Status e diagnóstico se o provedor está configurado; senão o reenvio também falhará.</p>
    </Section>
    <Section id="admin-auditoria" title="A5. Auditoria">
      <p><strong>Administração → Auditoria</strong> lista, do mais recente ao mais antigo, quem fez o quê e o resultado: logins, criação e emissão, downloads, envios, correções, gestão de usuários e alterações de Configurações (com os nomes dos campos alterados). A auditoria não guarda o conteúdo dos boletins.</p>
      <Figure name="admin-auditoria" alt="Tabela de auditoria com data, ação, nome, login e resultado" caption="Auditoria." onZoom={zoom}/>
    </Section>
    <Section id="admin-estatisticas" title="A6. Estatísticas">
      <p><strong>Administração → Estatísticas</strong> mostra totais por situação, revisados, falhas de e-mail e tipos mais registrados, com filtros de período, status e tipo. Não exibe dados pessoais.</p>
      <Figure name="admin-estatisticas" alt="Relatório administrativo com filtros e totais" caption="Estatísticas." onZoom={zoom}/>
    </Section>
    <Section id="admin-configuracoes" title="A7. Configurações">
      <p><strong>Administração → Configurações</strong> reúne parâmetros que antes exigiam mudar variáveis no servidor. Campo vazio = <strong>valor padrão do servidor</strong> (indicado abaixo de cada campo). Salve com <strong>Salvar configurações</strong>; ao sair com alterações não salvas, o sistema pede confirmação.</p>
      <Figure name="admin-configuracoes" alt="Página Configurações com cartões Unidade, E-mail institucional e Signatário" caption="Configurações." onZoom={zoom}/>
      <table className="guide-table"><thead><tr><th>Parâmetro</th><th>Onde aparece</th></tr></thead><tbody>
        <tr><td>Nome da unidade e Município/UF</td><td>Rodapé do Relatório Analítico (“24º Batalhão de Polícia Militar · Coroatá/MA”).</td></tr>
        <tr><td>Nome abreviado</td><td>Rodapé do BO (“24º BPM • Página N”), autor dos PDFs e assinatura dos e-mails.</td></tr>
        <tr><td>E-mail do batalhão</td><td>Recebe a cópia de todo BO e Relatório emitido (e dos reenvios).</td></tr>
        <tr><td>E-mail para respostas</td><td>Endereço usado quando alguém responde aos e-mails.</td></tr>
        <tr><td>Signatário (posto, nome, cargo)</td><td>Bloco de assinatura do Relatório Analítico.</td></tr>
      </tbody></table>
      <Callout kind="warn" title="Quando a mudança vale"><p>Imediatamente para prévias, novas emissões, correções e envios. <strong>PDFs já emitidos não mudam</strong>; para um documento com os novos dados é preciso corrigi-lo (nova versão). O cabeçalho oficial (Estado, PMMA, brasões) não é configurável.</p></Callout>
      <h3>Status e diagnóstico</h3>
      <p>Mostra o provedor de e-mail e se remetente e credenciais estão definidos (nunca exibe senhas ou chaves), banco de dados, migração, versão, ambiente e o endereço usado no QR. Use <strong>Enviar e-mail de teste</strong> para um endereço seu: o resultado diz honestamente se o provedor aceitou ou por que falhou. São até 3 testes a cada 10 minutos, registrados na auditoria.</p>
      <Figure name="admin-diagnostico" alt="Cartão Status e diagnóstico com provedor de e-mail, banco e resultado do e-mail de teste" caption="Diagnóstico e e-mail de teste." onZoom={zoom}/>
    </Section>
    <Section id="admin-rotina" title="A8. Rotina operacional">
      <ul><li><strong>E-mails pendentes</strong> após reinício do servidor: no backend, execute <code>python -m app.cli retry-pending</code> (agende na infraestrutura).</li><li><strong>Backups</strong>: os PDFs ficam no banco PostgreSQL; o backup do banco inclui os documentos. Teste a restauração periodicamente.</li><li>Revise a auditoria e as falhas de e-mail nas Estatísticas regularmente.</li><li>Desative contas de quem saiu da unidade.</li></ul>
    </Section>
    <Section id="admin-faq" title="A9. Perguntas frequentes do administrador">
      <div className="guide-faq">
        <details><summary>Todos os e-mails estão “Falhou”.</summary><p>Veja Configurações → Status e diagnóstico. “Não configurado” indica remetente ou credenciais ausentes no servidor (variáveis de ambiente). Depois de corrigir, faça um e-mail de teste e reenvie os BOs.</p></details>
        <details><summary>Troquei o signatário, mas o relatório antigo continua igual.</summary><p>Correto: PDFs emitidos são imutáveis. Corrija o relatório para gerar nova versão com o signatário atual.</p></details>
        <details><summary>Como volto ao valor original de um campo?</summary><p>Toque em “Usar padrão” (ou apague o campo) e salve.</p></details>
        <details><summary>Um usuário antigo era “Usuário simples”.</summary><p>Esse perfil foi extinto; essas contas viraram Usuário comum automaticamente e agora veem os próprios boletins e relatórios.</p></details>
      </div>
    </Section>
  </>;
}

export function Guide({ audience }: { audience: Audience }) {
  const [tab, setTab] = useState<'common' | 'admin'>('common');
  const [zoom, setZoom] = useState<Zoom>(null);
  const admin = audience === 'admin';
  useEffect(() => {
    // Printed copies show every FAQ answer.
    const open = () => document.querySelectorAll<HTMLDetailsElement>('.guide details').forEach(d => { d.open = true; });
    window.addEventListener('beforeprint', open);
    return () => window.removeEventListener('beforeprint', open);
  }, []);
  return <div className="guide">
    <div className="page-heading guide-heading"><div><small className="eyebrow">AJUDA</small><h1>Guia de uso do BO Online</h1><p>Passo a passo para registrar ocorrências, emitir PDFs e resolver problemas comuns.{audience === 'public' && ' Esta é a versão pública, com exemplos fictícios.'}</p></div><button type="button" className="secondary no-print" onClick={() => window.print()}><Printer size={16} aria-hidden="true"/> Imprimir guia</button></div>
    {audience === 'basic' && <p className="guide-note">Seu perfil é <strong>Usuário básico</strong>: veja a seção <a href="#guia-basico">Perfil Usuário básico</a>. Painel, consulta e download descritos abaixo não se aplicam a ele.</p>}
    {admin && <div className="guide-tabs no-print" role="tablist" aria-label="Guias disponíveis">{(['common', 'admin'] as const).map(t => <button key={t} type="button" role="tab" id={`tab-${t}`} aria-controls={`panel-${t}`} aria-selected={tab === t} tabIndex={tab === t ? 0 : -1} className={tab === t ? 'active' : ''} onClick={() => setTab(t)} onKeyDown={e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const next = t === 'common' ? 'admin' : 'common'; setTab(next); document.getElementById(`tab-${next}`)?.focus(); } }}>{t === 'common' ? <><BookOpen size={16} aria-hidden="true"/> Guia do usuário</> : <><ShieldCheck size={16} aria-hidden="true"/> Guia do administrador</>}</button>)}</div>}
    <div role={admin ? 'tabpanel' : undefined} id={admin ? `panel-${tab}` : undefined} aria-labelledby={admin ? `tab-${tab}` : undefined}>
      {tab === 'admin' && admin ? <AdminGuide zoom={setZoom}/> : <CommonGuide zoom={setZoom} publicView={audience === 'public'}/>}
    </div>
    {audience === 'public' && <p className="guide-note">O guia do administrador está disponível dentro do sistema, em Ajuda, para contas de administrador.</p>}
    {zoom && <Lightbox zoom={zoom} onClose={() => setZoom(null)}/>}
  </div>;
}
