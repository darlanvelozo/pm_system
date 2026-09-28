# Operação e homologação

## Antes do uso real

Validar perfis, numeração manual, layout e conteúdo com responsáveis institucionais. Confirmar endereço do batalhão no ambiente. Configurar SMTP, domínio HTTPS e origens CORS. Criar primeiro administrador por CLI; não publicar senha em scripts.

Testar emissão de ambos os modelos em banco de homologação com dados fictícios. Conferir acentos, quebras, campos opcionais, narrativa extensa e anexos. Verificar separadamente a entrega aos dois destinatários. A suíte automática usa mocks, portanto não comprova entregabilidade do provedor real.

## Banco e arquivos

O PDF está no PostgreSQL (`pdf_files`), junto dos metadados e relacionamentos do boletim. Backup do banco inclui PDFs. Restringir credenciais e acesso de rede, habilitar backups e ensaiar restauração em ambiente isolado. `pg_dump` e restauração devem usar cofre/ambiente, sem senha em linha de comando versionada.

Sem exclusão ou alteração de boletins emitidos. Definir institucionalmente fluxo de retificação, retenção e eventual descarte antes de implementá-los. Rascunhos de navegador expiram para recuperação em sete dias; limpeza explícita ocorre na saída e emissão.

## Falhas

- `FAILED` no e-mail: conferir credenciais, TLS, remetente autorizado, bloqueios de rede e limites do provedor. Administrador reenvia o mesmo documento.
- `PENDING` após reinicialização: executar `python -m app.cli retry-pending`. Locks de linha evitam processamento simultâneo do mesmo destino. Há janela de duplicação SMTP após aceitação remota e falha antes do commit.
- Erro de PDF durante emissão: transação não é confirmada; revisar os dados e tentar novamente.
- Conflito 409 de número: consultar se o BO já existe antes de tentar nova emissão. Nunca inventar um novo número para resolver uma falha de e-mail.
- Banco indisponível: restaurar conectividade antes de repetir operações; verificar existência do registro se houve timeout de resposta.

## Observabilidade

Auditoria acessível apenas ao ADMIN, paginada. Eventos incluem login, criação/edição, PDF gerado/baixado, entrega por destino, reenvio e gestão de usuários. Não contém nomes dos envolvidos, endereços, documentos ou histórico. A infraestrutura não deve registrar corpos ou cabeçalhos Authorization. Não usar ferramentas de analytics que capturem formulários.

`/health` é liveness do processo. Monitorar separadamente conexão PostgreSQL e pendências SMTP. Ao escalar, substituir rate limiting em memória por mecanismo compartilhado e mover execução de e-mail para worker durável. O banco preserva os destinos pendentes entre reinicializações.

## Atualizações

Validar locks de dependências em homologação. Aplicar migrations antes de iniciar nova versão. Fazer backup antes de alterações de schema. `alembic downgrade base` e pytest são destrutivos no banco apontado: executar apenas nos bancos descartáveis de testes.
