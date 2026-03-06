# Brief de implementação (Fase 1)
## Objetivo
OmniChat: central de atendimento estilo WhatsApp (layout de grupos), com tickets/escalonamento e automações de respostas prontas.
Canal cliente: **WhatsApp (GTI não-oficial)** + **Webchat**. Android via **PWA instalável** (fase 1.5).

## Escopo Fase 1 (MVP)
1) Banco SQL Server Express local (scripts em /db).
2) Login/JWT (users/agents/roles).
3) UI WhatsApp-like (lista conversas, mensagens, painel de ticket).
4) Webhook GTI (inbound) normalizado e persistido.
5) Envio outbound via GTI (texto + menu, conforme docs GTI).
6) Respostas rápidas (canned responses) + atalhos (/pix, /sla etc).
7) Automação: gerar SUGGEST (recomendação ao agente) e, opcionalmente, AUTO_REPLY para casos neutros.
8) Estruturar adaptadores para WhatsApp Oficial (placeholder).

## Fase 2
- BYOK IA como Knowledge Base (RAG) com auditoria de uso.
- Migração gradual do WhatsApp não-oficial para oficial (Cloud API/BSP).

## Definição de pronto (Fase 1)
- Um payload real de webhook GTI (texto) cria/resolve conversa e grava mensagem.
- O painel exibe a mensagem em tempo real.
- O agente envia resposta (manual ou frase pronta) e o sistema envia via API GTI.
