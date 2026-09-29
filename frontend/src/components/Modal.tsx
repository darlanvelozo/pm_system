'use client';
import { useEffect, useRef } from 'react';

export function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; d?.showModal(); return () => d?.close(); }, []);
  return <dialog className="modal" ref={ref} onCancel={e => { e.preventDefault(); onClose(); }} aria-label={title}>
    <div className="section-line"><h2>{title}</h2><button type="button" className="secondary" onClick={onClose} aria-label="Fechar diálogo">Fechar</button></div>{children}
  </dialog>;
}
