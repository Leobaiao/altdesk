# 📋 OmniChat — Documentação Completa do Projeto

> **Plataforma omnichannel de atendimento ao cliente via WhatsApp com painel administrativo, integração GTI/uazapi, e comunicação em tempo real.**

---

## 1. Visão Geral

O **OmniChat** é uma plataforma SaaS multi-tenant de atendimento ao cliente que centraliza conversas de WhatsApp (via API GTI/uazapi) em um painel web. O sistema permite que empresas gerenciem múltiplos atendentes, filas de atendimento, contatos, respostas rápidas e templates de mensagem — tudo em tempo real via WebSocket.

### Stack Tecnológico

| Camada | Tecnologia |
|---|---|
| **Frontend** | React 18 + TypeScript + Vite |
| **Backend** | Node.js + Express + TypeScript |
| **Banco de Dados** | Microsoft SQL Server 2022 |
| **Real-time** | Socket.IO (WebSocket) |
| **Integração WhatsApp** | GTI/uazapi API |
| **Deploy** | Docker Compose (3 containers) |
| **Autenticação** | JWT (JSON Web Tokens) |

---

## 2. Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                        DOCKER COMPOSE                           │
│                                                                 │
│  ┌──────────────┐   ┌──────────────────┐   ┌────────────────┐  │
│  │   Frontend   │   │     Backend      │   │   SQL Server   │  │
│  │  (React +    │──▶│  (Express +      │──▶│   2022         │  │
│  │   Nginx)     │   │   Socket.IO)     │   │                │  │
│  │  porta: 80   │   │  porta: 3002     │   │  porta: 14333  │  │
│  └──────────────┘   └────────┬─────────┘   └────────────────┘  │
│                              │                                  │
│                              │ Webhook                          │
│                              ▼                                  │
│                    ┌──────────────────┐                         │
│                    │   GTI/uazapi     │                         │
│                    │   (WhatsApp)     │                         │
│                    └──────────────────┘                         │
└─────────────────────────────────────────────────────────────────┘
```

### Fluxo de Mensagens

```
MENSAGEM RECEBIDA (Inbound):
  Celular → WhatsApp → GTI API → Webhook POST → Backend → DB + Socket.IO → Frontend (tempo real)

MENSAGEM ENVIADA (Outbound):
  Frontend → Backend API → GTI API → WhatsApp → Celular do cliente
```

---

## 3. Banco de Dados — Schema Completo

O banco utiliza o schema `omni` com **18 tabelas** distribuídas em 3 scripts SQL:

### 3.1 Tabelas Principais (`01-schema.sql`)

| Tabela | Descrição | Colunas Chave |
|---|---|---|
| `omni.Tenant` | Empresas/inquilinos | `Name`, `DefaultProvider`, `IsActive` |
| `omni.Subscription` | Planos de assinatura | `PlanCode`, `AgentsSeatLimit`, `ExpiresAt` |
| `omni.[User]` | Usuários do sistema | `Email`, `DisplayName`, `Role`, `PasswordHash` |
| `omni.Agent` | Agentes (humano/bot) | `Kind` (HUMAN/BOT), `UserId` |
| `omni.Channel` | Canais de comunicação | `Type` (WHATSAPP/WEBCHAT) |
| `omni.ChannelConnector` | Conectores de integração | `Provider` (GTI/ZAPI/OFFICIAL), `ConfigJson` |
| `omni.Queue` | Filas de atendimento | `Name`, `IsActive` |
| `omni.Conversation` | Conversas | `Title`, `Kind`, `Status`, `AssignedUserId`, `QueueId` |
| `omni.ConversationMember` | Membros da conversa | `AgentId`, `Role` |
| `omni.Contact` | Contatos | `Name`, `Phone`, `Email`, `Tags`, `Notes` |
| `omni.Message` | Mensagens | `Direction` (IN/OUT), `Body`, `MediaType`, `MediaUrl`, `Status` (SENT/DELIVERED/READ), `ExternalMessageId` |
| `omni.ExternalThreadMap` | Mapa de threads externos | `ExternalChatId`, `ExternalUserId`, `ConversationId` |
| `omni.Ticket` | Tickets de suporte | `Priority`, `Status`, `SLA_DueAt` |
| `omni.LLMUsage` | Uso de IA/LLM | `Provider`, `Model`, `PromptTokens`, `CostUSD` |

### 3.2 Tabelas de Automação (`02-canned-and-automation.sql`)

| Tabela | Descrição |
|---|---|
| `omni.CannedResponse` | Respostas rápidas pré-configuradas |
| `omni.CannedShortcut` | Atalhos para respostas rápidas |
| `omni.AutomationRule` | Regras de automação (trigger + action) |
| `omni.AgentSuggestion` | Sugestões de IA para agentes |

---

## 4. Backend (API REST + WebSocket)

### 4.1 Estrutura de Arquivos

```
backend/
├── src/
│   ├── index.ts                 # Servidor Express + Socket.IO
│   ├── db.ts                    # Pool de conexão SQL Server
│   ├── auth.ts                  # Hash, JWT, verificação de senha
│   ├── mw.ts                    # Middlewares (auth, role)
│   ├── utils.ts                 # Helpers (loadConnector)
│   ├── agents.ts                # Orquestrador de IA (TriageBot)
│   ├── adapters/
│   │   ├── types.ts             # Interfaces: ChannelAdapter, NormalizedInbound, StatusUpdate
│   │   ├── gti.ts               # Adaptador GTI/uazapi (principal)
│   │   ├── official.ts          # Adaptador WhatsApp Official API
│   │   └── webchat.ts           # Adaptador WebChat
│   ├── routes/
│   │   ├── auth.ts              # POST /api/auth/login
│   │   ├── profile.ts           # GET/PUT /api/profile
│   │   ├── admin.ts             # CRUD instâncias, tenants, users (SuperAdmin)
│   │   ├── chat.ts              # Conversas, mensagens, envio
│   │   ├── webhooks.ts          # Recebimento de webhooks GTI + status updates
│   │   ├── settings.ts          # Configurações do tenant
│   │   ├── users.ts             # CRUD usuários
│   │   ├── contacts.ts          # CRUD contatos
│   │   ├── queues.ts            # CRUD filas
│   │   ├── templates.ts         # CRUD templates
│   │   ├── cannedResponses.ts   # CRUD respostas rápidas
│   │   ├── dashboard.ts         # Métricas do dashboard
│   │   └── agents.ts            # CRUD agentes
│   ├── services/
│   │   ├── conversation.ts      # Resolver/criar conversas, salvar mensagens, status
│   │   ├── contact.ts           # Lógica de contatos
│   │   ├── queue.ts             # Atribuição de filas
│   │   ├── template.ts          # Lógica de templates
│   │   └── canned-response.ts   # Lógica de respostas rápidas
│   └── middleware/
│       ├── errorHandler.ts      # Handler global de erros
│       └── validateMw.ts        # Validação Zod
├── scripts/
│   └── create_sysadmin.ts       # Script para criar superadmin
└── db/
    ├── 01-schema.sql
    ├── 02-canned-and-automation.sql
    └── 03-seed.sql
```

### 4.2 Rotas da API — Referência Completa

#### Autenticação
| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/login` | Login com email + senha → retorna JWT |

#### Perfil
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/profile` | Dados do usuário logado |
| PUT | `/api/profile` | Atualizar senha, avatar, nome, cargo |

#### Super Admin (`/api/admin`)
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/admin/tenants` | Listar todas as empresas |
| POST | `/api/admin/tenants` | Criar empresa |
| DELETE | `/api/admin/tenants/:id` | Desativar empresa |
| GET | `/api/admin/instances` | Listar todas as instâncias |
| POST | `/api/admin/instances` | Criar instância (Channel + Connector) |
| PUT | `/api/admin/instances/:id` | Atualizar instância |
| DELETE | `/api/admin/instances/:id` | Soft-delete instância |
| GET | `/api/admin/instances/:id/webhook` | Ver webhook configurado na GTI |
| POST | `/api/admin/instances/:id/set-webhook` | Configurar webhook na GTI |
| DELETE | `/api/admin/instances/:id/webhook/:webhookId` | Remover webhook |
| GET | `/api/admin/users` | Listar todos os usuários |
| POST | `/api/admin/users` | Criar usuário |
| PUT | `/api/admin/users/:id` | Atualizar usuário |

#### Chat (`/api/conversations`)
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/conversations` | Listar conversas (filtro por role) |
| GET | `/api/conversations/:id/messages` | Mensagens de uma conversa |
| POST | `/api/conversations/:id/messages` | Enviar mensagem (texto/mídia) |
| POST | `/api/conversations/:id/close` | Encerrar conversa |
| POST | `/api/conversations/:id/transfer` | Transferir para agente/fila |
| DELETE | `/api/conversations/:id` | Deletar conversa |
| POST | `/api/conversations/new` | Iniciar conversa a partir de contato |
| POST | `/api/conversations/:id/assign` | Atribuir conversa a um agente |

#### Webhooks (recebimento de mensagens)
| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/whatsapp/:provider/:connectorId/*` | Webhook da GTI → processa mensagem inbound |
| POST | `/api/external/webchat/message` | Webhook do webchat |

#### Outros CRUDs
| Grupo | Rotas |
|---|---|
| Contatos | `GET/POST /api/contacts`, `PUT/DELETE /api/contacts/:id` |
| Filas | `GET/POST /api/queues`, `PUT/DELETE /api/queues/:id` |
| Usuários | `GET/POST /api/users`, `PUT/DELETE /api/users/:id` |
| Respostas Rápidas | `GET/POST /api/canned-responses`, `PUT/DELETE /api/canned-responses/:id` |
| Templates | `GET/POST /api/templates`, `PUT/DELETE /api/templates/:id` |
| Dashboard | `GET /api/dashboard` (métricas) |
| Configurações | `GET/PUT /api/settings` (instância padrão, provider) |

### 4.3 Adaptadores de Canal (Pattern: Adapter)

O sistema usa o **padrão Adapter** para suportar múltiplos provedores de WhatsApp:

```typescript
// Interface comum para todos os adaptadores
interface ChannelAdapter {
  provider: "GTI" | "ZAPI" | "OFFICIAL" | "WEBCHAT";
  parseInbound(body, connector): NormalizedInbound | null;    // Parsear webhook recebido
  parseStatusUpdate?(body, connector): StatusUpdate | null;   // Status entregue/lido
  sendText(connector, to, text): Promise<void>;               // Enviar texto
  sendMenu?(connector, to, title, options): Promise<void>;    // Enviar menu interativo
  setWebhook?(connector, options): Promise<void>;             // Configurar webhook na API
  getWebhook?(connector): Promise<any>;                       // Consultar webhook
  removeWebhook?(connector, webhookId): Promise<void>;        // Remover webhook
}
```

#### Adaptadores Implementados:

| Adaptador | Arquivo | Status |
|---|---|---|
| **GTI/uazapi** | `adapters/gti.ts` | ✅ Completo (envio, recebimento, webhook, status) |
| **Official API** | `adapters/official.ts` | ⚠️ Estrutura pronta, falta credenciais |
| **WebChat** | `adapters/webchat.ts` | ✅ Funcional |

### 4.4 Tracking de Status de Mensagem

O sistema rastreia o status de cada mensagem enviada em tempo real:

```
📤 SENT → 📦 DELIVERED → 👁️ READ
```

- A GTI envia eventos `messages_update` via webhook
- O `GtiAdapter.parseStatusUpdate()` interpreta o status (ack: 3=delivered, 4=read)
- O `updateMessageStatus()` atualiza o banco
- Um evento `message:status` é emitido via Socket.IO para o frontend

### 4.5 WebSocket (Socket.IO) — Eventos em Tempo Real

| Evento | Direção | Descrição |
|---|---|---|
| `conversation:join` | Client → Server | Entrar na sala da conversa |
| `conversation:leave` | Client → Server | Sair da sala da conversa |
| `tenant:join` | Client → Server | Entrar na sala do tenant |
| `message:new` | Server → Client | Nova mensagem recebida/enviada |
| `conversation:updated` | Server → Client | Conversa atualizada (nova msg) |
| `message:status` | Server → Client | Status de mensagem atualizado (delivered/read) |

### 4.6 Sistema de Autenticação e Permissões

| Role | Permissões |
|---|---|
| `SUPERADMIN` | Acesso total: gerenciar tenants, instâncias, usuários de todas as empresas |
| `ADMIN` | Gerenciar sua empresa: usuários, filas, contatos, configurações |
| `AGENT` | Atender conversas atribuídas ou não atribuídas (fila) |

---

## 5. Frontend (React + TypeScript)

### 5.1 Páginas Implementadas

| Página | Arquivo | Funcionalidade |
|---|---|---|
| **Login** | `App.tsx` | Autenticação com email/senha |
| **Chat** | `components/ChatWindow.tsx` | Interface de chat em tempo real |
| **Contatos** | `Contacts.tsx` | CRUD completo de contatos |
| **Usuários** | `Users.tsx` | Gestão de agentes/usuários |
| **Filas** | `QueueSettings.tsx` | Configuração de filas de atendimento |
| **Respostas Rápidas** | `CannedResponses.tsx` | Gerenciar respostas pré-configuradas |
| **Dashboard** | `Dashboard.tsx` | Métricas e estatísticas |
| **Configurações** | `Settings.tsx` | Perfil + Instância padrão |
| **Super Admin** | `SuperAdmin.tsx` | Painel multi-tenant |

### 5.2 Componentes

| Componente | Arquivo | Descrição |
|---|---|---|
| `Sidebar` | `components/Sidebar.tsx` | Menu lateral com navegação |
| `ChatWindow` | `components/ChatWindow.tsx` | Janela de chat completa (23KB) |
| `AudioPlayer` | `components/AudioPlayer.tsx` | Player de áudio personalizado |
| `DocumentCard` | `components/DocumentCard.tsx` | Visualização de documentos |
| `EmojiPicker` | `components/EmojiPicker.tsx` | Seletor de emojis |
| `ImageViewerModal` | `components/ImageViewerModal.tsx` | Visualizador de imagens em tela cheia |
| `TemplateModal` | `components/TemplateModal.tsx` | Modal para templates de mensagem |
| `Toast` | `components/Toast.tsx` | Notificações toast |

### 5.3 Painel Super Admin

O Super Admin tem **3 abas** com **6 modais**:

```
SuperAdmin/
├── InstancesTab.tsx          # Aba de instâncias (WhatsApp)
├── TenantsTab.tsx            # Aba de empresas
├── UsersTab.tsx              # Aba de usuários
└── Modals/
    ├── InstanceModal.tsx     # Criar/editar instância
    ├── TenantModal.tsx       # Criar/editar empresa
    ├── UserModal.tsx         # Criar/editar usuário
    ├── WebhookModal.tsx      # Configurar webhook avançado
    ├── LimitModal.tsx        # Configurar limites
    └── ConnectorConfigModal.tsx  # Configuração do conector
```

### 5.4 ChatWindow — Funcionalidades

O componente `ChatWindow` (23KB) é o coração da aplicação e inclui:

- ✅ Lista de conversas com busca e filtro
- ✅ Contagem de mensagens não lidas (UnreadCount)
- ✅ Envio de mensagens de texto
- ✅ Suporte a mídia (imagem, áudio, vídeo, documento)
- ✅ Player de áudio customizado
- ✅ Visualizador de imagens em tela cheia
- ✅ Picker de emojis
- ✅ Templates de mensagem
- ✅ Respostas rápidas via atalhos
- ✅ Transferência de conversa para outro agente/fila
- ✅ Encerrar conversa
- ✅ Iniciar nova conversa a partir de contato
- ✅ Atualização em tempo real via Socket.IO
- ✅ Indicador de direção de mensagem (enviada/recebida)

---

## 6. Integração WhatsApp (GTI/uazapi)

### 6.1 Configuração da Instância

Cada instância GTI requer:
```json
{
  "baseUrl": "https://api.gtiapi.workers.dev",
  "token": "<token-da-api>",
  "instance": "<nome-da-instancia>",
  "apiKey": "<chave-alternativa>"
}
```

### 6.2 APIs Utilizadas

| Endpoint GTI | Método | Uso no OmniChat |
|---|---|---|
| `/send/text` | POST | Enviar mensagem de texto |
| `/webhook` | GET | Consultar webhooks configurados |
| `/webhook` | POST | Configurar/remover webhook |

### 6.3 Eventos de Webhook Processados

| EventType | Processamento |
|---|---|
| `messages` | ✅ Mensagens recebidas → salva no DB + notifica frontend |
| `messages_update` | ✅ Status de entrega/leitura → atualiza status no DB |
| `presence` | ⏭️ Ignorado (presença online/offline) |
| `chats` | ⏭️ Ignorado (atualizações de chat) |
| `connection` | ⏭️ Ignorado (status de conexão) |

### 6.4 Tipos de Mídia Suportados

| Tipo | Parsing | Envio |
|---|---|---|
| Texto | ✅ | ✅ |
| Imagem | ✅ (com caption) | ✅ |
| Áudio/PTT | ✅ | ✅ |
| Vídeo | ✅ (com caption) | ✅ |
| Documento | ✅ (com fileName) | ✅ |

---

## 7. Deploy com Docker

### 7.1 Containers

| Container | Imagem | Porta | Descrição |
|---|---|---|---|
| `omnichat_db` | `mssql/server:2022-latest` | 14333 | Banco de dados SQL Server |
| `omnichat_api` | Build customizado | 3002 | Backend Node.js + Express |
| `omnichat_web` | Build customizado (Nginx) | 80 | Frontend React |

### 7.2 Comandos de Operação

```bash
# Subir tudo
docker-compose up --build -d

# Reset do banco de dados
docker exec -it omnichat_api npm run db:reset

# Criar superadmin
docker exec -it omnichat_api npx tsx scripts/create_sysadmin.ts <email> <senha>

# Ver logs do backend
docker logs omnichat_api --tail 50

# Rebuild apenas o backend
docker-compose up --build -d backend
```

---

## 8. Sistema Multi-Tenant

O OmniChat é **multi-tenant por design**:

- Cada empresa (Tenant) tem seus próprios dados isolados
- Todas as tabelas principais têm `TenantId` como chave estrangeira
- O SUPERADMIN pode gerenciar todas as empresas
- Usuários ADMIN/AGENT só veem dados da sua própria empresa
- Instâncias WhatsApp podem ser compartilhadas entre empresas (gerenciadas pelo SuperAdmin)

---

## 9. Resumo de Funcionalidades Implementadas

### ✅ Implementado e Funcionando

1. **Autenticação JWT** — Login, logout, proteção de rotas por role
2. **Chat em tempo real** — Envio/recebimento de mensagens via Socket.IO
3. **Integração WhatsApp GTI** — Envio de texto, recebimento webhook, status de mensagem
4. **Suporte a mídia** — Imagens, áudio, vídeo, documentos
5. **Painel Super Admin** — Gestão de empresas, instâncias, usuários
6. **Configuração de Webhook** — Interface avançada para configurar webhook na GTI
7. **Gestão de Contatos** — CRUD completo com tags e notas
8. **Gestão de Usuários** — CRUD com roles (SUPERADMIN, ADMIN, AGENT)
9. **Filas de Atendimento** — Criação e atribuição de conversas a filas
10. **Respostas Rápidas** — Templates pré-configurados com atalhos
11. **Perfil do Usuário** — Avatar, nome, cargo, alteração de senha
12. **Dashboard** — Métricas de atendimento
13. **Tracking de Status** — Mensagem SENT → DELIVERED → READ
14. **Deploy Docker** — 3 containers configurados e funcionando
15. **Multi-tenancy** — Isolamento completo de dados por empresa
16. **Transferência de Conversa** — Entre agentes e filas

### ⚠️ Estruturado mas Pendente de Configuração

17. **WhatsApp Official API** — Adaptador pronto, falta credenciais Meta
18. **WebChat** — Adaptador funcional, falta widget de embed
19. **Automação (Rules)** — Schema pronto, falta interface
20. **Sugestões de IA** — Schema pronto, orquestrador básico implementado (TriageBot)
21. **Templates de Mensagem** — CRUD pronto, falta tabela `omni.Template`

---

## 10. Métricas do Código

| Métrica | Valor |
|---|---|
| **Tabelas no banco** | 18 |
| **Rotas da API** | ~40 endpoints |
| **Adaptadores de canal** | 3 (GTI, Official, WebChat) |
| **Serviços backend** | 5 |
| **Páginas frontend** | 9 |
| **Componentes React** | 17+ |
| **Modais Super Admin** | 6 |
| **Eventos Socket.IO** | 6 |
| **Containers Docker** | 3 |

---

*Documento gerado em 25/02/2026 — OmniChat v1.0*
