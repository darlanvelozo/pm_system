# Validação de protocolos, prévia e integridade — 29/09/2026

## Base preservada

A main iniciou limpa, sincronizada com origin e em `fa8c965`. Já funcionavam usuários, nomes históricos, envolvidos dinâmicos, revisões, cancelamento/remoção lógica, PDF paginado e PWA. Não foram duplicados modelos nem recriada a aplicação.

As lacunas desta etapa eram número manual obrigatório, falta de idempotência, prévia, hash/QR, filtros detalhados, relatório agregado e retomada de conflito na interface. O scroll anterior focalizava um input no centro em vez do cabeçalho. A tela de usuários foi preservada; ampliou-se a validação de desativação/reativação e login.

## Evidências

- Sequência: primeiro, segundo, décimo, centésimo, novo dia e conversão UTC → America/Fortaleza.
- Concorrência real em PostgreSQL: oito emissões simultâneas recebem oito protocolos diferentes; quatro requisições concorrentes com a mesma chave criam apenas um boletim/revisão adicionais.
- Retry do mesmo rascunho: mesmo ID, protocolo e revisão; apenas as duas entregas originais. Outra chave não reemite um boletim já emitido.
- Falha proposital do gerador: rollback de boletim, contador e revisão, sem consumir número.
- Prévia: PDF válido, marca PRÉVIA/PENDENTE, sem protocolo, revisão ou envio.
- SHA-256: comparação com os bytes baixados, inclusive antes/depois de corrigir um boletim; número preservado e hash diferente entre versões.
- QR: o valor enviado ao codificador contém somente URL, ID do boletim e versão. Endpoint exige autenticação e autorização; outro operador recebe 404.
- Integridade legada: 15 revisões do banco local conferidas com os bytes armazenados; seis protocolos históricos não automáticos mantidos.
- E-mail: assunto estruturado, revisão, anexo sanitizado, corpo determinístico e ausência de narrativa/endereço completo/documentos dos envolvidos. Provedores sempre simulados ou desativados.
- Busca e relatórios: filtros no servidor, autorização de operadores, estatísticas restritas a ADMIN, reutilização operacional restrita ao próprio usuário.
- Envolvidos/PDF: preservados os testes de 1, 2, 3, 4, 5, 8, 12 e 30 pessoas, além de 2 → 7 → 3 e 8 → 3. Trinta não é um limite.
- Browser: cadastro → logout → login do novo operador; revisão/cancelamento/remoção; PWA/cache/offline/update; 30 envolvidos no celular; prévia/clique duplo/verificação; scroll em 390/1280 px; conflito entre dispositivos com recarga explícita. Painel também validado em 320/360/375/390/412/768 px.

## Execução

Backend: pytest em PostgreSQL local descartável, Ruff, compileall e Alembic. A migration `20260929_protocol` foi aplicada em banco com registros fictícios existentes; `alembic check` não encontrou divergência. Em outro banco vazio, upgrade/check/downgrade/upgrade aprovados. Nenhum teste foi executado contra Neon de produção.

Frontend: ESLint, geração de tipos/TypeScript, 17 testes Vitest e build Next.js 16.3.6 aprovados. A rota de verificação é dinâmica; manifest e ícones continuam públicos. O service worker mantém a lista exclusiva de recursos públicos e não cacheia API/PDF/verificação autenticada.

Resultado final local: **51 testes backend aprovados em PostgreSQL e 9 testes E2E aprovados**, além dos 17 testes Vitest, lint, tipos e build mencionados acima. A inspeção visual do PDF revisado com sete envolvidos confirmou os registros, a identificação do registrador, versão e QR sem sobreposição. Os estados dos deploys são registrados no relatório da entrega.

Os testes de navegador usam o banco `bo_e2e`, conta fictícia do script `backend/tests/seed_e2e.py`, backend local na porta 8000 e frontend na 3000. Nunca aponte essa suíte para produção. A primeira execução conjunta atingiu o limite real de logins. O helper agora respeita `Retry-After` e tenta novamente uma única vez; o limitador de produção não foi alterado. A suíte completa passou com essa espera.

## Limites

O hash armazenado não é assinatura digital. O QR não comprova sozinho a integridade de uma cópia externa: compare o hash do arquivo recebido com o exibido. Campos livres continuam exigindo cuidado do operador para não inserir dados pessoais em tipo/descrição. A consulta automática de deploy é separada da homologação institucional e não cria ocorrências nem envia e-mails reais em produção.

Homologar layout para 5+ pessoas, catálogo oficial de ocorrências, formato institucional de protocolo, impressão/QR e instalação real em Android/iOS. Referências: [operação](protocol-and-verification.md), [e-mails](email-summary.md), [pendências institucionais](open_questions.md).
