export type AgentContext = {
  tenantId: string;
  conversationId: string;
  userId?: string;
  externalSenderId?: string;
};

export type AgentDecision =
  | { type: "REPLY"; text: string }
  | { type: "SUGGEST"; text: string; ruleId?: string }
  | { type: "ESCALATE"; reason: string; priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT" }
  | { type: "ASK_AGENT"; agent: string; question: string };

export interface IAgent {
  name: string;
  handle(input: string, ctx: AgentContext): Promise<AgentDecision[]>;
}

import { getChatCompletion } from "./services/aiService.js";

export class TriageBot implements IAgent {
  name = "TriageBot";

  async handle(input: string, ctx: AgentContext): Promise<AgentDecision[]> {
    const systemPrompt = `
      Você é um assistente de triagem para um sistema de atendimento omnichannel.
      Analise a mensagem do usuário e decida a melhor ação.
      Você deve retornar um JSON no seguinte formato:
      [
        { "type": "REPLY", "text": "mensagem para o usuário" },
        { "type": "SUGGEST", "text": "sugestão para o agente humano" },
        { "type": "ESCALATE", "reason": "motivo da escalação", "priority": "LOW|MEDIUM|HIGH|URGENT" }
      ]
      
      Regras:
      - Se o usuário quiser cancelar, processar a empresa ou estiver muito irritado, use ESCALATE com priority HIGH ou URGENT.
      - Se for uma dúvida simples, use SUGGEST para ajudar o agente.
      - Se for uma saudação, você pode usar REPLY para responder automaticamente.
      - Retorne apenas o array JSON, sem texto explicativo.
    `;

    try {
      const response = await getChatCompletion([
        { role: "system", content: systemPrompt },
        { role: "user", content: `Mensagem do usuário: "${input}"\nTenantId: ${ctx.tenantId}` }
      ]);

      // Ollama returns the full response object, we need the content
      const content = response.message?.content || "[]";

      // Attempt to parse the content as JSON
      try {
        const decisions = JSON.parse(content);
        if (Array.isArray(decisions)) {
          return decisions;
        }
      } catch (parseError) {
        console.warn("[TriageBot] Failed to parse AI JSON response, falling back to suggestion.");
        return [{ type: "SUGGEST", text: content }];
      }
    } catch (error) {
      console.error("[TriageBot] AI Error:", error);
      return [{ type: "SUGGEST", text: "Erro ao processar com IA. Verifique se o Ollama está rodando." }];
    }

    return [];
  }
}

export class Orchestrator {
  private agents: Map<string, IAgent>;
  constructor(list: IAgent[]) {
    this.agents = new Map(list.map(a => [a.name, a]));
  }
  async run(entry: string, input: string, ctx: AgentContext): Promise<AgentDecision[]> {
    const a = this.agents.get(entry);
    if (!a) return [{ type: "SUGGEST", text: "Agente não encontrado." }];
    return a.handle(input, ctx);
  }
}
