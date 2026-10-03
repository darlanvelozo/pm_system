# Aplicativo instalável e uso móvel

O frontend mantém Next.js 16 e usa manifest, ícones e service worker nativo. Não foi necessário adicionar Serwist: uma lista explícita e pequena de arquivos públicos atende ao escopo sem configurar cache amplo de rotas autenticadas. O script `npm run build` gera `public/sw.js` com versão derivada do conteúdo; o arquivo gerado não é versionado. Não há downgrade do Next.js.

O manifest `/manifest.webmanifest` identifica BO Online, escopo e início `/`, modo `standalone`, orientação livre, cores e ícones 192/512, maskable e Apple. Em navegador compatível, o aviso “Instalar BO Online” usa o evento de instalação. “Agora não” registra a recusa naquele navegador. Em standalone o aviso não aparece. No Safari/iOS, use Compartilhar → Adicionar à Tela de Início; o navegador controla a disponibilidade.

O service worker armazena somente ícones, página pública offline e arquivos estáticos do Next. Não armazena navegação autenticada, RSC, API, login, JWT, boletins, PDFs, respostas com Authorization nem requisições ao Render. Isso é independente dos rascunhos locais explícitos do formulário. Sem conexão, a navegação apresenta aviso público e a emissão fica bloqueada.

Nova versão instalada fica aguardando. “Atualizar” abre confirmação para salvar o trabalho; só depois da confirmação ocorre ativação/recarregamento. É necessário entrar novamente, pois o token fica em memória. O rascunho local continua recuperável pelo mesmo usuário.

A interface inclui navegação inferior e menu em telas pequenas, listagem em cartões, progresso “Etapa X de 8”, áreas de toque de pelo menos 44 px, `dvh` e safe areas. A validação automatizada cobre 320, 360, 375, 390, 412 e 768 px. Em telas de toque (iOS Safari, Chrome Android) ou quando o navegador não tem visualizador de PDF, a prévia não usa iframe: mostra “Abrir PDF” e “Baixar PDF”. O menu lateral móvel tem fundo escurecido, fecha com Esc, toque fora ou navegação e mantém o foco dentro dele; tabelas administrativas viram cartões em até 768 px. Simular standalone no Chromium não substitui homologar a instalação real em Android e iOS.

Referências de implementação: [PWA no Next.js](https://nextjs.org/docs/app/guides/progressive-web-apps) e [Serwist com Next.js](https://serwist.pages.dev/docs/next).
