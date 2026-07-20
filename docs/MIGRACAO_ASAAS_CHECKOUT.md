# Migração para Asaas Checkout (Página Hospedada)

Este documento descreve as alterações realizadas para migrar o sistema de checkout do AltDesk de um modal interno (com formulário manual e polling de Pix QR Code) para o **Asaas Checkout** — a página de pagamento oficial e hospedada pelo Asaas.

## Motivação

O fluxo anterior exigia muita lógica no frontend e no backend para gerenciar a criação do cliente, assinatura, geração de QR code Pix e polling do status do pagamento.
A migração para o Asaas Checkout simplifica drasticamente o frontend, delegando toda a experiência de pagamento, coleta de dados do cartão, geração de boleto/Pix para a página segura do próprio Asaas.

## O que mudou?

### 1. Banco de Dados

**Nova Tabela:** `altdesk.BillingCheckout`
- **Arquivo:** `backend/db/08-billing-checkout.sql`
- **Propósito:** Rastrear as sessões de checkout criadas, armazenando o link de pagamento, status (ACTIVE, PAID, CANCELED), e a `ExternalReference` para vincular ao `Tenant` e `BillingPlan` corretos.

### 2. Backend (API Asaas)

- **Arquivo:** `backend/src/modules/billing/providers/asaas/asaas.client.ts`
- **Alterações:** Adicionadas as interfaces `AsaasCheckout` e as funções HTTP `createCheckout()`, `getCheckout()` e `cancelCheckout()` para consumir a rota `/checkouts` da API v3 do Asaas.

### 3. Backend (Billing Service)

- **Arquivo:** `backend/src/modules/billing/billing.service.ts`
- **Alterações:** Adicionadas as funções de alto nível:
  - `createCheckoutSession(tenantId, planCode)`: Busca os dados do plano e do tenant, pré-preenche as informações (nome, e-mail, cpf, telefone), gera as URLs de callback baseadas no `FRONTEND_URL`, cancela checkouts ativos anteriores e chama a API do Asaas para gerar o link de pagamento.
  - `cancelCheckoutSession()`: Para cancelar uma sessão pendente, caso necessário.

### 4. Backend (Controller)

- **Arquivo:** `backend/src/modules/billing/billing.controller.ts`
- **Alterações:** Adicionados os endpoints:
  - `POST /api/billing/checkout`
  - `DELETE /api/billing/checkout/:checkoutId`

### 5. Backend (Webhooks)

- **Arquivo:** `backend/src/modules/billing/providers/asaas/asaas.webhook.ts`
- **Alterações:** 
  - Anteriormente, o webhook só ativava a conta se o pagamento viesse acompanhado de um `subscription` ID.
  - Agora, ele verifica também a propriedade `externalReference`. Se encontrar o formato `tenant-{tenantId}_plan-{planCode}`, ele entende que o pagamento veio do Checkout.
  - Nesse caso, ele:
    1. Atualiza o status na tabela `BillingCheckout` para `PAID`.
    2. Espelha a assinatura localmente na tabela `BillingSubscription`.
    3. Ativa a conta oficial do tenant, limpando os dados de teste (caso seja um usuário em TRIAL).

### 6. Frontend

- **Arquivo:** `frontend/src/Billing.tsx`
- **Alterações (A grande limpeza):**
  - **-290 linhas de código removidas**.
  - O modal de checkout manual (nome, cpf, e-mail) foi **excluído**.
  - O modal de Pix QR Code com botão "Copiar" e "Aguardando pagamento..." foi **excluído**.
  - **Novo fluxo:** O botão "Selecionar" agora chama `POST /api/billing/checkout` e simplesmente abre o `link` retornado em uma nova aba usando `window.open(link, '_blank')`.
  - **Callbacks:** Adicionado um `useEffect` para ler as query params da URL (`?checkout=success`, `cancel` ou `expired`) e exibir os respectivos toasts ("Pagamento iniciado!", "Checkout cancelado", etc) quando o usuário retorna da aba do Asaas.

### 7. Variáveis de Ambiente

- **Arquivo:** `.env`
- **Alteração:** Adicionada a variável `FRONTEND_URL=http://localhost:5173`. Ela é usada pelo backend para informar ao Asaas para onde o usuário deve ser redirecionado (callback) após o pagamento. Em produção, isso deve ser ajustado para `https://app.altdesk.com.br`.

---

## Fluxo Resumido (Como ficou)

1. Usuário no frontend escolhe um plano e clica em **Selecionar**.
2. Frontend chama a API (`/api/billing/checkout`).
3. Backend cria uma sessão no Asaas e salva na tabela `BillingCheckout`.
4. Backend devolve o link da página do Asaas para o Frontend.
5. Frontend abre o link em uma nova aba.
6. O usuário insere o cartão de crédito ou paga o Pix na página do Asaas.
7. O Asaas envia um Webhook (`PAYMENT_CONFIRMED`) para a API do AltDesk.
8. O AltDesk processa o Webhook usando a `externalReference` e ativa a assinatura.
9. (Opcional) O usuário clica em "Voltar para a loja" no Asaas e volta para o app (onde recebe um toast de sucesso).
