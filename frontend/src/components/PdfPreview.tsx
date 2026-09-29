'use client';
import {useEffect} from 'react';
import {Modal} from './Modal';
export function PdfPreview({url, onClose}: {url:string; onClose:()=>void}) {
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return <Modal title="Visualização do PDF" onClose={onClose}><a className="secondary" href={url} target="_blank" rel="noopener">Abrir PDF em outra aba</a><iframe title="PDF" src={url} style={{width:'100%',height:'65dvh',border:0}}/></Modal>;
}
