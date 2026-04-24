# 🧭 Guia do Dev: Integração de E-mail no Altdesk
> **Documento de apoio para developers juniores** — baseado na especificação técnica oficial  
> Versão explicada por: Tech Lead Sénior

---

## 1. 🖼️ O Grande Retrato (Resumo Simplificado)

### O que é esta feature?

O Altdesk é uma plataforma de suporte ao cliente. Hoje, os agentes criam e respondem tickets pela interface web. O problema é que os clientes finais (quem pede ajuda) continuam a enviar e-mails para caixas como `suporte@empresa.com` — e esses e-mails ficam perdidos num cliente de e-mail separado, desconectados do sistema de tickets.

**Esta feature resolve isso de ponta a ponta:**

> "Quando o cliente da empresa X envia um e-mail para `suporte@empresaX.com`, esse e-mail entra automaticamente no Altdesk como um ticket. Quando o agente responde pelo Altdesk, o cliente recebe o e-mail de volta como se tivesse sido respondido diretamente pelo e-mail."

### O problema principal que estamos a resolver

| Situação ANTES | Situação DEPOIS |
|---|---|
| O cliente envia e-mail → fica na caixa do Gmail da empresa | O cliente envia e-mail → vira ticket automaticamente no Altdesk |
| O agente tem de copiar/colar entre e-mail e sistema | O agente responde diretamente no ticket |
| Não há histórico unificado | Toda a conversa por e-mail fica dentro do ticket |
| Cada e-mail novo abre um ticket (caos) | Respostas são reconhecidas e anexadas ao ticket correto |

### Uma frase para resumir tudo

> O Altdesk vai "vigiar" caixas de e-mail de clientes, transformar e-mails recebidos em tickets, e permitir que agentes respondam por e-mail sem sair da plataforma.

---

## 2. 🔄 O Ciclo de Vida da Mensagem (Fluxo de Ponta a Ponta)

Vamos seguir um e-mail desde que é enviado pelo cliente até aparecer no Altdesk como ticket ou mensagem.

---

### 📨 Cenário A: E-mail novo (sem ticket existente)

```
[Cliente] envia e-mail para suporte@empresaX.com
        │
        ▼
[Servidor de E-mail] (Gmail / Microsoft 365 / IMAP genérico)
        │
        ▼
[Worker de Entrada — roda a cada N segundos]
  └─ Conecta na conta de e-mail configurada
  └─ Busca mensagens novas não processadas
        │
        ▼
[Normalização]
  └─ Extrai: remetente, destinatário, assunto, corpo, anexos, headers
  └─ Cria um "inbound_event" na base de dados com status "pending"
        │
        ▼
[Motor de Correlação / Threading]
  └─ Pergunta: "Este e-mail é resposta a um ticket existente?"
  └─ Verifica: In-Reply-To → References → Message-ID → [TCK-XXXXX] no assunto
  └─ RESULTADO: NÃO encontrou correlação
        │
        ▼
[Criar novo Ticket]
  └─ Cria ticket com: título = assunto do e-mail, fila = configurada no canal
  └─ Cria primeira mensagem dentro do ticket com o corpo do e-mail
  └─ Salva os headers do e-mail para threading futuro
  └─ Marca inbound_event como "processed"
        │
        ▼
[Agente vê o ticket no Altdesk] ✅
```

---

### 📩 Cenário B: E-mail que é uma resposta (ticket já existe)

```
[Cliente] responde ao e-mail de suporte (hit "Reply")
        │
        ▼
[Servidor de E-mail] recebe a resposta
        │
        ▼
[Worker de Entrada] — mesmo fluxo até a normalização
        │
        ▼
[Motor de Correlação / Threading]
  └─ Verifica header In-Reply-To: <message-id-do-email-anterior>
  └─ RESULTADO: encontrou o ticket TCK-10231
        │
        ▼
[Adicionar mensagem ao ticket existente]
  └─ NÃO cria novo ticket
  └─ Cria nova mensagem dentro do TCK-10231
  └─ Agente vê a resposta no histórico do ticket ✅
```

---

### 📤 Cenário C: Agente responde pelo Altdesk

```
[Agente] escreve resposta na interface do Altdesk
        │
        ▼
[Serviço de Envio]
  └─ Descobre qual canal de e-mail está ligado ao ticket
  └─ Carrega as configurações de saída (SMTP / OAuth)
  └─ Constrói o e-mail com:
       - From: suporte@empresaX.com
       - Reply-To: suporte@empresaX.com
       - Subject: Re: [TCK-10231] Assunto original
       - Headers: In-Reply-To, References (para futuro threading)
        │
        ▼
[Provider de Saída] (Gmail API / Microsoft Graph / SMTP genérico)
  └─ Envia o e-mail
  └─ Recebe o Message-ID do e-mail enviado
        │
        ▼
[Guardar metadados]
  └─ Salva Message-ID, In-Reply-To, References na tabela email_messages
  └─ Isso garante que a próxima resposta do cliente seja correlacionada ✅
```

---

## 3. 📚 Dicionário de Jargões (Termos Técnicos Explicados)

### 🔐 OAuth 2.0

**O que é:** Um protocolo de autorização que permite ao Altdesk aceder à caixa de e-mail do cliente **sem guardar a password**.

**Analogia do dia a dia:** É como quando entras num site com "Login com Google". O site não fica com a tua password do Google — o Google emite um "passe temporário" que o site pode usar para certos fins. O OAuth funciona da mesma maneira.

**Na prática para nós:** Em vez de pedir "qual é a tua password do Gmail", redirecionamos o cliente para o Google, ele aprova o acesso, e o Google devolve-nos dois tokens:
- `access_token` — o passe que usamos para ler e-mails (expira em ~1h)
- `refresh_token` — um passe de renovação permanente para obter novos `access_tokens`

---

### 📬 IMAP vs SMTP

**IMAP** (Internet Message Access Protocol) — **protocolo de LEITURA**

> Analogia: É como ir ao correio buscar as cartas que chegaram à tua caixa.

Usamos IMAP no Worker de Entrada para ler os e-mails novos da conta configurada.

**SMTP** (Simple Mail Transfer Protocol) — **protocolo de ENVIO**

> Analogia: É como entregar uma carta na estação dos correios para ela ser enviada.

Usamos SMTP no Serviço de Saída para enviar respostas dos agentes.

**Regra importante do spec:** Entrada e saída são tratadas separadamente, mesmo que usem a mesma conta.

---

### 🧵 Threading por Headers (o mais importante de entender!)

**O problema:** Se dois clientes diferentes enviarem e-mails com o assunto "Ajuda com fatura", como sabemos qual resposta pertence a qual ticket?

**A solução são os headers HTTP do e-mail:**

| Header | O que contém | Analogia |
|---|---|---|
| `Message-ID` | ID único gerado para cada e-mail enviado | O número de rastreio de um pacote dos correios |
| `In-Reply-To` | O `Message-ID` do e-mail ao qual este é resposta | "Estou a responder ao pacote nº 12345" |
| `References` | Lista de todos os `Message-IDs` da conversa | A árvore genealógica da conversa |

**Fluxo prático:**
1. Cliente envia e-mail → tem `Message-ID: <abc123@gmail.com>`
2. Altdesk guarda esse ID na tabela `email_messages`
3. Altdesk responde → inclui `In-Reply-To: <abc123@gmail.com>`
4. Cliente responde de novo → o seu e-mail tem `In-Reply-To: <reply-de-altdesk@...>`
5. Motor de correlação vê esse header → encontra o ticket correto → **THREADING FUNCIONA** ✅

**Ordem de confiança no spec (da mais confiável para a menos):**
1. `In-Reply-To` ← mais fiável
2. `References`
3. `Message-ID` guardado previamente
4. `[TCK-10231]` no assunto ← fallback
5. Remetente + janela de tempo ← último recurso, não usar se possível

---

### ⚙️ Worker de Entrada (Polling Worker)

**O que é:** Um processo que corre em background de forma contínua (tipo a cada 30-60 segundos) e "pergunta" ao servidor de e-mail: "Chegou alguma coisa nova?".

**Analogia:** É como um carteiro que passa pela tua caixa de correio a cada hora para ver se chegou alguma carta.

**Na nossa arquitetura:** É um Job/Cron que itera sobre todos os canais de e-mail ativos e chama o provider correto para cada um.

---

### 🏭 Provider Factory (Padrão de Design)

**O que é:** Uma função/classe que, dado um tipo de canal (Gmail, Microsoft, IMAP genérico), devolve o conector (provider) correto para usar.

**Analogia:** É como um adaptador de tomada universal. Independentemente de estares em Portugal (tipo A), EUA (tipo B) ou Reino Unido (tipo G), o adaptador dá-te sempre a corrente que precisas.

```typescript
// Conceito simplificado do Provider Factory
function createInboundProvider(channel: EmailChannel): InboundEmailProvider {
  switch (channel.provider_type) {
    case 'gmail':      return new GmailProvider(channel);
    case 'microsoft':  return new MicrosoftProvider(channel);
    default:           return new ImapInboundProvider(channel);
  }
}
```

---

### 🏢 Multiempresa / Multi-conta

**O que é:** O sistema deve suportar várias empresas clientes do Altdesk, cada uma com várias contas de e-mail.

**Exemplo:**
- Empresa A: `suporte@empresaA.com` + `faturacao@empresaA.com`
- Empresa B: `help@empresaB.com`

Cada empresa tem as suas configurações isoladas. Um `company_id` garante que os dados de uma empresa nunca aparecem na outra.

---

### 🔁 Retry Queue (Fila de Reenvio)

**O que é:** Uma fila de mensagens que guardamos quando um envio de e-mail falha, para tentar reenviar automaticamente mais tarde.

**Regra de negócio crítica do spec:**
> "Falha de envio não pode descartar a resposta do agente; deve haver fila de retry."

Ou seja: se o SMTP falhar, **não perdemos a resposta**. Guardamos e tentamos de novo.

---

## 4. 🎯 O Foco do MVP

### ✅ O que TENS de fazer no MVP

Com base na tabela da secção 14 do documento:

| O que fazer | Porquê |
|---|---|
| Gmail com OAuth | Canal mais comum entre clientes |
| Microsoft 365 com OAuth | Segundo canal mais comum (empresas corporativas) |
| IMAP/SMTP genérico | Fallback para tudo o resto |
| Threading por headers (`In-Reply-To`, `References`) | Regra de negócio central — sem isso tudo falha |
| Protocolo no assunto `[TCK-XXXXX]` | Fallback de threading essencial |
| Múltiplas contas por empresa | Necessário desde o início (arquitetura multi-conta) |
| Worker de polling de entrada | O coração do sistema |
| Serviço de envio de resposta | Sem saída, a feature não está completa |
| Modelo de dados e migrations | Base de tudo |
| Logs + retry de falhas | Regra de negócio obrigatória do spec |

---

### ❌ O que podes IGNORAR no MVP (para fazer depois)

| O que NÃO fazer agora | Motivo |
|---|---|
| Regras avançadas de roteamento | Complexidade desnecessária no início |
| Detecção inteligente de spam | Feature extra, não é core |
| Health check para painel admin visual | Nice-to-have, não é blocante |
| Tela de logs para suporte técnico (UI) | Podes ter os logs só no servidor inicialmente |
| Assinatura configurável do remetente | Campo opcional no spec |

---

### ⚠️ Coisas que parecem opcionais mas NÃO são

- **Criptografia de passwords e tokens** — o spec é explícito: segredos nunca em plaintext na BD
- **`processing_status` nos inbound_events** — essencial para retry e debug
- **Guardar `Message-ID` dos e-mails enviados** — sem isso o threading quebra na próxima resposta

---

## 5. 🛠️ Plano de Ação para o Código

Ordem lógica de implementação para Node.js + TypeScript:

---

### 🥇 Fase 1 — Fundações (Base de Dados)

**Por onde começar sempre: o modelo de dados. Tudo depende disto.**

```
1. Criar as migrations das tabelas principais:
   - email_channels
   - email_inbound_settings
   - email_outbound_settings
   - inbound_events
   - email_messages

2. Definir os tipos TypeScript correspondentes (interfaces/types):
   - EmailChannel, InboundSettings, OutboundSettings, InboundEvent, EmailMessage

3. Criar os repositórios (funções de acesso à BD):
   - getActiveChannels()
   - saveInboundEvent()
   - updateEventStatus()
   - saveEmailMessage()
```

> 💡 **Dica:** Começa só com a tabela `email_channels` e `email_inbound_settings` para conseguir testar o worker rapidamente. Adiciona as outras à medida que precisas.

---

### 🥈 Fase 2 — Conectores (Providers)

**Isola a complexidade de cada protocolo aqui.**

```
4. Definir a interface base InboundEmailProvider:
   interface InboundEmailProvider {
     fetchNewMessages(channel: EmailChannel): Promise<RawEmailMessage[]>
   }

5. Implementar ImapInboundProvider (começa por aqui — mais simples de testar)
   - Usa a lib `imapflow` ou `node-imap`
   - Conecta, lista UIDs novos, faz fetch, desconecta

6. Implementar SmtpOutboundProvider
   - Usa a lib `nodemailer`
   - Constrói o e-mail com os headers corretos (In-Reply-To, References)

7. Criar o ProviderFactory
   - Recebe um EmailChannel e devolve o provider correto

8. Implementar GmailProvider (OAuth com googleapis)
   - Fluxo de autorização OAuth2
   - Usar Gmail API em vez de IMAP quando disponível

9. Implementar MicrosoftProvider (OAuth com @azure/msal-node)
   - Microsoft Graph API para leitura e envio
```

---

### 🥉 Fase 3 — Motor de Correlação (Threading)

**A lógica de negócio mais crítica.**

```
10. Criar o módulo de normalização:
    normalizeEmail(rawMessage, channel) → InboundEvent

11. Criar o motor de correlação:
    correlateToTicket(event: InboundEvent) → Ticket | null

    Implementar por ordem de confiança:
    a) Buscar por In-Reply-To na tabela email_messages
    b) Buscar por References na tabela email_messages
    c) Buscar por [TCK-XXXXX] no assunto
    d) (Heurística) Buscar por remetente + janela de tempo

12. Criar as funções de negócio:
    createTicketFromEmail(event) → Ticket
    appendMessageToTicket(ticket, event) → void
```

---

### 🏅 Fase 4 — Worker de Entrada

**O "coração" que une tudo.**

```
13. Criar o InboundEmailWorker (pode ser um CronJob com node-cron):
    - Busca todos os canais ativos
    - Para cada canal, chama ProviderFactory.createInbound()
    - Para cada mensagem, normaliza → correlaciona → cria ticket ou mensagem
    - Marca eventos como processados (ou com erro + motivo)
    - Implementar retry com backoff exponencial para falhas

14. Configurar agendamento (de 30 em 30 segundos no MVP é suficiente)
```

---

### 🏆 Fase 5 — Serviço de Envio + API

**Fechar o ciclo de saída.**

```
15. Criar o OutboundEmailService:
    sendTicketReply(ticketId, bodyHtml, attachments)
    - Resolve canal de e-mail do ticket
    - Constrói e-mail com headers de threading corretos
    - Envia via ProviderFactory.createOutbound()
    - Guarda metadados na tabela email_messages
    - Em caso de falha: adicionar à fila de retry (não descartar!)

16. Criar as rotas de API (Express/Fastify):
    POST /api/email-channels       — criar canal
    GET  /api/email-channels       — listar canais da empresa
    POST /api/email-channels/:id/test-inbound  — testar entrada
    POST /api/email-channels/:id/test-outbound — testar saída
    GET  /api/oauth/gmail/callback  — callback OAuth Gmail
    GET  /api/oauth/microsoft/callback — callback OAuth Microsoft
```

---

### 🎁 Fase 6 — Segurança e Observabilidade (não opcional!)

```
17. Implementar criptografia de segredos:
    - Usar AES-256 (ou bcrypt para passwords one-way se aplicável)
    - Nunca logar tokens ou passwords

18. Implementar logs estruturados por canal:
    - last_sync_at, last_error, consecutive_failure_count

19. Implementar fila de retry:
    - Pode ser simples: tabela `email_retry_queue` na BD no MVP
    - Futuro: migrar para BullMQ/Redis se necessário
```

---

### 📋 Resumo Visual da Ordem

```
BD/Migrations
      │
   Tipos TS
      │
 Repositórios
      │
  IMAP Provider ──→ SMTP Provider ──→ Provider Factory
      │
  Gmail/Microsoft Providers
      │
  Normalização + Motor de Correlação
      │
  Worker de Entrada (Cron)
      │
  Serviço de Saída
      │
  Rotas de API + OAuth
      │
  Criptografia + Logs + Retry
```

---

## 🚀 Dica Final do Tech Lead

> **Começa pelo IMAP genérico, não pelo OAuth.**
>
> É tentador ir direto ao Gmail porque parece mais "real", mas o OAuth adiciona uma camada de complexidade de autenticação que vai distrair-te da lógica de negócio principal. Com IMAP, podes testar o worker completo — desde ler e-mails, normalizar, correlacionar, criar tickets — em horas, usando qualquer conta de e-mail com IMAP ativado.
>
> Quando a espinha dorsal estiver a funcionar, adicionar Gmail e Microsoft é só mais um Provider no Factory.
>
> **Escreve testes unitários para o motor de correlação.** É a lógica mais complexa e mais fácil de quebrar silenciosamente. Um teste para cada um dos 5 níveis de threading vai salvar-te muitas horas de debug.
