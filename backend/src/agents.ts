export type AgentContext = {
  tenantId: string;
  conversationId: string;
  userId?: string;
  externalSenderId?: string;
};

export type AgentDecision =
  | { type: "REPLY"; text: string }
  | { type: "SUGGEST"; text: string; ruleId?: string }
  | { type: "ESCALATE"; reason: string; priority: "LOW"|"MEDIUM"|"HIGH"|"URGENT" }
  | { type: "ASK_AGENT"; agent: string; question: string };

export interface IAgent {
  name: string;
  handle(input: string, ctx: AgentContext): Promise<AgentDecision[]>;
}

export class TriageBot implements IAgent {
  name = "TriageBot";
  async handle(input: string): Promise<AgentDecision[]> {
    const t = input.toLowerCase();
    if (/(cancelar|estorno|processo|procon|juizado)/i.test(t)) {
      return [{ type: "ESCALATE", reason: "Tema sensível/risco", priority: "HIGH" }];
    }
    if (/(preço|valor|orçamento)/i.test(t)) {
      return [{ type: "SUGGEST", text: "Sugestão: enviar frase comercial padrão (preço/condições)." }];
    }
    return [{ type: "SUGGEST", text: "Sugestão: pedir nome e contexto para triagem rápida." }];
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
