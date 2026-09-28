# BO Online 24º BPM

Sistema de Emissão de Boletins de Ocorrência do 24º BPM da Polícia Militar do Maranhão. Frontend Next.js e backend FastAPI **independentes**, com comunicação HTTP/HTTPS, PostgreSQL, autenticação, PDF e entrega por SMTP.

## Estrutura

```text
frontend/        Next.js, React, TypeScript, Tailwind, React Hook Form, Zod
backend/         FastAPI, Pydantic, SQLAlchemy, Alembic, ReportLab
docs/            Arquitetura, referências, homologação e operação
.github/         CI com PostgreSQL e build do frontend
render.yaml      Blueprint do backend e PostgreSQL
docker-compose.yml  PostgreSQL para desenvolvimento
```

Os modelos BO 02 e BO 04 têm schemas e interfaces próprios, baseados em perfis declarativos. BO 02 inclui vestimentas, locomoção, arma de fogo, droga, veículo e arma branca individualmente. BO 04 tem quatro envolvidos e observações, sem esses extras.

## Pré-requisitos

- Node.js 24 LTS e npm.
- Python 3.12 e PostgreSQL 17.
- Git para versionamento.
- Servidor SMTP com TLS para entrega real.

Ferramentas portáteis eventualmente usadas no desenvolvimento ficam em `.tools/`, ignorado pelo Git. Não são necessárias no deploy.

## Banco local

Crie um banco e usuário próprios no PostgreSQL. Alternativamente, com Docker instalado:

```powershell
$env:POSTGRES_PASSWORD = "defina-uma-senha-local"
docker compose up -d postgres
```

Defina `DATABASE_URL=postgresql+psycopg://bo:SENHA@localhost:5432/bo` no arquivo `backend/.env`. Faça o URL-encoding dos caracteres especiais da senha. O exemplo do ambiente é apenas local e deve ser substituído.

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

1. Entre com e-mail e senha cadastrados pelo administrador.
2. Escolha Novo boletim, informe e-mail, modelo e número manual.
3. Preencha local, envolvidos, histórico, material, efetivo e entrega.
4. Revise os dados na última etapa e confirme a emissão.
5. Acompanhe os status reais e baixe o PDF.

O rascunho incompleto é salvo automaticamente no navegador, separado por usuário. Dura até sete dias para recuperação e é removido ao sair explicitamente ou emitir. Não use dispositivos compartilhados sem encerrar a sessão. O botão Salvar no servidor requer os campos obrigatórios completos; os rascunhos persistidos aparecem na listagem e podem ser editados. Boletins emitidos são imutáveis nesta versão.

O JWT permanece apenas em memória e expira em 30 minutos. Após recarregar a página, faça login novamente para recuperar o rascunho local. Não há renovação automática nem recuperação de senha por e-mail; o administrador pode redefini-la pela API administrativa.

## Permissões

| Recurso | Operador | Administrador |
|---|---|---|
| Criar, revisar e emitir | Sim | Sim |
| Consultar e baixar | Próprios boletins | Todos |
| Alterar rascunho | Próprios | Todos |
| Reenviar e-mail | Não | Sim |
| Gerenciar usuários / auditoria | Não | Sim |

A regra de consulta conservadora precisa de homologação institucional. O número do BO é informado manualmente e tem unicidade global. E-mail institucional vem exclusivamente da configuração do backend; `battalionEmail` enviado pelo cliente é ignorado.

## PDF

ReportLab produz A4, tabelas com bordas, títulos cinza, bandeira, emblema, classificação, características, lesões, narrativa e assinatura visual. Os dois templates estão em `backend/app/pdf/templates/`, com componentes comuns. Texto extenso expande os blocos e gera páginas adicionais. Nenhuma narrativa é truncada para caber em duas páginas.

Os dois PDFs oficiais foram examinados localmente. **Não estão no repositório**, assim como imagens de páginas, texto extraído e dados pessoais. Apenas bandeira e emblema isolados, conferidos visualmente, são usados como ativos institucionais. O emblema herdou a baixa resolução do modelo; substituir por arte oficial de melhor qualidade quando disponível.

`StorageService` define o contrato; a implementação `DatabaseStorage` grava o PDF como binário no PostgreSQL na mesma transação da emissão. Não depende do disco efêmero do Render. A API nunca expõe chave ou URL pública de armazenamento. Uma futura implementação S3/R2 deverá preservar autorização e consistência entre arquivo e metadados.

## E-mail

São duas mensagens independentes com o mesmo PDF: uma para `BATTALION_EMAIL` (padrão `boletimonline24bpm@gmail.com`) e outra para `recipient_email`. Não há CC. TLS é obrigatório: STARTTLS por padrão, ou TLS direto com `SMTP_SSL=true`.

O registro e PDF são confirmados antes do envio. Status e timestamps de cada destinatário são independentes (`PENDING`, `SENT`, `FAILED`). Ausência de configuração SMTP resulta em `FAILED`, nunca em falso sucesso. O painel consulta novamente enquanto há envios pendentes.

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
| Backend | `DATABASE_URL` | Conexão PostgreSQL; aceita URL do Render |
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

Consulte [validação](docs/validation.md) para resultados e limites da execução local. Dependências Python fixadas em `requirements.lock.txt`; frontend em `package-lock.json`.

## Vercel e Render

Vercel: importe o repositório, **Root Directory `frontend`**, framework Next.js. Configure `NEXT_PUBLIC_API_URL` com a URL HTTPS do Render e gere novo build.

Render: Blueprint `render.yaml` cria backend e PostgreSQL. **Root Directory `backend`**. Build `pip install -r requirements.lock.txt`; pre-deploy `alembic upgrade head`; start `uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1 --no-access-log`. Configure SMTP e `ALLOWED_ORIGINS` com a origem Vercel exata. O Blueprint utiliza planos pagos; confira-os antes de aplicar. Nenhum serviço de nuvem é provisionado automaticamente pelo código.

Execute `python -m app.cli create-admin` no ambiente do backend. Faça smoke test com dados fictícios, confirme dois recebimentos reais em homologação e valide o PDF antes de uso institucional. Deploy é preparação de infraestrutura, não substitui homologação.

Referências técnicas: [Next.js](https://nextjs.org/docs/app/getting-started/installation), [FastAPI — autenticação](https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/), [Vercel — monorepos](https://vercel.com/docs/monorepos), [Render — FastAPI](https://render.com/docs/deploy-fastapi).

## GitHub

Repositório: https://github.com/renanvsantos3-jpg/bo-online-24bpm. Branch principal `main`, remote `origin`. Commits usam Conventional Commits. Não sobrescrever histórico remoto com force push. Antes de enviar: testes, build, migrations, revisão de `git status` e conferência de ausência de dados reais.

```sh
git push origin main
```

Autenticação GitHub deve ser fornecida pelo Git/credential manager do ambiente, nunca por token salvo no projeto. Pendências institucionais: [open_questions.md](docs/open_questions.md).

## Integração RTK / Codex

`rtk init --codex` foi aplicado ao projeto por solicitação do usuário. Criou `RTK.md`, uma referência em `AGENTS.md` e `.codex/hooks.json`. O RTK precisa estar instalado e disponível no PATH. Reinicie o Codex e aprove a confiança no hook quando solicitado. A configuração não modifica permissões de sandbox nem habilita histórico global automaticamente.
