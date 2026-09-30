# Validação — GERADOR e Relatórios Analíticos — 30/09/2026

## Estado inicial

A branch `main` iniciou limpa, em `4c3fc3f`, sincronizada com `origin` após fetch. Foi mantido o repositório `renanvsantos3-jpg/bo-online-24bpm` e a arquitetura Next.js → FastAPI → PostgreSQL. Já existiam usuários, auditoria com snapshots, BOs dinâmicos, rascunhos, protocolos diários, idempotência, prévia, revisões, hash/QR, e-mail e PWA.

Faltavam GERADOR, relatórios com entidade/fluxo próprios, a substituição do rótulo do comandante e a aplicação do brasão oficial fornecido nesta etapa. Não se atribuiu falha de produção sem evidência.

## Fontes e implementação

PDF oficial analisado por texto e inspeção visual de ambas as páginas. Google Forms lido por HTTPS, sem submissão ou automatização de respostas. O [guia do módulo](analytical-reports.md) registra todas as perguntas, ordem, obrigatoriedade, opções, diferenças e matriz de permissões.

- GERADOR: login real, tela simplificada, rascunho próprio, prévia e emissão. Bloqueios FastAPI para listagem, emitidos, PDFs, versões, administração e relatórios. Recibo mínimo na emissão/retry. Proteção do último administrador ampliada.
- Relatórios: entidade própria, contador anual `N/AAAA`, snapshots, controle de versão, emissão idempotente e transacional, filtros, versões de PDF imutáveis, SHA-256, auditoria sem conteúdo pessoal, cancelamento e remoção lógica.
- Formulário: oito etapas, obrigatoriedade baseada no Forms, respostas explícitas SIM/NÃO, rascunho local separado e salvamento no servidor. Não foi criado catálogo artificial.
- PDF: ReportLab, tabela próxima ao modelo, brasão original e emblema PMMA existente. Uma página para o cenário curto e dez páginas para o cenário longo inspecionado. Marcadores finais do relato e das providências confirmados. Sem copiar assinatura; autoridade configurável e capturada na revisão.
- E-mail: transporte existente reutilizado, duas entregas independentes, metadados determinísticos e nome de anexo sanitizado. Revisões não são reenviadas automaticamente.
- BO: componente compartilhado atualizado para `Posto/Graduação/Nome Cmt`, layout `2026.4`. PDFs antigos não foram regravados.

## Problemas encontrados durante a validação

1. O detalhe do relatório podia carregar após o primeiro envio e permanecer com o segundo PENDING. Adicionada atualização periódica limitada e botão de atualização manual.
2. A tabela de relatórios aumentava a largura mínima do contêiner flex no desktop. Corrigido com `min-width: 0`, preservando rolagem dentro da tabela.
3. O PDF curto deixava a autoridade isolada na segunda página. Ajustados os espaços mínimos; texto longo continua expandindo em páginas adicionais.
4. Seletores iniciais dos novos testes não correspondiam aos nomes acessíveis dos controles de perfil e fechar prévia. Corrigidos os testes, sem remover as verificações de autorização.

## Evidências

Backend: **64 testes aprovados** no PostgreSQL local `bo_test`, incluindo toda a suíte anterior. Após ajustes de paginação, os 13 testes novos foram repetidos com sucesso. A identificação histórica foi conferida após renomear o criador. Os oito testes de GERADOR/rótulo também foram repetidos após ampliar a extração para perfis legados e PDF definitivo. Ruff e compileall aprovados.

Concorrência do relatório: seis emissões paralelas com seis números únicos; quatro requests com a mesma chave resultam em uma única emissão/revisão. Virada anual avaliada na fronteira UTC/America/Fortaleza. Falha de geração não consome sequência. Prévia não cria relatório, revisão, número ou e-mail.

PDFs de BO: extração confirma rótulo novo e ausência do antigo para 1, 2, 3, 4, 5, 8 e 12 envolvidos, nos perfis dinâmico e legados 02/04, e em documento definitivo. A suíte existente também mantém cenários com 30 envolvidos e revisões.

Frontend: **20 testes aprovados**, ESLint, TypeScript e build de produção aprovados. Após a correção de atualização de e-mail e largura, o build foi refeito com sucesso.

Navegador: **11 testes Playwright aprovados** no build final. ADMIN cria GERADOR pela interface, GERADOR autentica, preenche três envolvidos, abre prévia, emite e recebe 403 nas consultas proibidas. O relatório percorre prévia, duplo clique de emissão, download, revisão, versões, reenvio seletivo, cancelamento e remoção. Confirmados 320/360/375/390/412/768/1280 px sem transbordamento da listagem. Mantidos os fluxos anteriores de operador, 30 envolvidos, scroll, conflito de rascunho, PWA, atualização e cache seguro. O limitador real de login permanece ativo; os testes respeitam `Retry-After`.

Migrations: `20260930_reports` aplicada em banco local vazio, `alembic check`, downgrade para `20260929_protocol` e novo upgrade aprovados. Aplicada também em `bo_e2e`, já contendo BOs fictícios anteriores, com `alembic check` aprovado. O downgrade é bloqueado se houver relatórios. Nenhuma migration de teste foi executada no Neon de produção.

## Limites e homologação

Todos os registros e contas dos testes são fictícios. Provedores de e-mail simulados no pytest e SMTP desativado nos testes de navegador. Não houve envio real. PDF de referência, assinatura, tokens e arquivos `.env` não foram versionados.

Homologar apresentação institucional e impressão; confirmar a distinção entre município de emissão e da ocorrência, pois o Forms não possui campo separado para este último; configurar `REPORT_SIGNATORY_NAME`, `REPORT_SIGNATORY_RANK` e `REPORT_SIGNATORY_TITLE`; validar entrega real autorizada e instalação física Android/iOS. A UI não autentica automaticamente o administrador. O status público dos deploys não substitui homologação autenticada de produção.
