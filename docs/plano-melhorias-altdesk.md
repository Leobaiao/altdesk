# PROMPT — Plano de Melhorias AltDesk (para agente de IA / Antigravity)

> **Como usar este arquivo:** cole este documento inteiro como prompt inicial do agente. Ele contém contexto do projeto, o diagnóstico do que já existe no código vs. o que falta, e um plano de execução passo a passo, em ordem de prioridade. Trabalhe **uma fase por vez**, sempre abrindo um PR/branch por item, e ao final de cada item rode a "Definição de Pronto" antes de seguir para o próximo.

---

## 0. Contexto do projeto

Você vai trabalhar no repositório **AltDesk** (`https://github.com/Leobaiao/altdesk`), uma plataforma SaaS multi-tenant de atendimento/helpdesk (concorrente de Zendesk/Tomticket/Freshdesk), com canais de WhatsApp, e-mail e chat web.

**Stack identificada:**
- **Frontend cliente:** React + Vite + TypeScript (`/frontend`)
- **Frontend admin (SuperAdmin):** React + Vite + TypeScript (`/admin/frontend`)
- **Backend cliente:** Node.js + TypeScript + Express, driver `mssql` (`/backend`)
- **Backend admin:** Node.js + TypeScript + Express (`/admin/backend`)
- **Banco de dados:** SQL Server (schema `altdesk`), scripts versionados em `/backend/db/*.sql` e `/db/*.sql`
- **Infra:** Docker Compose, Nginx/Caddy, deploy em Locaweb (`/deploy`)
- **Gateway de pagamento:** Asaas (`billing.service.ts`)

O time já mantém alguns documentos internos de acompanhamento (`docs/melhorias_hoje.md`, `ideiasFuturas.md`, `notasDeMelhorias.md`, `docs/plano_de_testes_melhorias.md`) — **leia-os antes de começar**, pois há um histórico de decisões e nomenclaturas já usadas no projeto (ex.: `sp_altdesk_seed_demo`, `sp_altdesk_purge_demo_data`, `AuditLog`, `TrashTab`).

---

## 1. Metodologia de trabalho (boas práticas de mercado)

Siga estas práticas em **todos** os itens abaixo, não apenas nos itens que mencionam explicitamente:

1. **Um branch por item**, nomeado `fix/<slug>` ou `feat/<slug>`, partindo de `development` (ou a branch principal de trabalho do repo).
2. **Commits pequenos e semânticos** no padrão Conventional Commits (`fix:`, `feat:`, `refactor:`, `chore:`, `docs:`).
3. **Migrações de banco sempre idempotentes** (`IF NOT EXISTS...`), seguindo o padrão numérico já usado em `/backend/db/NN-nome.sql` — nunca edite um arquivo de migração já aplicado em produção; crie um novo arquivo.
4. **Nunca hardcode strings de negócio no frontend em inglês** — centralize em um objeto de tradução (ex.: `PRIORITY_LABELS`, `SLA_STATUS_LABELS`) já que o projeto usa esse padrão em vários lugares (`Reports.tsx`, `Kanban.tsx`, `TicketDetail.tsx`).
5. **Toda alteração em fluxo de pagamento/assinatura precisa de teste manual documentado** em `docs/plano_de_testes_melhorias.md` (siga o formato já existente: Objetivo, Onde, Passos, Resultado Esperado).
6. **Auditoria:** ações administrativas sensíveis (mover para lixeira, alterar plano, alterar data de vencimento) devem gravar em `AuditLog` via `writeAuditLog`, como já é feito em `admin/backend/src/routes/admin.ts`.
7. **Nada de "big bang":** cada correção deve poder ser revertida/deployada isoladamente. Use feature flags/config de tenant (`TenantSettings`) quando a mudança for visual/opcional.
8. **Teste os três perfis de acesso** (SuperAdmin, Admin do tenant, Agente/Colaborador) sempre que mexer em telas compartilhadas — o projeto tem um sistema de ACL (`END_USER`, Agente, Admin) já implementado.
9. **Verifique o LibreOffice/PDF/print** não se aplica aqui, mas **sempre rode o build do frontend (`npm run build`) e o backend (`tsc`)** antes de considerar o item concluído, para pegar erros de tipo.

**Definição de Pronto (DoD) padrão para cada item:**
- [ ] Código implementado e sem erros de build (`tsc`/`vite build`)
- [ ] Migração SQL (se houver) testada em banco limpo (`docker exec -it altdesk_api npm run db:reset`)
- [ ] Teste manual documentado e executado
- [ ] Sem strings em inglês visíveis ao usuário final (a menos que seja termo técnico aceito, tipo "SLA")
- [ ] Auditoria registrada quando a ação for administrativa
- [ ] Sem regressão nos 3 perfis de acesso

---

## 2. Diagnóstico — o que já está implementado vs. pendente

Este diagnóstico foi feito lendo o código-fonte real do repositório (não é suposição). Use-o como ponto de partida, mas **sempre confirme o estado atual antes de codar**, pois o repo pode ter evoluído.

| # | Item da lista de correções | Status encontrado no código | Evidência |
|---|---|---|---|
| 1 | Cadastrar SLA automaticamente na carga da base (pequeno/médio/grande) | ❌ **Não implementado.** A tabela `altdesk.SLAPolicy` existe (`backend/db/21-kanban-sla.sql`), mas nenhuma rotina de onboarding (`backend/db/09-onboarding.sql`, `demoDataService.ts`) insere políticas padrão nela. | Busca por `SLAPolicy` fora do `CREATE TABLE` não retorna nenhum `INSERT` de seed |
| 2 | Mostrar progresso de carga no onboarding grande ("carregando chamados...", "carregando usuários...") | ❌ **Não implementado.** Só existe um spinner genérico ("Criando..."). | `frontend/src/Onboarding.tsx` linha ~450 |
| 3/4 | Índices nas colunas usadas em `WHERE` (data, agente, contato, sla) | ✅ **Parcialmente implementado**, e bem feito. Há índices cobrindo `Tenant+DeletedAt+SlaStatus`, `Tenant+Status+Priority`, `Contact.LastActivityAt`, etc. | `backend/db/35-reports-indexes.sql`, `db/01-schema.sql` |
| 5 | Faturamento: SuperAdmin administra planos (não assina), textos de lançamento "Founders Edition" editáveis, planos configuráveis (Starter/Professional/Enterprise) com limites de agentes/usuários/contatos | ⚠️ **Parcial.** Existe `altdesk.BillingPlan` (Code, Name, PriceCents, AgentsSeatLimit) mas **faltam** campos de limite de usuários/contatos, flag de plano promocional, e o texto de lançamento não é editável (não existe em nenhuma tabela). | `backend/db/07-billing-and-service-desk.sql` |
| 6 | Página de comparação de planos (estilo tomticket.com/recursos) | ❌ **Não implementado.** Não há rota/página de comparação no frontend. | busca em `frontend/src` |
| 7 | Faixa de lançamento "Founders Edition" antes dos planos + "ver todos os detalhes" | ❌ **Não implementado.** | `frontend/src/Billing.tsx` não tem banner de lançamento |
| 8 | Remover a palavra "trial" das telas do cliente final | ⚠️ **Parcial / pendente de auditoria.** A palavra "trial" ainda aparece 13x em 4 arquivos voltados ao usuário. | `frontend/src/Billing.tsx`, `Onboarding.tsx`, `App.tsx`, `contexts/ChatContext.tsx` |
| 9 | Políticas de SLA ao lado de Tags, no mesmo layout | ❌ **Não unificado.** SLA vive como aba dentro de `Settings.tsx` (`SlaSettingsTab.tsx`); Tags é uma tela própria e separada (`TagsSettings.tsx`), com layout diferente. | comparar os dois arquivos |
| 10 | Traduzir termos em inglês na tela de detalhes do ticket (sidebar direita) | ✅ **Já corrigido no código atual** (prioridade e status de SLA já são traduzidos via mapa `{LOW: "Baixa", ...}` e `{BREACHED: "Violado", ...}`). Vale uma varredura geral no restante do app à procura de outros pontos esquecidos. | `frontend/src/components/TicketDetail.tsx` linhas ~540 e ~596 |
| 11.1 | Admin: não consegue mover empresa para lixeira / corrigir data de trial | ⚠️ **Backend parece implementado** (`DELETE /api/admin/tenants/:id` faz soft delete em cascata; `PUT /api/admin/tenants/:id/subscription` aceita `expiresAt`). O bug relatado é provavelmente de **integração/permissão no frontend**, não ausência de funcionalidade — precisa reproduzir e depurar. | `admin/backend/src/routes/admin.ts` |
| 11.2 | Ao anexar arquivo na conversa, aparece uma tela errada (modal sobre a tela de "Logs de Auditoria") | ❌ **Bug confirmado — causa raiz a investigar.** O componente do modal de envio de arquivo fica em `ChatWindow.tsx`; aparenta ser vazamento de estado/roteamento de modal (outro modal renderizando por baixo). | `frontend/src/components/ChatWindow.tsx` |
| 11.3 | Assinatura vencida: liberar 7 dias de renovação; na segunda vez, redirecionar para tela de oferta especial | ❌ **Não implementado.** Não há lógica de carência (grace period) nem tela de "segunda oferta" no fluxo de assinatura. | `backend/src/services/subscriptionService.ts`, `frontend/src/Billing.tsx` |
| 11.4 | Bug já reportado: erro ao recuperar senha ("Erro interno do servidor") | ✅ **Causa raiz encontrada.** Em `POST /forgot-password`, a chamada `await sendPasswordResetEmail(email, resetLink)` não tem `try/catch` — se o envio de e-mail falhar (SMTP fora do ar/mal configurado), o erro sobe e vira 500 para o usuário. | `backend/src/routes/public.ts` linha ~85 |
| 11.5 | Onboarding: opção de popular base de dados grande (1000 contatos, 5000 mensagens, 5000 tickets) | ✅ **Já implementado.** Existe a opção "Demonstração Pesada" (`model: "large"`) tanto no backend (`demoDataService.ts`, `sp_altdesk_seed_demo`) quanto no frontend (`Onboarding.tsx`). Vale conferir se os volumes batem exatamente com 1000/5000/5000. | `backend/src/services/demoDataService.ts`, `frontend/src/Onboarding.tsx` |

---

## 3. Plano de execução — passo a passo, por prioridade

### 🔴 Fase 1 — Bugs críticos em produção (fazer primeiro, alto impacto/baixo risco)

**1.1 — Corrigir erro 500 na recuperação de senha**
- Arquivo: `backend/src/routes/public.ts`
- Envolver `sendPasswordResetEmail` em `try/catch` próprio, **sem** deixar a falha de e-mail impedir a resposta de sucesso genérica ao usuário (o padrão "shadow success" já usado no bloco de usuário não encontrado deve valer também aqui).
- Logar o erro real (via `logger.error`) para observabilidade interna, sem expor detalhes ao cliente.
- Validar também a configuração de SMTP (`emailService.ts`) — checar variáveis de ambiente e adicionar fallback/log claro quando não configurado.
- Teste manual: disparar `/forgot-password` com SMTP propositalmente quebrado e confirmar que o usuário recebe a mensagem de sucesso normalmente (sem 500).

**1.2 — Corrigir bug do modal de anexo de arquivo na conversa**
- Arquivo: `frontend/src/components/ChatWindow.tsx`
- Reproduzir o fluxo: abrir uma conversa → anexar arquivo → observar se aparece um modal por cima de outra tela (ex.: Logs de Auditoria) que não deveria estar montada.
- Investigar: (a) portal/z-index conflitando com outro modal que ficou montado em memória; (b) roteamento condicional que não desmonta o componente anterior; (c) reaproveitamento indevido de um componente genérico de "modal" com estado global compartilhado.
- Corrigir isolando o estado do modal de upload e garantindo `unmount` correto dos modais anteriores.
- Teste manual: anexar arquivos de diferentes tipos/tamanhos em conversas de diferentes canais (WhatsApp, e-mail, webchat) e confirmar que a UI mostra sempre a tela correta de confirmação de envio.

**1.3 — Investigar e corrigir "não consigo mandar empresa para a lixeira" / "não consigo corrigir data de trial"**
- Arquivos: `admin/frontend/src/components/SuperAdmin/TenantsTab.tsx`, `admin/backend/src/routes/admin.ts`
- O backend (`DELETE /tenants/:id`, `PUT /tenants/:id/subscription`) parece correto — reproduza o erro real no ambiente do usuário (console do navegador + rede) para achar a causa: permissão de role, token expirado, erro de validação do `zod`, ou tenant já com `DeletedAt` preenchido travando alguma constraint.
- Corrigir a causa raiz encontrada; adicionar mensagem de erro amigável no frontend caso a ação falhe (hoje pode estar falhando silenciosamente).
- Teste manual: mover uma empresa de teste para a lixeira, restaurar via `TrashTab.tsx`, e editar a data de expiração/trial de uma assinatura ativa.

**1.4 — Implementar carência de 7 dias + tela de segunda oferta na assinatura vencida**
- Arquivos: `backend/src/services/subscriptionService.ts`, `frontend/src/Billing.tsx`
- Adicionar campo de controle de "primeira expiração" vs "segunda expiração" (ex.: `GraceExpiresAt` ou reaproveitar `Status = 'grace_period'`, que já existe no enum de `BillingSubscription`).
- Regra: na primeira vencida, liberar acesso por mais 7 dias em modo de carência (banner de aviso, sem bloquear o uso).
- Na segunda vencida (fim da carência sem pagamento), redirecionar o usuário para uma nova tela `WinBackOffer` com uma condição especial (texto/preço configurável pelo SuperAdmin, seguindo o mesmo padrão do texto de "Founders Edition" da Fase 2).
- Teste manual: simular os dois vencimentos alterando `ExpiresAt` manualmente e validar os dois estados de UI.

---

### 🟠 Fase 2 — Fundação de dados e onboarding

**2.1 — Cadastrar políticas de SLA padrão automaticamente na carga de base de dados**
- Arquivos: `backend/db/` (nova migração, ex. `39-default-sla-policies.sql`), `backend/src/services/demoDataService.ts` ou stored procedure `sp_altdesk_seed_demo`
- Criar um `INSERT` idempotente de `SLAPolicy` para os 4 níveis de prioridade (LOW, MEDIUM, HIGH, CRITICAL), com valores sensatos de `FirstResponseMinutes`/`ResolutionMinutes`/`WarningBeforeMinutes` por padrão, executado **para todo tenant novo**, independente do volume escolhido (pequeno, médio ou grande) — não somente no modelo "large".
- Ideal: mover esse `INSERT` para dentro da criação do tenant (rota/serviço que cria o tenant no onboarding), não apenas no seed de demonstração, para garantir que **todo** tenant tenha SLA cadastrado desde o primeiro dia.
- Teste manual: criar um tenant novo do zero (qualquer volume) e verificar em `SlaSettingsTab.tsx` que as 4 prioridades já vêm preenchidas.

**2.2 — Indicador de progresso granular no onboarding com volume grande**
- Arquivo: `frontend/src/Onboarding.tsx`, `backend/src/routes/onboarding.ts` (ou WebSocket/SSE se já existir infraestrutura de eventos em tempo real no projeto — verificar).
- Se o backend não emitir eventos de progresso hoje, a forma mais simples e de mercado é: o backend quebra a carga em etapas (`queues/agentes` → `contatos` → `conversas/mensagens` → `tickets` → `KB`) e emite progresso via *Server-Sent Events* ou *polling* em um endpoint `GET /onboarding/:tenantId/progress`.
- Frontend: substituir o spinner genérico por uma lista de etapas com estado (`pendente` → `em andamento` → `concluído`), ex.: "Carregando usuários...", "Carregando contatos...", "Carregando chamados...".
- Teste manual: rodar onboarding com modelo "Demonstração Pesada" e confirmar que o usuário vê o progresso etapa por etapa, sem parecer travado.

**2.3 — Revisar cobertura de índices**
- Arquivos: `backend/db/*indexes*.sql`
- Validar se todas as colunas usadas em cláusulas `WHERE`/`JOIN` de relatórios e listagens de alto volume (Ticket por Agente, Contato por telefone/email, Mensagem por conversa+data) têm índice — a maior parte já existe; adicionar o que faltar seguindo o padrão `IF NOT EXISTS (...) CREATE NONCLUSTERED INDEX ...`.
- Teste: rodar `SET STATISTICS IO ON` / plano de execução nas queries mais pesadas (listagem de tickets com filtro grande) antes/depois.

---

### 🟡 Fase 3 — Comercial / Faturamento (crítico para monetização)

**3.1 — Modelo de planos completo**
- Arquivos: `backend/db/07-billing-and-service-desk.sql` (nova migração para estender `BillingPlan`), `admin/frontend/src/components/SuperAdmin/BillingTab.tsx`, `frontend/src/Billing.tsx`
- Estender `altdesk.BillingPlan` com: `UserLimit`, `ContactLimit` (hoje só existe `AgentsSeatLimit`), `IsPromotional BIT`, `AdditionalAgentPriceCents` (para o "Valor Agente Adicional" citado na lista), e um texto de marketing editável (`MarketingHeadline`, `MarketingDescription`) para a faixa "Founders Edition"/lançamento.
- Confirmar regra de negócio: SuperAdmin **administra** os planos (CRUD completo, incluindo textos e valores); Admin do tenant **apenas visualiza** os planos disponíveis para assinar — dados só são digitáveis no SuperAdmin, como pedido na lista original.
- Criar tela/seção no SuperAdmin para CRUD de planos e do texto promocional, com toggle de "promoção ativa (s/n)".
- Teste manual: criar os planos Starter/Professional/Enterprise no SuperAdmin com os valores de exemplo da lista original e confirmar que aparecem corretamente (e apenas leitura) na tela de Billing do cliente.

**3.2 — Faixa de lançamento + planos + página de comparação**
- Arquivo: `frontend/src/Billing.tsx` + nova rota `frontend/src/PlansCompare.tsx` (ou equivalente)
- Adicionar, acima da lista de planos, uma faixa/banner reaproveitável (mesmo componente da faixa de assinatura já mencionada no código) puxando o texto configurado no SuperAdmin (item 3.1), com CTA "Ver todos os detalhes".
- Criar página de comparação (referência funcional: tomticket.com/recursos) com 1 a 3 colunas dinâmicas conforme a quantidade de planos ativos, listando as características de cada um.
- Adicionar link "Comparar planos" abaixo da lista de planos na tela de Billing.
- Teste manual: validar responsividade da página de comparação com 1, 2 e 3 planos ativos.

**3.3 — Remover a palavra "trial" das telas voltadas ao cliente final**
- Arquivos: `frontend/src/Billing.tsx`, `frontend/src/Onboarding.tsx`, `frontend/src/App.tsx`, `frontend/src/contexts/ChatContext.tsx`
- Substituir todo texto visível ao usuário que contenha "trial" por "período de teste" ou "avaliação gratuita" (manter `AccountStatus === "TRIAL"` como valor técnico interno do banco/enum — não precisa renomear o enum, só o texto exibido).
- Teste manual: `grep -rniE "\btrial\b" frontend/src` deve retornar zero ocorrências em texto visível (JSX/strings), mantendo apenas comparações de enum no código.

---

### 🟢 Fase 4 — Polimento de UX e i18n

**4.1 — Unificar layout de Políticas de SLA com Tags**
- Arquivos: `frontend/src/components/SlaSettingsTab.tsx`, `frontend/src/TagsSettings.tsx`
- Decidir a melhor abordagem de mercado: mover SLA para dentro da mesma tela/menu de Tags (como duas abas de um mesmo módulo "Configurações de Atendimento") reaproveitando o layout de lista + formulário lateral já usado em um dos dois componentes (escolher o que tiver o padrão visual mais atual do design system do projeto).
- Teste manual: navegar entre as duas configurações e confirmar consistência visual (espaçamento, botões, cores) e que nenhuma funcionalidade existente quebrou.

**4.2 — Varredura final de textos em inglês**
- Rodar uma busca ampla por palavras-chave comuns de status/prioridade em inglês fora dos mapas de tradução já existentes (`grep -rniE "\b(OPEN|CLOSED|PENDING|ASSIGNED|UNASSIGNED)\b" frontend/src`) e traduzir o que estiver sem tratamento, seguindo o mesmo padrão de objeto de tradução já usado em `Reports.tsx`/`Kanban.tsx`/`TicketDetail.tsx`.
- Teste manual: navegar por todas as telas principais (Kanban, Tickets, Relatórios, Contatos, Configurações) como Agente e como Admin, e listar qualquer termo em inglês remanescente.

---

## 4. Ordem sugerida de execução (resumo)

1. 1.1 → 1.2 → 1.3 → 1.4 (bugs críticos)
2. 2.1 → 2.3 → 2.2 (fundação de dados)
3. 3.1 → 3.2 → 3.3 (comercial)
4. 4.1 → 4.2 (polimento)

Ao final de cada fase, gere um resumo no padrão já usado em `docs/melhorias_hoje.md` (seção "✅ Concluído") e um caso de teste no padrão de `docs/plano_de_testes_melhorias.md`, para manter a documentação do projeto consistente com o histórico já existente.
