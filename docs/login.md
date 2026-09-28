# Login por usuário

O acesso aceita um nome de usuário, como `24bpmcoroata`, sem exigir e-mail. Novos nomes usam de 3 a 64 caracteres: letras, números, ponto, hífen ou sublinhado. Maiúsculas e minúsculas são equivalentes. Contas anteriores continuam aceitando o e-mail como identificador.

O e-mail padrão de envio e recebimento é independente das contas de acesso. As variáveis configuradas no Render não são alteradas pelo cadastro de usuários.

O deploy deve executar `alembic upgrade head` antes de iniciar o backend, para adicionar o campo username e preservar os cadastros existentes.

Para cadastrar o primeiro administrador, configure localmente o backend para o banco utilizado pelo Render e execute dentro de backend:

```powershell
.\.venv\Scripts\python.exe -m app.cli create-admin
```

Informe o usuário, nome e uma senha de pelo menos 12 caracteres. A senha é solicitada sem exibição. Nenhuma conta ou senha padrão é criada pela migration. Outros usuários podem ser cadastrados no painel administrativo.
