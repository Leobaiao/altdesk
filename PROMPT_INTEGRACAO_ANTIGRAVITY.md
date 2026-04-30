# Prompt para Integração Kanban + SLA + Escalonamento Automático no Altdesk via Antigravity

---

## CONTEXTO DO PROJETO

**Antigravity** é a IDE que você está usando para desenvolver o **Altdesk** (sistema de gestão de tickets/chamados). Você está recebendo uma especificação técnica completa para implementar um **Kanban operacional com SLA e escalonamento automático** como feature do Altdesk.

Esta integração transformará o Altdesk de um simples registrador de chamados em uma ferramenta de gestão de operações em tempo real.

### Por que isso importa
- Sem SLA: tickets ficam presos indefinidamente sem visibilidade
- Sem escalonamento automático: tickets críticos não recebem atenção
- Sem Kanban visual: agentes não conseguem priorizar fluxo de trabalho
- Com essa implementação: operação mais ágil, SLA respeitado, qualidade aumenta

### A IDE Antigravity
O Antigravity oferece ferramentas de desenvolvimento que você deve aproveitar:
- Visual editor para modelos de dados
- Code generation automático
- Deployment simplificado
- Integração com banco de dados
- Testes e monitoramento built-in

---

## ESPECIFICAÇÃO TÉCNICA

Você receberá um documento (`Altdesk_Kanban_SLA_Escalonamento_Dev.md`) que contém:

1. **Modelo de dados** - 8 status de ticket + tabelas de SLA e escalonamento
2. **Regras de negócio** - Quando SLA pausa, retoma, escala automaticamente
3. **APIs necessárias** - 11 endpoints que precisam ser implementados
4. **Código backend** - Exemplos Node/Express com Prisma ORM
5. **Código frontend** - Componente React do Kanban com drag-and-drop
6. **Engine de automação** - Cron/worker que roda a cada 1 minuto
7. **Métricas e dashboards** - KPIs de SLA para operação

---

## TAREFA: INTEGRAÇÃO NO ANTIGRAVITY

### Você deve:

#### **1. ANÁLISE DA ESTRUTURA DO ALTDESK NO ANTIGRAVITY**
- [ ] Mapear modelos de dados existentes no Altdesk (tabela tickets, users, companies)
- [ ] Identificar padrões de projeto já existentes no Antigravity (migrations, models, APIs)
- [ ] Verificar se há tabelas de tickets existentes e como estão estruturadas
- [ ] Documentar como Altdesk atualmente gerencia autenticação e multi-tenancy
- [ ] Entender como o Antigravity gera o código (templates, scaffolding)

#### **2. ADAPTAÇÃO DO MODELO DE DADOS**
- [ ] Criar migrations SQL que **se encaixem** na estrutura de banco já existente
- [ ] Estender a tabela `tickets` com colunas de SLA, escalação e status
- [ ] Criar tabelas `sla_policies`, `escalation_policies` e `ticket_events` compatíveis
- [ ] Garantir que herança de `company_id` ou tenant_id seja respeitada
- [ ] Adicionar índices necessários para queries de performance

#### **3. IMPLEMENTAÇÃO DO BACKEND**
- [ ] Converter código Node/Express para o framework que Antigravity usa
- [ ] Implementar os 11 endpoints conforme especificação, adaptando rotas ao padrão Antigravity
- [ ] Criar serviço/controller que lida com cálculo de SLA
- [ ] Criar worker/cron que executa `updateSLAStatusAndEscalate()` a cada 1 minuto
- [ ] Implementar notificações (email, in-app, webhook) usando sistema existente do Antigravity
- [ ] Criar job queue (BullMQ, Bull, Resque, ou o que Antigravity usa) para escalação

#### **4. IMPLEMENTAÇÃO DO FRONTEND**
- [ ] Converter componente React para a arquitetura/padrão de componentes do Antigravity
- [ ] Implementar Kanban drag-and-drop (ou integrar lib já usada no projeto)
- [ ] Adicionar visual de SLA nos cards (cores: verde=ON_TIME, amarelo=WARNING, vermelho=BREACHED)
- [ ] Implementar contador de tickets atrasados por coluna
- [ ] Adicionar indicador visual de escalação (nível 1, 2, 3...)
- [ ] Criar filtros: por agente, prioridade, cliente, status SLA

#### **5. SEED DATA & CONFIGURAÇÃO**
- [ ] Criar seeds com SLA padrão por prioridade (LOW=240min, MEDIUM=120min, HIGH=60min, CRITICAL=15min)
- [ ] Criar seeds com políticas de escalonamento (nível 1=SUPERVISOR, nível 2=SPECIALIST, nível 3=MANAGER)
- [ ] Permitir que admins editem essas políticas via painel administrativo

#### **6. TESTES**
- [ ] Teste unitário: Cálculo de SLA com ticket em movimento
- [ ] Teste unitário: Pausa/retomada de SLA ao mover para WAITING_CUSTOMER
- [ ] Teste de integração: Escalonamento automático ao SLA estourar
- [ ] Teste E2E: Drag-and-drop no Kanban -> SLA retoma/pausa corretamente
- [ ] Teste de carga: Worker rodando com 10k tickets simultâneos

#### **7. INTEGRAÇÃO COM SISTEMAS EXISTENTES**
- [ ] Integrar com sistema de notificações atual (email, SMS, webhook)
- [ ] Integrar com sistema de permissões/roles (SUPERVISOR, SPECIALIST, MANAGER)
- [ ] Integrar com logs de auditoria já existentes (ou criar em `ticket_events`)
- [ ] Garantir que histórico de tickets não seja perdido

#### **8. DOCUMENTAÇÃO**
- [ ] Documentar cada endpoint no formato que Antigravity usa (OpenAPI/Swagger, se aplicável)
- [ ] Documentar fluxo de SLA: quando pausa, quando escala, quando resolve
- [ ] Documentar regras de negócio por tipo de usuário
- [ ] Criar guia de operação para agentes e supervisores

#### **9. DEPLOYMENT & MONITORAMENTO**
- [ ] Criar variáveis de ambiente (SLA intervals, escalation max_level, etc.)
- [ ] Adicionar logs estruturados em todos os pontos críticos (SLA check, escalação, notificação)
- [ ] Criar alertas se worker de SLA não rodar por mais de 5 minutos
- [ ] Criar dashboard de monitoramento (quantos tickets escalados hoje? % SLA cumprido?)

---

## QUESTÕES CRÍTICAS A RESPONDER

Antes de começar no Antigravity, esclareça sobre a estrutura do Altdesk:

1. **Modelo de dados atual do Altdesk**: Já existe tabela `tickets`? Qual estrutura?
2. **Integração com Antigravity**: Como você está usando a IDE para gerar models/migrations?
3. **Autenticação no Altdesk**: Como users e companies estão mapeados?
4. **Multi-tenancy**: Como Altdesk separa dados por empresa/cliente?
5. **Jobs/Workers**: O Altdesk já usa alguma fila (BullMQ, RabbitMQ) ou precisa criar?
6. **Notificações**: Sistema de email/SMS/webhook já existe no Altdesk?
7. **Frontend Altdesk**: Qual framework? React, Vue, ou outro?
8. **Padrões de código**: Como estão organizadas as pastas/componentes no Altdesk?
9. **CI/CD**: Antigravity tem integração com git/deploy automático?

---

## CONTEXTO DE NEGÓCIO

### Diferencial competitivo
Com essa implementação, Antigravity terá:
- ✅ Visibilidade total de SLA em tempo real
- ✅ Escalonamento automático quando SLA estourar (sem intervenção manual)
- ✅ Kanban que guia a operação, não só visualiza
- ✅ Métricas que mostram gargalos e performance de agentes
- ✅ Redução de tickets vencidos (operação mais ágil)

### Impacto para o cliente
- Maior satisfação (SLA respeitado)
- Operação mais previsível
- Melhor alocação de recursos
- Rastreabilidade total via `ticket_events`

---

## PRIORIZAÇÃO (MVP)

### Fase 1 - Core (Semana 1-2)
- Modelo de dados + migrations
- Cálculo de SLA na criação do ticket
- Status e mudança de coluna no Kanban
- Worker de SLA básico (apenas ON_TIME/BREACHED)

### Fase 2 - Automação (Semana 3)
- Pausa/retomada de SLA
- Escalonamento automático
- Notificações (email + in-app)
- Ticket_events para auditoria

### Fase 3 - Visibilidade (Semana 4)
- Kanban visual completo
- Filtros por agente/prioridade/SLA
- Dashboard com métricas
- Admin panel para editar SLA policies

---

## ENTREGA ESPERADA

1. **Feature Kanban implementada** no Altdesk dentro do Antigravity
2. **Migrations de dados** para adicionar colunas de SLA e escalonamento
3. **Modelos atualizados** (sla_policies, escalation_policies, ticket_events)
4. **APIs criadas** via Antigravity (11 endpoints conforme spec)
5. **Componente visual Kanban** (drag-and-drop com cards de SLA)
6. **Worker de automação** rodando a cada 1 minuto
7. **Testes** (unitário + integração)
8. **Documentação** no projeto Altdesk
9. **Build gerado** pronto para deploy via Antigravity

---

## NOTAS FINAIS

- Esse código é **base evolutiva**: pode ser expandido com regras customizadas por cliente
- A pausa/retomada de SLA é **crítica**: teste isso muito bem no Altdesk
- O worker rodando a cada 1 minuto **deve ser robusto**: não pode travar, não pode perder eventos
- Métricas de SLA são **venda forte**: coloque bem visível no dashboard do Altdesk
- Auditoria (`ticket_events`) é **compliance**: não apague registros antigos
- Use os recursos do Antigravity para geração automática de código onde possível
- Valide que o build final do Altdesk inclui todo o novo código sem erros

---

## WORKFLOW NO ANTIGRAVITY

1. **Modelos** - Crie/atualize modelos de dados no visual editor do Antigravity
2. **Migrations** - Gere migrations automáticas
3. **APIs** - Use o gerador de CRUD do Antigravity como base
4. **Lógica de negócio** - Implemente funções de SLA e escalonamento
5. **Frontend** - Crie componentes do Kanban
6. **Deploy** - Build e deploy via Antigravity
7. **Teste** - Use ferramentas integradas de teste do Antigravity

---

## CHECKLIST FINAL ANTES DE ENTREGAR

- [ ] Código buildável e sem erros de compilação
- [ ] Migrations rodam sem erro
- [ ] Todos os 11 endpoints testados manualmente
- [ ] Worker de SLA testado com múltiplos tickets
- [ ] Escalação automática acontece corretamente
- [ ] Notificações são enviadas
- [ ] Histórico de ticket_events está completo
- [ ] Performance: <100ms para listar Kanban com 1000 tickets
- [ ] Documentação atualizada
- [ ] Code review feito
- [ ] Pronto para staging/produção
