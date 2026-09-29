# Administrador e usuarios

O administrador inicial continua sendo `24bpmcoroata`. Mantenha `SINGLE_USER_MODE=true` e `SINGLE_USER_PASSWORD` no Render: por compatibilidade, essas variaveis agora controlam somente a criacao automatica desse administrador; nao bloqueiam outras contas.

Em **Administracao > Usuarios**, o administrador cadastra nome, usuario, senha inicial (minimo 12 caracteres) e perfil. Operadores consultam seus proprios boletins; administradores consultam todos. O administrador pode ativar ou desativar outras contas. O login aceita o usuario cadastrado e nao exige e-mail.

Em cada boletim, **Registrado por** mostra o nome e o usuario responsavel. Novos PDFs incluem essa identificacao no rodape. PDFs antigos permanecem como foram emitidos; seus autores continuam identificados no sistema.

Nos detalhes, o administrador pode **Cancelar boletim**, informando o motivo e confirmando. Isso funciona para rascunhos e emitidos. O registro, PDF armazenado e auditoria sao preservados; edicao, download e reenvio ficam bloqueados. Cancelamento nao recolhe e-mails ja entregues. Nao ha exclusao definitiva nem reutilizacao do numero do boletim.

Faca deploy do backend e frontend. O Start Command existente executa a migration antes de iniciar o servidor. As variaveis de e-mail permanecem independentes das contas de acesso.
