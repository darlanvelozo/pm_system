'use client';
import {useEffect, useState} from 'react';
import {Modal} from './Modal';
// iOS Safari and Android Chrome do not render PDFs inside an iframe; offer open/download instead.
function inlineViewer() { return navigator.pdfViewerEnabled !== false && !matchMedia('(pointer: coarse)').matches; }
export function PdfPreview({url, onClose, filename = 'documento.pdf'}: {url:string; onClose:()=>void; filename?:string}) {
  const [inline] = useState(inlineViewer);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return <Modal title="Visualização do PDF" onClose={onClose}>{inline ? <><a className="secondary" href={url} target="_blank" rel="noopener">Abrir PDF em outra aba</a><iframe title="PDF" src={url} style={{width:'100%',height:'65dvh',border:0}}/></> : <div className="pdf-fallback"><p>Este dispositivo não exibe o PDF dentro da página. Abra o arquivo no visualizador do aparelho ou baixe uma cópia.</p><div className="action-row"><a className="primary" href={url} target="_blank" rel="noopener">Abrir PDF</a><a className="secondary" href={url} download={filename}>Baixar PDF</a></div></div>}</Modal>;
}
