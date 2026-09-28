# Envio pelo Brevo no Render Free

1. Crie uma conta em https://www.brevo.com/ e conclua a ativação do serviço de e-mails transacionais, se solicitada.
2. Cadastre e valide o remetente `24bpmcoroata2@gmail.com` no painel de remetentes. Use o nome `24º BPM — BoletimON`.
3. Em SMTP e API, gere uma **chave de API**, não uma chave SMTP.
4. No Render → backend → Environment, configure:

| Variável | Valor |
|---|---|
| `EMAIL_PROVIDER` | `brevo` |
| `BREVO_API_KEY` | Chave de API, somente no Render |
| `BREVO_FROM` | Endereço do remetente validado no Brevo |
| `BREVO_FROM_NAME` | `24º BPM — BoletimON` |
| `BREVO_REPLY_TO` | `24bpmcoroata2@gmail.com` |

Mantenha DATABASE_URL, JWT_SECRET, ALLOWED_ORIGINS e BATTALION_EMAIL. As variáveis GMAIL e SMTP não são usadas neste modo. Não envie a chave pelo chat nem a adicione ao Git. Salve e faça redeploy. Serviços existentes precisam da alteração de EMAIL_PROVIDER no painel; o push sozinho não altera seus segredos.

Para remetentes Gmail, o Brevo pode substituir o endereço de envio pelo domínio brevosend.com. Informe em BREVO_FROM o remetente validado no painel, sem inventar um endereço brevosend.com. As respostas vão para BREVO_REPLY_TO. Um domínio próprio autenticado permite um remetente personalizado.

O envio utiliza HTTPS, compatível com Render Free, e inclui o PDF diretamente como anexo. São duas mensagens separadas por boletim. O plano gratuito oferece 300 envios por dia: até 150 boletins, descontando reenvios e outros usos da conta. Limites e aprovação de conta são definidos pelo Brevo.

Falhas mantêm o documento salvo e o destino como FAILED. Não há fallback automático para Gmail ou SMTP nem reenvio automático após erro de rede, evitando duplicação imediata. SENT indica aceitação pela API, não entrega ou leitura; consulte os logs transacionais do Brevo para rejeições posteriores. Após configurar, valide com um boletim fictício e confira os dois destinatários.

O provedor processa destinatários, conteúdo e anexos para entregar os e-mails. Revise a política de privacidade publicada conforme a configuração utilizada. A integração Gmail continua disponível, mas não é necessária com Brevo.

Referências: [API de envio](https://developers.brevo.com/reference/send-transac-email), [remetentes](https://help.brevo.com/hc/en-us/articles/35852083084178-Domain-setup-for-better-email-deliverability), [plano gratuito](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan).
