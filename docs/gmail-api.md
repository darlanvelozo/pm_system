# Gmail no Render Free

Este guia descreve a alternativa Gmail. O Blueprint agora utiliza Brevo, sem OAuth; siga [o guia Brevo](brevo.md) para a configuração atual.

## Branding do BoletimON

Após o deploy do frontend, configure no Google Auth Platform → Branding:

- Nome: `BoletimON` (BO Online 24º BPM).
- Página inicial: `https://bpm24online.vercel.app/sobre`.
- Política de Privacidade: `https://bpm24online.vercel.app/privacidade`.
- Termos de Uso: `https://bpm24online.vercel.app/termos`.
- Contato de suporte: `24bpmcoroata2@gmail.com`.

Essas páginas são públicas e também estão vinculadas na tela de entrada. Confirme que o deploy está concluído e revise o conteúdo com o responsável pelo sistema antes de submeter o branding. Publicar o app não equivale a obter verificação do Google. Se solicitado, comprove a propriedade do endereço no Search Console e siga os requisitos de domínio apresentados no painel.

A conta usada na autorização OAuth deve corresponder ao remetente. Se autorizar `24bpmcoroata2@gmail.com`, adicione essa conta como testadora e use `GMAIL_FROM=24bpmcoroata2@gmail.com`. O endereço `BATTALION_EMAIL` é o destinatário da cópia, independente do remetente.

O backend suporta `EMAIL_PROVIDER=gmail_api`: envia o mesmo PDF por HTTPS pela API oficial do Gmail, com autorização OAuth da conta remetente. SMTP continua disponível para outros ambientes. Nenhum teste envia mensagens reais.

## Autorizar a conta do batalhão

1. Acesse https://console.cloud.google.com/ e crie ou selecione um projeto. Em APIs e serviços, ative **Gmail API**.
2. Configure o Google Auth Platform (tela de consentimento OAuth), com nome e contato do responsável. Para uma conta pessoal Gmail, escolha público externo. Durante testes, inclua `boletimonline24bpm@gmail.com` como usuário de teste.
3. Crie um cliente OAuth do tipo **Aplicativo da Web**. Adicione exatamente `https://developers.google.com/oauthplayground` em URIs de redirecionamento autorizados.
4. Abra https://developers.google.com/oauthplayground . Na engrenagem, marque **Use your own OAuth credentials** e informe o Client ID e Client Secret criados. Use acesso offline.
5. No campo de escopo, use somente `https://www.googleapis.com/auth/gmail.send`. Clique em **Authorize APIs** e autorize usando a conta do batalhão.
6. Clique em **Exchange authorization code for tokens**. Guarde o refresh token diretamente nos segredos do Render. Não compartilhe tokens no chat, em screenshots ou no Git.

Em modo externo **Testing**, o refresh token para esse escopo normalmente expira em sete dias. Para uso contínuo, publique a tela de consentimento em **Production** antes de gerar o token definitivo; siga os requisitos de verificação que o Google apresentar. Não contorne bloqueios de autorização. O acesso também pode ser revogado pela conta; nesse caso, será necessário autorizar novamente.

## Render → backend → Environment

| Variável | Valor |
|---|---|
| `EMAIL_PROVIDER` | `gmail_api` |
| `GMAIL_FROM` | `boletimonline24bpm@gmail.com` |
| `GMAIL_CLIENT_ID` | Client ID do cliente OAuth |
| `GMAIL_CLIENT_SECRET` | Client Secret do mesmo cliente |
| `GMAIL_REFRESH_TOKEN` | Refresh token autorizado pela conta do batalhão |

Mantenha `DATABASE_URL`, `JWT_SECRET`, `ALLOWED_ORIGINS` e `BATTALION_EMAIL`. As variáveis SMTP não são utilizadas nesse modo. Senha de app não substitui as credenciais OAuth.

Para um serviço já existente, selecione a instância **Free** no painel, remova o Pre-Deploy Command e configure Start Command:

```sh
alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1 --no-access-log
```

O Blueprint já contém esses valores. Salve e faça redeploy. As migrations executam antes de iniciar a API; se falharem, a API não inicia. Esta configuração pressupõe uma única instância.

O Render Free suspende serviços ociosos e tem cotas de execução; o primeiro acesso pode demorar. A API do Gmail continua sujeita às cotas e limites de envio da conta. Emita um boletim fictício para validar a entrega aos dois destinos após configurar as credenciais. Falhas de autenticação, limites ou rede mantêm o PDF salvo e o envio como FAILED; não há tentativa automática por SMTP.

Referências: [envio e anexos Gmail](https://developers.google.com/workspace/gmail/api/guides/sending), [OAuth e renovação](https://developers.google.com/identity/protocols/oauth2/web-server), [expiração dos tokens](https://developers.google.com/identity/protocols/oauth2#expiration), [limitações Render Free](https://render.com/docs/free).
