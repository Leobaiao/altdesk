# Frases prontas e automações
## Conceitos
- CannedResponse: resposta pronta acessível no UI (1 clique)
- CannedShortcut: atalhos por slash (/sla /pix /status)
- AutomationRule: regra que dispara SUGGEST ou AUTO_REPLY/ESCALATE/OPEN_TICKET
- AgentSuggestion: sugestão gerada e auditável

## Recomendações (MVP)
- Começar com SUGGEST (agent-assist). Habilitar AUTO_REPLY só para saudações/ack.
- Variáveis suportadas no template: {{nome}}, {{protocolo}}, {{sla}}, {{empresa}}

## Regras iniciais sugeridas
1) FIRST_MESSAGE -> SUGGEST -> "Olá! Recebi sua mensagem..."
2) OUT_OF_HOURS -> AUTO_REPLY -> "Estamos fora do horário..."
3) KEYWORD(cancelar, estorno, processo) -> OPEN_TICKET + ESCALATE(HIGH)
4) KEYWORD(preço, valor, orçamento) -> SUGGEST -> frase comercial
5) SLA_RISK -> SUGGEST -> "Estamos priorizando seu atendimento..."

## UI
- Botão ⚡ Respostas rápidas
- Campo com / para atalhos
- Painel lateral "Sugestões" com Aplicar/Descartar
