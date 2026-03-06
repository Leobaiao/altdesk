# Arquitetura (alto nível)
- Frontend: React + Socket.IO (UI estilo WhatsApp)
- Backend: Node/TS + Express + Socket.IO
- DB: SQL Server (Express em dev)
- Canais: WhatsApp (GTI/Z-API) e WhatsApp oficial (Cloud API/BSP) via adapters

## Normalização de eventos
Webhook -> Adapter (provider) -> NormalizedInbound -> resolve conversa -> grava Message -> orquestra -> envia resposta (optional)

## Multi-agente
Orchestrator executa bots internos para triagem, billing, etc.
O padrão recomendado no MVP: bots geram **sugestão** ao agente (AgentSuggestion) ao invés de auto-reply irrestrito.

## Knowledge Base (fase 2)
RAG: KBDocument/KBChunk, busca (FTS ou vetorial), chamada LLM via BYOK.
