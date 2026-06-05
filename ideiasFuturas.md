# 🚀 Ideias Futuras e Melhorias - AltDesk

Este documento lista as funcionalidades planejadas, melhorias de UX e expansões do sistema para o futuro.

---

## 💬 Comunicação e Chat
- [x] **Chat de Equipe Interno:** Implementar um canal de comunicação direta entre agentes/colaboradores (estilo Slack/Teams) que não dependa de um ticket aberto. (Implementado: rotas e lógica em `findOrCreateInternalConversation` para chats diretos entre usuários/agentes).

verificar se tem sistema de fila para envio de mensagem de whatsapp, se não tiver implementar, pois é uma funcionalidade de atendimento essencial. (Verificado: não há fila de envio de mensagens de WhatsApp, elas são enviadas síncronas via adapter com tratamento de erros na UI).
- [x] **Transferência de Conversas com Contexto:** Permitir que agentes deixem um resumo ao transferir uma conversa para outro colega ou fila. (Implementado: rota `/assign` aceita parâmetro `reason` e cria nota interna com o contexto da transferência).
- [ ] **Histórico Unificado do Cliente:** Ver todas as interações (WhatsApp, Email, Portal) em uma única linha do tempo no perfil do contato.
- [ ] **Integração de Programas Externos:** Abrir espaço para integrar scripts ou widgets de terceiros dentro da área de atendimento.

## 🤖 Automação e IA
- [ ] **Sugestão de Resposta com IA:** Integrar com GPT para sugerir respostas baseadas na Base de Conhecimento. (Parcial: Esboço da IA com Ollama/TriageBot existe no código em `agents.ts` mas não está integrado às rotas/UI).
- [ ] **Tradução em Tempo Real:** Tradução automática de mensagens para atendimento internacional.
- [ ] **Classificação Automática:** IA para sugerir tags e prioridade com base no texto inicial do ticket.

## 📊 Dashboard e Relatórios
- [ ] **Mapa de Calor de Atendimento:** Visualizar picos de demanda por região ou horário de forma mais granular.
- [x] **Exportação Personalizada:** Gerador de relatórios em PDF/Excel com filtros dinâmicos. (Implementado: `exportService` e rotas `/export` com exportação em CSV, XLSX e PDF usando filtros dinâmicos).
- [x] **KPIs de Eficiência:** Relatórios detalhados de tempo de primeira resposta e resolução por agente. (Implementado: métricas de TMR, tempo de resolução e conformidade de SLA na rota `/stats` e relatórios de performance por agente).

## 🛠️ Infraestrutura e Segurança
- [ ] **2FA (Autenticação de Dois Fatores):** Aumentar a segurança do login para agentes.
- [x] **Logs de Auditoria Avançados:** Rastreamento detalhado de alterações em configurações críticas. (Implementado: tabela `AuditLog`, serviço `writeAuditLog` e rotas de listagem para administradores e superadmins).
- [ ] **Modo Offline:** Cache local para permitir leitura de mensagens sem conexão momentânea. (Parcial: PWA está configurado no Frontend via `vite-plugin-pwa`, mas não há persistência offline local de mensagens em IndexedDB/localStorage).

## 🎓 Conhecimento e FAQ
- [ ] **Promover Ticket para KB:** Função para transformar uma solução de ticket bem-sucedida em um artigo de Base de Conhecimento com um clique.
- [ ] **Portal de FAQ Público:** Gerar uma página de ajuda externa baseada nos artigos marcados como "Públicos". (Parcial: Existe rota pública `/api/knowledge/public/search` para pesquisar artigos marcados como públicos, mas não uma página de FAQ pública estruturada).
