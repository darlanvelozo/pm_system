# Validação executada

Ambiente local Windows, Python 3.12.14, Node 24.21.0, PostgreSQL 17.6 descartável, Next.js 16.3.6.

## Resultados

- Backend: 11 testes aprovados com SQLite e com PostgreSQL real.
- Migrations PostgreSQL: upgrade, verificação de divergências, downgrade e novo upgrade aprovados.
- Imports: compilação dos módulos Python aprovada.
- Health check HTTP real: 200, `{"status":"ok"}`.
- Frontend: TypeScript, ESLint, 7 testes Vitest e build de produção aprovados.
- Navegador Chromium: login, preenchimento dos dois modelos, revisão, emissão, status de falha SMTP sem configuração, download e retorno à listagem aprovados contra API e PostgreSQL reais.
- PDFs baixados pelo navegador: duas páginas em cada modelo no cenário curto. Conferidos visualmente bordas, cabeçalhos, bandeira, emblema e acentos. Testes de narrativa longa verificam marcadores finais de histórico e material em páginas adicionais.
- Layout desktop e celular: capturas locais com dados fictícios, fora do Git.
- Dependências de produção frontend: `npm audit --omit=dev` retornou zero vulnerabilidades conhecidas.

## Cobertura funcional

Autenticação válida/inválida, usuário desativado, endpoints protegidos, isolamento entre operadores, privilégios administrativos, criação BO 02/04, validação dos perfis, rejeição de e-mail inválido, descarte de e-mail institucional enviado pelo cliente, persistência, unicidade de número, atualização de rascunho, conflito de versão, imutabilidade após emissão, download autenticado, auditoria, payload máximo e CORS.

E-mail: mocks conferem dois destinatários separados, bytes idênticos, TLS, nome sanitizado, falha parcial, reenvio autorizado e ausência de novo boletim. Nenhum teste dispara e-mail real.

Frontend: seleção de modelos, mudança de campos, validação, etapas, rascunho por usuário, revisão e erros da API.

## Reprodução do teste de navegador

1. Crie um banco descartável chamado `bo_e2e`.
2. Configure `DATABASE_URL` para ele e `JWT_SECRET` de teste; mantenha SMTP sem configuração.
3. Em backend: `alembic upgrade head`, `python -m tests.seed_e2e`, inicie Uvicorn em localhost:8000.
4. Em frontend: `npm ci`, `npx playwright install chromium`, `npm run build`, `npm start`.
5. Execute `npm run test:e2e`. O teste usa exclusivamente conta e dados fictícios definidos no seed.

Não execute o seed ou esse cenário contra produção. Capturas e PDFs ficam em `.local/`, ignorado pelo Git. Playwright só acessa a aplicação própria; nenhum Google Forms é automatizado.

## Limites

Validação local não equivale à homologação institucional nem a deploy. SMTP real, DNS, entregabilidade, segredos e serviços Vercel/Render dependem da configuração operacional. Uma advertência de depreciação da integração Starlette/httpx foi emitida, sem falha de testes; acompanhar atualização do cliente de testes. A fidelidade visual reproduz a estrutura dos modelos, sem exigir que narrativas arbitrariamente longas caibam em duas páginas.
