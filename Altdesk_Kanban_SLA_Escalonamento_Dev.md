# ALTDesk
## Kanban, SLA e Escalonamento Automático

**Documento técnico para implementação pelo desenvolvedor**

Versão: 1.0 | Escopo: MVP + base evolutiva

### Objetivo
Implementar um Kanban operacional para tickets, com SLA visível, alerta de vencimento e escalonamento automático quando o SLA estourar.

---

## 1. Visão geral

O Kanban do Altdesk deve ser mais do que uma visualização de tickets. Ele deve orientar a operação do agente, mostrar gargalos e disparar ações automáticas. O SLA deve ficar visível no card e acionar escalonamento automático quando for violado.

---

## 2. Grade recomendada do Kanban

| **Status** | **Código** | **Descrição operacional** | **SLA** |
| --- | --- | --- | --- |
| Novo | NEW | Ticket recebido e ainda não assumido. | SLA inicia ao criar ticket. |
| Em triagem | TRIAGE | Agente entende o problema, classifica categoria, impacto e prioridade. | SLA rodando. |
| Em atendimento | IN_PROGRESS | Ticket assumido e em execução. | SLA rodando. |
| Aguardando cliente | WAITING_CUSTOMER | Depende de resposta, documento ou confirmação do solicitante. | SLA pausado. |
| Aguardando terceiro | WAITING_THIRD_PARTY | Depende de fornecedor, operador externo ou outra área. | SLA pausado. |
| Escalado | ESCALATED | Ticket passou para supervisor/especialista/gestão. | SLA rodando, salvo exceção configurada. |
| Resolvido | RESOLVED | Solução aplicada; aguarda validação ou fechamento automático. | SLA para. |
| Fechado | CLOSED | Ticket encerrado oficialmente. | SLA encerrado. |

---

## 3. Prioridade não é status

Prioridade deve ser etiqueta do ticket, não coluna do Kanban. Prioridades sugeridas: LOW, MEDIUM, HIGH, CRITICAL. Ticket escalado automaticamente deve subir para CRITICAL, salvo regra configurada pela empresa.

---

## 4. Modelo de dados sugerido

```sql
-- Status do ticket
CREATE TYPE ticket_status AS ENUM (
  'NEW', 'TRIAGE', 'IN_PROGRESS', 'WAITING_CUSTOMER',
  'WAITING_THIRD_PARTY', 'ESCALATED', 'RESOLVED', 'CLOSED'
);

-- Prioridade
CREATE TYPE ticket_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

ALTER TABLE tickets
ADD COLUMN status ticket_status DEFAULT 'NEW',
ADD COLUMN priority ticket_priority DEFAULT 'MEDIUM',
ADD COLUMN kanban_order INTEGER DEFAULT 0,
ADD COLUMN assigned_agent_id UUID NULL,
ADD COLUMN sla_first_response_due TIMESTAMP NULL,
ADD COLUMN sla_resolution_due TIMESTAMP NULL,
ADD COLUMN first_response_at TIMESTAMP NULL,
ADD COLUMN resolved_at TIMESTAMP NULL,
ADD COLUMN sla_status VARCHAR(20) DEFAULT 'ON_TIME', -- ON_TIME | WARNING | BREACHED
ADD COLUMN sla_paused BOOLEAN DEFAULT FALSE,
ADD COLUMN sla_paused_at TIMESTAMP NULL,
ADD COLUMN sla_pause_duration_minutes INTEGER DEFAULT 0,
ADD COLUMN escalation_level INTEGER DEFAULT 0,
ADD COLUMN escalated_at TIMESTAMP NULL,
ADD COLUMN escalation_reason TEXT NULL,
ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();

CREATE TABLE sla_policies (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  priority ticket_priority NOT NULL,
  first_response_minutes INTEGER NOT NULL,
  resolution_minutes INTEGER NOT NULL,
  warning_before_minutes INTEGER DEFAULT 10,
  business_hours_only BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE escalation_policies (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  level INTEGER NOT NULL,
  assign_to_role VARCHAR(50) NOT NULL, -- SUPERVISOR | SPECIALIST | MANAGER
  notify_email BOOLEAN DEFAULT TRUE,
  notify_in_app BOOLEAN DEFAULT TRUE,
  notify_webhook BOOLEAN DEFAULT TRUE,
  max_level INTEGER DEFAULT 3,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE ticket_events (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  ticket_id UUID NOT NULL,
  actor_user_id UUID NULL,
  event_type VARCHAR(50) NOT NULL,
  old_value TEXT NULL,
  new_value TEXT NULL,
  metadata JSONB NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 5. SLA padrão por prioridade

| **Prioridade** | **Primeira resposta** | **Resolução** | **Uso sugerido** |
| --- | --- | --- | --- |
| LOW | 240 min | 1440 min | Solicitações simples e sem impacto. |
| MEDIUM | 120 min | 720 min | Chamado comum de operação. |
| HIGH | 60 min | 240 min | Impacto relevante ou usuário bloqueado. |
| CRITICAL | 15 min | 60 min | Operação parada, cliente VIP, incidente grave. |

---

## 6. Regras de negócio obrigatórias

- **SLA de primeira resposta** começa na criação do ticket e para no primeiro envio de resposta pública do agente.
- **SLA de resolução** começa na criação do ticket e para ao mover para RESOLVED ou CLOSED.
- **SLA pausa** automaticamente em WAITING_CUSTOMER e WAITING_THIRD_PARTY.
- **SLA retoma** quando o cliente responde ou quando o ticket volta para TRIAGE, IN_PROGRESS ou ESCALATED.
- Se **sla_status** virar **BREACHED**, o sistema deve escalar automaticamente.
- **Ticket escalado** deve ir para a coluna ESCALATED e receber escalation_level incrementado.
- Não escalar tickets RESOLVED ou CLOSED.
- Não escalar tickets com sla_paused = true.
- Não escalar infinitamente: respeitar max_level configurado.
- **Toda mudança** de status, SLA e escalonamento deve gerar registro em ticket_events.

---

## 7. APIs necessárias

| **Método** | **Endpoint** | **Objetivo** |
| --- | --- | --- |
| GET | /api/tickets/kanban | Listar tickets agrupáveis no Kanban. |
| PATCH | /api/tickets/:id/status | Mover ticket entre colunas. |
| PATCH | /api/tickets/:id/assign | Atribuir agente. |
| PATCH | /api/tickets/:id/priority | Alterar prioridade. |
| GET | /api/sla/policies | Listar políticas de SLA por empresa. |
| POST | /api/sla/policies | Criar política de SLA. |
| PATCH | /api/sla/policies/:id | Editar política de SLA. |
| GET | /api/escalation/policies | Listar políticas de escala. |
| POST | /api/escalation/policies | Criar política de escala. |
| POST | /api/tickets/:id/escalate | Escalonar manualmente. |
| GET | /api/tickets/metrics/sla | Métricas operacionais de SLA. |

---

## 8. Backend Node/Express - código base

```javascript
app.get('/api/tickets/kanban', async (req, res) => {
  const companyId = req.user.companyId;

  const tickets = await prisma.ticket.findMany({
    where: {
      companyId,
      status: { not: 'CLOSED' }
    },
    orderBy: [
      { kanbanOrder: 'asc' },
      { updatedAt: 'desc' }
    ],
    include: {
      assignedAgent: true,
      requester: true
    }
  });

  res.json(tickets);
});

app.patch('/api/tickets/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, kanbanOrder } = req.body;
  const companyId = req.user.companyId;

  const oldTicket = await prisma.ticket.findFirst({ where: { id, companyId } });
  if (!oldTicket) return res.status(404).json({ error: 'Ticket not found' });

  const data = {
    status,
    kanbanOrder,
    updatedAt: new Date()
  };

  if (['WAITING_CUSTOMER', 'WAITING_THIRD_PARTY'].includes(status)) {
    data.slaPaused = true;
    data.slaPausedAt = new Date();
  }

  if (oldTicket.slaPaused && ['TRIAGE', 'IN_PROGRESS', 'ESCALATED'].includes(status)) {
    const pausedMinutes = Math.floor((Date.now() - new Date(oldTicket.slaPausedAt).getTime()) / 60000);
    data.slaPaused = false;
    data.slaPausedAt = null;
    data.slaPauseDurationMinutes = oldTicket.slaPauseDurationMinutes + pausedMinutes;
    data.slaFirstResponseDue = addMinutes(oldTicket.slaFirstResponseDue, pausedMinutes);
    data.slaResolutionDue = addMinutes(oldTicket.slaResolutionDue, pausedMinutes);
  }

  const ticket = await prisma.ticket.update({ where: { id }, data });

  await createTicketEvent({
    companyId,
    ticketId: id,
    actorUserId: req.user.id,
    eventType: 'STATUS_CHANGED',
    oldValue: oldTicket.status,
    newValue: status
  });

  res.json(ticket);
});

function addMinutes(date, minutes) {
  if (!date) return null;
  return new Date(new Date(date).getTime() + minutes * 60000);
}
```

---

## 9. Aplicação de SLA na criação do ticket

```javascript
async function applySLAOnTicketCreate(ticket) {
  const policy = await prisma.slaPolicy.findFirst({
    where: {
      companyId: ticket.companyId,
      priority: ticket.priority
    }
  });

  if (!policy) throw new Error('SLA policy not configured');

  const now = new Date();

  return prisma.ticket.update({
    where: { id: ticket.id },
    data: {
      slaFirstResponseDue: new Date(now.getTime() + policy.firstResponseMinutes * 60000),
      slaResolutionDue: new Date(now.getTime() + policy.resolutionMinutes * 60000),
      slaStatus: 'ON_TIME'
    }
  });
}
```

---

## 10. Engine de SLA e escala automática

```javascript
async function updateSLAStatusAndEscalate() {
  const now = new Date();

  const tickets = await prisma.ticket.findMany({
    where: {
      status: { notIn: ['RESOLVED', 'CLOSED'] },
      slaPaused: false
    }
  });

  for (const ticket of tickets) {
    const policy = await prisma.slaPolicy.findFirst({
      where: { companyId: ticket.companyId, priority: ticket.priority }
    });

    const warningBefore = policy?.warningBeforeMinutes || 10;
    let slaStatus = 'ON_TIME';

    const firstResponseBreached = !ticket.firstResponseAt && ticket.slaFirstResponseDue && now > ticket.slaFirstResponseDue;
    const resolutionBreached = ticket.slaResolutionDue && now > ticket.slaResolutionDue;

    if (firstResponseBreached || resolutionBreached) {
      slaStatus = 'BREACHED';
    } else if (ticket.slaResolutionDue && now > new Date(ticket.slaResolutionDue.getTime() - warningBefore * 60000)) {
      slaStatus = 'WARNING';
    }

    if (slaStatus !== ticket.slaStatus) {
      await prisma.ticket.update({ where: { id: ticket.id }, data: { slaStatus } });
      await createTicketEvent({
        companyId: ticket.companyId,
        ticketId: ticket.id,
        eventType: 'SLA_STATUS_CHANGED',
        oldValue: ticket.slaStatus,
        newValue: slaStatus
      });
    }

    if (slaStatus === 'BREACHED') {
      await handleEscalation(ticket);
    }
  }
}

// Rodar a cada 1 minuto via node-cron, BullMQ, worker ou job scheduler.
// cron.schedule('* * * * *', updateSLAStatusAndEscalate);

async function handleEscalation(ticket) {
  if (ticket.slaPaused) return;
  if (['RESOLVED', 'CLOSED'].includes(ticket.status)) return;
  if (ticket.escalationLevel >= 3) return;

  const nextLevel = ticket.escalationLevel + 1;

  const policy = await prisma.escalationPolicy.findFirst({
    where: {
      companyId: ticket.companyId,
      level: nextLevel
    }
  });

  if (!policy) return;

  const newAgent = await findAvailableAgentByRole({
    companyId: ticket.companyId,
    role: policy.assignToRole
  });

  const updated = await prisma.ticket.update({
    where: { id: ticket.id },
    data: {
      escalationLevel: nextLevel,
      assignedAgentId: newAgent?.id || ticket.assignedAgentId,
      status: 'ESCALATED',
      escalatedAt: new Date(),
      escalationReason: 'SLA_BREACHED',
      priority: 'CRITICAL',
      updatedAt: new Date()
    }
  });

  await createTicketEvent({
    companyId: ticket.companyId,
    ticketId: ticket.id,
    eventType: 'AUTO_ESCALATED',
    oldValue: String(ticket.escalationLevel),
    newValue: String(nextLevel),
    metadata: { assignedTo: newAgent?.id, reason: 'SLA_BREACHED' }
  });

  await notifyEscalation(updated, newAgent, policy);
}

async function findAvailableAgentByRole({ companyId, role }) {
  return prisma.user.findFirst({
    where: { companyId, role, active: true },
    orderBy: { openTicketsCount: 'asc' }
  });
}
```

---

## 11. Frontend React - Kanban base

```javascript
import { useEffect, useState } from 'react';

const columns = [
  { key: 'NEW', title: 'Novo' },
  { key: 'TRIAGE', title: 'Em triagem' },
  { key: 'IN_PROGRESS', title: 'Em atendimento' },
  { key: 'WAITING_CUSTOMER', title: 'Aguardando cliente' },
  { key: 'WAITING_THIRD_PARTY', title: 'Aguardando terceiro' },
  { key: 'ESCALATED', title: 'Escalado' },
  { key: 'RESOLVED', title: 'Resolvido' },
  { key: 'CLOSED', title: 'Fechado' }
];

function getSLAClass(status) {
  if (status === 'BREACHED') return 'bg-red-600 text-white';
  if (status === 'WARNING') return 'bg-yellow-400 text-black';
  return 'bg-green-500 text-white';
}

export default function TicketKanban() {
  const [tickets, setTickets] = useState([]);

  useEffect(() => {
    fetch('/api/tickets/kanban')
      .then(res => res.json())
      .then(setTickets);
  }, []);

  async function moveTicket(ticketId, status) {
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status } : t));

    await fetch(`/api/tickets/${ticketId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
  }

  return (
    <div className="grid grid-cols-8 gap-4 p-4 overflow-x-auto">
      {columns.map(column => {
        const columnTickets = tickets.filter(t => t.status === column.key);
        const breachedCount = columnTickets.filter(t => t.slaStatus === 'BREACHED').length;

        return (
          <div
            key={column.key}
            className="bg-gray-100 rounded-xl p-3 min-w-[260px]"
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              const ticketId = e.dataTransfer.getData('ticketId');
              moveTicket(ticketId, column.key);
            }}
          >
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-semibold">{column.title}</h2>
              {breachedCount > 0 && <span className="text-xs text-red-600 font-bold">{breachedCount} atrasado(s)</span>}
            </div>

            {columnTickets.map(ticket => (
              <div
                key={ticket.id}
                draggable
                onDragStart={e => e.dataTransfer.setData('ticketId', ticket.id)}
                className="bg-white rounded-xl shadow p-3 mb-3 cursor-move"
              >
                <div className="text-sm font-bold">#{ticket.number} - {ticket.title}</div>
                <div className="text-xs text-gray-500 mt-1">Cliente: {ticket.requester?.name || 'Não informado'}</div>

                <div className="flex justify-between mt-3 text-xs items-center">
                  <span className="px-2 py-1 rounded bg-gray-200">{ticket.priority}</span>
                  <span className={`px-2 py-1 rounded ${getSLAClass(ticket.slaStatus)}`}>{ticket.slaStatus}</span>
                </div>

                {ticket.escalationLevel > 0 && (
                  <div className="text-xs text-red-600 font-bold mt-2">
                    ESCALADO NÍVEL {ticket.escalationLevel}
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
```

---

## 12. Métricas operacionais para dashboard

- % de SLA cumprido por período
- Tempo médio de primeira resposta
- Tempo médio de resolução
- Tickets vencidos por agente
- Tickets escalados por agente
- Tickets escalados por cliente
- Quantidade de tickets por coluna
- Tempo médio parado por coluna
- Backlog por prioridade
- Top clientes com mais violações de SLA

---

## 13. MVP recomendado

- Kanban com colunas principais e drag-and-drop
- SLA de primeira resposta
- SLA de resolução
- Status SLA: ON_TIME, WARNING, BREACHED
- Pausa de SLA em Aguardando cliente e Aguardando terceiro
- Escalonamento automático ao estourar SLA
- Notificação interna e por email
- Registro de eventos/auditoria em ticket_events
- Métricas básicas de SLA

---

## 14. Checklist para o desenvolvedor

- [ ] Criar migrations do banco
- [ ] Criar seeds de SLA padrão por empresa
- [ ] Criar endpoint de Kanban
- [ ] Criar endpoint de mudança de status
- [ ] Implementar cálculo de SLA na criação do ticket
- [ ] Implementar pausa/retomada de SLA
- [ ] Criar worker/cron de SLA a cada 1 minuto
- [ ] Implementar escalonamento automático
- [ ] Implementar notificações
- [ ] Adicionar SLA visual no card
- [ ] Adicionar filtros por agente, prioridade, cliente e SLA
- [ ] Criar logs em ticket_events
- [ ] Testar cenários de SLA pausado, vencido, resolvido e escalado

---

## 15. Observação estratégica

O Kanban sem SLA é apenas uma tela visual. O Kanban com SLA, escalonamento automático e métricas vira uma ferramenta de gestão. Essa deve ser a diferença do Altdesk: não apenas registrar chamados, mas conduzir a operação até a solução.
