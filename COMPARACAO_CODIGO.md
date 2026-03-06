# 🔄 Comparação: Código Base vs. Código Atual

> Documento comparando o código original (protótipo/MVP) com o sistema atual implementado.

---

## 1. Visão Geral da Evolução

| Métrica | Código Base | Código Atual | Crescimento |
|---|---|---|---|
| **Arquivos backend** | 9 arquivos | 30+ arquivos | ~3.3x |
| **Arquivos frontend** | 2 arquivos | 25+ arquivos | ~12.5x |
| **Tabelas no banco** | 14 tabelas | 18 tabelas | +4 tabelas |
| **Rotas da API** | 4 endpoints (monolítico) | ~40 endpoints (modular) | ~10x |
| **Serviços backend** | 1 (conversation) | 5 serviços | 5x |
| **Adaptadores** | 2 (stubs com TODO) | 3 (funcionais) | Implementados |
| **Componentes React** | 1 (App.tsx monolítico) | 17+ componentes | ~17x |
| **Linhas frontend** | ~160 linhas | ~2.500+ linhas | ~15x |
| **Linhas backend** | ~400 linhas total | ~3.000+ linhas | ~7.5x |
| **Docker** | Apenas SQL Server | 3 containers completos | ✅ |

---

## 2. Backend — O que Mudou

### 2.1 Arquitetura: Monolítico → Modular

**ANTES (Código Base):**
Tudo em um único arquivo `index.ts` (166 linhas):
```
backend/src/
├── index.ts          ← TUDO aqui: login, webhook, agents, loadConnector
├── db.ts
├── auth.ts
├── mw.ts
├── agents.ts
├── adapters/
│   ├── types.ts
│   ├── gti.ts        ← Stub com TODOs
│   └── official.ts   ← Stub com TODOs
└── services/
    └── conversation.ts  ← Apenas 3 funções básicas
```

**DEPOIS (Código Atual):**
Separado em 13 módulos de rotas + 5 serviços:
```
backend/src/
├── index.ts          ← Apenas bootstrap + injeção de dependência
├── db.ts
├── auth.ts
├── mw.ts
├── utils.ts          ← [NOVO] Helpers compartilhados
├── agents.ts
├── adapters/
│   ├── types.ts      ← Expandido: StatusUpdate, parseStatusUpdate
│   ├── gti.ts        ← IMPLEMENTADO: envio, recebimento, webhook, status
│   ├── official.ts   ← Estrutura pronta
│   └── webchat.ts    ← [NOVO] Adaptador WebChat
├── routes/           ← [NOVO] 13 módulos de rota
│   ├── auth.ts
│   ├── profile.ts
│   ├── admin.ts          (21KB — maior arquivo, CRUD SuperAdmin)
│   ├── chat.ts           (11KB — conversas + mensagens)
│   ├── webhooks.ts       (recebimento + status update)
│   ├── settings.ts
│   ├── users.ts
│   ├── contacts.ts
│   ├── queues.ts
│   ├── templates.ts
│   ├── cannedResponses.ts
│   ├── dashboard.ts
│   └── agents.ts
├── services/         ← Expandido de 1 para 5 serviços
│   ├── conversation.ts  ← Expandido: findOrCreate, updateStatus, delete
│   ├── contact.ts       ← [NOVO]
│   ├── queue.ts         ← [NOVO]
│   ├── template.ts      ← [NOVO]
│   └── canned-response.ts ← [NOVO]
├── middleware/       ← [NOVO]
│   ├── errorHandler.ts
│   └── validateMw.ts
└── scripts/          ← [NOVO]
    └── create_sysadmin.ts
```

### 2.2 Login — Antes vs. Depois

**ANTES:**
```typescript
// Exigia tenantId obrigatório para login
app.post("/api/auth/login", async (req, res) => {
  const body = z.object({
    tenantId: z.string().uuid(),      // ← OBRIGATÓRIO
    email: z.string().email(),
    password: z.string().min(6)
  }).parse(req.body);
  // ... sem verificação de SUPERADMIN
  const token = signToken({ userId, tenantId, role });
  return res.json({ token });       // ← Só retornava token
});
```

**DEPOIS:**
```typescript
// TenantId é opcional, SUPERADMIN pode logar sem tenant
const LoginSchema = z.object({
  tenantId: z.string().uuid().optional(),  // ← OPCIONAL
  email: z.string().email(),
  password: z.string().min(6)
});

// Se não informar tenantId, busca por email apenas
// SUPERADMIN pula verificação de tenant ativo
if (u.Role !== 'SUPERADMIN') {
  await assertTenantActive(u.TenantId);
}
return res.json({ token, role: u.Role, tenantId: u.TenantId }); // ← Retorna role e tenantId
```

### 2.3 GTI Adapter — Antes vs. Depois

**ANTES (51 linhas, tudo TODO):**
```typescript
// parseInbound: mapeamento genérico/placeholder
const externalUserId = String(body?.from ?? body?.sender ?? body?.phone ?? "");
// sendText: NÃO IMPLEMENTADO
throw new Error("GTI sendText() não implementado");
// sendMenu: NÃO IMPLEMENTADO
throw new Error("GTI sendMenu() não implementado");
```

**DEPOIS (230+ linhas, completo):**
```typescript
// parseInbound: mapeamento real da GTI/uazapi
// Suporta: text, image, audio/ptt, video, document
// Extrai: sender_pn, chatid, messageTimestamp, caption, url, fileName, messageId
if (body?.EventType !== "messages") { /* ignora outros eventos */ }
const externalUserId = String(msg.sender_pn ?? msg.chatid ?? "");

// sendText: IMPLEMENTADO
const response = await fetch(`${baseUrl}/send/text`, {
  headers: { "Content-Type": "application/json", "token": cfg.token },
  body: JSON.stringify({ instance: cfg.instance, number: to, text })
});

// parseStatusUpdate: [NOVO] — Tracking de entrega/leitura
// setWebhook: [NOVO] — Configurar webhook na GTI via API
// getWebhook: [NOVO] — Consultar webhooks configurados
// removeWebhook: [NOVO] — Remover webhook
```

### 2.4 Webhook Route — Antes vs. Depois

**ANTES:**
```typescript
// Rota inline no index.ts, sem tratamento de status
app.post("/api/webhooks/whatsapp/:provider/:connectorId", async (req, res) => {
  const inbound = adapter.parseInbound(req.body, connector);
  await saveInboundMessage(inbound, conversationId);
  io.to(conversationId).emit("message:new", { /* apenas texto */ });
  // Orquestrador síncrono (bloqueava a resposta)
  const decisions = await orch.run("TriageBot", ...);
  return res.status(200).json({ ok: true, decisions });
});
```

**DEPOIS:**
```typescript
// Módulo separado (webhooks.ts), com status update e notificação ao tenant
router.post("/whatsapp/:provider/:connectorId/*", async (req, res) => {
  // 1. Tenta status update (messages_update → delivered/read)
  if (adapter.parseStatusUpdate) {
    const statusUpdate = adapter.parseStatusUpdate(req.body, connector);
    if (statusUpdate) {
      await updateMessageStatus(tenantId, externalMessageId, status);
      io.to(`tenant:${tenantId}`).emit("message:status", { /* status */ });
    }
  }
  // 2. Tenta mensagem inbound (messages → new message)
  const inbound = adapter.parseInbound(req.body, connector);
  io.to(`tenant:${tenantId}`).emit("message:new", { /* texto + mídia */ });
  io.to(`tenant:${tenantId}`).emit("conversation:updated", { /* last msg */ });
  // Orquestrador assíncrono (não bloqueia)
  orch.run(...).catch(err => console.error(err));
});
```

### 2.5 Conversation Service — Antes vs. Depois

**ANTES (3 funções):**
- `resolveConversationForInbound()` — Criar/resolver conversa para webhook
- `saveInboundMessage()` — Salvar mensagem recebida (sem mídia)
- `saveOutboundMessage()` — Salvar mensagem enviada

**DEPOIS (6+ funções):**
- `resolveConversationForInbound()` — Melhorado, suporta ExternalMessageId
- `saveInboundMessage()` — Expandido: MediaType, MediaUrl, ExternalMessageId
- `saveOutboundMessage()` — Mantido
- `findOrCreateConversation()` — [NOVO] Para criar conversas a partir de contatos
- `updateMessageStatus()` — [NOVO] Atualizar SENT → DELIVERED → READ
- `deleteConversation()` — [NOVO] Deletar conversa

### 2.6 Novas Funcionalidades de Backend (inexistentes no código base)

| Feature | Arquivo | Descrição |
|---|---|---|
| **Super Admin CRUD** | `routes/admin.ts` (21KB) | Gestão completa de Tenants, Instances, Users |
| **Perfil do Usuário** | `routes/profile.ts` | GET/PUT com avatar, nome, cargo |
| **Gestão de Contatos** | `routes/contacts.ts` + `services/contact.ts` | CRUD com tags e notas |
| **Filas de Atendimento** | `routes/queues.ts` + `services/queue.ts` | Criação e atribuição |
| **Respostas Rápidas** | `routes/cannedResponses.ts` | CRUD de templates prontos |
| **Templates** | `routes/templates.ts` + `services/template.ts` | Templates de mensagem |
| **Configurações** | `routes/settings.ts` | Instância padrão por tenant |
| **Dashboard** | `routes/dashboard.ts` | Métricas do tenant |
| **Validação Zod** | `middleware/validateMw.ts` | Middleware genérico de validação |
| **Error Handler** | `middleware/errorHandler.ts` | Tratamento global de erros com logging |
| **WebChat Adapter** | `adapters/webchat.ts` | Novo canal de comunicação |

---

## 3. Frontend — O que Mudou

### 3.1 Estrutura: 1 Arquivo → 25+ Arquivos

**ANTES (2 arquivos, ~160 linhas):**
```
frontend/src/
├── App.tsx    ← TUDO aqui: login simulado, chat demo, sidebar estática
└── main.tsx
```

O frontend original era um **protótipo visual estático**:
- Conversas hardcoded (`demo-1`, `demo-2`)
- Sem autenticação real
- Sem conexão com banco de dados
- API chamava apenas `/api/demo/conversations/:id/messages`
- Sem CSS externo (estilos inline)
- Sem sidebar de navegação
- Sem páginas separadas

**DEPOIS (25+ arquivos, ~2.500+ linhas):**
```
frontend/src/
├── App.tsx               ← Router + autenticação real (12KB)
├── Settings.tsx          ← Página de configurações (15KB)
├── Users.tsx             ← Gestão de usuários (18KB)
├── Contacts.tsx          ← Gestão de contatos (10KB)
├── CannedResponses.tsx   ← Respostas rápidas (8KB)
├── QueueSettings.tsx     ← Filas de atendimento (6KB)
├── Dashboard.tsx         ← Métricas (4KB)
├── SuperAdmin.tsx        ← Painel SuperAdmin (2KB)
├── index.css             ← Design system completo (12KB)
├── lib/
│   └── api.ts            ← Axios instance com interceptor JWT
├── contexts/
│   └── ChatContext.tsx    ← Context API para estado do chat
├── components/
│   ├── Sidebar.tsx           ← Navegação principal (6KB)
│   ├── ChatWindow.tsx        ← Chat completo (23KB)
│   ├── AudioPlayer.tsx       ← Player de áudio (3KB)
│   ├── DocumentCard.tsx      ← Card de documento (2KB)
│   ├── EmojiPicker.tsx       ← Seletor de emojis (5KB)
│   ├── ImageViewerModal.tsx  ← Viewer de imagens (3KB)
│   ├── TemplateModal.tsx     ← Modal de templates (11KB)
│   ├── Toast.tsx             ← Notificações (1KB)
│   └── SuperAdmin/
│       ├── InstancesTab.tsx      ← Aba de instâncias (11KB)
│       ├── TenantsTab.tsx        ← Aba de empresas (9KB)
│       ├── UsersTab.tsx          ← Aba de usuários (7KB)
│       └── Modals/
│           ├── InstanceModal.tsx
│           ├── TenantModal.tsx
│           ├── UserModal.tsx
│           ├── WebhookModal.tsx
│           ├── LimitModal.tsx
│           └── ConnectorConfigModal.tsx
└── assets/               ← [NOVO] 9 assets (ícones, etc.)
```

### 3.2 Chat — Antes vs. Depois

**ANTES (App.tsx, 159 linhas):**
- ❌ Conversas hardcoded em array local
- ❌ Sem autenticação
- ❌ Apenas mensagens de texto demo
- ❌ Sem suporte a mídia
- ❌ Layout fixo de 3 colunas
- ❌ Sem busca funcional
- ❌ Estilo inline básico

**DEPOIS (ChatWindow.tsx, 23KB):**
- ✅ Conversas carregadas da API (`GET /api/conversations`)
- ✅ Autenticação JWT completa
- ✅ Envio real via WhatsApp/GTI
- ✅ Suporte a imagem, áudio, vídeo, documento
- ✅ Player de áudio customizado
- ✅ Viewer de imagens fullscreen
- ✅ Picker de emojis
- ✅ Templates de mensagem
- ✅ Respostas rápidas via atalhos
- ✅ Contagem de não lidas (UnreadCount)
- ✅ Busca e filtro de conversas
- ✅ Transferência de conversa
- ✅ Encerrar conversa
- ✅ Iniciar nova conversa a partir de contato
- ✅ Socket.IO real-time (mensagens + status)
- ✅ Design responsivo com CSS customizado

### 3.3 Páginas Totalmente Novas (inexistentes no código base)

| Página | Funcionalidade |
|---|---|
| **Login Real** | Formulário com email/senha, JWT, role-based routing |
| **Settings** | Perfil do usuário + Instância padrão do tenant |
| **Users** | CRUD completo de usuários com roles |
| **Contacts** | CRUD de contatos com tags, email, notas |
| **QueueSettings** | Gestão de filas de atendimento |
| **CannedResponses** | Respostas rápidas pré-configuradas |
| **Dashboard** | Métricas e estatísticas |
| **SuperAdmin** | Painel multi-tenant com 3 abas e 6 modais |

---

## 4. Banco de Dados — O que Mudou

### 4.1 Schema (`01-schema.sql`)

**Tabelas existentes no código base mas modificadas:**

| Tabela | Mudança |
|---|---|
| `omni.Tenant` | +`DefaultProvider` (NVARCHAR(50), default 'GTI') |
| `omni.Channel` | +`Type` (era referenciado mas não existia na coluna) |
| `omni.Conversation` | +`QueueId`, +`AssignedUserId` (foreign keys) |
| `omni.Message` | +`MediaType`, +`MediaUrl`, +`ExternalMessageId`, +`Status` |

**Tabelas adicionadas:**

| Tabela | Descrição |
|---|---|
| `omni.Queue` | Filas de atendimento |
| `omni.Contact` | Contatos com telefone, email, tags |

### 4.2 Automação (`02-canned-and-automation.sql`)

**Modificações:**
- `omni.CannedResponse`: +`Shortcut`, +`Content` (eram referenciados no seed mas não existiam)

### 4.3 Seed (`03-seed.sql`)

**ANTES:** Inseria dados sem `Shortcut` e `Content` → causava erro.
**DEPOIS:** Corrigido para incluir todos os campos obrigatórios.

---

## 5. Infraestrutura — O que Mudou

### 5.1 Docker

**ANTES:**
```yaml
# docker/docker-compose.yml — apenas SQL Server
services:
  sqlserver:
    image: mcr.microsoft.com/mssql/server:2022-latest
    ports: ["1433:1433"]
```

**DEPOIS:**
```yaml
# docker-compose.yml — 3 containers completos
services:
  db:        # SQL Server 2022
  backend:   # Node.js + Express (build customizado com Dockerfile)
  frontend:  # React + Nginx (build customizado com Dockerfile)
volumes:
  mssql_data:  # Persistência de dados
```

### 5.2 Scripts de Operação (Novos)

| Script | Comando | Descrição |
|---|---|---|
| `db:reset` | `npm run db:reset` | Reseta banco e roda seeds |
| `create_sysadmin` | `npx tsx scripts/create_sysadmin.ts` | Cria usuário SUPERADMIN |

---

## 6. Resumo de Evolução

```
CÓDIGO BASE (Protótipo/MVP)          →    CÓDIGO ATUAL (Produção)
─────────────────────────────        →    ─────────────────────────────
Monolítico (1 arquivo index.ts)      →    Modular (13 rotas + 5 services)
Frontend demo (hardcoded)            →    Frontend completo (25+ arquivos)
GTI adapter com TODOs                →    GTI adapter funcional + webhook + status
2 adaptadores stub                   →    3 adaptadores implementados
Sem autenticação real                →    JWT + roles (SUPERADMIN/ADMIN/AGENT)
Sem multi-tenant real                →    Multi-tenant completo
Sem Docker para app                  →    3 containers Docker Compose
Sem painel admin                     →    SuperAdmin com 3 abas + 6 modais
Sem gestão de contatos               →    CRUD completo de contatos
Sem filas de atendimento             →    Filas com atribuição
Sem respostas rápidas                →    CRUD de respostas + atalhos
Sem tracking de status               →    SENT → DELIVERED → READ
Sem suporte a mídia                  →    Imagem, áudio, vídeo, documento
Sem CSS/Design System                →    Design system completo (12KB CSS)
~570 linhas total                    →    ~5.500+ linhas total (~10x)
```

---

*Documento gerado em 25/02/2026*
