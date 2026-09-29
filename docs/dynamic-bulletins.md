# Boletins dinâmicos e revisões

Um boletim começa com um envolvido A. “Adicionar envolvido” abre e focaliza a pessoa seguinte. Cada cartão mantém identificação estável, resumo, campos complementares e indicação de pendências. A remoção de pessoa preenchida exige confirmação; as restantes mantêm seus dados e recebem rótulos sequenciais A…Z, AA, AB etc. Não existe seletor de modelos nem limite de quatro pessoas. Os valores legados TWO_INVOLVED/FOUR_INVOLVED continuam aceitos para registros antigos, sem controlar a quantidade.

`people[]` é validado no frontend e backend, com mínimo de uma pessoa e sem máximo de contagem. Continuam os limites de tamanho de campos e de requisição; “sem limite de pessoas” não significa memória ou payload ilimitados. CPF é opcional, mas seus dígitos são validados quando informado. Efetivo também aceita adição de equipes.

## Rascunhos e concorrência

O rascunho local fica separado por usuário e boletim, expira após sete dias e não substitui uma versão mais recente do servidor. Sair explicitamente limpa os rascunhos daquele usuário. Não há JWT no armazenamento local. O salvamento no servidor aceita rascunho sem número; emissão exige o preenchimento completo. Em outro dispositivo, abra o rascunho na listagem. A API exige a versão atual para salvar/corrigir: conflito retorna 409, preservando o rascunho local para conferência.

## PDF

`backend/app/pdf/layout.py` centraliza o layout `2026.3`, derivado dos dois modelos oficiais examinados localmente. Para até duas pessoas, mantém os blocos detalhados. Para mais pessoas, omite somente blocos complementares vazios; qualquer informação complementar preenchida continua sendo impressa. Modelos de compatibilidade delegam ao mesmo mecanismo.

ReportLab calcula as páginas conforme o conteúdo, mantém a identificação da pessoa junto ao bloco quando cabe e divide blocos grandes entre linhas. Histórico e material extensos continuam em páginas adicionais. Efetivo e entrega permanecem no final. Cabeçalho de continuação identifica o BO; rodapé mostra página e registrador pelo nome e login. Não se alteram bytes de PDF emitido: toda correção gera um documento novo.

## Correção, cancelamento e remoção

Somente ADMIN corrige um boletim emitido. Após editar os dados, deve informar motivo e confirmar. A operação mantém ID/número, verifica concorrência e grava `BulletinRevision`: versão, data, autor e identidade capturada, motivo, dados, quantidade, versão do layout e chave do PDF. O documento anterior continua disponível em “Histórico de versões”. O novo PDF fica como “Não enviado”; reenvio exige ação explícita.

Cancelar exige motivo e preserva registro, PDF e auditoria. Remover também exige motivo e é exclusão lógica (`REMOVED`), com autor e data: não executa DELETE do boletim. Removidos ficam fora da listagem padrão e inacessíveis ao operador; ADMIN encontra pelo filtro de status e consulta versões. O número nunca é reutilizado.

Auditoria e ciclo de vida usam nomes capturados no evento. A identificação do registrador é capturada na primeira emissão, conservada nas correções. UUIDs são chaves internas, nunca a identificação visual da pessoa.

## Migrations e operação

- `20260929_identity`: identidade capturada na auditoria; eventos antigos recebem o nome conhecido na migração.
- `20260929_revisions`: revisões, identificação do registrador, alteração e remoção. PDFs existentes viram versão 1 com layout `legacy`, conservando exatamente os mesmos bytes/chaves. O motivo identifica a limitação histórica da migração.

O Start Command existente executa `alembic upgrade head` antes de iniciar a API. Faça backup antes de migrar dados institucionais. Downgrade dessa migração é permitido apenas em banco sem boletins; banco com registros requer plano de exportação/restauração para não apagar o histórico.

## Homologação institucional

Os dois PDFs oficiais não são versionados. Não foi fornecido modelo oficial de cinco ou mais envolvidos: a continuação dinâmica precisa de aprovação do batalhão, incluindo numeração, agrupamento e campos complementares. Validar impressão física, assinatura, legibilidade do emblema original e envio real aos dois destinos em ambiente autorizado. Testes de desenvolvimento usam somente dados fictícios e não enviam mensagens reais.

A numeração manual foi substituída pela [emissão automática e idempotente](protocol-and-verification.md). Prévias não recebem protocolo. PDFs definitivos novos incluem versão e QR autenticado; cada revisão armazena SHA-256.
