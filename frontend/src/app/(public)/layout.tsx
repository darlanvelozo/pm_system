import Link from 'next/link';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <main className="public-page"><header><Link href="/sobre"><strong>BoletimON · BO Online 24º BPM</strong></Link><nav aria-label="Navegação pública"><Link href="/">Acessar sistema</Link><Link href="/privacidade">Privacidade</Link><Link href="/termos">Termos de uso</Link><Link href="/guia">Guia de uso</Link></nav></header><article>{children}</article><footer>Contato: <a href="mailto:24bpmcoroata2@gmail.com">24bpmcoroata2@gmail.com</a></footer></main>;
}
