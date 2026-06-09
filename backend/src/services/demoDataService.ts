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
            logger.info({ tenantId }, "Seeding rich historical demo dataset (50 tickets)");

            const names = [
                "Marcos Pereira", "Fernanda Alves", "João Batista", "Paula Mendes", "Ricardo Nunes",
                "Luciana Costa", "Beatriz Lima", "Gustavo Azevedo", "Simone Prado", "Diego Martins",
                "Patricia Freitas", "Eduardo Ramos", "Roberto Carlos", "Julio Cesar", "Camila Pitanga",
                "Renato Aragão", "Aline Santos", "Bruno Souza", "Carolina Oliveira", "Daniel Silva",
                "Eliana Costa", "Fabio Rocha", "Gabriela Martins", "Hugo Torres", "Isabela Lima",
                "Jefferson Alves", "Karina Prado", "Leonardo Ramos", "Marina Mendes", "Nelson Pereira",
                "Olivia Nunes", "Pedro Silveira", "Renata Costa", "Samuel Souza", "Tatiane Oliveira",
                "Valter Silva", "Yasmin Santos", "Alexandre Rocha", "Bianca Torres", "Claudio Lima",
                "Debora Alves", "Emilio Prado", "Flavia Ramos", "Gerson Mendes", "Helena Pereira",
                "Igor Nunes", "Juliana Costa", "Katia Silveira", "Lucas Souza", "Milena Oliveira"
            ];

            const suporteScripts = [
                {
                    subject: "Instabilidade no sistema",
                    messages: [
                        { dir: "IN", body: "Olá, o sistema está apresentando lentidão hoje?" },
                        { dir: "OUT", body: "Olá! Tivemos uma breve instabilidade nos servidores, mas já foi resolvido. Pode atualizar a página?" },
                        { dir: "IN", body: "Ah, agora carregou! Obrigado pelo retorno rápido." }
                    ]
                },
                {
                    subject: "Erro 500 ao gerar relatório",
                    messages: [
                        { dir: "IN", body: "Erro 500 constante ao tentar gerar relatório de auditoria do último mês." },
                        { dir: "OUT", body: "Olá, identificamos que o filtro de datas estava estourando a query. Já aplicamos a correção." },
                        { dir: "IN", body: "Perfeito, acabei de testar aqui e funcionou." }
                    ]
                },
                {
                    subject: "Configuração do chat widget",
                    messages: [
                        { dir: "IN", body: "Como altero a cor do chat widget no meu site?" },
                        { dir: "OUT", body: "Olá! Basta ir em Configurações > Widget e alterar a cor primária no painel de personalização." },
                        { dir: "IN", body: "Ok, vou dar uma olhada. Obrigado!" }
                    ]
                },
                {
                    subject: "Integração API travada",
                    messages: [
                        { dir: "IN", body: "Nossa integração com o CRM parou de funcionar do nada." },
                        { dir: "OUT", body: "Olá! Identificamos um excesso de requisições excedendo a cota do plano. Ajustamos as cotas." },
                        { dir: "IN", body: "Ah, agora voltou a sincronizar. Valeu!" }
                    ]
                },
                {
                    subject: "Como resetar senha de outro agente?",
                    messages: [
                        { dir: "IN", body: "Olá, sou admin e preciso resetar a senha de um dos agentes." },
                        { dir: "OUT", body: "Olá! Você pode ir em Configurações > Agentes, selecionar o agente e clicar em 'Redefinir Senha'." },
                        { dir: "IN", body: "Deu certo, obrigado!" }
                    ]
                }
            ];

            const financeiroScripts = [
                {
                    subject: "Dúvida sobre cobrança adicional",
                    messages: [
                        { dir: "IN", body: "Recebi uma cobrança a mais na minha fatura deste mês. O que seria?" },
                        { dir: "OUT", body: "Olá! Essa cobrança refere-se ao excedente de agentes ativos contratados no dia 15." },
                        { dir: "IN", body: "Ah, verdade. Havíamos adicionado 2 novos agentes. Obrigado pelo esclarecimento." }
                    ]
                },
                {
                    subject: "Boleto não recebido este mês",
                    messages: [
                        { dir: "IN", body: "Não recebi meu boleto deste mês. Podem reenviar?" },
                        { dir: "OUT", body: "Olá! Claro, acabo de enviar a segunda via atualizada para o seu e-mail de cadastro." },
                        { dir: "IN", body: "Recebido, obrigado!" }
                    ]
                },
                {
                    subject: "Alteração de dados de faturamento (CNPJ)",
                    messages: [
                        { dir: "IN", body: "Preciso alterar o CNPJ da minha conta de faturamento." },
                        { dir: "OUT", body: "Olá! Por favor envie o contrato social atualizado para realizarmos a alteração no sistema." },
                        { dir: "IN", body: "Segue o documento anexo." },
                        { dir: "OUT", body: "Alteração realizada com sucesso! As próximas notas fiscais serão emitidas no novo CNPJ." }
                    ]
                },
                {
                    subject: "Segunda via da nota fiscal",
                    messages: [
                        { dir: "IN", body: "Poderiam me enviar a nota fiscal da última mensalidade?" },
                        { dir: "OUT", body: "Olá! A nota fiscal foi emitida e anexada ao seu ticket. Você também pode baixá-la no menu Faturamento." },
                        { dir: "IN", body: "Perfeito, baixei aqui." }
                    ]
                }
            ];

            const comercialScripts = [
                {
                    subject: "Solicitação de proposta para 50 agentes",
                    messages: [
                        { dir: "IN", body: "Gostaria de uma proposta comercial personalizada para 50 agentes de atendimento." },
                        { dir: "OUT", body: "Olá! Com certeza, temos descontos progressivos excelentes para essa escala. Qual o seu melhor e-mail corporativo?" },
                        { dir: "IN", body: "Pode mandar no comercial@empresa.com.br" },
                        { dir: "OUT", body: "Proposta enviada! Se tiver dúvidas, podemos marcar uma call rápida." }
                    ]
                },
                {
                    subject: "Demonstração do plano Enterprise",
                    messages: [
                        { dir: "IN", body: "Gostaria de agendar uma demonstração completa do plano Enterprise." },
                        { dir: "OUT", body: "Olá! Claro, acesse o link calendly.com/altdesk-demo para escolher o melhor horário." },
                        { dir: "IN", body: "Agendado para quinta-feira. Obrigado!" }
                    ]
                },
                {
                    subject: "Dúvidas sobre canais inclusos",
                    messages: [
                        { dir: "IN", body: "O plano Starter inclui integração com Instagram?" },
                        { dir: "OUT", body: "Olá! O plano Starter inclui WhatsApp e Webchat. A integração com Instagram está disponível a partir do plano Professional." },
                        { dir: "IN", body: "Entendido. Vou analisar o Professional." }
                    ]
                },
                {
                    subject: "Preços para envio de SMS",
                    messages: [
                        { dir: "IN", body: "Vocês enviam SMS corporativo? Qual o valor por mensagem?" },
                        { dir: "OUT", body: "Olá! Sim, temos suporte a SMS. O custo é de R$ 0,08 por SMS enviado. Quer que eu ative na sua conta?" },
                        { dir: "IN", body: "Sim, por favor." }
                    ]
                }
            ];

            const implantacaoScripts = [
                {
                    subject: "Dificuldade na homologação do WhatsApp",
                    messages: [
                        { dir: "IN", body: "Não estou conseguindo validar o número na API Cloud do WhatsApp." },
                        { dir: "OUT", body: "Olá! Verifique se a sua conta comercial do Facebook Business está com a verificação concluída." },
                        { dir: "IN", body: "Verifiquei e o Facebook está pedindo mais documentos." },
                        { dir: "OUT", body: "Certo. Vamos marcar uma chamada de 15 minutos para te auxiliar com essa documentação?" }
                    ]
                },
                {
                    subject: "Migração de dados do Zendesk",
                    messages: [
                        { dir: "IN", body: "Como faço para migrar o histórico de tickets que tenho no Zendesk?" },
                        { dir: "OUT", body: "Olá! Nós realizamos a migração de histórico através da nossa API de importação. Vou te passar o escopo do serviço." },
                        { dir: "IN", body: "Legal, me manda a proposta de migração." }
                    ]
                },
                {
                    subject: "Configuração do domínio personalizado",
                    messages: [
                        { dir: "IN", body: "Já fiz o apontamento CNAME na minha hospedagem, mas a Central de Ajuda ainda não carrega." },
                        { dir: "OUT", body: "Olá! A propagação de DNS pode levar até 24 horas. Vou monitorar o status do seu certificado SSL." },
                        { dir: "IN", body: "Ah, ok. Vou aguardar então." }
                    ]
                },
                {
                    subject: "Ajuste de horário de atendimento",
                    messages: [
                        { dir: "IN", body: "Como configuro a mensagem automática para quando a equipe estiver fora do horário comercial?" },
                        { dir: "OUT", body: "Olá! Vá em Configurações > Horários de Atendimento, defina seus horários e configure a mensagem de ausência." },
                        { dir: "IN", body: "Consegui configurar aqui, obrigado!" }
                    ]
                }
            ];

            const escapeSql = (str: string): string => {
                return str.replace(/'/g, "''");
            };

            const getContactEmail = (name: string, prefix: string): string => {
                const normalized = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ".");
                return `${normalized}.${prefix}@cliente.demo`;
            };

            const getContactPhone = (index: number): string => {
                const suffix = (1001 + index).toString();
                return `551198888${suffix}`;
            };

            let declarations = "";
            let sqlQueries = `
                -- Clean up default contacts to avoid duplicate phones/emails
                DELETE FROM altdesk.Contact WHERE TenantId = @tenantId;

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
            `;

            for (let i = 0; i < 50; i++) {
                const name = names[i % names.length];
                const phone = getContactPhone(i);
                const prefix = tenantId.substring(0, 5);
                const email = getContactEmail(name, prefix);

                // Determine Queue
                let queueVar = "@q_suporte";
                let scripts = suporteScripts;
                let queueName = "Suporte";
                if (i % 5 === 2) {
                    queueVar = "@q_financeiro";
                    scripts = financeiroScripts;
                    queueName = "Financeiro";
                } else if (i % 5 === 3) {
                    queueVar = "@q_comercial";
                    scripts = comercialScripts;
                    queueName = "Comercial";
                } else if (i % 5 === 4) {
                    queueVar = "@q_implantacao";
                    scripts = implantacaoScripts;
                    queueName = "Implantação";
                }

                const script = scripts[(i + Math.floor(i / 5)) % scripts.length];
                const subject = script.subject;

                // Determine Status
                let ticketStatus = "RESOLVED";
                let convStatus = "RESOLVED";
                let kanbanOrder = 0;
                if (i >= 30 && i < 38) {
                    ticketStatus = "OPEN";
                    convStatus = "OPEN";
                    kanbanOrder = 0;
                } else if (i >= 38 && i < 44) {
                    ticketStatus = "IN_PROGRESS";
                    convStatus = "OPEN";
                    kanbanOrder = 1;
                } else if (i >= 44 && i < 48) {
                    ticketStatus = "WAITING_CUSTOMER";
                    convStatus = "OPEN";
                    kanbanOrder = 2;
                } else if (i >= 48 && i < 50) {
                    ticketStatus = "ESCALATED";
                    convStatus = "OPEN";
                    kanbanOrder = 3;
                }

                // Determine Priority
                let priority = "MEDIUM";
                let priorityHours = 12;
                let responseHours = 2;
                if (i % 6 === 0) {
                    priority = "CRITICAL";
                    priorityHours = 1;
                    responseHours = 0.25;
                } else if (i % 6 === 1 || i % 6 === 2) {
                    priority = "HIGH";
                    priorityHours = 4;
                    responseHours = 1;
                } else if (i % 6 === 5) {
                    priority = "LOW";
                    priorityHours = 24;
                    responseHours = 4;
                }

                // Determine Channel
                let channelVar = "@whatsapp_chId";
                let sourceChannel = "WHATSAPP";
                let externalChatId = phone;
                let externalUserId = `${phone}@s.whatsapp.net`;
                let connectorIdSuffix = "whatsapp";

                if (i % 4 === 1) {
                    channelVar = "@email_chId";
                    sourceChannel = "EMAIL";
                    externalChatId = email;
                    externalUserId = email;
                    connectorIdSuffix = "email";
                } else if (i % 4 === 2) {
                    channelVar = "@webchat_chId";
                    sourceChannel = "PLATFORM";
                    externalChatId = phone;
                    externalUserId = phone;
                    connectorIdSuffix = "webchat";
                } else if (i % 4 === 3) {
                    channelVar = "@sms_chId";
                    sourceChannel = "SMS";
                    externalChatId = phone;
                    externalUserId = phone;
                    connectorIdSuffix = "sms";
                }

                const connectorId = `demo_${connectorIdSuffix}_conn_` + tenantId.substring(0, 8);

                // Determine Assigned Agent
                let agentUserVar = "@admin_userId";
                let agentVar = "@admin_agentId";
                if (queueName === "Financeiro") {
                    agentUserVar = i % 2 === 0 ? "@fin_userId" : "@rafael_userId";
                    agentVar = i % 2 === 0 ? "@fin_agentId" : "@rafael_agentId";
                } else if (queueName === "Comercial") {
                    agentUserVar = i % 2 === 0 ? "@vendas_userId" : "@carlos_userId";
                    agentVar = i % 2 === 0 ? "@vendas_agentId" : "@carlos_agentId";
                } else if (queueName === "Implantação") {
                    agentUserVar = i % 2 === 0 ? "@carlos_userId" : "@admin_userId";
                    agentVar = i % 2 === 0 ? "@carlos_agentId" : "@admin_agentId";
                } else {
                    agentUserVar = i % 3 === 0 ? "@n1_userId" : (i % 3 === 1 ? "@juliana_userId" : "@admin_userId");
                    agentVar = i % 3 === 0 ? "@n1_agentId" : (i % 3 === 1 ? "@juliana_agentId" : "@admin_agentId");
                }

                // Determine SLA status
                let slaStatus = "MET";
                let ticketSlaStatus = "ON_TIME";
                if (i % 7 === 0) {
                    slaStatus = "VIOLATED";
                    ticketSlaStatus = "VIOLATED";
                } else if (i % 7 === 3 && ticketStatus !== "RESOLVED") {
                    slaStatus = "WARNING";
                    ticketSlaStatus = "WARNING";
                } else if (ticketStatus !== "RESOLVED") {
                    slaStatus = "PENDING";
                    ticketSlaStatus = "ON_TIME";
                }

                // Timestamps (calculated in JS to prevent -- T-SQL comment syntax issues)
                const createdMinsAgo = 200 + i * 850;
                const createdAtOffset = -createdMinsAgo;
                const slaFirstResponseDueOffset = -createdMinsAgo + Math.round(responseHours * 60);
                const slaResolutionDueOffset = -createdMinsAgo + Math.round(priorityHours * 60);

                const createdAtSql = `DATEADD(minute, ${createdAtOffset}, GETUTCDATE())`;
                const slaFirstResponseDueSql = `DATEADD(minute, ${slaFirstResponseDueOffset}, GETUTCDATE())`;
                const slaResolutionDueSql = `DATEADD(minute, ${slaResolutionDueOffset}, GETUTCDATE())`;

                let firstResponseAtSql = "NULL";
                if (ticketStatus === "RESOLVED" || i % 5 !== 0) {
                    const responseDelay = slaStatus === "VIOLATED" ? Math.round(responseHours * 60 + 20) : 10;
                    const firstResponseAtOffset = -createdMinsAgo + responseDelay;
                    firstResponseAtSql = `DATEADD(minute, ${firstResponseAtOffset}, GETUTCDATE())`;
                }

                let resolvedAtSql = "NULL";
                let csatScoreSql = "NULL";
                let csatCreatedAtSql = "NULL";
                if (ticketStatus === "RESOLVED") {
                    const resolutionDelay = slaStatus === "VIOLATED" ? Math.round(priorityHours * 60 + 120) : 40;
                    const resolvedAtOffset = -createdMinsAgo + resolutionDelay;
                    resolvedAtSql = `DATEADD(minute, ${resolvedAtOffset}, GETUTCDATE())`;
                    
                    if (i % 3 === 0) {
                        csatScoreSql = "5";
                    } else if (i % 3 === 1) {
                        csatScoreSql = "4";
                    } else if (i % 3 === 2 && i % 9 === 2) {
                        csatScoreSql = "2";
                    } else if (i % 3 === 2) {
                        csatScoreSql = "3";
                    }

                    const csatCreatedAtOffset = resolvedAtOffset + 5;
                    csatCreatedAtSql = `DATEADD(minute, ${csatCreatedAtOffset}, GETUTCDATE())`;
                }

                const lastMessageAtOffset = ticketStatus === "RESOLVED" 
                    ? (-createdMinsAgo + 40)
                    : (-createdMinsAgo + 20);
                const lastMessageAtSql = `DATEADD(minute, ${lastMessageAtOffset}, GETUTCDATE())`;

                declarations += `
                DECLARE @c_${i} UNIQUEIDENTIFIER = NEWID();
                DECLARE @conv_${i} UNIQUEIDENTIFIER = NEWID();
                DECLARE @ticket_${i} UNIQUEIDENTIFIER = NEWID();
                `;

                sqlQueries += `
                -- Contact
                INSERT INTO altdesk.Contact (ContactId, TenantId, Name, Phone, Email, Tags, CreatedAt)
                VALUES (@c_${i}, @tenantId, '${escapeSql(name)}', '${phone}', '${email}', '["Demonstração", "${queueName}"]', ${createdAtSql});

                -- Conversation
                INSERT INTO altdesk.Conversation (
                    ConversationId, TenantId, ChannelId, QueueId, AssignedUserId, 
                    OpenedByContactId, Title, Kind, Status, SourceChannel, 
                    LastMessageAt, CreatedAt, ClosedAt, CsatScore, SlaDeadline, 
                    SlaStatus, FirstResponseAt
                ) VALUES (
                    @conv_${i}, @tenantId, ${channelVar}, ${queueVar}, ${agentUserVar}, 
                    @c_${i}, '${escapeSql(subject)}', 'DIRECT', '${convStatus}', '${sourceChannel}', 
                    ${lastMessageAtSql}, ${createdAtSql}, ${resolvedAtSql}, ${csatScoreSql}, ${slaResolutionDueSql}, 
                    '${slaStatus}', ${firstResponseAtSql}
                );

                -- External Thread Map
                INSERT INTO altdesk.ExternalThreadMap (TenantId, ConnectorId, ExternalChatId, ExternalUserId, ConversationId)
                VALUES (@tenantId, '${connectorId}', '${externalChatId}', '${externalUserId}', @conv_${i});
                `;

                // Messages generation
                const numMsgs = Math.min(script.messages.length, ticketStatus === "RESOLVED" ? 4 : 3);
                for (let m = 0; m < numMsgs; m++) {
                    const msg = script.messages[m];
                    let msgOffset = m * 15;
                    if (m === 1 && slaStatus === "VIOLATED") {
                        msgOffset = Math.round(responseHours * 60 + 20);
                    } else if (m === 3 && slaStatus === "VIOLATED") {
                        msgOffset = Math.round(priorityHours * 60 + 120);
                    }
                    const msgCreatedAtOffset = -createdMinsAgo + msgOffset;
                    const msgCreatedAtSql = `DATEADD(minute, ${msgCreatedAtOffset}, GETUTCDATE())`;
                    
                    if (msg.dir === "IN") {
                        sqlQueries += `
                        INSERT INTO altdesk.Message (MessageId, TenantId, ConversationId, Direction, Body, SenderExternalId, Status, CreatedAt)
                        VALUES (NEWID(), @tenantId, @conv_${i}, 'IN', '${escapeSql(msg.body)}', '${externalChatId}', 'READ', ${msgCreatedAtSql});
                        `;
                    } else {
                        sqlQueries += `
                        INSERT INTO altdesk.Message (MessageId, TenantId, ConversationId, Direction, Body, SenderUserId, Status, CreatedAt)
                        VALUES (NEWID(), @tenantId, @conv_${i}, 'OUT', '${escapeSql(msg.body)}', ${agentUserVar}, 'READ', ${msgCreatedAtSql});
                        `;
                    }
                }

                // Ticket
                sqlQueries += `
                INSERT INTO altdesk.Ticket (
                    TicketId, TenantId, ConversationId, Priority, Status, 
                    AssignedAgentId, SLAFirstResponseDue, SLAResolutionDue, 
                    FirstResponseAt, ResolvedAt, SlaStatus, KanbanOrder, CreatedAt, UpdatedAt
                ) VALUES (
                    @ticket_${i}, @tenantId, @conv_${i}, '${priority}', '${ticketStatus}', 
                    ${agentVar}, ${slaFirstResponseDueSql}, ${slaResolutionDueSql}, 
                    ${firstResponseAtSql}, ${resolvedAtSql}, '${ticketSlaStatus}', ${kanbanOrder}, ${createdAtSql}, ${lastMessageAtSql}
                );

                -- Ticket Event
                INSERT INTO altdesk.TicketEvent (TenantId, TicketId, EventType, NewValue, ActorUserId, CreatedAt)
                VALUES (@tenantId, @ticket_${i}, 'CREATED', 'NEW', @admin_userId, ${createdAtSql});
                `;

                if (ticketStatus === "RESOLVED") {
                    sqlQueries += `
                    INSERT INTO altdesk.TicketEvent (TenantId, TicketId, EventType, NewValue, ActorUserId, CreatedAt)
                    VALUES (@tenantId, @ticket_${i}, 'STATUS_CHANGE', 'RESOLVED', ${agentUserVar}, ${resolvedAtSql});
                    `;
                    
                    if (csatScoreSql !== "NULL") {
                        let csatComment = "Atendimento excelente!";
                        if (csatScoreSql === "4") csatComment = "Muito bom, resolveu meu problema.";
                        if (csatScoreSql === "3") csatComment = "Atendimento normal.";
                        if (csatScoreSql === "2") csatComment = "Demorou bastante para responder.";
                        
                        sqlQueries += `
                        INSERT INTO altdesk.SatisfactionRating (ConversationId, Score, Comment, CreatedAt)
                        VALUES (@conv_${i}, ${csatScoreSql}, '${escapeSql(csatComment)}', ${csatCreatedAtSql});
                        `;
                    }
                } else {
                    sqlQueries += `
                    INSERT INTO altdesk.TicketEvent (TenantId, TicketId, EventType, NewValue, ActorUserId, CreatedAt)
                    VALUES (@tenantId, @ticket_${i}, 'STATUS_CHANGE', '${ticketStatus}', ${agentUserVar}, ${firstResponseAtSql !== "NULL" ? firstResponseAtSql : createdAtSql});
                    `;
                }
            }

            const fullQuery = declarations + "\n" + sqlQueries;
            await pool.request()
                .input("tenantId", tenantId)
                .input("adminId", adminId || null)
                .input("whatsapp_chId", whatsappChannelId)
                .input("email_chId", emailChannelId)
                .input("webchat_chId", webchatChannelId)
                .input("sms_chId", smsChannelId)
                .query(fullQuery);
        }

        logger.info({ tenantId }, "Demo data preload finished");
    } catch (err: any) {
        logger.error({ tenantId, error: err.message }, "Failed to preload demo data");
    }
}

