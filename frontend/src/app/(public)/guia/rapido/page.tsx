import type { Metadata } from 'next';
import Link from 'next/link';
export const metadata: Metadata = { title: 'Guia rápido | BO Online 24º BPM' };
const blocks: [string, string[]][] = [
  ['Acesso', ['Entre com usuário e senha fornecidos pelo administrador.', 'A sessão dura 30 minutos; recarregar a página exige novo login.', 'Use Sair ao terminar.']],
  ['Novo BO em 8 etapas', ['1 Identificação · 2 Local · 3 Envolvidos · 4 Histórico', '5 Material · 6 Efetivo · 7 Entrega · 8 Revisão', 'Campos * são obrigatórios. CPF é opcional, mas deve ser válido.', 'Adicione quantos envolvidos precisar (A, B, C…).']],
  ['Rascunho', ['Automático no aparelho por 7 dias.', 'Salvar no servidor para continuar em outro aparelho.', 'Retome em Painel → Meus rascunhos.']],
  ['Emitir', ['Revisão → Visualizar prévia do PDF (no celular: Abrir/Baixar).', 'Confirmar e gerar boletim: protocolo AAAAMMDD-NN.', 'Emitido não se edita: peça correção ao administrador.']],
  ['E-mails', ['Duas mensagens: batalhão e e-mail informado.', 'Falhou: o BO continua válido. Baixe o PDF e avise o administrador.', 'Não emita outro BO para a mesma ocorrência.']],
  ['Relatório Analítico', ['Menu → Novo Relatório Analítico.', 'Número próprio por ano (N/AAAA).', 'Prévia → Emitir Relatório Analítico.']],
  ['Autenticidade', ['O QR do PDF abre a página de verificação (exige login).', 'Compare o SHA-256 da cópia com o exibido.']],
  ['Privacidade', ['Nada de nomes, CPF, telefone ou endereço na descrição breve ou no tipo.', 'Não compartilhe sua senha: tudo fica na auditoria.']],
];
export default function QuickGuide() {
  return <div className="quick-guide"><h1>BO Online · Guia rápido</h1><p>Resumo de uma página. Guia completo: menu Ajuda dentro do sistema ou <Link href="/guia">/guia</Link>.</p>
    <div className="quick-grid">{blocks.map(([title, items]) => <section key={title}><h2>{title}</h2><ul>{items.map(i => <li key={i}>{i}</li>)}</ul></section>)}</div>
    <p className="quick-foot">Dúvidas ou falhas de envio: procure o administrador do sistema na sua unidade.</p></div>;
}
