import sql from "mssql";
import { getPool } from "../db.js";
import { createArticle } from "./knowledgeService.js";
import { findOrCreateConversation, saveInboundMessage } from "./conversation.js";
import { createTicketForConversation } from "./ticketService.js";
import { createContact } from "./contact.js";
import { logger } from "../lib/logger.js";

export async function preloadDemoData(tenantId: string, model: "basic" | "demo") {
    logger.info({ tenantId, model }, "Starting demo data preload");

    try {
        // 1. Knowledge Base Articles
        const articles = [
            {
                Title: "Como configurar meu perfil?",
                Content: "Para configurar seu perfil, acesse Configurações > Perfil e preencha seus dados básicos e foto de exibição.",
                Category: "Demonstração",
                IsPublic: true
            },
            {
                Title: "Política de Reembolso",
                Content: "Nossa política de reembolso permite solicitações em até 7 dias após a compra, desde que o serviço não tenha sido totalmente utilizado.",
                Category: "Demonstração",
                IsPublic: true
            },
            {
                Title: "Horários de Atendimento",
                Content: "Nosso suporte funciona de segunda a sexta, das 08:00 às 18:00, e aos sábados das 09:00 às 13:00.",
                Category: "Demonstração",
                IsPublic: true
            }
        ];

        if (model === "demo") {
            articles.push(
                {
                    Title: "Guia de Integração API",
                    Content: "Para integrar via API, utilize o Token gerado no menu Desenvolvedores e siga a documentação técnica oficial.",
                    Category: "Demonstração",
                    IsPublic: true
                },
                {
                    Title: "Segurança da Conta",
                    Content: "Recomendamos a ativação da autenticação de dois fatores (2FA) em Segurança > Autenticação para proteger sua conta.",
                    Category: "Demonstração",
                    IsPublic: true
                }
            );
        }

        for (const art of articles) {
            await createArticle(tenantId, art);
        }

        // 1.5 Create a Demo Channel to allow conversation routing
        const pool = await getPool();
        const chResult = await pool.request()
            .input("tenantId", tenantId)
            .query(`
                DECLARE @chId UNIQUEIDENTIFIER = NEWID();
                INSERT INTO altdesk.Channel (ChannelId, TenantId, Type, Name)
                VALUES (@chId, @tenantId, 'WHATSAPP', 'WhatsApp (Demonstração)');
                
                INSERT INTO altdesk.ChannelConnector (ConnectorId, ChannelId, Provider, ConfigJson)
                VALUES ('demo_whatsapp_conn_' + CAST(NEWID() AS NVARCHAR(36)), @chId, 'GTI', '{}');
                
                SELECT @chId AS ChannelId;
            `);

        // 2. Sample Contacts, Conversations and Tickets
        const demoContacts = [
            { name: "João Silva", phone: "5511999998888", email: "joao@example.com", notes: "Cliente recorrente", tags: ["Demonstração"] },
            { name: "Maria Oliveira", phone: "5511977776666", email: "maria@example.com", notes: "Interesse em upgrade", tags: ["Demonstração"] }
        ];

        for (const c of demoContacts) {
            await createContact(tenantId, c);
            try {
                const cid = await findOrCreateConversation(tenantId, c.phone, c.name);
                
                // Add a sample inbound message
                await saveInboundMessage({
                    channel: "WHATSAPP",
                    provider: "GTI",
                    timestamp: Date.now(),
                    tenantId,
                    externalChatId: c.phone,
                    externalUserId: c.phone + "@s.whatsapp.net",
                    senderName: c.name,
                    text: "Olá, gostaria de tirar uma dúvida sobre meu pedido.",
                    raw: { from: c.phone }
                }, cid);

                // Create a ticket if it's the demo model
                if (model === "demo") {
                    await createTicketForConversation(tenantId, cid, "MEDIUM");
                }
            } catch (convErr: any) {
                console.error("Error creating conversation for", c.name, "Error:", convErr);
                throw convErr; // fail fast so outer try/catch logs it
            }
        }

        logger.info({ tenantId }, "Demo data preload finished");
    } catch (err: any) {
        console.error("Failed to preload demo data", err);
        logger.error({ tenantId, error: err.message }, "Failed to preload demo data");
        // We don't throw here to avoid failing the whole onboarding if only demo data fails
    }
}
