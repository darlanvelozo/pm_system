'use client';
import Image from 'next/image';
import {useEffect,useState} from 'react';
import {api} from '@/services/api';
import type {Bulletin,User} from '@/types/api';
import {Wizard} from './Wizard';

export function Generator({user,token,onLogout}: {user:User;token:string;onLogout:()=>void}) {
  const [draft,setDraft] = useState<Bulletin>();
  const [editing,setEditing] = useState(false);
  const [success,setSuccess] = useState('');
  const [error,setError] = useState('');
  const [account,setAccount] = useState(false);
  useEffect(()=>{api<Bulletin|null>('/api/bo/active-draft',token).then(b=>setDraft(b || undefined)).catch(e=>setError(e.message));},[token,editing]);
  return <div className="generator-shell"><header className="topbar"><Image src="/24bpm-official.png" width={44} height={44} alt="Brasão oficial do 24º BPM"/><strong>BO Online</strong><div><button className="text-button" onClick={()=>setAccount(!account)}>Conta</button><button className="secondary" onClick={onLogout}>Sair</button></div></header><main className="content">{account && <section className="card"><h2>Conta</h2><p>{user.name} ({user.username})</p><p>Usuário simples</p></section>}{error && <p role="alert">{error}</p>}{editing ? <Wizard user={user} token={token} existing={draft} onBack={()=>setEditing(false)} onComplete={b=>{setSuccess(b.bo_number || '');setDraft(undefined);setEditing(false);}}/> : <section className="card"><h1>{success ? 'Boletim gerado com sucesso' : 'Registrar boletim'}</h1>{success && <p role="status">Protocolo: {success}. O envio será processado pelo sistema.</p>}<button className="primary" onClick={()=>{setDraft(undefined);setSuccess('');setEditing(true);}}>Novo boletim</button>{draft && <button className="secondary" onClick={()=>{setSuccess('');setEditing(true);}}>Continuar rascunho</button>}</section>}</main></div>;
}
