# Banco online gratuito

## Escolha para este projeto

Usar **Neon Free**, mantendo PostgreSQL, SQLAlchemy, Psycopg 3 e Alembic. MongoDB Atlas é uma opção gratuita de banco documental, mas sua URL não é compatível com esta aplicação relacional. Adotá-lo exigiria uma migração de código e dados, incluindo os locks usados no reenvio. O requisito de banco online gratuito pode ser atendido sem essa reescrita.

Consulta aos fornecedores em 28/09/2026:

| Provedor | Camada gratuita | Compatibilidade |
|---|---|---|
| Neon | PostgreSQL, 0,5 GB de armazenamento por projeto; limites de processamento e transferência | Compatível com o backend atual |
| Supabase | PostgreSQL, 500 MB de banco; pausa após uma semana inativo | Alternativa compatível; exige selecionar conexão adequada ao ambiente |
| MongoDB Atlas | Cluster gratuito com 512 MB | Exige reescrever persistência e migrations |

Fontes: [Neon](https://neon.com/pricing), [Supabase](https://supabase.com/pricing), [MongoDB Atlas](https://www.mongodb.com/docs/atlas/manage-clusters/). As cotas podem mudar; confira o painel antes de criar o projeto.

## Configurar Neon e Render

1. Acesse [Neon](https://neon.com/) e crie uma conta/projeto no plano **Free**. Escolha PostgreSQL 17 e uma região próxima ao serviço Render, entre as disponíveis.
2. No painel do projeto, abra **Connect**. Selecione a branch, banco e usuário da aplicação. Para esta configuração inicial de um worker, use a conexão **direta**, desativando a opção de pooling: a mesma URL é usada pelo servidor e pelo Alembic.
3. Copie somente a URL de conexão PostgreSQL. Não copie o prefixo `psql`, aspas externas ou uma URL JDBC.
4. No serviço web do Render, abra **Environment** e defina `DATABASE_URL` com essa URL. Preserve `sslmode=require` e `channel_binding=require` quando fornecidos pelo painel. Não coloque essa credencial no GitHub, Vercel ou conversa.
5. Faça o deploy. O comando de pre-deploy `alembic upgrade head` cria/atualiza as tabelas no banco escolhido.
6. Para um banco novo, execute no shell do backend `python -m app.cli create-admin` e cadastre o primeiro administrador.
7. Faça login, emita um boletim fictício, confirme o download e consulte novamente após reiniciar o serviço. O health check sozinho não comprova persistência.

Exemplo **fictício**, que precisa ser substituído pela conexão real:

```dotenv
DATABASE_URL=postgresql://USUARIO:SENHA@ep-exemplo.REGIAO.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

O código converte o prefixo para `postgresql+psycopg://` sem remover senha codificada ou parâmetros de conexão. `pool_pre_ping=True` verifica conexões reutilizadas após suspensão do banco, conforme a [orientação SQLAlchemy do Neon](https://neon.com/docs/guides/sqlalchemy). Não desative TLS para resolver erro de conexão.

Nenhuma variável nova é necessária na Vercel: mantenha apenas `NEXT_PUBLIC_API_URL` apontando para o backend. Não são necessárias chaves de API Neon, MongoDB ou Supabase para esta integração PostgreSQL.

## Se já existir um banco com registros

Alterar `DATABASE_URL` não transfere dados: `alembic upgrade head` cria o schema, mas não copia usuários, boletins, PDFs ou auditoria. Planeje uma janela sem gravações, faça backup do banco de origem e restaure no Neon usando ferramentas PostgreSQL compatíveis. Valide contagens, login e download dos PDFs antes de mudar a aplicação para o novo banco. Preserve o banco anterior até confirmar a restauração.

Remover o recurso de banco do `render.yaml` não deve ser tratado como exclusão nem como cancelamento de cobrança de um banco já criado. Confira separadamente os recursos existentes no painel Render. Este ajuste não exclui bancos existentes e não transfere dados automaticamente.

## Limites e custo restante

O Neon Free não é um teste temporário, mas está sujeito às cotas: a documentação consultada informa 0,5 GB por projeto, 100 CU-hours de processamento e 5 GB de transferência por período mensal. Esgotar processamento/transferência pode suspender o serviço até renovar a cota; exceder armazenamento bloqueia gravações. Confirme os limites atuais no [plano oficial](https://neon.com/pricing).

Os PDFs ficam em `pdf_files` dentro do PostgreSQL e competem com boletins, índices e auditoria pelo espaço. Monitore armazenamento no painel e estabeleça backup externo testado. Não há um número fixo garantido de boletins: o tamanho do PDF depende do conteúdo. Não remova documentos para liberar espaço sem uma regra institucional de retenção.

O banco e o backend podem usar os planos gratuitos dentro de suas cotas. O Blueprint usa Render Free com migrations na inicializacao e API do Gmail via HTTPS. Configure a autorizacao OAuth conforme [Gmail no Render Free](gmail-api.md); SMTP nao funciona nesse plano.
