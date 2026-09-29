# Validação da evolução de boletins — 29/09/2026

## Estado inicial e correções

Foi mantida a branch main e a arquitetura Next.js/FastAPI/PostgreSQL. A base já tinha criação de usuários e consulta administrativa, mas a edição não abrangia nome/login, não havia identidade histórica independente de renomeações e o bootstrap podia voltar a sincronizar dados do administrador. O formulário ainda usava perfis rígidos de dois/quatro envolvidos; emitidos não tinham revisão preservada e o frontend não tinha PWA.

Não se atribui o relato antigo de falha de cadastro a uma causa de produção sem logs. Foram corrigidas as lacunas encontradas no código: edição completa, mensagens de duplicidade, normalização do login, senha opcional na edição, proteção de administradores, bootstrap somente inicial e confirmação visível de criação. O teste integrado demonstrou ADMIN criar uma conta e essa conta efetivamente autenticar pela interface.

As migrations são `20260929_identity` e `20260929_revisions`. Nomes/login são capturados nos eventos e emissões; registros antigos usam a identidade disponível na migração, sem alegar reconstrução histórica. PDFs anteriores conservam seus bytes. O downgrade só é permitido quando não há boletins.

## Evidência automatizada local

| Verificação | Resultado |
|---|---|
| Backend pytest em PostgreSQL descartável | 44 testes aprovados |
| Ruff e compileall | Aprovados |
| Alembic banco vazio: upgrade, check, downgrade, upgrade | Aprovados, sem diferença de schema |
| Migração com registros legados fictícios | Aplicada no banco local de integração, preservando PDFs anteriores |
| Frontend ESLint e TypeScript | Aprovados |
| Vitest | 17 testes aprovados |
| Build Next.js 16.3.6 | Aprovado, inclui manifest público |
| Envolvidos, API/PostgreSQL/PDF | 1, 2, 3, 4, 5, 8, 12 e 30; todos os nomes extraídos do PDF |
| Revisões | 2 → 7 → 3 e 8 → 3; identidades retidas, PDFs antigos preservados, conflito 409, sem reenvio automático |
| Interface integrada | Criar usuário, login do operador, emitir, 2 → 7, remover C preservando os dados de D, consultar versões, cancelar, remover e auditoria |
| Playwright | 5 cenários aprovados: 4 na suíte principal e o adicional de 30 envolvidos no celular |
| Persistência móvel de 30 envolvidos | Formulário → API → PostgreSQL → novo login → consulta dos 30 nomes → PDF |
| Mobile | 320, 360, 375, 390, 412 e 768 px sem overflow no painel |
| PWA | Manifest, controle pelo SW, cache público, fallback offline, recusa de instalação, standalone simulado e atualização real de SW com confirmação |

O PDF de sete envolvidos emitido pela interface contém todos os nomes e registrador em três páginas. O PDF móvel de trinta contém todos os nomes em onze páginas, com sequência até AD. A extração foi conferida com PyMuPDF; primeira/última página foram inspecionadas visualmente. Os arquivos fictícios e screenshots ficam em `.local`, ignorado pelo Git. Trinta é a maior quantidade testada, não um limite de implementação.

Os testes backend substituem o envio de e-mail; no navegador local o SMTP foi desabilitado intencionalmente e o sistema mostrou falha real, sem falso sucesso. Não houve envio externo de teste nem inclusão de dados reais. Há um aviso de depreciação do TestClient/HTTPX na dependência instalada; a suíte concluiu com sucesso.

## Como reproduzir

Use PostgreSQL exclusivo para testes. `TEST_DATABASE_URL` é destrutivo para tabelas desse banco. Execute os comandos de teste do README. Para E2E, inicie backend na porta 8000 com banco fictício migrado e frontend de produção na porta 3000. Crie somente nesse banco a conta fictícia definida em `frontend/e2e/bulletin.spec.ts`; mantenha `EMAIL_PROVIDER=smtp` e `SMTP_HOST` vazio. Instale Chromium via Playwright e execute `npm run test:e2e`. O teste de atualização modifica temporariamente o SW gerado local e o restaura; nunca execute essa suíte contra produção.

## Limites e homologação

Validar institucionalmente o layout de cinco ou mais pessoas, impressão/assinatura e recebimento real pelos dois destinatários. O emblema herdado precisa de arte oficial melhor se a resolução for insuficiente. Instalação física Android/iOS permanece para homologação; Chromium com viewport e standalone simulado não equivale a esses dispositivos. O service worker não permite emitir sem rede. Deploy e aplicação das migrations em produção devem ser conferidos separadamente dos testes locais e do push.
