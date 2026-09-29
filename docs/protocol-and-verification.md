# Emissão automática, prévia e verificação

Novos rascunhos não exigem número. O backend atribui o protocolo na primeira emissão, no formato `AAAAMMDD-SEQUENCIAL`, usando a data de emissão no fuso `America/Fortaleza`. A sequência diária começa em 01, aceita 100 e seguintes e não depende da data da ocorrência. Números históricos não são alterados; revisão, cancelamento e remoção conservam o número original.

## Transação e concorrência

`BulletinSequence` usa chave diária e `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` em PostgreSQL. A reserva de número, PDF, revisão e mudança de status pertencem à mesma transação. A geração não consulta `MAX + 1`. A migration inicializa os contadores considerando números históricos compatíveis, inclusive registros cancelados/removidos, para não reutilizá-los.

`POST /api/bo/{id}/emit` recebe `{"version": 1}` e o header `Idempotency-Key` com UUID. A mesma chave na mesma operação retorna o boletim existente sem nova revisão, protocolo, PDF ou tarefa de e-mail. Outra chave não reemite um boletim já encerrado. Lock da linha protege a emissão do rascunho; lock transacional da chave também cobre criação/emissão conjunta. A versão otimista impede sobrescrita entre dispositivos.

Por compatibilidade, `POST /api/bo` e `PUT /api/bo/{id}` continuam aceitando `emit=true`, agora com `Idempotency-Key` obrigatório e a mesma proteção. A interface usa essa forma para salvar os dados revisados e emitir atomicamente. A chave fica separada por usuário/rascunho e é conservada em retries; não é um token de autenticação. Cliques simultâneos também são bloqueados na interface.

O envio só é agendado após o commit, com status independentes por destino. Retry HTTP não agenda envio novamente. Isso não constitui promessa de entrega exatamente uma vez pelo provedor: uma queda após aceitação do e-mail e antes de salvar `SENT` exige conferir o provedor antes de recuperar entregas pendentes.

## Prévia

Na revisão, “Visualizar prévia do PDF” chama `POST /api/bo/preview-pdf`, autenticado, com os dados validados do formulário. O retorno é `application/pdf`, `inline` e `no-store`, com “PRÉVIA — NÃO EMITIDO” e número “PENDENTE”. Não salva documento oficial, não consome sequência, não cria revisão e não envia e-mail. A prévia pode ser aberta em outra aba quando o navegador móvel não exibir o PDF incorporado.

## Hash, QR e verificação

O layout `2026.3` imprime versão e QR discreto. O QR contém somente URL do frontend, ID interno do boletim e versão; não contém nomes, documentos ou narrativa. A URL padrão usa o domínio atual. Em outro ambiente, configure no backend `FRONTEND_URL` com a origem do frontend (em produção, HTTPS).

O SHA-256 é calculado sobre os bytes finais e salvo em `BulletinRevision.pdf_sha256`; não é inserido dentro do próprio PDF. A migration calcula hashes de arquivos anteriores sem regravá-los. PDFs históricos não ganham QR retroativamente.

`/verificar/{id}?revision=N` exige login e conserva o destino durante a autenticação. A API aplica a mesma autorização do boletim. A tela mostra apenas protocolo, versão, estado, data e hash; calcula novamente o hash do arquivo armazenado para detectar divergência. Para verificar uma cópia recebida, compare o SHA-256 dessa cópia com o hash exibido. Consultar o QR sozinho não prova que um arquivo externo foi mantido intacto e não equivale a assinatura digital ICP-Brasil.

## Busca, estatísticas e rascunhos

A busca é feita no backend, com `q` (ou `search` legado), status, período da ocorrência, tipo, descrição breve, município, responsável (`created_by`) e versão (`revision`). Operadores continuam limitados aos próprios registros. “Meus rascunhos” aplica usuário atual e status DRAFT; mostra etapa, quantidade e última alteração.

Rascunhos locais continuam separados por usuário/registro e não substituem silenciosamente uma versão diferente do servidor. O servidor aceita rascunho incompleto sem número. Conflitos oferecem “Recarregar versão do servidor”; essa ação explícita substitui os campos locais. Não há mesclagem automática. Ao retornar a conexão, o usuário escolhe “Sincronizar rascunho”. Nenhuma mensagem afirma salvamento remoto durante uma falha de conexão.

Sugestões de ocorrência vêm dos próprios registros, mantêm texto livre e “Outro”; não são catálogo institucional aprovado. Reutilizar efetivo/unidade é ação explícita e usa somente o último registro acessível do próprio usuário. Não copia envolvidos, narrativa, material nem destinatário. Os botões informam quando substituem o conteúdo atual.

ADMIN dispõe de `/api/admin/stats` e relatório com filtros de período, estado e tipo: total, emitidos, rascunhos, cancelados, removidos, revisados, falhas e tipos mais registrados. Não retorna os campos pessoais de envolvidos.

## Migração e deploy

`20260929_protocol` permite número nulo, adiciona chave de emissão única, tabela de sequência e hash das revisões. Descrição breve e etapa usam o JSON existente. Não recria tabelas de produção nem renumera documentos. Downgrade com boletins é bloqueado para preservar histórico; reversão em banco vazio serve à CI.

Mantenha os comandos de Render e a variável pública da Vercel existentes. Após o deploy de ambos, atualize o aplicativo antes de emitir: versões antigas sem `Idempotency-Key` serão recusadas. O CORS agora permite esse header. Faça backup e confira logs da migration no ambiente operacional; testes locais não substituem essa conferência.
