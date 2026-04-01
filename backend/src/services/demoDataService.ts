import sql from "mssql";
import { getPool } from "../db.js";
import { createArticle } from "./knowledgeService.js";
import { findOrCreateConversation, saveInboundMessage, saveOutboundMessage } from "./conversation.js";
import { createTicketForConversation } from "./ticketService.js";
import { createContact } from "./contact.js";
import { createCannedResponse } from "./canned-response.js";
import { logger } from "../lib/logger.js";

export async function preloadDemoData(tenantId: string, model: "basic" | "demo", adminId?: string) {
    logger.info({ tenantId, model, adminId }, "Starting demo data preload");

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

        // 1.5 Quick Responses (Canned Responses)
        const cannedResponses = [
            { shortcut: "boasvindas", title: "Boas-vindas", content: "Olá! Seja muito bem-vindo ao suporte da nossa empresa. Em que posso te ajudar hoje?" },
            { shortcut: "finalizar", title: "Finalizar Atendimento", content: "Foi um prazer te atender! Espero ter resolvido todas as suas dúvidas. Até logo!" }
        ];

        if (model === "demo") {
            cannedResponses.push(
                { shortcut: "demo", title: "Mensagem Demo", content: "Esta é uma resposta rápida de demonstração configurada automaticamente durante o onboarding." },
                { shortcut: "pix", title: "Dados para PIX", content: "Nossa chave PIX para pagamentos é: financeiro@empresa.com.br. Após o pagamento, por favor envie o comprovante por aqui." }
            );
        }

        for (const cr of cannedResponses) {
            await createCannedResponse(tenantId, cr.shortcut, cr.content, cr.title);
        }

        const pool = await getPool();
        const demoConnectorId = "demo_whatsapp_conn_" + tenantId.substring(0, 8);
        const chResult = await pool.request()
            .input("tenantId", tenantId)
            .input("connectorId", demoConnectorId)
            .query(`
                DECLARE @chId UNIQUEIDENTIFIER = NEWID();
                INSERT INTO altdesk.Channel (ChannelId, TenantId, Type, Name)
                VALUES (@chId, @tenantId, 'WHATSAPP', 'WhatsApp (Demonstração)');
                
                INSERT INTO altdesk.ChannelConnector (ConnectorId, ChannelId, Provider, ConfigJson)
                VALUES (@connectorId, @chId, 'GTI', '{}');
                
                SELECT @chId AS ChannelId;
            `);

        // 1.7 Assign Admin to the new instance
        if (adminId) {
            logger.info({ tenantId, demoConnectorId, adminId }, "Assigning admin to demo instance");
            await pool.request()
                .input("tenantId", tenantId)
                .input("connectorId", demoConnectorId)
                .input("userId", adminId)
                .query(`
                    INSERT INTO altdesk.InstanceAssignment (TenantId, ConnectorId, UserId)
                    VALUES (@tenantId, @connectorId, @userId)
                `);
        } else {
            logger.warn({ tenantId }, "No adminId provided for demo assignment");
        }

        // 2. Sample Contacts, Conversations and Tickets
        const demoContacts = [
            { name: "João Silva", phone: "5511999998888", email: "joao@example.com", notes: "Cliente recorrente", tags: ["Demonstração"] },
            { name: "Maria Oliveira", phone: "5511977776666", email: "maria@example.com", notes: "Interesse em upgrade", tags: ["Demonstração"] }
        ];

        for (const c of demoContacts) {
            await createContact(tenantId, c);
            try {
                const cid = await findOrCreateConversation(tenantId, c.phone, c.name, adminId);
                logger.info({ tenantId, cid, contact: c.name }, "Demo conversation created");
                
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

                // Add a sample outbound message (from the agent)
                await saveOutboundMessage(tenantId, cid, "Olá! Sou o assistente virtual da AltDesk. Em que posso te ajudar com seu pedido hoje?");

                // Create a ticket if it's the demo model
                if (model === "demo") {
                    await createTicketForConversation(tenantId, cid, "MEDIUM");
                }
            } catch (convErr: any) {
                console.error("Error creating conversation for", c.name, "Error:", convErr);
                throw convErr; // fail fast so outer try/catch logs it
            }
        }

        // 3. More demo tickets if model === demo
        if (model === "demo") {
            const extraContacts = [
                { name: "Carlos Ferreira", phone: "5511988887777", email: "carlos@example.com", tags: ["Demonstração", "Prioritário"] },
                { name: "Ana Souza", phone: "5511966665555", email: "ana@example.com", tags: ["Demonstração"] }
            ];
            for (const ec of extraContacts) {
                await createContact(tenantId, ec);
                const cid = await findOrCreateConversation(tenantId, ec.phone, ec.name, adminId);
                await saveInboundMessage({
                    channel: "WHATSAPP",
                    provider: "GTI",
                    timestamp: Date.now(),
                    tenantId,
                    externalChatId: ec.phone,
                    externalUserId: ec.phone + "@s.whatsapp.net",
                    senderName: ec.name,
                    text: "Preciso de ajuda com a integração da API.",
                    raw: { from: ec.phone }
                }, cid);
                await createTicketForConversation(tenantId, cid, "HIGH");
            }
        }

        logger.info({ tenantId }, "Demo data preload finished");
    } catch (err: any) {
        console.error("Failed to preload demo data", err);
        logger.error({ tenantId, error: err.message }, "Failed to preload demo data");
    }
}
