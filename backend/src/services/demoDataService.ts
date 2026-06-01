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

        // 1.6 Setup Channels
        const pool = await getPool();
        let whatsappChannelId = "";
        let emailChannelId = "";
        let webchatChannelId = "";
        let smsChannelId = "";

        const demoConnectorId = "demo_whatsapp_conn_" + tenantId.substring(0, 8);

        if (model === "basic") {
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
            whatsappChannelId = chResult.recordset[0].ChannelId;
        } else {
            const demoEmailConnectorId = "demo_email_conn_" + tenantId.substring(0, 8);
            const demoWebchatConnectorId = "demo_webchat_conn_" + tenantId.substring(0, 8);
            const demoSmsConnectorId = "demo_sms_conn_" + tenantId.substring(0, 8);

            const chResult = await pool.request()
                .input("tenantId", tenantId)
                .input("connectorId", demoConnectorId)
                .input("emailConnectorId", demoEmailConnectorId)
                .input("webchatConnectorId", demoWebchatConnectorId)
                .input("smsConnectorId", demoSmsConnectorId)
                .query(`
                    -- 1. WhatsApp Channel
                    DECLARE @whatsapp_chId UNIQUEIDENTIFIER = NEWID();
                    INSERT INTO altdesk.Channel (ChannelId, TenantId, Type, Name)
                    VALUES (@whatsapp_chId, @tenantId, 'WHATSAPP', 'WhatsApp (Demonstração)');
                    
                    INSERT INTO altdesk.ChannelConnector (ConnectorId, ChannelId, Provider, ConfigJson)
                    VALUES (@connectorId, @whatsapp_chId, 'GTI', '{}');
                    
                    -- 2. Email Channel
                    DECLARE @email_chId UNIQUEIDENTIFIER = NEWID();
                    INSERT INTO altdesk.Channel (ChannelId, TenantId, Type, Name)
                    VALUES (@email_chId, @tenantId, 'EMAIL', 'Email de Suporte');
                    
                    INSERT INTO altdesk.ChannelConnector (ConnectorId, ChannelId, Provider, ConfigJson)
                    VALUES (@emailConnectorId, @email_chId, 'GTI', '{}');

                    -- 3. Webchat Channel
                    DECLARE @webchat_chId UNIQUEIDENTIFIER = NEWID();
                    INSERT INTO altdesk.Channel (ChannelId, TenantId, Type, Name)
                    VALUES (@webchat_chId, @tenantId, 'PLATFORM', 'Chat do Portal');
                    
                    INSERT INTO altdesk.ChannelConnector (ConnectorId, ChannelId, Provider, ConfigJson)
                    VALUES (@webchatConnectorId, @webchat_chId, 'GTI', '{}');

                    -- 4. SMS Channel
                    DECLARE @sms_chId UNIQUEIDENTIFIER = NEWID();
                    INSERT INTO altdesk.Channel (ChannelId, TenantId, Type, Name)
                    VALUES (@sms_chId, @tenantId, 'SMS', 'SMS Corporativo');
                    
                    INSERT INTO altdesk.ChannelConnector (ConnectorId, ChannelId, Provider, ConfigJson)
                    VALUES (@smsConnectorId, @sms_chId, 'GTI', '{}');

                    SELECT 
                        @whatsapp_chId AS WhatsAppChannelId,
                        @email_chId AS EmailChannelId,
                        @webchat_chId AS WebchatChannelId,
                        @sms_chId AS SmsChannelId;
                `);
            whatsappChannelId = chResult.recordset[0].WhatsAppChannelId;
            emailChannelId = chResult.recordset[0].EmailChannelId;
            webchatChannelId = chResult.recordset[0].WebchatChannelId;
            smsChannelId = chResult.recordset[0].SmsChannelId;
        }

        // 1.7 Assign Admin to the new instance
        if (adminId) {
            logger.info({ tenantId, demoConnectorId, adminId }, "Assigning admin to demo instances");
            if (model === "basic") {
                await pool.request()
                    .input("tenantId", tenantId)
                    .input("connectorId", demoConnectorId)
                    .input("userId", adminId)
                    .query(`
                        INSERT INTO altdesk.InstanceAssignment (TenantId, ConnectorId, UserId)
                        VALUES (@tenantId, @connectorId, @userId)
                    `);
            } else {
                const demoEmailConnectorId = "demo_email_conn_" + tenantId.substring(0, 8);
                const demoWebchatConnectorId = "demo_webchat_conn_" + tenantId.substring(0, 8);
                const demoSmsConnectorId = "demo_sms_conn_" + tenantId.substring(0, 8);
                await pool.request()
                    .input("tenantId", tenantId)
                    .input("adminId", adminId)
                    .input("c1", demoConnectorId)
                    .input("c2", demoEmailConnectorId)
                    .input("c3", demoWebchatConnectorId)
                    .input("c4", demoSmsConnectorId)
                    .query(`
                        INSERT INTO altdesk.InstanceAssignment (TenantId, ConnectorId, UserId) VALUES
                        (@tenantId, @c1, @adminId),
                        (@tenantId, @c2, @adminId),
                        (@tenantId, @c3, @adminId),
                        (@tenantId, @c4, @adminId);
                    `);
            }
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
                        passwordRaw: process.env.DEMO_USER_PASSWORD || "Demo@123",
                        role: member.role
                    });
                } catch (err) {
                    logger.warn({ email: member.email }, "Member already exists or failed to create");
                }
            }

            // Ensure ALL existing users (including Admin and SQL seed users) have Agent entries
            await pool.request()
                .input("tenantId", tenantId)
                .query(`
                    INSERT INTO altdesk.Agent (TenantId, UserId, Kind, Name, IsActive)
                    SELECT u.TenantId, u.UserId, 'HUMAN', u.DisplayName, 1
                    FROM altdesk.[User] u
                    LEFT JOIN altdesk.Agent a ON a.UserId = u.UserId
                    WHERE u.TenantId = @tenantId AND a.AgentId IS NULL AND u.DeletedAt IS NULL
                `);
        }

        // 2. Sample Contacts, Conversations and Tickets
        if (model === "basic") {
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
                } catch (convErr: any) {
                    logger.error({ contact: c.name, error: convErr.message }, "Error creating basic conversation");
                }
            }
        } else if (model === "demo") {
            logger.info({ tenantId }, "Seeding rich historical demo dataset");
            // Run a single comprehensive SQL script to seed all backdated tickets, messages, SLAs, CSATs, and assignments
            await pool.request()
                .input("tenantId", tenantId)
                .input("adminId", adminId || null)
                .input("whatsapp_chId", whatsappChannelId)
                .input("email_chId", emailChannelId)
                .input("webchat_chId", webchatChannelId)
                .input("sms_chId", smsChannelId)
                .query(`
                    -- Clean up default contacts to avoid duplicate phones/emails
                    DELETE FROM altdesk.Contact WHERE TenantId = @tenantId;

                    DECLARE @convId UNIQUEIDENTIFIER, @ticketId UNIQUEIDENTIFIER;

                    -- Declare all contact IDs
                    DECLARE @c1 UNIQUEIDENTIFIER = NEWID(), @c2 UNIQUEIDENTIFIER = NEWID(), @c3 UNIQUEIDENTIFIER = NEWID(), @c4 UNIQUEIDENTIFIER = NEWID();
                    DECLARE @c5 UNIQUEIDENTIFIER = NEWID(), @c6 UNIQUEIDENTIFIER = NEWID(), @c7 UNIQUEIDENTIFIER = NEWID(), @c8 UNIQUEIDENTIFIER = NEWID();
                    DECLARE @c9 UNIQUEIDENTIFIER = NEWID(), @c10 UNIQUEIDENTIFIER = NEWID(), @c11 UNIQUEIDENTIFIER = NEWID(), @c12 UNIQUEIDENTIFIER = NEWID();
                    DECLARE @c13 UNIQUEIDENTIFIER = NEWID(), @c14 UNIQUEIDENTIFIER = NEWID(), @c15 UNIQUEIDENTIFIER = NEWID(), @c16 UNIQUEIDENTIFIER = NEWID();

                    -- Get Agent / User IDs
                    DECLARE @admin_userId UNIQUEIDENTIFIER = @adminId;
                    DECLARE @admin_agentId UNIQUEIDENTIFIER = (SELECT TOP 1 AgentId FROM altdesk.Agent WHERE UserId = @admin_userId);

                    DECLARE @n1_userId UNIQUEIDENTIFIER = (SELECT TOP 1 UserId FROM altdesk.[User] WHERE TenantId = @tenantId AND Email LIKE 'suporte.n1.%');
                    DECLARE @n1_agentId UNIQUEIDENTIFIER = (SELECT TOP 1 AgentId FROM altdesk.Agent WHERE UserId = @n1_userId);

                    DECLARE @vendas_userId UNIQUEIDENTIFIER = (SELECT TOP 1 UserId FROM altdesk.[User] WHERE TenantId = @tenantId AND Email LIKE 'vendas.%');
                    DECLARE @vendas_agentId UNIQUEIDENTIFIER = (SELECT TOP 1 AgentId FROM altdesk.Agent WHERE UserId = @vendas_userId);

                    DECLARE @fin_userId UNIQUEIDENTIFIER = (SELECT TOP 1 UserId FROM altdesk.[User] WHERE TenantId = @tenantId AND Email LIKE 'financeiro.%');
                    DECLARE @fin_agentId UNIQUEIDENTIFIER = (SELECT TOP 1 AgentId FROM altdesk.Agent WHERE UserId = @fin_userId);

                    DECLARE @carlos_userId UNIQUEIDENTIFIER = (SELECT TOP 1 UserId FROM altdesk.[User] WHERE TenantId = @tenantId AND Email LIKE 'carlos.lima.%');
                    DECLARE @carlos_agentId UNIQUEIDENTIFIER = (SELECT TOP 1 AgentId FROM altdesk.Agent WHERE UserId = @carlos_userId);

                    DECLARE @juliana_userId UNIQUEIDENTIFIER = (SELECT TOP 1 UserId FROM altdesk.[User] WHERE TenantId = @tenantId AND Email LIKE 'juliana.rocha.%');
                    DECLARE @juliana_agentId UNIQUEIDENTIFIER = (SELECT TOP 1 AgentId FROM altdesk.Agent WHERE UserId = @juliana_userId);

                    DECLARE @rafael_userId UNIQUEIDENTIFIER = (SELECT TOP 1 UserId FROM altdesk.[User] WHERE TenantId = @tenantId AND Email LIKE 'rafael.torres.%');
                    DECLARE @rafael_agentId UNIQUEIDENTIFIER = (SELECT TOP 1 AgentId FROM altdesk.Agent WHERE UserId = @rafael_userId);

                    -- Fallbacks
                    SET @n1_userId = COALESCE(@n1_userId, @admin_userId);
                    SET @n1_agentId = COALESCE(@n1_agentId, @admin_agentId);

                    SET @vendas_userId = COALESCE(@vendas_userId, @admin_userId);
                    SET @vendas_agentId = COALESCE(@vendas_agentId, @admin_agentId);

                    SET @fin_userId = COALESCE(@fin_userId, @admin_userId);
                    SET @fin_agentId = COALESCE(@fin_agentId, @admin_agentId);

                    SET @carlos_userId = COALESCE(@carlos_userId, @admin_userId);
                    SET @carlos_agentId = COALESCE(@carlos_agentId, @admin_agentId);

                    SET @juliana_userId = COALESCE(@juliana_userId, @admin_userId);
                    SET @juliana_agentId = COALESCE(@juliana_agentId, @admin_agentId);

                    SET @rafael_userId = COALESCE(@rafael_userId, @admin_userId);
                    SET @rafael_agentId = COALESCE(@rafael_agentId, @admin_agentId);

                    -- Get Queue IDs
                    DECLARE @q_suporte UNIQUEIDENTIFIER = (SELECT TOP 1 QueueId FROM altdesk.Queue WHERE TenantId = @tenantId AND Name = 'Suporte');
                    DECLARE @q_financeiro UNIQUEIDENTIFIER = (SELECT TOP 1 QueueId FROM altdesk.Queue WHERE TenantId = @tenantId AND Name = 'Financeiro');
                    DECLARE @q_implantacao UNIQUEIDENTIFIER = (SELECT TOP 1 QueueId FROM altdesk.Queue WHERE TenantId = @tenantId AND Name = N'Implantação');
                    DECLARE @q_comercial UNIQUEIDENTIFIER = (SELECT TOP 1 QueueId FROM altdesk.Queue WHERE TenantId = @tenantId AND Name = 'Comercial');

                    -- Scenario 1: Closed ticket, low priority, WhatsApp, assigned to Suporte N1, created 9 days ago.
                    INSERT INTO altdesk.Contact (ContactId, TenantId, Name, Phone, Email, Tags, CreatedAt)
                    VALUES (@c1, @tenantId, 'Marcos Pereira', '5511988881001', 'marcos.pereira@cliente.demo', '["Demonstração", "Suporte"]', DATEADD(day, -9, GETUTCDATE()));

                    SET @convId = NEWID();
                    INSERT INTO altdesk.Conversation (ConversationId, TenantId, ChannelId, QueueId, AssignedUserId, OpenedByContactId, Title, Kind, Status, SourceChannel, LastMessageAt, CreatedAt, ClosedAt, CsatScore, SlaDeadline, SlaStatus, FirstResponseAt)
                    VALUES (@convId, @tenantId, @whatsapp_chId, @q_suporte, @n1_userId, @c1, 'Marcos Pereira', 'DIRECT', 'RESOLVED', 'WHATSAPP', DATEADD(minute, 40, DATEADD(day, -9, GETUTCDATE())), DATEADD(day, -9, GETUTCDATE()), DATEADD(minute, 40, DATEADD(day, -9, GETUTCDATE())), 5, DATEADD(hour, 4, DATEADD(day, -9, GETUTCDATE())), 'MET', DATEADD(minute, 10, DATEADD(day, -9, GETUTCDATE())));

                    INSERT INTO altdesk.ExternalThreadMap (TenantId, ConnectorId, ExternalChatId, ExternalUserId, ConversationId)
                    VALUES (@tenantId, 'demo_whatsapp_conn_' + LEFT(CAST(@tenantId AS NVARCHAR(36)), 8), '5511988881001', '5511988881001@s.whatsapp.net', @convId);

                    INSERT INTO altdesk.Message (MessageId, TenantId, ConversationId, Direction, Body, SenderExternalId, Status, CreatedAt)
                    VALUES (NEWID(), @tenantId, @convId, 'IN', 'Olá, preciso tirar uma dúvida', '5511988881001', 'READ', DATEADD(day, -9, GETUTCDATE()));

                    INSERT INTO altdesk.Message (MessageId, TenantId, ConversationId, Direction, Body, SenderUserId, Status, CreatedAt)
                    VALUES (NEWID(), @tenantId, @convId, 'OUT', 'Claro, no que posso ajudar?', @n1_userId, 'READ', DATEADD(minute, 10, DATEADD(day, -9, GETUTCDATE())));

                    INSERT INTO altdesk.Message (MessageId, TenantId, ConversationId, Direction, Body, SenderExternalId, Status, CreatedAt)
                    VALUES (NEWID(), @tenantId, @convId, 'IN', 'Onde vejo minhas faturas?', '5511988881001', 'READ', DATEADD(minute, 15, DATEADD(day, -9, GETUTCDATE())));

                    INSERT INTO altdesk.Message (MessageId, TenantId, ConversationId, Direction, Body, SenderUserId, Status, CreatedAt)
                    VALUES (NEWID(), @tenantId, @convId, 'OUT', 'Você pode ver em Configurações > Faturas.', @n1_userId, 'READ', DATEADD(minute, 30, DATEADD(day, -9, GETUTCDATE())));

                    INSERT INTO altdesk.Message (MessageId, TenantId, ConversationId, Direction, Body, SenderExternalId, Status, CreatedAt)
                    VALUES (NEWID(), @tenantId, @convId, 'IN', 'Obrigado!', '5511988881001', 'READ', DATEADD(minute, 35, DATEADD(day, -9, GETUTCDATE())));

                    SET @ticketId = NEWID();
                    INSERT INTO altdesk.Ticket (TicketId, TenantId, ConversationId, Priority, Status, AssignedAgentId, SLAFirstResponseDue, SLAResolutionDue, FirstResponseAt, ResolvedAt, SlaStatus, KanbanOrder, CreatedAt, UpdatedAt)
                    VALUES (@ticketId, @tenantId, @convId, 'LOW', 'RESOLVED', @n1_agentId, DATEADD(hour, 4, DATEADD(day, -9, GETUTCDATE())), DATEADD(day, 1, DATEADD(day, -9, GETUTCDATE())), DATEADD(minute, 10, DATEADD(day, -9, GETUTCDATE())), DATEADD(minute, 40, DATEADD(day, -9, GETUTCDATE())), 'ON_TIME', 0, DATEADD(day, -9, GETUTCDATE()), DATEADD(minute, 40, DATEADD(day, -9, GETUTCDATE())));

                    INSERT INTO altdesk.TicketEvent (TenantId, TicketId, EventType, NewValue, ActorUserId, CreatedAt)
                    VALUES (@tenantId, @ticketId, 'CREATED', 'NEW', @n1_userId, DATEADD(day, -9, GETUTCDATE())),
                           (@tenantId, @ticketId, 'STATUS_CHANGE', 'RESOLVED', @n1_userId, DATEADD(minute, 40, DATEADD(day, -9, GETUTCDATE())));

                    INSERT INTO altdesk.SatisfactionRating (ConversationId, Score, Comment, CreatedAt)
                    VALUES (@convId, 5, 'Excelente atendimento, rápido e objetivo.', DATEADD(minute, 45, DATEADD(day, -9, GETUTCDATE())));

                    -- Scenario 2: Closed ticket, high priority, Email, assigned to Financeiro, created 8 days ago.
                    INSERT INTO altdesk.Contact (ContactId, TenantId, Name, Phone, Email, Tags, CreatedAt)
                    VALUES (@c2, @tenantId, 'Fernanda Alves', '5511988881002', 'fernanda.alves@cliente.demo', '["Demonstração", "Financeiro"]', DATEADD(day, -8, GETUTCDATE()));

                    SET @convId = NEWID();
                    INSERT INTO altdesk.Conversation (ConversationId, TenantId, ChannelId, QueueId, AssignedUserId, OpenedByContactId, Title, Kind, Status, SourceChannel, LastMessageAt, CreatedAt, ClosedAt, CsatScore, SlaDeadline, SlaStatus, FirstResponseAt)
                    VALUES (@convId, @tenantId, @email_chId, @q_financeiro, @fin_userId, @c2, 'Problema na Fatura #4820', 'DIRECT', 'RESOLVED', 'EMAIL', DATEADD(hour, 3, DATEADD(day, -8, GETUTCDATE())), DATEADD(day, -8, GETUTCDATE()), DATEADD(hour, 3, DATEADD(day, -8, GETUTCDATE())), 4, DATEADD(hour, 1, DATEADD(day, -8, GETUTCDATE())), 'MET', DATEADD(minute, 45, DATEADD(day, -8, GETUTCDATE())));

                    INSERT INTO altdesk.ExternalThreadMap (TenantId, ConnectorId, ExternalChatId, ExternalUserId, ConversationId)
                    VALUES (@tenantId, 'demo_email_conn_' + LEFT(CAST(@tenantId AS NVARCHAR(36)), 8), 'fernanda.alves@cliente.demo', 'fernanda.alves@cliente.demo', @convId);

                    INSERT INTO altdesk.Message (MessageId, TenantId, ConversationId, Direction, Body, SenderExternalId, Status, CreatedAt)
                    VALUES (NEWID(), @tenantId, @convId, 'IN', 'Problema no pagamento da fatura vencida', 'fernanda.alves@cliente.demo', 'READ', DATEADD(day, -8, GETUTCDATE()));

                    INSERT INTO altdesk.Message (MessageId, TenantId, ConversationId, Direction, Body, SenderUserId, Status, CreatedAt)
                    VALUES (NEWID(), @tenantId, @convId, 'OUT', 'Olá, identificamos que o banco rejeitou o cartão. Pode tentar novamente?', @fin_userId, 'READ', DATEADD(minute, 45, DATEADD(day, -8, GETUTCDATE())));

                    INSERT INTO altdesk.Message (MessageId, TenantId, ConversationId, Direction, Body, SenderExternalId, Status, CreatedAt)
                    VALUES (NEWID(), @tenantId, @convId, 'IN', 'Consegui realizar o pagamento agora, obrigado!', 'fernanda.alves@cliente.demo', 'READ', DATEADD(hour, 3, DATEADD(day, -8, GETUTCDATE())));

                    SET @ticketId = NEWID();
                    INSERT INTO altdesk.Ticket (TicketId, TenantId, ConversationId, Priority, Status, AssignedAgentId, SLAFirstResponseDue, SLAResolutionDue, FirstResponseAt, ResolvedAt, SlaStatus, KanbanOrder, CreatedAt, UpdatedAt)
                    VALUES (@ticketId, @tenantId, @convId, 'HIGH', 'RESOLVED', @fin_agentId, DATEADD(hour, 1, DATEADD(day, -8, GETUTCDATE())), DATEADD(hour, 4, DATEADD(day, -8, GETUTCDATE())), DATEADD(minute, 45, DATEADD(day, -8, GETUTCDATE())), DATEADD(hour, 3, DATEADD(day, -8, GETUTCDATE())), 'ON_TIME', 0, DATEADD(day, -8, GETUTCDATE()), DATEADD(hour, 3, DATEADD(day, -8, GETUTCDATE())));

                    INSERT INTO altdesk.TicketEvent (TenantId, TicketId, EventType, NewValue, ActorUserId, CreatedAt)
                    VALUES (@tenantId, @ticketId, 'CREATED', 'NEW', @fin_userId, DATEADD(day, -8, GETUTCDATE())),
                           (@tenantId, @ticketId, 'STATUS_CHANGE', 'RESOLVED', @fin_userId, DATEADD(hour, 3, DATEADD(day, -8, GETUTCDATE())));

                    INSERT INTO altdesk.SatisfactionRating (ConversationId, Score, Comment, CreatedAt)
                    VALUES (@convId, 4, 'Resolvido rápido.', DATEADD(hour, 4, DATEADD(day, -8, GETUTCDATE())));

                    -- Scenario 3: Closed ticket, critical priority, WhatsApp, assigned to Admin, created 7 days ago.
                    INSERT INTO altdesk.Contact (ContactId, TenantId, Name, Phone, Email, Tags, CreatedAt)
                    VALUES (@c3, @tenantId, 'João Batista', '5511988881003', 'joao.batista@cliente.demo', '["Demonstração", "Servidor"]', DATEADD(day, -7, GETUTCDATE()));

                    SET @convId = NEWID();
                    INSERT INTO altdesk.Conversation (ConversationId, TenantId, ChannelId, QueueId, AssignedUserId, OpenedByContactId, Title, Kind, Status, SourceChannel, LastMessageAt, CreatedAt, ClosedAt, CsatScore, SlaDeadline, SlaStatus, FirstResponseAt)
                    VALUES (@convId, @tenantId, @whatsapp_chId, @q_suporte, @admin_userId, @c3, 'Sistema Instável', 'DIRECT', 'RESOLVED', 'WHATSAPP', DATEADD(minute, 15, DATEADD(day, -7, GETUTCDATE())), DATEADD(day, -7, GETUTCDATE()), DATEADD(minute, 15, DATEADD(day, -7, GETUTCDATE())), 5, DATEADD(minute, 15, DATEADD(day, -7, GETUTCDATE())), 'MET', DATEADD(minute, 5, DATEADD(day, -7, GETUTCDATE())));

                    INSERT INTO altdesk.ExternalThreadMap (TenantId, ConnectorId, ExternalChatId, ExternalUserId, ConversationId)
                    VALUES (@tenantId, 'demo_whatsapp_conn_' + LEFT(CAST(@tenantId AS NVARCHAR(36)), 8), '5511988881003', '5511988881003@s.whatsapp.net', @convId);

                    INSERT INTO altdesk.Message (MessageId, TenantId, ConversationId, Direction, Body, SenderExternalId, Status, CreatedAt)
                    VALUES (NEWID(), @tenantId, @convId, 'IN', 'Sistema está fora do ar!', '5511988881003', 'READ', DATEADD(day, -7, GETUTCDATE()));

                    INSERT INTO altdesk.Message (MessageId, TenantId, ConversationId, Direction, Body, SenderUserId, Status, CreatedAt)
                    VALUES (NEWID(), @tenantId, @convId, 'OUT', 'Estamos cientes e nossa equipe já está trabalhando. Deve normalizar em 5 minutos.', @admin_userId, 'READ', DATEADD(minute, 5, DATEADD(day, -7, GETUTCDATE())));

                    INSERT INTO altdesk.Message (MessageId, TenantId, ConversationId, Direction, Body, SenderExternalId, Status, CreatedAt)
                    VALUES (NEWID(), @tenantId, @convId, 'IN', 'Confirmado, voltou aqui. Obrigado.', '5511988881003', 'READ', DATEADD(minute, 15, DATEADD(day, -7, GETUTCDATE())));

                    SET @ticketId = NEWID();
                    INSERT INTO altdesk.Ticket (TicketId, TenantId, ConversationId, Priority, Status, AssignedAgentId, SLAFirstResponseDue, SLAResolutionDue, FirstResponseAt, ResolvedAt, SlaStatus, KanbanOrder, CreatedAt, UpdatedAt)
                    VALUES (@ticketId, @tenantId, @convId, 'CRITICAL', 'RESOLVED', @admin_agentId, DATEADD(minute, 15, DATEADD(day, -7, GETUTCDATE())), DATEADD(hour, 1, DATEADD(day, -7, GETUTCDATE())), DATEADD(minute, 5, DATEADD(day, -7, GETUTCDATE())), DATEADD(minute, 15, DATEADD(day, -7, GETUTCDATE())), 'ON_TIME', 0, DATEADD(day, -7, GETUTCDATE()), DATEADD(minute, 15, DATEADD(day, -7, GETUTCDATE())));

                    INSERT INTO altdesk.TicketEvent (TenantId, TicketId, EventType, NewValue, ActorUserId, CreatedAt)
                    VALUES (@tenantId, @ticketId, 'CREATED', 'NEW', @admin_userId, DATEADD(day, -7, GETUTCDATE())),
                           (@tenantId, @ticketId, 'STATUS_CHANGE', 'RESOLVED', @admin_userId, DATEADD(minute, 15, DATEADD(day, -7, GETUTCDATE())));

                    INSERT INTO altdesk.SatisfactionRating (ConversationId, Score, Comment, CreatedAt)
                    VALUES (@convId, 5, 'Salvaram meu dia!', DATEADD(minute, 20, DATEADD(day, -7, GETUTCDATE())));

                    -- Scenario 4: Open ticket, medium priority, Platform (Webchat), assigned to Carlos Lima, created 6 days ago.
                    INSERT INTO altdesk.Contact (ContactId, TenantId, Name, Phone, Email, Tags, CreatedAt)
                    VALUES (@c4, @tenantId, 'Paula Mendes', '5511988881004', 'paula.mendes@cliente.demo', '["Demonstração", "Vendas"]', DATEADD(day, -6, GETUTCDATE()));

                    SET @convId = NEWID();
                    INSERT INTO altdesk.Conversation (ConversationId, TenantId, ChannelId, QueueId, AssignedUserId, OpenedByContactId, Title, Kind, Status, SourceChannel, LastMessageAt, CreatedAt, ClosedAt, CsatScore, SlaDeadline, SlaStatus, FirstResponseAt)
                    VALUES (@convId, @tenantId, @webchat_chId, @q_comercial, @carlos_userId, @c4, 'Paula Mendes', 'DIRECT', 'OPEN', 'PLATFORM', DATEADD(hour, 2, DATEADD(day, -6, GETUTCDATE())), DATEADD(day, -6, GETUTCDATE()), NULL, NULL, DATEADD(hour, 2, DATEADD(day, -6, GETUTCDATE())), 'MET', DATEADD(hour, 2, DATEADD(day, -6, GETUTCDATE())));

                    INSERT INTO altdesk.ExternalThreadMap (TenantId, ConnectorId, ExternalChatId, ExternalUserId, ConversationId)
                    VALUES (@tenantId, 'demo_webchat_conn_' + LEFT(CAST(@tenantId AS NVARCHAR(36)), 8), '5511988881004', '5511988881004', @convId);

                    INSERT INTO altdesk.Message (MessageId, TenantId, ConversationId, Direction, Body, SenderExternalId, Status, CreatedAt)
                    VALUES (NEWID(), @tenantId, @convId, 'IN', 'Como faço para importar meus contatos antigos?', 'paula.mendes@cliente.demo', 'READ', DATEADD(day, -6, GETUTCDATE()));

                    INSERT INTO altdesk.Message (MessageId, TenantId, ConversationId, Direction, Body, SenderUserId, Status, CreatedAt)
                    VALUES (NEWID(), @tenantId, @convId, 'OUT', 'Temos uma ferramenta de importação em contatos...', @carlos_userId, 'READ', DATEADD(hour, 2, DATEADD(day, -6, GETUTCDATE())));

                    SET @ticketId = NEWID();
                    INSERT INTO altdesk.Ticket (TicketId, TenantId, ConversationId, Priority, Status, AssignedAgentId, SLAFirstResponseDue, SLAResolutionDue, FirstResponseAt, ResolvedAt, SlaStatus, KanbanOrder, CreatedAt, UpdatedAt)
                    VALUES (@ticketId, @tenantId, @convId, 'MEDIUM', 'IN_PROGRESS', @carlos_agentId, DATEADD(hour, 2, DATEADD(day, -6, GETUTCDATE())), DATEADD(hour, 12, DATEADD(day, -6, GETUTCDATE())), DATEADD(hour, 2, DATEADD(day, -6, GETUTCDATE())), NULL, 'ON_TIME', 1, DATEADD(day, -6, GETUTCDATE()), DATEADD(hour, 2, DATEADD(day, -6, GETUTCDATE())));

                    INSERT INTO altdesk.TicketEvent (TenantId, TicketId, EventType, NewValue, ActorUserId, CreatedAt)
                    VALUES (@tenantId, @ticketId, 'CREATED', 'NEW', @carlos_userId, DATEADD(day, -6, GETUTCDATE())),
                           (@tenantId, @ticketId, 'STATUS_CHANGE', 'IN_PROGRESS', @carlos_userId, DATEADD(hour, 2, DATEADD(day, -6, GETUTCDATE())));

                    -- Scenario 5: Closed ticket (SLA Violated), critical priority, SMS, assigned to Juliana Rocha, created 5 days ago.
                    INSERT INTO altdesk.Contact (ContactId, TenantId, Name, Phone, Email, Tags, CreatedAt)
                    VALUES (@c5, @tenantId, 'Ricardo Nunes', '5511988881005', 'ricardo.nunes@cliente.demo', '["Demonstração", "Urgente"]', DATEADD(day, -5, GETUTCDATE()));

                    SET @convId = NEWID();
                    INSERT INTO altdesk.Conversation (ConversationId, TenantId, ChannelId, QueueId, AssignedUserId, OpenedByContactId, Title, Kind, Status, SourceChannel, LastMessageAt, CreatedAt, ClosedAt, CsatScore, SlaDeadline, SlaStatus, FirstResponseAt)
                    VALUES (@convId, @tenantId, @sms_chId, @q_suporte, @juliana_userId, @c5, 'Ricardo Nunes', 'DIRECT', 'RESOLVED', 'SMS', DATEADD(hour, 6, DATEADD(day, -5, GETUTCDATE())), DATEADD(day, -5, GETUTCDATE()), DATEADD(hour, 6, DATEADD(day, -5, GETUTCDATE())), 2, DATEADD(minute, 15, DATEADD(day, -5, GETUTCDATE())), 'VIOLATED', DATEADD(hour, 4, DATEADD(day, -5, GETUTCDATE())));

                    INSERT INTO altdesk.ExternalThreadMap (TenantId, ConnectorId, ExternalChatId, ExternalUserId, ConversationId)
                    VALUES (@tenantId, 'demo_sms_conn_' + LEFT(CAST(@tenantId AS NVARCHAR(36)), 8), '5511988881005', '5511988881005', @convId);

                    INSERT INTO altdesk.Message (MessageId, TenantId, ConversationId, Direction, Body, SenderExternalId, Status, CreatedAt)
                    VALUES (NEWID(), @tenantId, @convId, 'IN', 'Preciso alterar meu CPF de cadastro urgente!', '5511988881005', 'READ', DATEADD(day, -5, GETUTCDATE()));

                    INSERT INTO altdesk.Message (MessageId, TenantId, ConversationId, Direction, Body, SenderUserId, Status, CreatedAt)
                    VALUES (NEWID(), @tenantId, @convId, 'OUT', 'Desculpe a demora, para alterar envie o comprovante...', @juliana_userId, 'READ', DATEADD(hour, 4, DATEADD(day, -5, GETUTCDATE())));

                    INSERT INTO altdesk.Message (MessageId, TenantId, ConversationId, Direction, Body, SenderExternalId, Status, CreatedAt)
                    VALUES (NEWID(), @tenantId, @convId, 'IN', 'Já enviei', '5511988881005', 'READ', DATEADD(hour, 5, DATEADD(day, -5, GETUTCDATE())));

                    INSERT INTO altdesk.Message (MessageId, TenantId, ConversationId, Direction, Body, SenderUserId, Status, CreatedAt)
                    VALUES (NEWID(), @tenantId, @convId, 'OUT', 'Alterado com sucesso.', @juliana_userId, 'READ', DATEADD(hour, 6, DATEADD(day, -5, GETUTCDATE())));

                    SET @ticketId = NEWID();
                    INSERT INTO altdesk.Ticket (TicketId, TenantId, ConversationId, Priority, Status, AssignedAgentId, SLAFirstResponseDue, SLAResolutionDue, FirstResponseAt, ResolvedAt, SlaStatus, KanbanOrder, CreatedAt, UpdatedAt)
                    VALUES (@ticketId, @tenantId, @convId, 'CRITICAL', 'RESOLVED', @juliana_agentId, DATEADD(minute, 15, DATEADD(day, -5, GETUTCDATE())), DATEADD(hour, 1, DATEADD(day, -5, GETUTCDATE())), DATEADD(hour, 4, DATEADD(day, -5, GETUTCDATE())), DATEADD(hour, 6, DATEADD(day, -5, GETUTCDATE())), 'VIOLATED', 0, DATEADD(day, -5, GETUTCDATE()), DATEADD(hour, 6, DATEADD(day, -5, GETUTCDATE())));

                    INSERT INTO altdesk.TicketEvent (TenantId, TicketId, EventType, NewValue, ActorUserId, CreatedAt)
                    VALUES (@tenantId, @ticketId, 'CREATED', 'NEW', @juliana_userId, DATEADD(day, -5, GETUTCDATE())),
                           (@tenantId, @ticketId, 'STATUS_CHANGE', 'RESOLVED', @juliana_userId, DATEADD(hour, 6, DATEADD(day, -5, GETUTCDATE())));

                    INSERT INTO altdesk.SatisfactionRating (ConversationId, Score, Comment, CreatedAt)
                    VALUES (@convId, 2, 'Demorou muito para responder, quase perdi o prazo.', DATEADD(hour, 7, DATEADD(day, -5, GETUTCDATE())));

                    -- Scenario 6: Open ticket (SLA Warning), high priority, WhatsApp, assigned to Suporte N1, created 50 minutes ago.
                    INSERT INTO altdesk.Contact (ContactId, TenantId, Name, Phone, Email, Tags, CreatedAt)
                    VALUES (@c6, @tenantId, 'Luciana Costa', '5511988881006', 'luciana.costa@cliente.demo', '["Demonstração", "Suporte"]', DATEADD(minute, -50, GETUTCDATE()));

                    SET @convId = NEWID();
                    INSERT INTO altdesk.Conversation (ConversationId, TenantId, ChannelId, QueueId, AssignedUserId, OpenedByContactId, Title, Kind, Status, SourceChannel, LastMessageAt, CreatedAt, ClosedAt, CsatScore, SlaDeadline, SlaStatus, FirstResponseAt)
                    VALUES (@convId, @tenantId, @whatsapp_chId, @q_suporte, @n1_userId, @c6, 'Luciana Costa', 'DIRECT', 'OPEN', 'WHATSAPP', DATEADD(minute, -50, GETUTCDATE()), DATEADD(minute, -50, GETUTCDATE()), NULL, NULL, DATEADD(minute, 10, GETUTCDATE()), 'PENDING', NULL);

                    INSERT INTO altdesk.ExternalThreadMap (TenantId, ConnectorId, ExternalChatId, ExternalUserId, ConversationId)
                    VALUES (@tenantId, 'demo_whatsapp_conn_' + LEFT(CAST(@tenantId AS NVARCHAR(36)), 8), '5511988881006', '5511988881006@s.whatsapp.net', @convId);

                    INSERT INTO altdesk.Message (MessageId, TenantId, ConversationId, Direction, Body, SenderExternalId, Status, CreatedAt)
                    VALUES (NEWID(), @tenantId, @convId, 'IN', 'Minha integração com o CRM parou de funcionar', '5511988881006', 'READ', DATEADD(minute, -50, GETUTCDATE()));

                    SET @ticketId = NEWID();
                    INSERT INTO altdesk.Ticket (TicketId, TenantId, ConversationId, Priority, Status, AssignedAgentId, SLAFirstResponseDue, SLAResolutionDue, FirstResponseAt, ResolvedAt, SlaStatus, KanbanOrder, CreatedAt, UpdatedAt)
                    VALUES (@ticketId, @tenantId, @convId, 'HIGH', 'OPEN', @n1_agentId, DATEADD(minute, 10, GETUTCDATE()), DATEADD(hour, 3, DATEADD(minute, 10, GETUTCDATE())), NULL, NULL, 'WARNING', 0, DATEADD(minute, -50, GETUTCDATE()), GETUTCDATE());

                    INSERT INTO altdesk.TicketEvent (TenantId, TicketId, EventType, NewValue, ActorUserId, CreatedAt)
                    VALUES (@tenantId, @ticketId, 'CREATED', 'NEW', @n1_userId, DATEADD(minute, -50, GETUTCDATE()));

                    -- Scenario 7: Closed ticket, medium priority, Email, assigned to Consultor Comercial, created 4 days ago.
                    INSERT INTO altdesk.Contact (ContactId, TenantId, Name, Phone, Email, Tags, CreatedAt)
                    VALUES (@c7, @tenantId, 'Beatriz Lima', '5511988881007', 'beatriz.lima@cliente.demo', '["Demonstração", "Upgrade"]', DATEADD(day, -4, GETUTCDATE()));

                    SET @convId = NEWID();
                    INSERT INTO altdesk.Conversation (ConversationId, TenantId, ChannelId, QueueId, AssignedUserId, OpenedByContactId, Title, Kind, Status, SourceChannel, LastMessageAt, CreatedAt, ClosedAt, CsatScore, SlaDeadline, SlaStatus, FirstResponseAt)
                    VALUES (@convId, @tenantId, @email_chId, @q_comercial, @vendas_userId, @c7, 'Demonstração Plano Enterprise', 'DIRECT', 'RESOLVED', 'EMAIL', DATEADD(hour, 2, DATEADD(day, -4, GETUTCDATE())), DATEADD(day, -4, GETUTCDATE()), DATEADD(hour, 2, DATEADD(day, -4, GETUTCDATE())), 5, DATEADD(hour, 2, DATEADD(day, -4, GETUTCDATE())), 'MET', DATEADD(minute, 30, DATEADD(day, -4, GETUTCDATE())));

                    INSERT INTO altdesk.ExternalThreadMap (TenantId, ConnectorId, ExternalChatId, ExternalUserId, ConversationId)
                    VALUES (@tenantId, 'demo_email_conn_' + LEFT(CAST(@tenantId AS NVARCHAR(36)), 8), 'beatriz.lima@cliente.demo', 'beatriz.lima@cliente.demo', @convId);

                    INSERT INTO altdesk.Message (MessageId, TenantId, ConversationId, Direction, Body, SenderExternalId, Status, CreatedAt)
                    VALUES (NEWID(), @tenantId, @convId, 'IN', 'Gostaria de agendar uma demonstração do plano Enterprise', 'beatriz.lima@cliente.demo', 'READ', DATEADD(day, -4, GETUTCDATE()));

                    INSERT INTO altdesk.Message (MessageId, TenantId, ConversationId, Direction, Body, SenderUserId, Status, CreatedAt)
                    VALUES (NEWID(), @tenantId, @convId, 'OUT', 'Com certeza! Segue link do meu calendário...', @vendas_userId, 'READ', DATEADD(minute, 30, DATEADD(day, -4, GETUTCDATE())));

                    INSERT INTO altdesk.Message (MessageId, TenantId, ConversationId, Direction, Body, SenderExternalId, Status, CreatedAt)
                    VALUES (NEWID(), @tenantId, @convId, 'IN', 'Agendado! Muito obrigado.', 'beatriz.lima@cliente.demo', 'READ', DATEADD(hour, 2, DATEADD(day, -4, GETUTCDATE())));

                    SET @ticketId = NEWID();
                    INSERT INTO altdesk.Ticket (TicketId, TenantId, ConversationId, Priority, Status, AssignedAgentId, SLAFirstResponseDue, SLAResolutionDue, FirstResponseAt, ResolvedAt, SlaStatus, KanbanOrder, CreatedAt, UpdatedAt)
                    VALUES (@ticketId, @tenantId, @convId, 'MEDIUM', 'RESOLVED', @vendas_agentId, DATEADD(hour, 2, DATEADD(day, -4, GETUTCDATE())), DATEADD(hour, 12, DATEADD(day, -4, GETUTCDATE())), DATEADD(minute, 30, DATEADD(day, -4, GETUTCDATE())), DATEADD(hour, 2, DATEADD(day, -4, GETUTCDATE())), 'ON_TIME', 0, DATEADD(day, -4, GETUTCDATE()), DATEADD(hour, 2, DATEADD(day, -4, GETUTCDATE())));

                    INSERT INTO altdesk.SatisfactionRating (ConversationId, Score, Comment, CreatedAt)
                    VALUES (@convId, 5, 'Ótimo atendimento de vendas.', DATEADD(hour, 2, DATEADD(day, -4, GETUTCDATE())));

                    -- Scenario 8: Closed ticket, low priority, WhatsApp, assigned to Admin, created 4 days ago.
                    INSERT INTO altdesk.Contact (ContactId, TenantId, Name, Phone, Email, Tags, CreatedAt)
                    VALUES (@c8, @tenantId, 'Gustavo Azevedo', '5511988881008', 'gustavo.azevedo@cliente.demo', '["Demonstração", "Dúvida"]', DATEADD(day, -4, GETUTCDATE()));

                    SET @convId = NEWID();
                    INSERT INTO altdesk.Conversation (ConversationId, TenantId, ChannelId, QueueId, AssignedUserId, OpenedByContactId, Title, Kind, Status, SourceChannel, LastMessageAt, CreatedAt, ClosedAt, CsatScore, SlaDeadline, SlaStatus, FirstResponseAt)
                    VALUES (@convId, @tenantId, @whatsapp_chId, @q_suporte, @admin_userId, @c8, 'Gustavo Azevedo', 'DIRECT', 'RESOLVED', 'WHATSAPP', DATEADD(hour, 3, DATEADD(day, -4, GETUTCDATE())), DATEADD(day, -4, GETUTCDATE()), DATEADD(hour, 3, DATEADD(day, -4, GETUTCDATE())), 3, DATEADD(hour, 4, DATEADD(day, -4, GETUTCDATE())), 'MET', DATEADD(hour, 1, DATEADD(day, -4, GETUTCDATE())));

                    INSERT INTO altdesk.ExternalThreadMap (TenantId, ConnectorId, ExternalChatId, ExternalUserId, ConversationId)
                    VALUES (@tenantId, 'demo_whatsapp_conn_' + LEFT(CAST(@tenantId AS NVARCHAR(36)), 8), '5511988881008', '5511988881008@s.whatsapp.net', @convId);

                    INSERT INTO altdesk.Message (MessageId, TenantId, ConversationId, Direction, Body, SenderExternalId, Status, CreatedAt)
                    VALUES (NEWID(), @tenantId, @convId, 'IN', 'Como altero a cor do chat widget?', '5511988881008', 'READ', DATEADD(day, -4, GETUTCDATE()));

                    INSERT INTO altdesk.Message (MessageId, TenantId, ConversationId, Direction, Body, SenderUserId, Status, CreatedAt)
                    VALUES (NEWID(), @tenantId, @convId, 'OUT', 'Basta ir em Configurações > Widget...', @admin_userId, 'READ', DATEADD(hour, 1, DATEADD(day, -4, GETUTCDATE())));

                    INSERT INTO altdesk.Message (MessageId, TenantId, ConversationId, Direction, Body, SenderExternalId, Status, CreatedAt)
                    VALUES (NEWID(), @tenantId, @convId, 'IN', 'Ok.', '5511988881008', 'READ', DATEADD(hour, 3, DATEADD(day, -4, GETUTCDATE())));

                    SET @ticketId = NEWID();
                    INSERT INTO altdesk.Ticket (TicketId, TenantId, ConversationId, Priority, Status, AssignedAgentId, SLAFirstResponseDue, SLAResolutionDue, FirstResponseAt, ResolvedAt, SlaStatus, KanbanOrder, CreatedAt, UpdatedAt)
                    VALUES (@ticketId, @tenantId, @convId, 'LOW', 'RESOLVED', @admin_agentId, DATEADD(hour, 4, DATEADD(day, -4, GETUTCDATE())), DATEADD(day, 1, DATEADD(day, -4, GETUTCDATE())), DATEADD(hour, 1, DATEADD(day, -4, GETUTCDATE())), DATEADD(hour, 3, DATEADD(day, -4, GETUTCDATE())), 'ON_TIME', 0, DATEADD(day, -4, GETUTCDATE()), DATEADD(hour, 3, DATEADD(day, -4, GETUTCDATE())));

                    INSERT INTO altdesk.SatisfactionRating (ConversationId, Score, Comment, CreatedAt)
                    VALUES (@convId, 3, 'Resposta ok, mas poderia ter mais imagens no guia.', DATEADD(hour, 3, DATEADD(day, -4, GETUTCDATE())));

                    -- Scenario 9: Open ticket, low priority, Email, assigned to Financeiro, created 3 days ago.
                    INSERT INTO altdesk.Contact (ContactId, TenantId, Name, Phone, Email, Tags, CreatedAt)
                    VALUES (@c9, @tenantId, 'Simone Prado', '5511988881009', 'simone.prado@cliente.demo', '["Demonstração", "Financeiro"]', DATEADD(day, -3, GETUTCDATE()));

                    SET @convId = NEWID();
                    INSERT INTO altdesk.Conversation (ConversationId, TenantId, ChannelId, QueueId, AssignedUserId, OpenedByContactId, Title, Kind, Status, SourceChannel, LastMessageAt, CreatedAt, ClosedAt, CsatScore, SlaDeadline, SlaStatus, FirstResponseAt)
                    VALUES (@convId, @tenantId, @email_chId, @q_financeiro, @fin_userId, @c9, 'Boleto não Recebido', 'DIRECT', 'OPEN', 'EMAIL', DATEADD(hour, 5, DATEADD(day, -3, GETUTCDATE())), DATEADD(day, -3, GETUTCDATE()), NULL, NULL, DATEADD(hour, 4, DATEADD(day, -3, GETUTCDATE())), 'VIOLATED', DATEADD(hour, 5, DATEADD(day, -3, GETUTCDATE())));

                    INSERT INTO altdesk.ExternalThreadMap (TenantId, ConnectorId, ExternalChatId, ExternalUserId, ConversationId)
                    VALUES (@tenantId, 'demo_email_conn_' + LEFT(CAST(@tenantId AS NVARCHAR(36)), 8), 'simone.prado@cliente.demo', 'simone.prado@cliente.demo', @convId);

                    INSERT INTO altdesk.Message (MessageId, TenantId, ConversationId, Direction, Body, SenderExternalId, Status, CreatedAt)
                    VALUES (NEWID(), @tenantId, @convId, 'IN', 'Não recebi meu boleto deste mês', 'simone.prado@cliente.demo', 'READ', DATEADD(day, -3, GETUTCDATE()));

                    INSERT INTO altdesk.Message (MessageId, TenantId, ConversationId, Direction, Body, SenderUserId, Status, CreatedAt)
                    VALUES (NEWID(), @tenantId, @convId, 'OUT', 'Verificamos que o boleto foi enviado para o email X. Confirma?', @fin_userId, 'READ', DATEADD(hour, 5, DATEADD(day, -3, GETUTCDATE())));

                    SET @ticketId = NEWID();
                    INSERT INTO altdesk.Ticket (TicketId, TenantId, ConversationId, Priority, Status, AssignedAgentId, SLAFirstResponseDue, SLAResolutionDue, FirstResponseAt, ResolvedAt, SlaStatus, KanbanOrder, CreatedAt, UpdatedAt)
                    VALUES (@ticketId, @tenantId, @convId, 'LOW', 'WAITING_CUSTOMER', @fin_agentId, DATEADD(hour, 4, DATEADD(day, -3, GETUTCDATE())), DATEADD(day, 1, DATEADD(day, -3, GETUTCDATE())), DATEADD(hour, 5, DATEADD(day, -3, GETUTCDATE())), NULL, 'VIOLATED', 2, DATEADD(day, -3, GETUTCDATE()), DATEADD(hour, 5, DATEADD(day, -3, GETUTCDATE())));

                    -- Scenario 10: Closed ticket, high priority, Platform, assigned to Carlos Lima, created 3 days ago.
                    INSERT INTO altdesk.Contact (ContactId, TenantId, Name, Phone, Email, Tags, CreatedAt)
                    VALUES (@c10, @tenantId, 'Diego Martins', '5511988881010', 'diego.martins@cliente.demo', '["Demonstração", "Suporte"]', DATEADD(day, -3, GETUTCDATE()));

                    SET @convId = NEWID();
                    INSERT INTO altdesk.Conversation (ConversationId, TenantId, ChannelId, QueueId, AssignedUserId, OpenedByContactId, Title, Kind, Status, SourceChannel, LastMessageAt, CreatedAt, ClosedAt, CsatScore, SlaDeadline, SlaStatus, FirstResponseAt)
                    VALUES (@convId, @tenantId, @webchat_chId, @q_suporte, @carlos_userId, @c10, 'Diego Martins', 'DIRECT', 'RESOLVED', 'PLATFORM', DATEADD(hour, 1, DATEADD(day, -3, GETUTCDATE())), DATEADD(day, -3, GETUTCDATE()), DATEADD(hour, 1, DATEADD(day, -3, GETUTCDATE())), 5, DATEADD(hour, 1, DATEADD(day, -3, GETUTCDATE())), 'MET', DATEADD(minute, 15, DATEADD(day, -3, GETUTCDATE())));

                    INSERT INTO altdesk.ExternalThreadMap (TenantId, ConnectorId, ExternalChatId, ExternalUserId, ConversationId)
                    VALUES (@tenantId, 'demo_webchat_conn_' + LEFT(CAST(@tenantId AS NVARCHAR(36)), 8), '5511988881010', '5511988881010', @convId);

                    INSERT INTO altdesk.Message (MessageId, TenantId, ConversationId, Direction, Body, SenderExternalId, Status, CreatedAt)
                    VALUES (NEWID(), @tenantId, @convId, 'IN', 'Não consigo adicionar novos agentes', 'diego.martins@cliente.demo', 'READ', DATEADD(day, -3, GETUTCDATE()));

                    INSERT INTO altdesk.Message (MessageId, TenantId, ConversationId, Direction, Body, SenderUserId, Status, CreatedAt)
                    VALUES (NEWID(), @tenantId, @convId, 'OUT', 'Verifiquei que seu plano Starter tem limite de 3 assentos. Quer fazer upgrade?', @carlos_userId, 'READ', DATEADD(minute, 15, DATEADD(day, -3, GETUTCDATE())));

                    INSERT INTO altdesk.Message (MessageId, TenantId, ConversationId, Direction, Body, SenderExternalId, Status, CreatedAt)
                    VALUES (NEWID(), @tenantId, @convId, 'IN', 'Sim, por favor!', 'diego.martins@cliente.demo', 'READ', DATEADD(minute, 45, DATEADD(day, -3, GETUTCDATE())));

                    INSERT INTO altdesk.Message (MessageId, TenantId, ConversationId, Direction, Body, SenderUserId, Status, CreatedAt)
                    VALUES (NEWID(), @tenantId, @convId, 'OUT', 'Upgrade realizado. Já pode adicionar!', @carlos_userId, 'READ', DATEADD(hour, 1, DATEADD(day, -3, GETUTCDATE())));

                    SET @ticketId = NEWID();
                    INSERT INTO altdesk.Ticket (TicketId, TenantId, ConversationId, Priority, Status, AssignedAgentId, SLAFirstResponseDue, SLAResolutionDue, FirstResponseAt, ResolvedAt, SlaStatus, KanbanOrder, CreatedAt, UpdatedAt)
                    VALUES (@ticketId, @tenantId, @convId, 'HIGH', 'RESOLVED', @carlos_agentId, DATEADD(hour, 1, DATEADD(day, -3, GETUTCDATE())), DATEADD(hour, 4, DATEADD(day, -3, GETUTCDATE())), DATEADD(minute, 15, DATEADD(day, -3, GETUTCDATE())), DATEADD(hour, 1, DATEADD(day, -3, GETUTCDATE())), 'ON_TIME', 0, DATEADD(day, -3, GETUTCDATE()), DATEADD(hour, 1, DATEADD(day, -3, GETUTCDATE())));

                    INSERT INTO altdesk.SatisfactionRating (ConversationId, Score, Comment, CreatedAt)
                    VALUES (@convId, 5, 'Ótimo atendimento, rápido e resolveu.', DATEADD(hour, 1, DATEADD(day, -3, GETUTCDATE())));

                    -- Scenario 11: Open ticket, medium priority, WhatsApp, assigned to Juliana Rocha, created 2 days ago.
                    INSERT INTO altdesk.Contact (ContactId, TenantId, Name, Phone, Email, Tags, CreatedAt)
                    VALUES (@c11, @tenantId, 'Patricia Freitas', '5511988881011', 'patricia.freitas@cliente.demo', '["Demonstração", "Bug"]', DATEADD(day, -2, GETUTCDATE()));

                    SET @convId = NEWID();
                    INSERT INTO altdesk.Conversation (ConversationId, TenantId, ChannelId, QueueId, AssignedUserId, OpenedByContactId, Title, Kind, Status, SourceChannel, LastMessageAt, CreatedAt, ClosedAt, CsatScore, SlaDeadline, SlaStatus, FirstResponseAt)
                    VALUES (@convId, @tenantId, @whatsapp_chId, @q_suporte, @juliana_userId, @c11, 'Patricia Freitas', 'DIRECT', 'OPEN', 'WHATSAPP', DATEADD(day, -2, GETUTCDATE()), DATEADD(day, -2, GETUTCDATE()), NULL, NULL, DATEADD(hour, 2, DATEADD(day, -2, GETUTCDATE())), 'VIOLATED', NULL);

                    INSERT INTO altdesk.ExternalThreadMap (TenantId, ConnectorId, ExternalChatId, ExternalUserId, ConversationId)
                    VALUES (@tenantId, 'demo_whatsapp_conn_' + LEFT(CAST(@tenantId AS NVARCHAR(36)), 8), '5511988881011', '5511988881011@s.whatsapp.net', @convId);

                    INSERT INTO altdesk.Message (MessageId, TenantId, ConversationId, Direction, Body, SenderExternalId, Status, CreatedAt)
                    VALUES (NEWID(), @tenantId, @convId, 'IN', 'Erro 500 ao tentar gerar relatório de auditoria', '5511988881011', 'READ', DATEADD(day, -2, GETUTCDATE()));

                    SET @ticketId = NEWID();
                    INSERT INTO altdesk.Ticket (TicketId, TenantId, ConversationId, Priority, Status, AssignedAgentId, SLAFirstResponseDue, SLAResolutionDue, FirstResponseAt, ResolvedAt, SlaStatus, KanbanOrder, CreatedAt, UpdatedAt)
                    VALUES (@ticketId, @tenantId, @convId, 'MEDIUM', 'ESCALATED', @juliana_agentId, DATEADD(hour, 2, DATEADD(day, -2, GETUTCDATE())), DATEADD(hour, 12, DATEADD(day, -2, GETUTCDATE())), NULL, NULL, 'VIOLATED', 3, DATEADD(day, -2, GETUTCDATE()), GETUTCDATE());

                    -- Scenario 12: Closed ticket, medium priority, WhatsApp, assigned to Admin, created 2 days ago.
                    INSERT INTO altdesk.Contact (ContactId, TenantId, Name, Phone, Email, Tags, CreatedAt)
                    VALUES (@c12, @tenantId, 'Eduardo Ramos', '5511988881012', 'eduardo.ramos@cliente.demo', '["Demonstração", "Suporte"]', DATEADD(day, -2, GETUTCDATE()));

                    SET @convId = NEWID();
                    INSERT INTO altdesk.Conversation (ConversationId, TenantId, ChannelId, QueueId, AssignedUserId, OpenedByContactId, Title, Kind, Status, SourceChannel, LastMessageAt, CreatedAt, ClosedAt, CsatScore, SlaDeadline, SlaStatus, FirstResponseAt)
                    VALUES (@convId, @tenantId, @whatsapp_chId, @q_suporte, @admin_userId, @c12, 'Eduardo Ramos', 'DIRECT', 'RESOLVED', 'WHATSAPP', DATEADD(minute, 45, DATEADD(day, -2, GETUTCDATE())), DATEADD(day, -2, GETUTCDATE()), DATEADD(minute, 45, DATEADD(day, -2, GETUTCDATE())), 4, DATEADD(hour, 2, DATEADD(day, -2, GETUTCDATE())), 'MET', DATEADD(minute, 20, DATEADD(day, -2, GETUTCDATE())));

                    INSERT INTO altdesk.ExternalThreadMap (TenantId, ConnectorId, ExternalChatId, ExternalUserId, ConversationId)
                    VALUES (@tenantId, 'demo_whatsapp_conn_' + LEFT(CAST(@tenantId AS NVARCHAR(36)), 8), '5511988881012', '5511988881012@s.whatsapp.net', @convId);

                    INSERT INTO altdesk.Message (MessageId, TenantId, ConversationId, Direction, Body, SenderExternalId, Status, CreatedAt)
                    VALUES (NEWID(), @tenantId, @convId, 'IN', 'Como ativo autenticação de dois fatores?', '5511988881012', 'READ', DATEADD(day, -2, GETUTCDATE()));

                    INSERT INTO altdesk.Message (MessageId, TenantId, ConversationId, Direction, Body, SenderUserId, Status, CreatedAt)
                    VALUES (NEWID(), @tenantId, @convId, 'OUT', 'Vá em Configurações > Segurança...', @admin_userId, 'READ', DATEADD(minute, 20, DATEADD(day, -2, GETUTCDATE())));

                    INSERT INTO altdesk.Message (MessageId, TenantId, ConversationId, Direction, Body, SenderExternalId, Status, CreatedAt)
                    VALUES (NEWID(), @tenantId, @convId, 'IN', 'Obrigado, funcionou!', '5511988881012', 'READ', DATEADD(minute, 40, DATEADD(day, -2, GETUTCDATE())));

                    SET @ticketId = NEWID();
                    INSERT INTO altdesk.Ticket (TicketId, TenantId, ConversationId, Priority, Status, AssignedAgentId, SLAFirstResponseDue, SLAResolutionDue, FirstResponseAt, ResolvedAt, SlaStatus, KanbanOrder, CreatedAt, UpdatedAt)
                    VALUES (@ticketId, @tenantId, @convId, 'MEDIUM', 'RESOLVED', @admin_agentId, DATEADD(hour, 2, DATEADD(day, -2, GETUTCDATE())), DATEADD(hour, 12, DATEADD(day, -2, GETUTCDATE())), DATEADD(minute, 20, DATEADD(day, -2, GETUTCDATE())), DATEADD(minute, 45, DATEADD(day, -2, GETUTCDATE())), 'ON_TIME', 0, DATEADD(day, -2, GETUTCDATE()), DATEADD(minute, 45, DATEADD(day, -2, GETUTCDATE())));

                    INSERT INTO altdesk.SatisfactionRating (ConversationId, Score, Comment, CreatedAt)
                    VALUES (@convId, 4, 'Suporte bom.', DATEADD(minute, 50, DATEADD(day, -2, GETUTCDATE())));

                    -- Scenario 13: Open ticket, high priority, Email, assigned to Rafael Torres, created 1 day ago.
                    INSERT INTO altdesk.Contact (ContactId, TenantId, Name, Phone, Email, Tags, CreatedAt)
                    VALUES (@c13, @tenantId, 'Roberto Carlos', '5511988881013', 'roberto.carlos@cliente.demo', '["Demonstração", "Financeiro"]', DATEADD(day, -1, GETUTCDATE()));

                    SET @convId = NEWID();
                    INSERT INTO altdesk.Conversation (ConversationId, TenantId, ChannelId, QueueId, AssignedUserId, OpenedByContactId, Title, Kind, Status, SourceChannel, LastMessageAt, CreatedAt, ClosedAt, CsatScore, SlaDeadline, SlaStatus, FirstResponseAt)
                    VALUES (@convId, @tenantId, @email_chId, @q_financeiro, @rafael_userId, @c13, 'Fatura Duplicada no Sistema', 'DIRECT', 'OPEN', 'EMAIL', DATEADD(day, -1, GETUTCDATE()), DATEADD(day, -1, GETUTCDATE()), NULL, NULL, DATEADD(hour, 1, DATEADD(day, -1, GETUTCDATE())), 'VIOLATED', NULL);

                    INSERT INTO altdesk.ExternalThreadMap (TenantId, ConnectorId, ExternalChatId, ExternalUserId, ConversationId)
                    VALUES (@tenantId, 'demo_email_conn_' + LEFT(CAST(@tenantId AS NVARCHAR(36)), 8), 'roberto.carlos@cliente.demo', 'roberto.carlos@cliente.demo', @convId);

                    INSERT INTO altdesk.Message (MessageId, TenantId, ConversationId, Direction, Body, SenderExternalId, Status, CreatedAt)
                    VALUES (NEWID(), @tenantId, @convId, 'IN', 'Erro de conciliação de faturas no final do mês', 'roberto.carlos@cliente.demo', 'READ', DATEADD(day, -1, GETUTCDATE()));

                    SET @ticketId = NEWID();
                    INSERT INTO altdesk.Ticket (TicketId, TenantId, ConversationId, Priority, Status, AssignedAgentId, SLAFirstResponseDue, SLAResolutionDue, FirstResponseAt, ResolvedAt, SlaStatus, KanbanOrder, CreatedAt, UpdatedAt)
                    VALUES (@ticketId, @tenantId, @convId, 'HIGH', 'OPEN', @rafael_agentId, DATEADD(hour, 1, DATEADD(day, -1, GETUTCDATE())), DATEADD(hour, 4, DATEADD(day, -1, GETUTCDATE())), NULL, NULL, 'VIOLATED', 0, DATEADD(day, -1, GETUTCDATE()), GETUTCDATE());

                    -- Scenario 14: Closed ticket, low priority, WhatsApp, assigned to Suporte N1, created 1 day ago.
                    INSERT INTO altdesk.Contact (ContactId, TenantId, Name, Phone, Email, Tags, CreatedAt)
                    VALUES (@c14, @tenantId, 'Julio Cesar', '5511988881014', 'julio.cesar@cliente.demo', '["Demonstração", "Suporte"]', DATEADD(day, -1, GETUTCDATE()));

                    SET @convId = NEWID();
                    INSERT INTO altdesk.Conversation (ConversationId, TenantId, ChannelId, QueueId, AssignedUserId, OpenedByContactId, Title, Kind, Status, SourceChannel, LastMessageAt, CreatedAt, ClosedAt, CsatScore, SlaDeadline, SlaStatus, FirstResponseAt)
                    VALUES (@convId, @tenantId, @whatsapp_chId, @q_suporte, @n1_userId, @c14, 'Julio Cesar', 'DIRECT', 'RESOLVED', 'WHATSAPP', DATEADD(hour, 2, DATEADD(day, -1, GETUTCDATE())), DATEADD(day, -1, GETUTCDATE()), DATEADD(hour, 2, DATEADD(day, -1, GETUTCDATE())), 5, DATEADD(hour, 4, DATEADD(day, -1, GETUTCDATE())), 'MET', DATEADD(minute, 30, DATEADD(day, -1, GETUTCDATE())));

                    INSERT INTO altdesk.ExternalThreadMap (TenantId, ConnectorId, ExternalChatId, ExternalUserId, ConversationId)
                    VALUES (@tenantId, 'demo_whatsapp_conn_' + LEFT(CAST(@tenantId AS NVARCHAR(36)), 8), '5511988881014', '5511988881014@s.whatsapp.net', @convId);

                    INSERT INTO altdesk.Message (MessageId, TenantId, ConversationId, Direction, Body, SenderExternalId, Status, CreatedAt)
                    VALUES (NEWID(), @tenantId, @convId, 'IN', 'Vocês aceitam Pix parcelado?', '5511988881014', 'READ', DATEADD(day, -1, GETUTCDATE()));

                    INSERT INTO altdesk.Message (MessageId, TenantId, ConversationId, Direction, Body, SenderUserId, Status, CreatedAt)
                    VALUES (NEWID(), @tenantId, @convId, 'OUT', 'Atualmente apenas Pix à vista ou Cartão...', @n1_userId, 'READ', DATEADD(minute, 30, DATEADD(day, -1, GETUTCDATE())));

                    INSERT INTO altdesk.Message (MessageId, TenantId, ConversationId, Direction, Body, SenderExternalId, Status, CreatedAt)
                    VALUES (NEWID(), @tenantId, @convId, 'IN', 'Ok, farei no cartão então.', '5511988881014', 'READ', DATEADD(hour, 2, DATEADD(day, -1, GETUTCDATE())));

                    SET @ticketId = NEWID();
                    INSERT INTO altdesk.Ticket (TicketId, TenantId, ConversationId, Priority, Status, AssignedAgentId, SLAFirstResponseDue, SLAResolutionDue, FirstResponseAt, ResolvedAt, SlaStatus, KanbanOrder, CreatedAt, UpdatedAt)
                    VALUES (@ticketId, @tenantId, @convId, 'LOW', 'RESOLVED', @n1_agentId, DATEADD(hour, 4, DATEADD(day, -1, GETUTCDATE())), DATEADD(day, 1, DATEADD(day, -1, GETUTCDATE())), DATEADD(minute, 30, DATEADD(day, -1, GETUTCDATE())), DATEADD(hour, 2, DATEADD(day, -1, GETUTCDATE())), 'ON_TIME', 0, DATEADD(day, -1, GETUTCDATE()), DATEADD(hour, 2, DATEADD(day, -1, GETUTCDATE())));

                    INSERT INTO altdesk.SatisfactionRating (ConversationId, Score, Comment, CreatedAt)
                    VALUES (@convId, 5, 'Bem explicado!', DATEADD(hour, 2, DATEADD(day, -1, GETUTCDATE())));

                    -- Scenario 15: Open ticket, low priority, SMS, assigned to Consultor Comercial, created 12 hours ago.
                    INSERT INTO altdesk.Contact (ContactId, TenantId, Name, Phone, Email, Tags, CreatedAt)
                    VALUES (@c15, @tenantId, 'Camila Pitanga', '5511988881015', 'camila.pitanga@cliente.demo', '["Demonstração", "Upgrade"]', DATEADD(hour, -12, GETUTCDATE()));

                    SET @convId = NEWID();
                    INSERT INTO altdesk.Conversation (ConversationId, TenantId, ChannelId, QueueId, AssignedUserId, OpenedByContactId, Title, Kind, Status, SourceChannel, LastMessageAt, CreatedAt, ClosedAt, CsatScore, SlaDeadline, SlaStatus, FirstResponseAt)
                    VALUES (@convId, @tenantId, @sms_chId, @q_comercial, @vendas_userId, @c15, 'Camila Pitanga', 'DIRECT', 'OPEN', 'SMS', DATEADD(hour, -11, GETUTCDATE()), DATEADD(hour, -12, GETUTCDATE()), NULL, NULL, DATEADD(hour, -8, GETUTCDATE()), 'MET', DATEADD(hour, 1, DATEADD(hour, -12, GETUTCDATE())));

                    INSERT INTO altdesk.ExternalThreadMap (TenantId, ConnectorId, ExternalChatId, ExternalUserId, ConversationId)
                    VALUES (@tenantId, 'demo_sms_conn_' + LEFT(CAST(@tenantId AS NVARCHAR(36)), 8), '5511988881015', '5511988881015', @convId);

                    INSERT INTO altdesk.Message (MessageId, TenantId, ConversationId, Direction, Body, SenderExternalId, Status, CreatedAt)
                    VALUES (NEWID(), @tenantId, @convId, 'IN', 'Tem desconto no plano anual?', '5511988881015', 'READ', DATEADD(hour, -12, GETUTCDATE()));

                    INSERT INTO altdesk.Message (MessageId, TenantId, ConversationId, Direction, Body, SenderUserId, Status, CreatedAt)
                    VALUES (NEWID(), @tenantId, @convId, 'OUT', 'Sim, no plano anual oferecemos 20% de desconto...', @vendas_userId, 'READ', DATEADD(hour, -11, GETUTCDATE()));

                    SET @ticketId = NEWID();
                    INSERT INTO altdesk.Ticket (TicketId, TenantId, ConversationId, Priority, Status, AssignedAgentId, SLAFirstResponseDue, SLAResolutionDue, FirstResponseAt, ResolvedAt, SlaStatus, KanbanOrder, CreatedAt, UpdatedAt)
                    VALUES (@ticketId, @tenantId, @convId, 'LOW', 'IN_PROGRESS', @vendas_agentId, DATEADD(hour, 4, DATEADD(hour, -12, GETUTCDATE())), DATEADD(day, 1, DATEADD(hour, -12, GETUTCDATE())), DATEADD(hour, -11, GETUTCDATE()), NULL, 'ON_TIME', 1, DATEADD(hour, -12, GETUTCDATE()), GETUTCDATE());

                    -- Scenario 16: Closed ticket, medium priority, WhatsApp, assigned to Juliana Rocha, created 4 hours ago.
                    INSERT INTO altdesk.Contact (ContactId, TenantId, Name, Phone, Email, Tags, CreatedAt)
                    VALUES (@c16, @tenantId, 'Renato Aragão', '5511988881016', 'renato.aragao@cliente.demo', '["Demonstração", "Suporte"]', DATEADD(hour, -4, GETUTCDATE()));

                    SET @convId = NEWID();
                    INSERT INTO altdesk.Conversation (ConversationId, TenantId, ChannelId, QueueId, AssignedUserId, OpenedByContactId, Title, Kind, Status, SourceChannel, LastMessageAt, CreatedAt, ClosedAt, CsatScore, SlaDeadline, SlaStatus, FirstResponseAt)
                    VALUES (@convId, @tenantId, @whatsapp_chId, @q_suporte, @juliana_userId, @c16, 'Renato Aragão', 'DIRECT', 'RESOLVED', 'WHATSAPP', DATEADD(hour, -3, GETUTCDATE()), DATEADD(hour, -4, GETUTCDATE()), DATEADD(hour, -3, GETUTCDATE()), 4, DATEADD(hour, -2, GETUTCDATE()), 'MET', DATEADD(minute, 10, DATEADD(hour, -4, GETUTCDATE())));

                    INSERT INTO altdesk.ExternalThreadMap (TenantId, ConnectorId, ExternalChatId, ExternalUserId, ConversationId)
                    VALUES (@tenantId, 'demo_whatsapp_conn_' + LEFT(CAST(@tenantId AS NVARCHAR(36)), 8), '5511988881016', '5511988881016@s.whatsapp.net', @convId);

                    INSERT INTO altdesk.Message (MessageId, TenantId, ConversationId, Direction, Body, SenderExternalId, Status, CreatedAt)
                    VALUES (NEWID(), @tenantId, @convId, 'IN', 'Como faço para excluir uma tag?', '5511988881016', 'READ', DATEADD(hour, -4, GETUTCDATE()));

                    INSERT INTO altdesk.Message (MessageId, TenantId, ConversationId, Direction, Body, SenderUserId, Status, CreatedAt)
                    VALUES (NEWID(), @tenantId, @convId, 'OUT', 'Vá em Configurações > Tags e clique na lixeira...', @juliana_userId, 'READ', DATEADD(minute, 10, DATEADD(hour, -4, GETUTCDATE())));

                    INSERT INTO altdesk.Message (MessageId, TenantId, ConversationId, Direction, Body, SenderExternalId, Status, CreatedAt)
                    VALUES (NEWID(), @tenantId, @convId, 'IN', 'Deu certo!', '5511988881016', 'READ', DATEADD(hour, -3, GETUTCDATE()));

                    SET @ticketId = NEWID();
                    INSERT INTO altdesk.Ticket (TicketId, TenantId, ConversationId, Priority, Status, AssignedAgentId, SLAFirstResponseDue, SLAResolutionDue, FirstResponseAt, ResolvedAt, SlaStatus, KanbanOrder, CreatedAt, UpdatedAt)
                    VALUES (@ticketId, @tenantId, @convId, 'MEDIUM', 'RESOLVED', @juliana_agentId, DATEADD(hour, 2, DATEADD(hour, -4, GETUTCDATE())), DATEADD(hour, 12, DATEADD(hour, -4, GETUTCDATE())), DATEADD(minute, 10, DATEADD(hour, -4, GETUTCDATE())), DATEADD(hour, -3, GETUTCDATE())), 'ON_TIME', 0, DATEADD(hour, -4, GETUTCDATE()), DATEADD(hour, -3, GETUTCDATE()));

                    INSERT INTO altdesk.SatisfactionRating (ConversationId, Score, Comment, CreatedAt)
                    VALUES (@convId, 4, 'Resolvido.', DATEADD(hour, -3, GETUTCDATE()));
                `);
        }

        logger.info({ tenantId }, "Demo data preload finished");
    } catch (err: any) {
        logger.error({ tenantId, error: err.message }, "Failed to preload demo data");
    }
}

