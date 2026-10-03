# Deploy em VPS com Cloudflare Quick Tunnel

Implantação gratuita sem domínio próprio: Docker Compose na VPS e link público `https://*.trycloudflare.com` com HTTPS do Cloudflare. A VPS não expõe portas; o túnel faz apenas conexões de saída.

## Componentes (`deploy/`)

| Serviço | Função |
|---|---|
| `postgres` | PostgreSQL 17, volume `bo24_pgdata`, sem porta publicada |
| `api` | FastAPI; aplica `alembic upgrade head` ao iniciar; `ENVIRONMENT=production` |
| `web` | Next.js em produção, com a API no mesmo domínio (`NEXT_PUBLIC_API_URL=/`) |
| `caddy` | Proxy: `/api/*` e `/health` vão para a API, o resto para o frontend; repassa `CF-Connecting-IP` como IP do cliente (limite de login por usuário). Local em `127.0.0.1:8088` |
| `tunnel` | `cloudflared` Quick Tunnel; métricas em `127.0.0.1:20241/quicktunnel` |

## Link público

O endereço do Quick Tunnel muda quando o contêiner `tunnel` reinicia (por exemplo, após reiniciar a VPS). O timer `bo24-sync-url.timer` roda `deploy/sync-url.sh` a cada minuto: detecta o novo endereço, atualiza `PUBLIC_URL` em `deploy/.env` (QR code e origem permitida) e recria a API. O link atual fica em `deploy/public-url.txt`:

```sh
cat /opt/bo24/deploy/public-url.txt
```

PDFs emitidos antes de uma troca de endereço mantêm o QR antigo. Para endereço fixo, use um domínio no Cloudflare com túnel nomeado.

## Operação

```sh
cd /opt/bo24/deploy
docker compose ps                 # situação
docker compose logs -f api        # logs da API
docker compose up -d --build      # aplicar nova versão do código
docker compose exec api python -m app.cli retry-pending   # reenviar e-mails pendentes
```

Atualizar o código a partir do computador de desenvolvimento:

```sh
rsync -az --delete --exclude-from=.dockerignore ./ root@SUA-VPS:/opt/bo24/
ssh root@SUA-VPS 'cd /opt/bo24/deploy && docker compose up -d --build'
```

`deploy/.env` (permissão 600) guarda segredos e não é enviado pelo rsync (`.dockerignore` exclui `.env`). Modelo em `deploy/.env.example`. Para habilitar e-mail, preencha `BREVO_API_KEY` e `BREVO_FROM` (ou SMTP) e rode `docker compose up -d api`.

## Backup

`deploy/backup.sh` roda diariamente às 03:30 (crontab do root) e mantém os 14 dumps mais recentes em `deploy/backups/`. Restaurar:

```sh
gunzip -c backups/bo-AAAAMMDD-HHMM.sql.gz | docker compose exec -T postgres psql -U bo -d bo
```

Copie os backups para fora da VPS periodicamente.
