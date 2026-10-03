# Relatórios Analíticos e perfis

O módulo é separado dos BOs e das estatísticas. Usa a mesma API FastAPI, conexão PostgreSQL, armazenamento transacional de PDFs e provedores Brevo/Gmail/SMTP. O frontend nunca conecta ao banco.

## Fontes analisadas em 30/09/2026

O PDF fornecido, de duas páginas, é a referência visual: cabeçalho institucional, tabela, relato, providências, local/data e autoridade. Foi inspecionado por extração de texto e imagens das duas páginas. Nenhum PDF oficial ou assinatura foi versionado. O brasão do 24º BPM fornecido pelo usuário é utilizado sem alteração, junto ao emblema da PMMA já existente. Não se reproduziu a marca comemorativa do PDF como se fosse um novo asset oficial.

O [Google Forms](https://docs.google.com/forms/d/e/1FAIpQLScOXN7WJ86MUZWGY2Mm8ZL4iLAjbSZa1k1scqr6m8V9k2WKqA/viewform) foi lido diretamente por HTTPS após a ferramenta de navegação não conseguir abri-lo. Apenas leitura: nenhuma resposta foi enviada. A estrutura pública permitiu identificar três seções: identificação, Dados da ocorrência e Descrição da ocorrência. Não foi encontrada ramificação condicional nas perguntas lidas.

| Ordem | Pergunta no Forms | Resposta | Obrigatória |
|---|---|---|---|
| 1 | Email | Texto curto | Sim |
| 2 | Número do Relatório | Texto curto | Sim, substituído por sequência automática |
| 3 | Código/Tipo de Ocorrência | Texto curto | Sim |
| 4 | Local | Texto curto | Sim |
| 5 | Data / hora | Data com hora | Sim |
| 6 | Vítima(s) | Parágrafo | Não |
| 7 | Envolvido(s) | Parágrafo | Não |
| 8 | Testemunhas(s) | Parágrafo | Não |
| 9 | Materiais apreendidos | Parágrafo | Não |
| 10 | Tipo de arma usada | Texto curto | Não |
| 11 | Outros (veículos, drogas, objetos) | Parágrafo | Não |
| 12 | Solução da ocorrência | Grade: EVADIU-SE, SAMU, ICRIM; SIM/NÃO em cada linha | Sim |
| 13 | Causa/Motivo | Parágrafo | Não |
| 14 | Viatura(s) e guarnições envolvidas | Parágrafo | Não |
| 15 | RELATO DA OCORRÊNCIA | Parágrafo | Sim |
| 16 | PROVIDÊNCIAS ADOTADAS | Parágrafo | Sim |

Diferenças: e-mail e obrigatoriedade aparecem no Forms; o PDF acrescenta local/data finais e autoridade. A aplicação substitui o número manual por `N/AAAA`, separa data e hora em controles acessíveis e distribui o formulário em oito etapas. Não foram inventados catálogos ou opções de armas/viaturas.

O campo LOCAL final do PDF é apresentado como **Local de emissão (município)**, opcional, sem endereço. O Forms não tem um município da ocorrência separado: a aplicação não o deduz do endereço. O filtro `city` e o município do assunto usam o local de emissão, claramente identificado na interface e no corpo do e-mail. Essa distinção deve ser homologada pela unidade; não se deve confundir município de emissão com município da ocorrência.

## Matriz de permissões

| Recurso | ADMIN (Administrador) | OPERADOR (Usuário comum) |
|---|---|---|
| Novo BO / prévia / emissão | Sim | Sim |
| Editar rascunho BO | Todos | Próprio |
| Consultar BOs / emitidos / baixar PDF | Todos | Próprios |
| Corrigir / cancelar / remover BO | Sim | Não |
| Versões e reenvio de BO | Sim | Não |
| Novo relatório / prévia / emissão | Sim | Sim |
| Consultar relatório / PDF | Todos | Próprios |
| Editar rascunho de relatório | Todos | Próprio |
| Corrigir / cancelar / remover / versões / reenviar relatório | Sim | Não |
| Usuários / auditoria / estatísticas / Configurações | Sim | Não |

O perfil GERADOR (“Usuário simples”) foi removido em 02/10/2026. A migration `20261002_two_roles` converte essas contas em Usuário comum (`OPERADOR`); a API rejeita `GERADOR` com 422 e qualquer valor de perfil desconhecido recebe 403.

ADMIN continua podendo editar nome real, login, perfil, senha e acesso. Não é permitido remover o próprio acesso administrativo ou desativar/rebaixar o último ADMIN ativo. O papel vem do banco em cada requisição, sem confiar no menu ou num papel armazenado no JWT.

## Dados e ciclo de vida

`analytical_reports` guarda dados estruturados, dono, número, controle otimista de versão, revisão vigente, estado e snapshots de identidade. `analytical_report_revisions` preserva dados, autoridade configurada, ator, motivo, layout, SHA-256 e chave de cada PDF. `analytical_report_sequences` mantém contador anual separado da sequência dos BOs.

Rascunhos e prévias não recebem número. Emissão utiliza America/Fortaleza, incremento `INSERT … ON CONFLICT … RETURNING` e transação única com PDF/revisão/status. A chave UUID em `Idempotency-Key`, protegida por lock transacional, faz um retry retornar o mesmo relatório. Falha de geração reverte o contador. Revisão, cancelamento e remoção mantêm o número; não há hard delete pelo painel.

O PDF é gerado no backend com ReportLab, a partir dos dados. Caixas crescem e quebram em páginas adicionais; não há limite de duas páginas nem redução de fonte para encaixar texto. PDFs anteriores não são alterados. Arquivos usam `analytical-reports/{id}/vN.pdf` no StorageService existente. SHA-256 confere bytes; não constitui assinatura digital.

O formulário mantém rascunho local em `bo24:report-draft:{user}:{id|new}`, separado do BO, e oferece salvamento no servidor. Conflitos devolvem 409 com recarga explícita. Logout limpa apenas as chaves do usuário. Os dados autenticados, PDFs e endpoints `/api/analytical-reports` não entram no cache do service worker.

## API

Base: `/api/analytical-reports`.

| Método | Caminho | Uso |
|---|---|---|
| POST / GET | Base | Criar rascunho / listar |
| GET / PUT | `/{id}` | Consultar / atualizar rascunho com `version` |
| POST | `/preview-pdf` | Prévia sem número, revisão ou envio |
| POST | `/{id}/emit` | Emitir com `version` e `Idempotency-Key` |
| GET | `/{id}/pdf` | PDF vigente |
| POST | `/{id}/revise` | ADMIN: dados, versão e motivo |
| GET | `/{id}/revisions` | ADMIN: histórico e hashes |
| GET | `/{id}/revisions/{version}/pdf` | ADMIN: PDF preservado |
| POST | `/{id}/resend-email` | ADMIN: `both`, `recipient` ou `battalion` |
| POST | `/{id}/cancel` / `/{id}/remove` | ADMIN: motivo obrigatório |

Listagem aceita `q`, `status`, `date_from`, `date_to`, `occurrence_type`, `city`, `created_by`, `page` e `size`. Não retorna pessoas, relato ou providências. Operadores sempre ficam limitados aos próprios registros, independentemente dos filtros.

## E-mail e auditoria

São duas mensagens independentes com o mesmo PDF, sem CC. O transporte atual é reutilizado, sem integração duplicada. Exemplo fictício:

```text
Assunto: Relatório Analítico 42/2026 | ROUBO | Cidade Fictícia

Prezados,

Segue em anexo o Relatório Analítico de Ocorrência nº 42/2026.
Tipo de ocorrência: ROUBO
Data/Hora: 30/09/2026 às 12:30:00
Local de emissão (município): Cidade Fictícia
Registrado por: Operador Fictício (operador.teste)
Versão: 1

O documento completo segue em anexo.
Mensagem gerada automaticamente pelo BO Online 24º BPM.
```

Não se copia vítima, envolvidos, testemunhas, endereço, relato ou providências para o corpo/assunto. Os campos livres usados como metadados exigem cuidado do operador; não há IA nem identificação infalível de dados pessoais em texto livre. O nome do anexo é sanitizado, por exemplo `RELATORIO_ANALITICO_42-2026_ROUBO_v1.pdf`.

Revisões ficam `NOT_SENT` até reenvio explícito. Falha de provedor preserva PDF e marca `FAILED`. A emissão é idempotente; entrega usa o processamento após commit já existente, sem prometer entrega externa exatamente uma vez em falhas entre o provedor e o commit do status. Um envio que permanecer PENDING após queda do processo requer avaliação operacional, como nos BOs existentes.

Eventos `ANALYTICAL_REPORT_*` guardam ator/snapshot, ação, documento, resultado e horário. Não contêm payload, narrativa, endereço ou pessoas. Ações administrativas preservam identidade e motivo no documento; o nome real e login são exibidos em vez de UUID.

## Render e migrations

A migration `20260930_reports`, posterior a `20260929_protocol`, cria três tabelas e adiciona vínculo opcional do relatório à auditoria. Não altera os BOs ou seus números. Downgrade com relatórios existentes é bloqueado, exigindo plano de restauração.

Preservar o Start Command:

```sh
alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1 --no-access-log
```

O administrador define o signatário em **Administração → Configurações** (ver [Configurações](settings.md)). As variáveis abaixo, no backend Render, são o valor padrão usado quando o campo da tela está vazio:

| Variável | Conteúdo |
|---|---|
| `REPORT_SIGNATORY_NAME` | Nome da autoridade |
| `REPORT_SIGNATORY_RANK` | Posto/graduação |
| `REPORT_SIGNATORY_TITLE` | Cargo/função |

Sem essas configurações o bloco permanece sem identificação de autoridade. Nenhum nome real nem assinatura manuscrita foi copiado do modelo. Cada nova versão captura a configuração vigente; mudanças posteriores não reescrevem PDFs antigos. Nenhuma nova variável é necessária no Vercel. Mantenha a configuração de banco, e-mail e CORS existente.
