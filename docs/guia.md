# Guia de uso (Ajuda)

O guia ilustrado fica dentro do sistema, no menu **Ajuda / Guia de uso** (no celular: Menu → Ajuda / Guia de uso, ou Conta → Ajuda / Guia de uso). O conteúdo depende do perfil:

- **Usuário comum**: guia do usuário (acesso, painel, BO em 8 etapas, rascunhos, prévia, emissão, e-mails, PDF, verificação, Relatórios Analíticos, celular/PWA, privacidade, FAQ e anexos).
- **Administrador**: abas “Guia do usuário” e “Guia do administrador” (usuários, correção, cancelamento/remoção, reenvio, auditoria, estatísticas, Configurações, rotina operacional, FAQ).
- **Público** em `/guia` (link no rodapé do login): somente o guia do usuário. Todas as imagens usam dados fictícios. Guia rápido de uma página em `/guia/rapido`.

O botão “Imprimir guia” usa a folha de estilo de impressão (sem menus, FAQ aberto, figuras sem quebra).

## Arquivos

- Conteúdo: `frontend/src/features/guide/Guide.tsx`; guia rápido: `frontend/src/app/(public)/guia/rapido/page.tsx`.
- Capturas (WebP): `frontend/public/guia/*.webp`; dimensões em `frontend/src/features/guide/screenshots.json` (gerado).
- Anexos: `frontend/public/guia/anexos/` — `exemplo-boletim-de-ocorrencia.pdf`, `exemplo-relatorio-analitico.pdf` (prévias, sem protocolo) e `guia-rapido.pdf`. O `.gitignore` abre exceção somente para essa pasta.

## Regenerar capturas e anexos

Com PostgreSQL, backend (`:8000`) e frontend (`npm run dev`, `:3000`) em execução, num banco **de desenvolvimento**:

```sh
cd frontend
GUIDE_ADMIN_USERNAME=seu.admin GUIDE_ADMIN_PASSWORD='***' node scripts/capture-guide.mjs
```

O script (`frontend/scripts/capture-guide.mjs`):

1. Faz 2 logins pela API (administrador e conta fictícia `guia.exemplo`, Usuário comum, criada ou com senha aleatória redefinida a cada execução), abaixo do limite de 10 logins/min.
2. Cria, se ainda não existirem, três BOs emitidos, um rascunho e um Relatório Analítico com dados fictícios (e-mails `@example.com`; sem provedor configurado os envios ficam “Falhou”).
3. Captura telas em Chromium 1366×900 e WebKit iPhone 14 (390×844), escondendo o indicador do Next e recortando regiões úteis. Listas de usuários e auditoria são simuladas com linhas fictícias para não expor contas reais.
4. Converte para WebP com `sharp` (dependência já presente via Next; sem ele, grava PNG), gera os PDFs de exemplo pelos endpoints de prévia e imprime `/guia/rapido` em PDF.

Ao alterar textos ou telas, rode novamente e confira as imagens. Tamanho atual de `public/guia`: cerca de 1 MB.
