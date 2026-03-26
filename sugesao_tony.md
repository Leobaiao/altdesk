Altdesk - Modelo Relacional Completo (Help Desk / Service Desk)
1. Estrutura Principal
Entidades:
- companies
- users
- contacts
- queues
- tickets
- ticket_messages
- ticket_attachments
- roles
- user_queue_permissions
- ticket_events
2. Tabela Companies
Campos principais:
- id
- uuid
- razao_social
- nome_fantasia
- cnpj
- email_principal
- telefone_principal
- plano
- status_contrato
- timezone
- idioma
- created_at
- updated_at
3. Tabela Roles
- SUPER_ADMIN
- TENANT_ADMIN
- SUPERVISOR
- AGENT
- END_USER
4. Tabela Users
- id
- company_id
- role_id
- nome
- email
- telefone
- password_hash
- status
- departamento
- cargo
- ultimo_login_em
- created_at
5. Tabela Contacts
- id
- company_id
- nome
- email
- telefone
- cpf
- origem_cadastro
- status
- created_at
6. Tabela Queues
- id
- company_id
- nome
- descricao
- sla_resposta_minutos
- sla_resolucao_minutos
7. Tabela Tickets
- id
- company_id
- protocolo
- subject
- status
- priority
- type
- channel
- requester_contact_id
- requester_user_id
- assignee_user_id
- queue_id
- created_at
8. Tabela Ticket Messages
- id
- ticket_id
- author_user_id
- author_contact_id
- message_type (public, internal, system)
- content_html
- created_at
9. Tabela Ticket Attachments
- id
- ticket_id
- ticket_message_id
- file_name
- mime_type
- storage_path
- public_url
10. Tabela Ticket Events
- id
- ticket_id
- event_type
- actor_user_id
- old_value
- new_value
- created_at
11. Regras de Negócio
- Separar usuário de contato
- Toda mensagem tem tipo
- Ticket sempre pertence a uma empresa
- Tudo importante gera evento
- Anexos fora do HTML
12. Status e Enum
Status:
- open  - aberto
- in_progress – em andamento
- waiting_customer – esperando cliente
- resolved - Resolvido
- closed = Fechado

Prioridade:
- low - Baixa
- medium - Média
- high - Alta
- urgent - Urgente

Canal:
- whatsapp
O usuário será instruido para enviar um  OI para o numero de whatsapp que estará devidamente cadastrado pelo admin do cliente. Exemplo 551194814644
Olá, voce está no helpdesk da empresa xxxxx, por favor digite seu cpf ou um número que voce possa ser identificado na Plataforma. Caso não saiba comece tentando pelo seu CPF que iremos pesquisar, caso a resposta seja 
NUMERO INEXISTENTE
Digite NÃO SEI que um tecnico entrará em ação em minutos. Favor aguardar
Caso seu CPF exista a mensagem abaixo aparecerá
Olá, ESTE É SEU TICKET XXXXXXXX, ele está aberto em seu nome, por favor digite seu problema para verificarmos se temos uma resposta que será fornecida pelo IA ou um tecnico vira te atender.
 
- email:
O cliente deve fornecer o email que irá tratar das demandas, este email deve ser registrado pelo admin do cliente. Exemplo: cliente@cliente.com
Na primeira vez que o remetente enviar uma mensagem para o email cadastrado e no corpo não houver uma marca +++ então alocar um numero de ticket e mandar mensagem padrão de abertura de chamado que o cliente irá propor na configuração. Exemplo:
+++
ESTE É SEU TICKET XXXXXXX
Seu problema esta sendo tratado e responderemos por este canal o mais breve possivel. 
Sempre responda este email com o texto antes da marca +++,  NÃO EXCLUA O TEXTO ABAIXO DA MARCA.


Grato


- webchat
Idem ao whatsapp

- api
A ser pensado
13. MVP Essencial
- companies
- users
- contacts
- queues
- tickets
- ticket_messages



Perfeito. Vou te passar um pacote de integração do Asaas para o Altdesk em formato que dá para entregar ao programador.
Visão correta da integração
Para o Altdesk, o Asaas deve ficar como motor de billing, enquanto o Altdesk continua sendo o dono da regra de negócio: plano ativo, trial, bloqueio por inadimplência, upgrade, downgrade e suspensão. A API do Asaas é v3; em produção a base é https://api.asaas.com/v3 e em sandbox https://api-sandbox.asaas.com/v3. A autenticação usa API key no header access_token, e contas novas também devem enviar User-Agent nas requisições. 
O que o Altdesk precisa fazer
O fluxo ideal é este: criar ou sincronizar o cliente no Asaas, criar a assinatura/recorrência, receber webhooks de cobrança, atualizar o status local da assinatura e então liberar ou bloquear acesso no Altdesk. O ponto importante é que o Asaas não tem webhooks próprios de assinatura; o acompanhamento da assinatura é feito pelos webhooks de cobrança, e cada cobrança relacionada traz o campo subscription para você ligar ao contrato local. 
O que armazenar no Altdesk
Vocês não devem guardar dados sensíveis de cartão. A chave da API deve ficar em secret manager ou variável de ambiente, nunca no código-fonte; o próprio Asaas recomenda isso e informa que a chave é exibida uma única vez, além de ser distinta entre sandbox e produção. 
No banco do Altdesk, eu criaria estas tabelas mínimas:
1. billing_customers
Guarda o espelho do cliente no Asaas.
CREATE TABLE billing_customers (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    company_id BIGINT NOT NULL,
    provider VARCHAR(20) NOT NULL DEFAULT 'asaas',
    provider_customer_id VARCHAR(100) NOT NULL,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(200),
    mobile_phone VARCHAR(30),
    cpf_cnpj VARCHAR(20),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (provider, provider_customer_id),
    UNIQUE (company_id, provider)
);
2. billing_plans
Plano comercial do Altdesk.
CREATE TABLE billing_plans (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    price_cents INT NOT NULL,
    cycle VARCHAR(20) NOT NULL, -- monthly, quarterly, yearly
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
3. billing_subscriptions
Contrato local vinculado ao Asaas.
CREATE TABLE billing_subscriptions (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    company_id BIGINT NOT NULL,
    billing_plan_id BIGINT NOT NULL,
    provider VARCHAR(20) NOT NULL DEFAULT 'asaas',
    provider_subscription_id VARCHAR(100) NOT NULL,
    provider_customer_id VARCHAR(100) NOT NULL,
    status VARCHAR(30) NOT NULL, -- trialing, active, past_due, canceled, suspended
    payment_method VARCHAR(30),  -- BOLETO, PIX, CREDIT_CARD, UNDEFINED
    value_cents INT NOT NULL,
    next_due_date DATE,
    remote_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    started_at TIMESTAMP,
    canceled_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (provider, provider_subscription_id)
);
4. billing_invoices
Cada cobrança gerada pelo Asaas.
CREATE TABLE billing_invoices (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    billing_subscription_id BIGINT NULL,
    company_id BIGINT NOT NULL,
    provider VARCHAR(20) NOT NULL DEFAULT 'asaas',
    provider_payment_id VARCHAR(100) NOT NULL,
    provider_subscription_id VARCHAR(100),
    status VARCHAR(30) NOT NULL, -- pending, overdue, received, confirmed, refunded, deleted...
    billing_type VARCHAR(30),    -- BOLETO, PIX, CREDIT_CARD, UNDEFINED
    value_cents INT NOT NULL,
    net_value_cents INT,
    due_date DATE,
    payment_date TIMESTAMP NULL,
    invoice_url TEXT,
    bank_slip_url TEXT,
    pix_qr_code_payload TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (provider, provider_payment_id)
);
5. billing_webhook_events
Idempotência e auditoria.
CREATE TABLE billing_webhook_events (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    provider VARCHAR(20) NOT NULL DEFAULT 'asaas',
    event_type VARCHAR(100) NOT NULL,
    provider_payment_id VARCHAR(100),
    payload_json TEXT NOT NULL,
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    processed_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
Como o Asaas entrega webhooks em modelo at least once, o endpoint pode receber evento duplicado. A própria documentação recomenda idempotência e log dos eventos processados. 
Campos que eu mapearia do Asaas para o Altdesk
No mínimo, mapear:
customer.id do Asaas → provider_customer_id 
subscription.id do Asaas → provider_subscription_id 
payment.id do Asaas → provider_payment_id 
billingType 
status 
dueDate 
value 
netValue 
invoiceUrl / bankSlipUrl 
subscription dentro do webhook de cobrança. 
Endpoints do Asaas que vocês vão usar
Pelo recorte do Altdesk, os endpoints centrais são:
Clientes: criar, listar, buscar, atualizar, remover/restaurar. 
Cobranças: criar cobrança, listar cobranças, recuperar uma cobrança, obter linha digitável do boleto, obter QR Code Pix. 
Assinaturas: criar assinatura, listar, buscar, atualizar, remover, listar cobranças da assinatura. 
Webhooks: criar, listar, editar e excluir webhook via API em POST /v3/webhooks e GET /v3/webhooks. 
Arquitetura recomendada no Altdesk
Separaria em um módulo próprio, por exemplo:
/modules/billing
  /providers/asaas
    asaas.client.ts
    asaas.mapper.ts
    asaas.webhook.ts
    asaas.service.ts
  billing.service.ts
  billing.controller.ts
  billing.webhook.controller.ts
A ideia é abstrair o provider desde já. Hoje provider = asaas; amanhã, se precisar trocar, o domínio do Altdesk não muda.
Fluxo de integração que eu recomendo
Fluxo 1 — criação da empresa pagante
Empresa criada no Altdesk. 
Altdesk cria cliente no Asaas. 
Guarda provider_customer_id. 
Se já existir cliente equivalente, pode atualizar em vez de recriar. 
O Asaas trabalha com cadastro prévio de cliente para depois usar cobrança, assinatura, emissão de NF e demais recursos. 
Fluxo 2 — ativação da assinatura
Usuário escolhe plano. 
Altdesk cria assinatura no Asaas. 
Asaas gera automaticamente a primeira cobrança. 
Altdesk marca a assinatura local como pending_activation. 
Webhook PAYMENT_CREATED chega. 
Quando houver confirmação/recebimento, Altdesk marca como active. 
Quando uma nova assinatura é criada, a primeira cobrança é gerada automaticamente. O rastreio da assinatura ocorre pelos webhooks de cobrança. 
Fluxo 3 — renovação recorrente
Asaas gera nova cobrança da assinatura. 
Webhook chega com o subscription vinculado. 
Altdesk cria ou atualiza billing_invoices. 
Se pago, mantém conta ativa. 
Se vencido, muda para past_due. 
Após régua interna definida por vocês, muda para suspended. 
Fluxo 4 — cancelamento
Cliente cancela no Altdesk. 
Altdesk chama endpoint de remoção da assinatura no Asaas. 
Marca assinatura local como canceled. 
Se vierem PAYMENT_DELETED das cobranças associadas, registra a auditoria. 
A própria FAQ de webhooks do Asaas informa que remoção de assinatura/parcelamento gera eventos de cobrança, como PAYMENT_DELETED, e não “webhooks de assinatura”. 
Eventos de webhook que eu trataria no MVP
No mínimo:
PAYMENT_CREATED 
PAYMENT_UPDATED 
PAYMENT_CONFIRMED 
PAYMENT_RECEIVED 
PAYMENT_OVERDUE 
PAYMENT_REFUNDED 
PAYMENT_DELETED 
Esses eventos já cobrem quase tudo que o Altdesk precisa para billing SaaS.
Regras de negócio locais do Altdesk
Eu sugiro esta convenção:
trialing: empresa em teste, ainda sem cobrança efetivada 
pending_activation: cobrança criada, aguardando pagamento 
active: pagamento confirmado/recebido 
past_due: cobrança venceu 
grace_period: vencido, mas ainda com acesso parcial 
suspended: acesso bloqueado 
canceled: cancelado pelo cliente 
fraud_hold: se futuramente vocês usarem análise de risco 
Esses estados são do Altdesk, não necessariamente do Asaas. Isso é importante para não terceirizar a regra de acesso.
Endpoint de webhook do Altdesk
Exemplo de endpoint:
POST /api/billing/webhooks/asaas
Regras obrigatórias:
Validar o header asaas-access-token usando o token do webhook configurado. 
Persistir o payload cru. 
Responder 200 rápido. 
Processar de forma assíncrona. 
Ignorar eventos duplicados. 
O Asaas recomenda usar token próprio no webhook, enviado no header asaas-access-token; também recomenda retorno rápido com HTTP 200, processamento assíncrono e idempotência. Se o endpoint falhar 200 por 15 vezes seguidas, a fila de sincronização pode ser interrompida. 
Exemplo de pseudocódigo do webhook
app.post('/api/billing/webhooks/asaas', async (req, res) => {
  const auth = req.header('asaas-access-token');
  if (auth !== process.env.ASAAS_WEBHOOK_TOKEN) {
    return res.status(401).json({ error: 'invalid webhook token' });
  }

  // responder rápido
  res.status(200).json({ ok: true });

  const eventType = req.body.event;
  const payment = req.body.payment;
  const paymentId = payment?.id ?? null;

  const alreadyProcessed = await db.webhookEvents.findByProviderAndPayment(
    'asaas',
    eventType,
    paymentId
  );

  if (alreadyProcessed) return;

  const eventRecord = await db.webhookEvents.insert({
    provider: 'asaas',
    event_type: eventType,
    provider_payment_id: paymentId,
    payload_json: JSON.stringify(req.body),
    processed: false
  });

  await queue.add('process-asaas-webhook', { eventRecordId: eventRecord.id });
});
Lógica do worker do webhook
switch (event.event_type) {
  case 'PAYMENT_CREATED':
    // cria/atualiza invoice local
    // associa pelo campo subscription
    break;

  case 'PAYMENT_CONFIRMED':
  case 'PAYMENT_RECEIVED':
    // marca fatura como paga
    // ativa ou mantém assinatura ativa
    // reativa empresa se estiver suspensa
    break;

  case 'PAYMENT_OVERDUE':
    // marca invoice vencida
    // assinatura vira past_due
    break;

  case 'PAYMENT_REFUNDED':
    // marca fatura estornada
    break;

  case 'PAYMENT_DELETED':
    // marca fatura excluída/cancelada
    break;
}
Headers obrigatórios da API
Exemplo de chamada server-to-server:
Content-Type: application/json
User-Agent: Altdesk/1.0
access_token: SUA_API_KEY
O User-Agent é obrigatório para novas contas raiz criadas a partir de 13/06/2024, segundo a documentação do Asaas. 
Exemplo de client HTTP em TypeScript
const baseUrl =
  process.env.ASAAS_ENV === 'production'
    ? 'https://api.asaas.com/v3'
    : 'https://api-sandbox.asaas.com/v3';

async function asaasRequest<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Altdesk/1.0',
      'access_token': process.env.ASAAS_API_KEY!,
      ...(init.headers || {})
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Asaas error ${response.status}: ${body}`);
  }

  return response.json() as Promise<T>;
}
Sequência mínima de implementação
Fase 1
gerar API key sandbox 
criar módulo asaas.client 
criar cadastro/sincronização de cliente 
criar assinatura 
criar endpoint de webhook 
persistir eventos 
atualizar status local 
Fase 2
tela de billing no superadmin 
histórico de cobranças 
links para boleto e Pix 
suspensão por inadimplência 
reativação automática 
Fase 3
upgrade/downgrade 
cancelamento agendado 
NFS-e, se precisarem 
split, só se virar marketplace ou white-label complexo 
Sandbox e testes
O Asaas mantém sandbox separado da produção; mudanças no sandbox não replicam em produção. O ambiente de sandbox permite testar cobranças, webhooks e vários fluxos, e a conta é criada em sandbox.asaas.com. Para alguns testes, a própria interface permite confirmar pagamento fictício de boleto/Pix e “receber pagamento” de cartão; não há endpoint específico para essa confirmação via API em alguns desses cenários de sandbox. 
Limites e cuidados de performance
A documentação informa:
até 50 requisições GET concorrentes; 
cota de 25.000 requisições por conta a cada 12 horas; 
alguns endpoints têm rate limit próprio, exposto pelos headers RateLimit-Limit, RateLimit-Remaining e RateLimit-Reset. 
Então, para o programador:
não fazer polling desnecessário; 
usar webhook como principal fonte de atualização; 
usar reconciliação por rotina agendada só para auditoria, por exemplo 1x ao dia para itens divergentes. 
Segurança que eu exigiria
API key só em backend. 
Nunca expor a chave ao frontend. 
Variável de ambiente ou secret manager. 
Token exclusivo para webhook. 
TLS obrigatório. 
Logs sem dados sensíveis. 
Chaves separadas para sandbox e produção. 
Processo de rotação de chave. 
O Asaas destaca armazenamento seguro da API key, uso de HTTPS, controle de acesso, rotação e ainda informa que chaves podem ser desabilitadas automaticamente após inatividade, com expiração permanente posterior se permanecerem inativas. 
Sobre SDK
Hoje o Asaas informa SDK oficial para Java. Para Node/TypeScript, o caminho padrão é integrar via REST diretamente. 
Minha recomendação objetiva para o Altdesk
Para o MVP, eu faria exatamente isso:
cobrança recorrente via Asaas; 
lógica de acesso e bloqueio no Altdesk; 
webhook como fonte principal; 
uma tabela de invoices local; 
abstração de provider desde o primeiro dia. 
Isso entrega um billing profissional sem amarrar a plataforma.
Se você quiser, eu transformo isso agora em um DOCX técnico para entregar ao programador.
