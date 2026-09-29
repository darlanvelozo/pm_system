# Identificação dos e-mails

Os dois envios independentes continuam usando o mesmo PDF, sem CC. O assunto passa a ser `BO {número} | {tipo} | {município}`, acrescentando `Revisão N` nas versões corrigidas. “Outro/Outros” pode usar a descrição breve. O tamanho é limitado, quebras de linha são retiradas e valores pessoais conhecidos dos envolvidos são omitidos desses metadados.

Descrição breve é opcional, limitada a 80 caracteres, com orientação explícita para não incluir nomes, CPF/RG ou outros dados pessoais. Ela não é resumo automático do histórico. Campos de texto livre exigem cuidado de quem preenche: a aplicação não infere toda possível informação pessoal em linguagem natural.

Exemplo inteiramente fictício:

```text
Assunto: BO 20260929-03 | ROUBO | Cidade Fictícia | Revisão 2

Prezados,

Segue em anexo o Boletim de Ocorrência nº 20260929-03.
Tipo de ocorrência: ROUBO
Descrição breve: Ocorrência fictícia para homologação
Data/Hora: 29/09/2026 às 07:35
Local: Centro — Cidade Fictícia
Envolvidos cadastrados: 3
Material apreendido informado: Sim
Registrado por: Operador Fictício (operador.teste)
Versão do documento: 2

O documento completo segue em anexo.
Esta mensagem foi gerada automaticamente pelo BO Online 24º BPM.

Atenciosamente,
24º BPM
```

O anexo usa nome sanitizado como `BO_20260929-03_ROUBO_v2.pdf`. O corpo é determinístico, montado de campos estruturados; não utiliza IA e não copia narrativa, endereço completo nem nomes/documentos dos envolvidos. O registrador é identificado conforme a identidade capturada na emissão.

Uma revisão não envia mensagens automaticamente. ADMIN escolhe reenviar para ambos, somente destinatário ou somente batalhão, ou deixa para depois. Todos os testes usam provedor simulado/desativado; recebimento real requer homologação autorizada.
