# Plano de Implementação: Lista de Correções Altdesk 09

Este documento detalha o plano de ação e as alterações necessárias no código-fonte (frontend e backend) para resolver os apontamentos descritos no documento `lista de correções altdesk 09.docx`.

---

## 1. Melhorias na Interface de Conversas e Tickets

### 1.1. Retirar a palavra "trial" em conversas [OK - IMPLEMENTADO]
* **Descrição:** A flag indicando que a conta está em modo *trial* não deve aparecer nas janelas de conversa do usuário/atendente.
* **Arquivos Prováveis:**
  * `frontend/src/components/Sidebar.tsx` (Remover a tag "TRIAL" ao lado de "Conversas" no cabeçalho da barra lateral).
* **Ação:** Ocultar a tag "TRIAL" no header do painel de conversas do atendente/colaborador.

### 1.2. Layout de Políticas de SLA e Tags [OK - IMPLEMENTADO]
* **Descrição:** Colocar políticas de SLA ao lado de Tags no mesmo layout.
* **Arquivos Prováveis:**
  * `frontend/src/components/TicketDetail.tsx` (Painel de detalhes na lateral direita do ticket).
* **Ação:** Refatorar a lateral direita do `TicketDetail.tsx` para exibir as tags do ticket (com possibilidade de remoção/adição rápida se necessário) logo ao lado ou na mesma linha da política de SLA (usando flexbox ou grid).

### 1.3. Tradução do Painel de Detalhes (Inglês -> Português) [OK - IMPLEMENTADO]
* **Descrição:** Colocar em português os termos em inglês que aparecem na lista de tickets e no painel direito de detalhes.
* **Arquivos Prováveis:**
  * `frontend/src/components/TicketDetail.tsx`
  * `frontend/src/components/TicketList.tsx`
* **Ação:** Traduzir prioridades (Low -> Baixa, Medium -> Média, High -> Alta, Critical -> Crítica), status de SLA (BREACHED -> Violado, WARNING -> Em risco, ON_TIME -> No prazo) e outros termos em inglês exibidos nesses painéis.

---

## 2. Correções no Admin e Superadmin

### 2.1. Funcionalidade de Lixeira para Empresas [OK - IMPLEMENTADO]
* **Descrição:** No painel Admin não é possível mandar empresa (Tenant) para a lixeira.
* **Status:** O backend já implementa o soft delete cascata no endpoint `DELETE /api/admin/tenants/:id` e a listagem da lixeira, mas o frontend chama uma função `handleDelete` não declarada no arquivo `TenantsTab.tsx`.
* **Ação:**
  * **Frontend (Admin):** Declarar a função `handleDelete` no arquivo `admin/frontend/src/components/SuperAdmin/TenantsTab.tsx` para chamar a API (`DELETE /api/admin/tenants/:id`) e recarregar a lista de empresas.

### 2.2. Correção de Data de Trial da Empresa [OK - IMPLEMENTADO]
* **Descrição:** Não é possível corrigir a data de trial da empresa via painel Admin (especificamente na aba de empresas/Tenants).
* **Status:** O backend já suporta no endpoint `PUT /api/admin/tenants/:id/subscription`. O frontend já tem essa edição na aba de Subscrições, mas falta expor e permitir alterar a data diretamente nos detalhes da empresa na aba principal de Tenants.
* **Ação:** Habilitar um *date picker* para o campo `ExpiresAt` (ou data de trial/expiração) no formulário de detalhes ou em um modal na aba de Tenants, integrando com o endpoint PUT do backend.

### 2.3. Fluxo de Anexos em Conversas (Superadmin) [OK - IMPLEMENTADO]
* **Descrição:** Ao anexar um arquivo na conversa, o sistema seleciona o arquivo e depois mostra uma tela inesperada/confusa.
* **Arquivos Prováveis:**
  * `frontend/src/components/ChatWindow.tsx`
* **Ação:** Simplificar ou deixar mais claro o fluxo de pré-visualização e envio de arquivos. Evitar a tela cheia escura se ela não for necessária ou se for confusa, ou assegurar que apenas uma tela clara de confirmação apareça.

### 2.4. Erro Genérico em Preenchimento (Bug Visual) [OK - IMPLEMENTADO]
* **Descrição:** Tela de erro/bloqueio ao preencher determinados campos (conforme Image 6 e 8 do relatorio).
* **Ação:** Adicionar tratamento robusto de erros (try/catch e Toasts amigáveis) nos formulários e garantir que falhas de validação de dados (como CPF/CNPJ) não quebrem a renderização da tela.

---

## 3. Fluxo de Renovação e Assinaturas (Billing)

### 3.1. Tratamento de Assinatura Vencida [OK - IMPLEMENTADO]
* **Descrição:** Tratamento de trial expirado, possibilidade de estender por +7 dias no primeiro vencimento, e redirecionamento para rota `/special-offer` no segundo vencimento.
* **Status:** Totalmente implementado no commit `c113779775e066c9d03544d1104fca2a088c640f`.

---

## 4. Onboarding de Novas Contas

### 4.1. Carga de Base de Dados Grande (Demo Data) [OK - IMPLEMENTADO]
* **Descrição:** Opção de gerar 1000 contatos, 5000 mensagens e 5000 tickets de demonstração sem sofrer timeout de conexão.
* **Status:** Totalmente implementado no commit `f8a73a63a3bb9eb8189d9c9dbe28058081f2e277` usando bulk insert otimizado.

---

## 5. Próximos Passos (Checklist)

- [x] Remover tag "TRIAL" do header do painel de conversas (`frontend/src/components/Sidebar.tsx`).
- [x] Inserir a listagem de Tags ao lado do SLA no painel lateral de detalhes do ticket (`frontend/src/components/TicketDetail.tsx`).
- [x] Traduzir termos técnicos (status do SLA, prioridades) na interface de tickets para português.
- [x] Implementar a função `handleDelete` que falta na aba de Tenants (`admin/frontend/src/components/SuperAdmin/TenantsTab.tsx`).
- [x] Adicionar botão/input de edição de data de expiração/trial na aba de Tenants.
- [x] Revisar e melhorar a experiência visual de anexar arquivos no chat (`ChatWindow.tsx`).
- [x] Validar e prevenir falhas críticas de formulários para evitar quebras visuais (Bug Visual).
- [x] Implementar redirecionamento ao `SpecialOffer.tsx` (item 3.1).
- [x] Refatorar gerador de Demo Data para suportar *bulk insert* sem timeout (item 4.1).
