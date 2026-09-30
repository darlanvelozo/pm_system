Administrador inicial: `24bpmcoroata`, criado pelo bootstrap quando ainda não existe administrador. Configure `SINGLE_USER_MODE=true` e o segredo `SINGLE_USER_PASSWORD` no Render; depois da criação pode desativar o bootstrap. Veja [usuários](docs/login.md).

# Envio no Render Free

A configuração recomendada usa Brevo via HTTPS, sem OAuth Google. Siga [o guia Brevo](docs/brevo.md). Gmail e SMTP continuam opcionais.

# BO Online 24º BPM

Sistema de Emissão de Boletins de Ocorrência do 24º BPM da Polícia Militar do Maranhão. Frontend Next.js e backend FastAPI **independentes**, com comunicação HTTP/HTTPS, PostgreSQL, autenticação, PDF e entrega por SMTP ou API do Gmail.

## Estrutura

```text
frontend/        Next.js, React, TypeScript, Tailwind, React Hook Form, Zod
backend/         FastAPI, Pydantic, SQLAlchemy, Alembic, ReportLab
docs/            Arquitetura, referências, homologação e operação
.github/         CI com PostgreSQL e build do frontend
render.yaml      Blueprint do backend; PostgreSQL externo gratuito no Neon
docker-compose.yml  PostgreSQL para desenvolvimento
```

O formulário usa envolvidos dinâmicos, iniciando com A e permitindo adicionar/remover pessoas sem perder dados. Todos podem receber campos complementares; o PDF adapta as páginas à quantidade e ao conteúdo. Veja [boletins, revisões e homologação](docs/dynamic-bulletins.md) e [PWA e mobile](docs/pwa.md).

## Pré-requisitos

- Node.js 24 LTS e npm.
- Python 3.12 e PostgreSQL 17.
- Git para versionamento.
- Credencial Brevo para envio HTTPS no Render Free; Gmail e SMTP são alternativas. Veja [o guia](docs/brevo.md).

Ferramentas portáteis eventualmente usadas no desenvolvimento ficam em `.tools/`, ignorado pelo Git. Não são necessárias no deploy.

## Banco local

Crie um banco e usuário próprios no PostgreSQL. Alternativamente, com Docker instalado:

```powershell
$env:POSTGRES_PASSWORD = "defina-uma-senha-local"
docker compose up -d postgres
```

Defina `DATABASE_URL=postgresql+psycopg://bo:SENHA@localhost:5432/bo` no arquivo `backend/.env`. Faça o URL-encoding dos caracteres especiais da senha. O exemplo do ambiente é apenas local e deve ser substituído.

## Banco online gratuito — Neon

O deploy utiliza **Neon Free (PostgreSQL)**. O `render.yaml` não cria um banco pago no Render: solicita `DATABASE_URL` de um banco externo. Crie um projeto gratuito no Neon e copie sua URL de conexão direta, mantendo `sslmode=require` e os demais parâmetros TLS fornecidos pelo painel. Cadastre essa URL somente no backend, em **Render → Environment → DATABASE_URL**.

O backend já aceita `postgresql://`, `postgres://` e `postgresql+psycopg://`, utiliza Psycopg 3 e verifica conexões ociosas com `pool_pre_ping`. As migrations Alembic, transações, relacionamentos e PDFs continuam funcionando com PostgreSQL. Não é necessário instalar MongoDB ou alterar as dependências.

O plano gratuito tem limites de armazenamento e processamento; os PDFs também consomem o espaço do banco. Consulte o [guia de configuração, limites e migração](docs/free-database.md). Essa alteração torna o **banco** gratuito dentro da cota; não altera o plano do serviço web Render nem o provedor de e-mail.

## Backend — execução independente

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.lock.txt
Copy-Item .env.example .env
```

Edite `.env`. Gere um segredo aleatório com `python -c "import secrets; print(secrets.token_urlsafe(48))"` e configure `JWT_SECRET`. Depois:

```powershell
alembic upgrade head
python -m app.cli create-admin
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 --no-access-log
```

Em Linux/macOS use `source .venv/bin/activate` e `cp .env.example .env`. O comando de criação do administrador solicita e confirma a senha sem exibi-la. Não existe senha padrão nem cadastro público.

API: `http://localhost:8000`. Documentação de desenvolvimento: `/docs`. Health check: `GET /health` retorna `{"status":"ok"}`. O health check verifica o processo; a CI e os testes verificam persistência separadamente.

## Frontend — execução independente

Em outro terminal:

```powershell
cd frontend
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Abra `http://localhost:3000`. `NEXT_PUBLIC_API_URL` aponta para a API, por padrão `http://localhost:8000`. Essa variável é pública e resolvida no build: alterá-la exige novo deploy. O frontend não recebe credenciais PostgreSQL ou SMTP.

## Uso

1. Entre com usuário e senha cadastrados pelo administrador.
2. Escolha Novo boletim, informe e-mail de recebimento e os dados da ocorrência; o número será automático.
3. Preencha local, envolvidos, histórico, material, efetivo e entrega.
4. Revise os dados na última etapa e confirme a emissão.
5. Acompanhe os status reais e baixe o PDF.

O rascunho incompleto é salvo automaticamente no navegador, separado por usuário e boletim. Dura até sete dias e é removido ao sair explicitamente ou emitir. Salvar no servidor permite rascunhos incompletos e sem número. Boletins emitidos podem ser corrigidos por ADMIN, com motivo, confirmação e preservação de todas as versões do PDF.

O JWT permanece apenas em memória e expira em 30 minutos. Após recarregar a página, faça login novamente para recuperar o rascunho local. Não há renovação automática nem recuperação de senha por e-mail; o administrador pode redefini-la em Administração → Usuários.

## Permissões

| Recurso | Operador | Administrador |
|---|---|---|
| Criar, revisar e emitir | Sim | Sim |
| Consultar e baixar | Próprios boletins | Todos |
| Alterar rascunho | Próprios | Todos |
| Corrigir emitido / versões / cancelar / remover | Não | Sim |
| Reenviar e-mail | Não | Sim |
| Gerenciar usuários / auditoria | Não | Sim |

A regra de consulta conservadora precisa de homologação institucional. O protocolo é gerado na primeira emissão em America/Fortaleza, com sequência diária atômica e unicidade global. E-mail institucional vem exclusivamente da configuração do backend; `battalionEmail` enviado pelo cliente é ignorado.

## PDF

ReportLab produz A4, tabelas com bordas, títulos cinza, bandeira, emblema, classificação, características, lesões, narrativa e assinatura visual. O layout dinâmico está em `backend/app/pdf/layout.py`; os imports de templates antigos delegam a ele. Texto extenso expande os blocos e gera páginas adicionais, com número do BO e registrador. Nenhuma narrativa é truncada para caber em duas páginas.

Os dois PDFs oficiais foram examinados localmente. **Não estão no repositório**, assim como imagens de páginas, texto extraído e dados pessoais. Apenas bandeira e emblema isolados, conferidos visualmente, são usados como ativos institucionais. O emblema herdou a baixa resolução do modelo; substituir por arte oficial de melhor qualidade quando disponível.

`StorageService` define o contrato; a implementação `DatabaseStorage` grava o PDF como binário no PostgreSQL na mesma transação da emissão. Não depende do disco efêmero do Render. A API nunca expõe chave ou URL pública de armazenamento. Uma futura implementação S3/R2 deverá preservar autorização e consistência entre arquivo e metadados.

## E-mail

São duas mensagens independentes com o mesmo PDF: uma para `BATTALION_EMAIL` (padrão `boletimonline24bpm@gmail.com`) e outra para `recipient_email`. Não há CC. TLS é obrigatório: STARTTLS por padrão, ou TLS direto com `SMTP_SSL=true`.

O registro e PDF são confirmados antes do envio. Status e timestamps de cada destinatário são independentes (`PENDING`, `SENT`, `FAILED`, `NOT_SENT`). Revisões ficam `NOT_SENT` até reenvio explícito. Ausência de configuração do provedor resulta em `FAILED`, nunca em falso sucesso. O painel consulta novamente enquanto há envios pendentes.

O administrador pode reenviar para destinatário, batalhão ou ambos em `POST /api/bo/{id}/resend-email`, corpo `{"target":"recipient|battalion|both"}`. O mesmo registro, número e PDF são reutilizados. Envios são serializados com locks de linha do PostgreSQL.

Após uma interrupção do processo, recupere envios pendentes com:

```sh
python -m app.cli retry-pending
```

Agende esse comando na infraestrutura conforme a operação. Sem um worker externo, tarefas de e-mail dependem do processo web. SMTP não garante entrega exatamente uma vez: uma interrupção após o servidor aceitar a mensagem e antes de gravar `SENT` pode levar a duplicação de entrega na recuperação. Isso nunca cria um novo BO.

## Variáveis

| Aplicação | Variável | Finalidade |
|---|---|---|
| Frontend | `NEXT_PUBLIC_API_URL` | URL pública da API |
| Backend | `DATABASE_URL` | Conexão PostgreSQL externa, como Neon Free, com TLS |
| Backend | `JWT_SECRET` | Segredo aleatório, mínimo 32 caracteres |
| Backend | `BATTALION_EMAIL` | Destino institucional definido no servidor |
| Backend | `SMTP_HOST`, `SMTP_PORT` | Servidor e porta SMTP |
| Backend | `SMTP_USERNAME`, `SMTP_PASSWORD` | Autenticação SMTP |
| Backend | `SMTP_FROM` | Remetente autorizado no provedor |
| Backend | `SMTP_SSL` | `false` para STARTTLS, `true` para TLS direto |
| Backend | `ALLOWED_ORIGINS` | Origens exatas separadas por vírgula |
| Backend | `ENVIRONMENT` | `development` ou `production` |
| Backend | `TOKEN_MINUTES` | Validade JWT, padrão 30 |
| Backend | `PDF_ASSET_DIR` | Diretório das imagens institucionais |

Nunca versione `.env` real. O `.gitignore` exclui segredos, PDFs, bancos locais, uploads e ferramentas. Sem wildcard CORS. Produção exige origens HTTPS; HTTPS externo é terminado pelas plataformas.

## API principal

`POST /api/auth/login`, `GET /api/auth/me`, `POST /api/bo`, `GET /api/bo`, `GET /api/bo/{id}`, `PUT /api/bo/{id}`, `GET /api/bo/{id}/pdf`, `POST /api/bo/{id}/resend-email`.

Criação recebe `{"data":{...},"emit":true|false}`. Atualização também requer `version` para impedir sobrescrita de edição concorrente. A listagem aceita `page` e `size`, até 100 por página, e omite narrativa e dados pessoais. Endpoints administrativos: `/api/admin/users`, `/api/admin/users/{id}` e `/api/admin/audit`.

## Segurança operacional

Senha Argon2; JWT HS256 com expiração, emissor e audiência; autorização em todas as operações; payload limitado a 256 KiB; validação independente nos dois lados; rate limiting básico; erros sem ecoar payload; SQL com parâmetros ocultos; downloads autenticados e respostas sem cache. Auditoria armazena apenas ator, ação, BO, resultado e horário.

O limitador é local ao processo. O deploy utiliza um worker; para múltiplos workers/instâncias, adote limitador compartilhado ou proteção de borda. Configure proxies confiáveis, TLS, backups criptografados, restauração testada, monitoramento e retenção antes de receber dados reais. Não capture corpos HTTP ou parâmetros de SQL nos logs da infraestrutura. Detalhes em [operação](docs/operations.md).

## Testes

Backend (banco de teste descartável; **nunca aponte para produção**):

```sh
cd backend
ruff check app tests
pytest -q
python -m compileall -q app
```

Por padrão, pytest ignora `DATABASE_URL` e usa SQLite temporário. Para testar PostgreSQL, defina explicitamente `TEST_DATABASE_URL` com um banco descartável: a suíte apaga e recria suas tabelas. A CI usa PostgreSQL dedicado. SMTP é mockado; nenhum teste envia e-mail real.

Migrations em banco vazio de teste:

```sh
alembic upgrade head
alembic check
```

Somente em banco descartável sem boletins, valide também a reversão:

```sh
alembic downgrade base
alembic upgrade head
```

Frontend:

```sh
cd frontend
npm run lint
npm run typecheck
npm test
npm run build
```

Consulte a [validação atual de envolvidos, revisões e PWA](docs/validation-20260929.md) para resultados e limites da execução local, além da [validação original](docs/validation.md). Dependências Python fixadas em `requirements.lock.txt`; frontend em `package-lock.json`.

## Vercel e Render

Vercel: importe o repositório, **Root Directory `frontend`**, framework Next.js. Configure `NEXT_PUBLIC_API_URL` com a URL HTTPS do Render e gere novo build.

Render: o Blueprint `render.yaml` usa o plano **Free**, PostgreSQL externo Neon e envio HTTPS pela API do Brevo. Root Directory: `backend`. Build: `pip install -r requirements.lock.txt`. Start: `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1 --no-access-log`. Configure o remetente e a chave de API conforme [Brevo no Render Free](docs/brevo.md). Para servicos existentes, ajuste tambem o plano e os comandos no painel. O envio real depende da autorizacao da conta remetente.

Use o bootstrap ou `python -m app.cli create-admin` conforme [login](docs/login.md). Faça smoke test com dados fictícios, confirme dois recebimentos reais em homologação e valide o PDF antes de uso institucional. Deploy não substitui homologação.

Referências técnicas: [Next.js](https://nextjs.org/docs/app/getting-started/installation), [FastAPI — autenticação](https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/), [Vercel — monorepos](https://vercel.com/docs/monorepos), [Render — FastAPI](https://render.com/docs/deploy-fastapi).

## GitHub

Repositório: https://github.com/renanvsantos3-jpg/bo-online-24bpm. Branch principal `main`, remote `origin`. Commits usam Conventional Commits. Não sobrescrever histórico remoto com force push. Antes de enviar: testes, build, migrations, revisão de `git status` e conferência de ausência de dados reais.

```sh
git push origin main
```

Autenticação GitHub deve ser fornecida pelo Git/credential manager do ambiente, nunca por token salvo no projeto. Pendências institucionais: [open_questions.md](docs/open_questions.md).

## Integração RTK / Codex

`rtk init --codex` foi aplicado ao projeto por solicitação do usuário. Criou `RTK.md`, uma referência em `AGENTS.md` e `.codex/hooks.json`. O RTK precisa estar instalado e disponível no PATH. Reinicie o Codex e aprove a confiança no hook quando solicitado. A configuração não modifica permissões de sandbox nem habilita histórico global automaticamente.

## Emissão e integridade documental

Consulte [numeração, idempotência, prévia e verificação](docs/protocol-and-verification.md) e [resumo dos e-mails](docs/email-summary.md). A interface inclui filtros no servidor, Meus rascunhos, relatório administrativo e scroll ao cabeçalho do envolvido. `FRONTEND_URL` no backend define o destino do QR; por padrão já usa https://bpm24online.vercel.app. O hash é calculado depois de finalizar o PDF e não é inserido no próprio arquivo.

Resultados desta etapa: [validação de protocolos e integridade](docs/validation-protocol-20260929.md).
# Relatórios Analíticos e Usuário simples

A aplicação também possui Relatórios Analíticos, com sequência anual independente, prévia, revisões e envio de PDF. O perfil GERADOR permite apenas novos BOs e rascunhos próprios. Consulte a [matriz de permissões, fontes do formulário e configuração da autoridade](docs/analytical-reports.md).
