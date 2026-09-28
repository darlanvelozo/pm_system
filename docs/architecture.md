# Arquitetura e referências

Monorepo: Next.js/React/TypeScript em frontend; FastAPI/Pydantic/SQLAlchemy/Alembic/ReportLab em backend. Comunicação exclusiva HTTP, PostgreSQL acessível somente pelo backend. UUID nas entidades; envolvidos e efetivo em relacionamentos. Número manual único, sem regra institucional inventada.

Hospedagem do banco: Neon Free (PostgreSQL externo), configurado por `DATABASE_URL`. O Blueprint Render provisiona apenas o serviço web; não cria PostgreSQL pago. Ver [configuração e limites](free-database.md).

## Análise dos modelos oficiais

Analisadas visualmente todas as quatro páginas dos dois PDFs locais fornecidos. Nenhum conteúdo pessoal foi incorporado à documentação ou aos testes. Ambos medem aproximadamente A4 (596 × 842 pontos), com grade preta fina, cabeçalhos cinza, bandeira à esquerda, identificação PMMA e emblema à direita. Dados de ocorrência e endereço antecedem os envolvidos.

BO 02: A e B na primeira página, cada um com classificação, identificação, características, lesão, vestimentas, locomoção, arma de fogo, droga, veículo e arma branca. Segunda página: histórico, material, duas linhas de efetivo e entrega.

BO 04: A, B e C na primeira página; D continua na segunda. Inclui observação individual, sem os extras do BO 02. Na segunda página também aparecem histórico, material, efetivo e entrega. Evitamos cabeçalho de envolvido órfão na quebra. Textos extensos expandem os blocos e criam páginas adicionais, sem truncar.

Formulários Google indisponíveis na consulta inicial; os PDFs oficiais e o pedido são as referências usadas. Os PDFs originais e renderizações ficam ignorados pelo Git.

## Decisões técnicas

Autenticação JWT curta em memória no navegador, hash Argon2, sem cadastro público. Usuário inativo bloqueado mesmo com token válido. Operador consulta e baixa apenas seus boletins; administrador consulta todos, gerencia usuários, consulta auditoria e reenvia. Esta política conservadora aguarda confirmação institucional.

Boletim emitido é imutável. PUT edita somente rascunhos persistidos. Emissão explícita valida novamente, gera PDF e grava conteúdo binário no PostgreSQL na mesma transação dos metadados. StorageService permite trocar o armazenamento sem mudar a API. E-mail é processado após commit; falhas não removem boletim. PENDING é persistido e pode ser recuperado por comando de manutenção. SMTP não oferece exatamente-uma-vez; uma queda após aceitação e antes do commit pode causar entrega repetida ao recuperar.

Rate limit básico em memória por IP (um worker); configure proteção distribuída no proxy antes de escalar. API rejeita payload acima de 256 KiB sem registrar conteúdo. Logs de auditoria guardam identificadores e resultado, nunca narrativa ou documentos pessoais.
