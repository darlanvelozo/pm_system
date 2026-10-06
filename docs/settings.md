# Configurações (somente ADMIN)

Página **Administração → Configurações**. Permite ao administrador ajustar parâmetros de gestão sem novo deploy. Usuário comum não vê o item no menu e a API responde 403.

## Como os valores são resolvidos

Os valores ficam numa única linha da tabela `system_settings` (migrations `20261002_settings` e `20261006_signature_footer`). Para cada campo, `effective_settings(db)` (em `backend/app/services/system_settings.py`) usa o valor do banco; se estiver vazio ou nulo, usa a variável de ambiente. Sem nenhuma edição, a saída é idêntica à anterior. A tela mostra “Usando valor padrão do servidor” quando o campo está vazio e o botão “Usar padrão” apaga o valor personalizado.

| Campo | Padrão (variável de ambiente → valor) | Onde é usado |
|---|---|---|
| Nome da unidade | `UNIT_NAME` → 24º Batalhão de Polícia Militar | Rodapé do Relatório Analítico (“Nome · Município/UF”) |
| Nome abreviado | `UNIT_SHORT_NAME` → 24º BPM | Rodapé do BO (“24º BPM • Página N”), autor dos PDFs, assinatura dos e-mails de BO (“…BO Online 24º BPM / Atenciosamente, 24º BPM”) e de relatório, e-mail de teste |
| Município/UF | `UNIT_CITY` → Coroatá/MA | Rodapé do Relatório Analítico |
| Endereço do rodapé, Contato do rodapé | `UNIT_FOOTER_ADDRESS`, `UNIT_FOOTER_CONTACT` → vazios | Rodapé do Relatório Analítico no modelo do batalhão: traço e até duas linhas centralizadas em cinza, em todas as páginas. Com os dois vazios, o rodapé continua “Nome · Município/UF”. Até 200 caracteres, uma linha |
| E-mail do batalhão | `BATTALION_EMAIL` → boletimonline24bpm@gmail.com | Cópia institucional de todo BO e Relatório Analítico (envio e reenvio) |
| E-mail para respostas | `BREVO_REPLY_TO` → 24bpmcoroata2@gmail.com | Reply-To. Valor da tela vale para Brevo, SMTP e Gmail API; o padrão do ambiente continua só no Brevo, como antes |
| Posto/graduação, Nome, Cargo do signatário | `REPORT_SIGNATORY_RANK`, `_NAME`, `_TITLE` → vazios | Bloco de assinatura do Relatório Analítico |
| Assinatura digitalizada | sem padrão (só no banco) | Imagem acima de “posto nome” e do cargo, centralizada no bloco de assinatura do Relatório Analítico (até 150 × 45 pt, proporção mantida). Sem imagem, o bloco sai só com o texto |

Não são configuráveis: cabeçalho do Estado/SSP/PMMA/CPI e a linha “24º BATALHÃO DE POLÍCIA MILITAR” do cabeçalho do relatório, brasões, estrutura legal dos documentos, remetente e credenciais do provedor (continuam em variáveis de ambiente).

## Quando a mudança tem efeito

- Imediatamente após salvar, para **prévias, novas emissões, correções (nova versão do PDF) e envios/reenvios** de e-mail.
- PDFs já emitidos são binários armazenados e **não mudam**. O reenvio de um BO antigo reutiliza o PDF original, mas vai para o e-mail institucional atual.
- Cada revisão de Relatório Analítico guarda o signatário usado (`analytical_report_revisions.data.signatory`) e, em `signature_sha256`, apenas o SHA-256 da assinatura digitalizada usada (ou `null`). A imagem nunca vai para o JSON da revisão.

## Validação e auditoria

`PUT /api/admin/settings` (ADMIN): e-mails válidos, limites de 60–254 caracteres, sem quebras de linha, `<` ou `>`, campos desconhecidos rejeitados (422). Espaços nas pontas são removidos; texto vazio volta ao padrão. A auditoria registra `SETTINGS_UPDATED` com **somente os nomes** dos campos alterados (coluna `audit_logs.details`), nunca os valores.

## Assinatura digitalizada

Card **Signatário**, campo “Assinatura digitalizada”: PNG ou JPG de até 500 KB, com prévia e botão “Remover assinatura”. A gravação é imediata (não depende de “Salvar configurações”). A imagem fica somente em `system_settings.signature_image` (com `signature_mime`); **não é versionada no repositório** nem copiada para revisões.

- `PUT /api/admin/settings/signature` `{"data_base64": "..."}` (JSON, porque `python-multipart` não é dependência). O servidor ignora o tipo informado pelo navegador e confere os bytes iniciais (PNG `\x89PNG\r\n\x1a\n` ou JPEG `\xff\xd8\xff`) e se a imagem abre; base64 inválido ou imagem falsa → 422, acima de 500 KB → 413. O limite de corpo do middleware é de 720 KiB só nessa rota (256 KiB nas demais).
- `GET /api/admin/settings/signature` devolve a imagem com `Cache-Control: no-store` (404 sem assinatura); `DELETE` remove.
- `GET /api/admin/settings` expõe apenas `has_signature` e `signature_mime`, nunca os bytes.
- Auditoria: `SETTINGS_UPDATED` com `{"fields": ["signature_image"]}`.

## Status e diagnóstico

`GET /api/admin/diagnostics` (somente leitura): provedor selecionado (`EMAIL_PROVIDER`), se remetente e credenciais estão definidos (apenas booleanos — nunca chaves, senhas ou tokens), e-mail institucional e reply-to efetivos, banco acessível, revisão Alembic atual × head, versão da aplicação e dos layouts de PDF, ambiente e `FRONTEND_URL` usado no QR.

`POST /api/admin/diagnostics/test-email` `{"email": "..."}` envia uma mensagem curta, sem anexo nem dados de boletins, pelo provedor atual. Resultado honesto: sem provedor configurado retorna “Não enviado…” sem tentar; recusa do provedor aparece como falha; sucesso significa aceitação pelo provedor, não entrega. Limite: 3 testes a cada 10 minutos por administrador (429), além do limite global por IP. Auditado como `SETTINGS_TEST_EMAIL_SENT` ou `SETTINGS_TEST_EMAIL_FAILED` (com o provedor, sem o destinatário).

## Migrations

- `20261002_two_roles`: `UPDATE users SET role='OPERADOR' WHERE role='GERADOR'`. Downgrade é no-op (não há registro de quem era GERADOR).
- `20261002_settings`: cria `system_settings` e `audit_logs.details`. Downgrade remove ambos; os valores voltam a vir só do ambiente.
- `20261006_signature_footer`: adiciona `footer_address`, `footer_contact`, `signature_image` e `signature_mime`. Downgrade remove as colunas (o rodapé volta a “unidade · município” e a assinatura enviada é descartada).
