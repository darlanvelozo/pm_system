'use client';
import { useEffect, useState } from 'react';
import { Modal } from './Modal';
type InstallEvent = Event & {prompt: () => Promise<void>; userChoice: Promise<{outcome: string}>};
export function Pwa() {
  const [offline, setOffline] = useState(false);
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    const network = () => setOffline(!navigator.onLine);
    network(); window.addEventListener('online', network); window.addEventListener('offline', network);
    const prompt = (event: Event) => {
      event.preventDefault();
      if (!matchMedia('(display-mode: standalone)').matches && !localStorage.getItem('bo24:install-dismissed')) setInstall(event as InstallEvent);
    };
    const installed = () => setInstall(null);
    window.addEventListener('beforeinstallprompt', prompt); window.addEventListener('appinstalled', installed);
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js', {updateViaCache: 'none'}).then(registration => {
      if (registration.waiting) setWaiting(registration.waiting);
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => { if (worker.state === 'installed' && navigator.serviceWorker.controller) setWaiting(worker); });
      });
    }).catch(() => { /* Browser operation remains available without installation. */ });
    return () => { window.removeEventListener('online', network); window.removeEventListener('offline', network); window.removeEventListener('beforeinstallprompt', prompt); window.removeEventListener('appinstalled', installed); };
  }, []);
  return <aside className="pwa-notices" aria-label="Aplicativo e conexão">
    {offline && <p role="status">Sem conexão com a internet. O BO Online precisa de conexão para consultar ou emitir boletins.</p>}
    {install && <div><button className="secondary" onClick={async () => {await install.prompt(); const choice = await install.userChoice; if (choice.outcome === 'dismissed') localStorage.setItem('bo24:install-dismissed', '1'); setInstall(null);}}>Instalar BO Online</button><button className="text-button" onClick={() => {localStorage.setItem('bo24:install-dismissed', '1'); setInstall(null);}}>Agora não</button></div>}
    {waiting && <div>Nova versão disponível. <button className="secondary" onClick={() => setConfirm(true)}>Atualizar</button></div>}
    {confirm && <Modal title="Atualizar aplicativo" onClose={() => setConfirm(false)}><p>Salve o rascunho antes de continuar. A página será recarregada e será necessário entrar novamente.</p><button className="primary" onClick={() => {navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), {once: true}); waiting?.postMessage({type: 'ACTIVATE_UPDATE'});}}>Salvei meu trabalho, atualizar</button></Modal>}
  </aside>;
}
