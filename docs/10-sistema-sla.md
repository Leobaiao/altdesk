# Sistema de SLA (Service Level Agreement) - AltDesk

O sistema de SLA do AltDesk é projetado para garantir que os atendimentos sejam realizados dentro dos prazos acordados, fornecendo visibilidade em tempo real sobre o status de cada ticket e automatizando a escalação em caso de atrasos.

## 1. Visão Geral

O SLA é aplicado a cada **Ticket** criado no sistema. Ele monitora dois marcos principais:
1.  **Tempo para Primeira Resposta (First Response):** Prazo para o agente enviar a primeira mensagem ao cliente.
2.  **Tempo para Resolução (Resolution):** Prazo total para marcar o ticket como resolvido ou fechado.

## 2. Estrutura de Dados

### Políticas de SLA (`SLAPolicy`)
As regras são definidas por prioridade e por inquilino (Tenant).
-   **Priority:** LOW, MEDIUM, HIGH, CRITICAL.
-   **FirstResponseMinutes:** Minutos permitidos para a primeira resposta.
-   **ResolutionMinutes:** Minutos permitidos para a resolução final.
-   **WarningBeforeMinutes:** Tempo de antecedência (em minutos) para mudar o status para "WARNING".
-   **BusinessHoursOnly:** (Flag) Se o cálculo deve considerar apenas o horário comercial (em implementação).

### Campos no Ticket
-   `SLAFirstResponseDue`: Data/hora limite para a primeira resposta.
-   `SLAResolutionDue`: Data/hora limite para a resolução.
-   `FirstResponseAt`: Quando a primeira resposta realmente ocorreu.
-   `ResolvedAt`: Quando o ticket foi resolvido.
-   `SlaStatus`: Status atual (`ON_TIME`, `WARNING`, `BREACHED`).
-   `SlaPaused`: Indica se o cronômetro está pausado (ex: aguardando cliente).

## 3. Ciclo de Vida e Estados

O status do SLA é atualizado periodicamente por um worker de background (`slaService.ts`):

| Status | Descrição |
| :--- | :--- |
| **ON_TIME** | O ticket está dentro do prazo e longe do limite de aviso. |
| **WARNING** | O ticket está próximo do vencimento (dentro da janela de `WarningBeforeMinutes`). |
| **BREACHED** | O prazo (de resposta ou resolução) foi ultrapassado. |

### Pausa de SLA
O SLA pode ser pausado quando o ticket entra em status específicos (ex: "Aguardando Terceiro" ou "Aguardando Cliente"), garantindo que o tempo de espera externo não penalize a equipe de suporte.

## 4. Escalação Automática

Quando um ticket atinge o status **BREACHED**, o sistema inicia o processo de escalação:

1.  **Identificação da Política:** O sistema busca a `EscalationPolicy` para o próximo nível.
2.  **Aumento de Nível:** O `EscalationLevel` do ticket é incrementado.
3.  **Priorização:** A prioridade do ticket é automaticamente alterada para **CRITICAL**.
4.  **Reatribuição:** O ticket é reatribuído a um agente com o cargo (Role) definido na política de escalação (ex: Supervisor ou Gerente).
5.  **Notificação:** Eventos são registrados e notificações são enviadas (In-app, E-mail, Webhook).

## 5. Interface do Usuário (UI)

-   **Kanban:** Os cards exibem um badge colorido com o status do SLA e um cronômetro regressivo mostrando quanto tempo resta.
-   **Dashboard:** Gráficos de conformidade de SLA (SLA Compliance) mostram a porcentagem de tickets atendidos dentro do prazo.
-   **Filtros:** É possível filtrar tickets por status de SLA para priorizar aqueles em "WARNING" ou "BREACHED".

## 6. Auditoria

Todas as mudanças de status de SLA e eventos de escalação são registrados na tabela `TicketEvent`, permitindo um histórico completo de quem estava com o ticket e por que ele atrasou.

---
*Nota: As configurações de SLA podem ser ajustadas no painel administrativo por administradores do Tenant.*
