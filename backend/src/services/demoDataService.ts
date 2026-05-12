import sql from "mssql";
import { getPool } from "../db.js";
import { createArticle } from "./knowledgeService.js";
import { findOrCreateConversation, saveInboundMessage, saveOutboundMessage } from "./conversation.js";
import { createTicketForConversation } from "./ticketService.js";
import { createContact } from "./contact.js";
import { createCannedResponse } from "./canned-response.js";
import { createGlobalUser } from "./userService.js";
import { logger } from "../lib/logger.js";

export async function preloadDemoData(tenantId: string, model: "basic" | "demo", adminId?: string) {
    logger.info({ tenantId, model, adminId }, "Starting demo data preload");

    try {
        // 1. Knowledge Base Articles
        const articles = [
            {
                Title: "Como configurar meu perfil?",
                Content: "Para configurar seu perfil, acesse **Configurações > Perfil**. Lá você poderá alterar seu nome de exibição, foto, fuso horário e gerenciar suas preferências de notificação por e-mail e push.",
                Category: "Configuração",
                IsPublic: true
            },
            {
                Title: "Política de Reembolso e Cancelamento",
                Content: "Nossa política permite o cancelamento a qualquer momento. Para reembolsos, o prazo é de até 7 dias após a contratação inicial, conforme o Código de Defesa do Consumidor. Entre em contato com o financeiro para processar sua solicitação.",
                Category: "Financeiro",
                IsPublic: true
            },
            {
                Title: "Horários de Atendimento ao Cliente",
                Content: "Nossa equipe está disponível nos seguintes horários:\n- **Segunda a Sexta:** 08:00 às 19:00\n- **Sábados:** 09:00 às 13:00\n- **Domingos e Feriados:** Plantão apenas para emergências (Tickets Críticos).",
                Category: "Suporte",
                IsPublic: true
            }
        ];

        if (model === "demo") {
            articles.push(
                {
                    Title: "Guia Rápido de Integração via API",
                    Content: "Para integrar sistemas externos à AltDesk, gere um Token em **Configurações > Desenvolvedores**. Nossa API é RESTful e aceita JSON. Consulte a documentação completa em [docs.altdesk.com](https://docs.altdesk.com).",
                    Category: "Desenvolvedor",
                    IsPublic: true
                },
                {
                    Title: "Segurança e Autenticação em Duas Etapas (2FA)",
                    Content: "Proteja sua conta ativando o 2FA. Vá em **Segurança > Autenticação**, escaneie o QR Code com seu app preferido (Google Authenticator, Authy, etc) e insira o código de validação.",
                    Category: "Segurança",
                    IsPublic: false
                }
            );
        }

        for (const art of articles) {
            await createArticle(tenantId, art);
        }

        // 1.5 Quick Responses (Canned Responses)
        const cannedResponses = [
            { shortcut: "ola", title: "Saudação Inicial", content: "Olá! Tudo bem? Seja bem-vindo ao nosso suporte. Como posso te ajudar com o seu projeto hoje?" },
            { shortcut: "aguarde", title: "Aguardar Análise", content: "Entendido. Por favor, aguarde um instante enquanto consulto as informações no sistema. Já retorno com uma resposta." },
            { shortcut: "finalizar", title: "Encerramento Padrão", content: "Foi um prazer te atender! Se precisar de mais alguma coisa, é só chamar. Tenha um excelente dia! 👋" }
        ];

        if (model === "demo") {
            cannedResponses.push(
                { shortcut: "pix", title: "Dados para Pagamento PIX", content: "Para pagamentos via PIX, utilize nossa chave CNPJ: **00.000.000/0001-00**. Após realizar a transferência, por favor envie o comprovante por aqui para agilizarmos a baixa." },
                { shortcut: "documento", title: "Solicitação de Documento", content: "Para prosseguirmos com sua solicitação por motivos de segurança, por favor envie uma foto do seu RG ou CNH frente e verso." },
                { shortcut: "transferir", title: "Transferência de Setor", content: "Sua solicitação será encaminhada para o setor responsável. Por favor, continue na linha, um especialista já irá te atender." }
            );
        }

        for (const cr of cannedResponses) {
            await createCannedResponse(tenantId, cr.shortcut, cr.content, cr.title);
        }

        // 1.6 Setup Channel
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
        }

        // 1.8 Create Demo Team (Agents)
        if (model === "demo") {
            const team = [
                { name: "Suporte N1", email: `suporte.n1.${tenantId.substring(0, 5)}@altdesk.demo`, role: "AGENT" as const },
                { name: "Consultor Comercial", email: `vendas.${tenantId.substring(0, 5)}@altdesk.demo`, role: "AGENT" as const },
                { name: "Financeiro", email: `financeiro.${tenantId.substring(0, 5)}@altdesk.demo`, role: "AGENT" as const }
            ];
            for (const member of team) {
                try {
                    await createGlobalUser({
                        tenantId,
                        name: member.name,
                        email: member.email,
                        passwordRaw: "Demo@123", // Padrão para demo
                        role: member.role
                    });
                } catch (err) {
                    logger.warn({ email: member.email }, "Member already exists or failed to create");
                }
            }
        }

        // 2. Sample Contacts, Conversations and Tickets
        const demoContacts = [
            { name: "João Silva", phone: "5511999998888", email: "joao.silva@demo.com", notes: "Cliente recorrente, interessado em planos corporativos.", tags: ["Demonstração", "Lead"] },
            { name: "Maria Oliveira", phone: "5511977776666", email: "maria.oliveira@demo.com", notes: "Dúvidas recorrentes sobre faturamento.", tags: ["Demonstração", "Financeiro"] }
        ];

        for (const c of demoContacts) {
            await createContact(tenantId, c);
            try {
                const cid = await findOrCreateConversation(tenantId, c.phone, c.name, adminId);
                
                // Add a sample inbound message
                await saveInboundMessage({
                    channel: "WHATSAPP",
                    provider: "GTI",
                    timestamp: Date.now() - 3600000, // 1h ago
                    tenantId,
                    externalChatId: c.phone,
                    externalUserId: c.phone + "@s.whatsapp.net",
                    senderName: c.name,
                    text: "Olá, gostaria de saber mais sobre os planos de suporte.",
                    raw: { from: c.phone }
                }, cid);

                // Add a sample outbound message (from the agent)
                await saveOutboundMessage(tenantId, cid, "Olá João! Com certeza, temos planos que se adequam ao tamanho da sua equipe. Você gostaria de focar em atendimento via WhatsApp ou Omnichannel?");

                // Create a ticket if it's the demo model
                if (model === "demo") {
                    await createTicketForConversation(tenantId, cid, "MEDIUM");
                }
            } catch (convErr: any) {
                logger.error({ contact: c.name, error: convErr.message }, "Error creating demo conversation");
            }
        }

        // 3. More demo tickets if model === demo
        if (model === "demo") {
            const extraContacts = [
                { name: "Ricardo Souza", phone: "5511988887777", email: "ricardo.souza@demo.com", tags: ["Demonstração", "Urgente"] },
                { name: "Amanda Lima", phone: "5511966665555", email: "amanda.lima@demo.com", tags: ["Demonstração", "Vendas"] }
            ];
            
            // Ricardo - Urgent Issue
            const c1 = extraContacts[0];
            await createContact(tenantId, c1);
            const cid1 = await findOrCreateConversation(tenantId, c1.phone, c1.name, adminId);
            await saveInboundMessage({
                channel: "WHATSAPP", provider: "GTI", timestamp: Date.now() - 1800000, tenantId,
                externalChatId: c1.phone, externalUserId: c1.phone + "@s.whatsapp.net",
                senderName: c1.name, text: "Meu acesso está bloqueado e preciso enviar uma proposta agora!", raw: { from: c1.phone }
            }, cid1);
            await createTicketForConversation(tenantId, cid1, "HIGH");

            // Amanda - New Sales Inquiry
            const c2 = extraContacts[1];
            await createContact(tenantId, c2);
            const cid2 = await findOrCreateConversation(tenantId, c2.phone, c2.name, adminId);
            await saveInboundMessage({
                channel: "WHATSAPP", provider: "GTI", timestamp: Date.now() - 600000, tenantId,
                externalChatId: c2.phone, externalUserId: c2.phone + "@s.whatsapp.net",
                senderName: c2.name, text: "Boa tarde! Vi o anúncio de vocês e queria saber se tem integração com o Shopify.", raw: { from: c2.phone }
            }, cid2);
            await createTicketForConversation(tenantId, cid2, "MEDIUM");
        }

        logger.info({ tenantId }, "Demo data preload finished");
    } catch (err: any) {
        logger.error({ tenantId, error: err.message }, "Failed to preload demo data");
    }
}

