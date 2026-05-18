# 🚀 Melhorias e Refinamentos Altdesk Enterprise - [14/05/2026]

Este documento resume as melhorias implementadas e o plano para os itens pendentes, focando na transição do Altdesk para uma plataforma SaaS robusta.

## ✅ Concluído (Implementado hoje)

### 1. Segurança e Acesso
*   **Visualização de Senha:** Adicionado o ícone de "olho" no campo de senha da tela de login (`PasswordInput.tsx`) e do Onboarding.
*   **Máscara de Telefone:** Ajustado componente `PhoneMaskInput.tsx` com a formatação padrão brasileira: `(99) 99999-9999` e aplicado nas telas de Onboarding e Contatos.

### 2. Atendimento Unificado (UX)
*   **Conversa Direta no Ticket:** O ecrã de detalhes do Ticket agora integra o `ChatWindow`. É possível responder ao cliente diretamente da aba de tickets.
*   **Aba de Mensagens no Ticket:** Refatorado o layout do Ticket para incluir uma área de chat centralizada e metadados na lateral.
*   **Botão "Ir para Ticket" no Chat:** Adicionado um link direto no cabeçalho do chat que navega automaticamente para os detalhes do ticket correspondente (`Tickets.tsx` integrado via roteamento).

### 3. Personalização do Tenant
*   **Kanban Dinâmico:** Implementada a funcionalidade de alterar os títulos das colunas do Kanban via configurações do banco de dados (`TenantSettings`).

### 4. Funcionalidades de Ticket (Timeline)
*   **Barra de Comentários:** Adicionado campo de entrada de notas internas na aba de Linha do Tempo do Ticket, com suporte a Respostas Rápidas e Base de Conhecimento.
*   **Histórico de Atividade:** Backend atualizado para registrar comentários no histórico, permitindo auditoria e visualização na linha do tempo.
*   **Exibição de Conteúdo:** A Linha do Tempo agora exibe o texto completo das interações (mensagens e comentários) com formatação diferenciada.

### 5. Hierarquia e Controle de Acesso (ACL)
*   **Perfil Colaborador (END_USER):**
    *   **Bloqueio Total:** Restrição de acesso ao Dashboard, Configurações e Relatórios.
    *   **Kanban Restrito:** Colaboradores veem apenas a lista de chamados, sem acesso à visão de Kanban administrativo.
    *   **Escrita Bloqueada:** Impedido o envio de notas internas/comentários na timeline do ticket (Frontend e Backend).
    *   **Redirecionamento:** Fluxo de login ajustado para enviar o colaborador diretamente para o portal de chamados.
*   **Gestão de Equipe:**
    *   **Separação de Times:** Lista de usuários dividida entre "Time Técnico" e "Colaboradores".
    *   **Busca Avançada:** Implementada busca por nome/email na tela de gestão de usuários.
    *   **Badges de Função:** Diferenciação visual clara entre Agentes, Admins e Colaboradores.

### 6. Refinamentos de UX e Títulos
*   **Priorização de Nome vs Assunto:**
    *   **Técnico:** Vê o Nome do Contato como título e o Assunto do Ticket como subtítulo.
    *   **Colaborador:** Vê o Assunto do Ticket como título e o Nome do Agente como subtítulo.
*   **Direcionamento de Chat:** Correção da lógica de balões (In/Out) para colaboradores, garantindo que suas mensagens apareçam à direita e as do suporte à esquerda.
*   **Nomes de Remetente:** Ajustada a lógica de exibição nos balões para mostrar o nome da pessoa em vez do assunto do ticket.

---

## ✅ Concluído (15/05/2026)

### 7. Gestão de Dados e Manutenção (Admin)
*   **Data de Onboarding:** Adição do campo `CreatedAt` na visualização e no painel de gestão de tenants.
*   **Botão "Zerar Dados":** Criação da Stored Procedure `sp_altdesk_purge_demo_data` e integração do botão "Reset Demo" no painel administrativo para limpar dados iniciais gerados automaticamente, preservando os registros criados manualmente após o onboarding.

### 8. CRM e Inteligência de Dados
*   **Rastreabilidade de Contatos:** Adição dos campos Origem (Source), Tipo de Canal (Whatsapp, Email, Web) e Campanha (UTM), com captura automática baseada no canal de entrada e integrações (GTI, Webchat, Email).
*   **Timeline de Contato:** Exibição da data da "Última Atividade" (`LastActivityAt`) diretamente na listagem e no painel de contatos, com atualização automática a cada interação.

### 9. Refinamentos de Interface
*   **Edição de Kanban (Quick Edit):** Implementação de edição rápida (inline) do título dos cards diretamente no Kanban.

---

## 🛠️ Em Progresso / Próximos Passos

*(A definir)*
