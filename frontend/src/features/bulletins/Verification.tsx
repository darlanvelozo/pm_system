'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {api} from '@/services/api';
type Verified = {bo_number:string; version:number; status:string; generated_at:string; pdf_sha256:string; matches:boolean; current_revision:number};
export function Verification({id,revision,token}: {id:string;revision:string;token:string}) {
  const [value,setValue] = useState<Verified>();
  const [error,setError] = useState('');
  useEffect(() => {api<Verified>(`/api/bo/${id}/verify?revision=${encodeURIComponent(revision)}`,token).then(setValue).catch(e=>setError(e.message));},[id,revision,token]);
  return <main className="public-page"><h1>Verificação documental</h1>{error && <p role="alert">{error}</p>}{value && <div className="card verification"><p>Nº do BO: {value.bo_number}</p><p>Versão: {value.version} · Vigente: {value.current_revision}</p><p>Status: {({DRAFT:'Rascunho',ISSUED:'Emitido',CANCELLED:'Cancelado',REMOVED:'Removido'} as Record<string,string>)[value.status] || value.status}</p><p>Gerado em: {new Date(value.generated_at).toLocaleString('pt-BR')}</p><p style={{overflowWrap:'anywhere'}}>SHA-256: {value.pdf_sha256}</p><p role="status">{value.matches ? 'Documento corresponde ao registro armazenado.' : 'Divergência de integridade. Procure o administrador.'}</p><p>Compare este hash com o SHA-256 do arquivo recebido. A consulta verifica os bytes armazenados; não analisa um arquivo externo.</p></div>}<Link href="/">Voltar ao sistema</Link></main>;
}
