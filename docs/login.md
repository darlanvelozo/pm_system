# Administrador e usuários

O login usa **nome de usuário e senha**, sem preenchimento automático. Nome completo é a identificação real da pessoa; nome de usuário é o login único, normalizado em minúsculas, com 3 a 64 caracteres.

Para a primeira inicialização, configure no Render `SINGLE_USER_MODE=true` e `SINGLE_USER_PASSWORD` como segredo. Isso cria `24bpmcoroata` somente quando ainda não existe administrador ativo nem essa conta. Apesar do nome legado, a variável não restringe o sistema a um usuário. Reinícios não alteram nome, senha ou perfil de contas existentes. Após criar o administrador, pode mudar `SINGLE_USER_MODE=false`; a conta permanece no banco.

Em **Administração → Usuários**, o administrador cria e edita nome completo, login, perfil e situação, além de redefinir senha. Senha em branco na edição mantém a atual; novas senhas administrativas exigem pelo menos 12 caracteres. O sistema impede desativar/rebaixar o último administrador ativo. Operadores acessam os próprios boletins; administradores acessam todos. Não há cadastro público.

Edite “Administrador inicial” para o nome real do responsável. Boletins, PDF e auditoria mostram **Nome completo (login)**. A identificação capturada em eventos e emissões é preservada quando o usuário muda de nome posteriormente. Eventos antigos receberam o nome disponível na migração; não é possível reconstruir nomes históricos ausentes.

O administrador pode corrigir boletins emitidos, cancelar, remover logicamente e reenviar e-mails. Correções exigem motivo e confirmação, geram outro PDF e preservam a versão anterior. Não reenviam automaticamente. Cancelamento e remoção preservam histórico e não liberam o número para reutilização. Veja [boletins dinâmicos e revisões](dynamic-bulletins.md).

Alternativamente ao bootstrap, execute no backend `python -m app.cli create-admin` (Windows: `.\.venv\Scripts\python.exe -m app.cli create-admin`). O comando solicita os dados e a senha. Faça deploy do backend e frontend; o Start Command existente executa as migrations. As variáveis de e-mail são independentes do login; veja [Brevo](brevo.md).
