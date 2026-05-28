import "dotenv/config";
import { getPool } from "../db.js";

async function run() {
    const pool = await getPool();
    console.log("Running Help Articles Migration...");

    try {
        // 1. Create table if not exists
        await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'HelpArticle' AND schema_id = SCHEMA_ID('altdesk'))
      BEGIN
        CREATE TABLE altdesk.HelpArticle (
            HelpArticleId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
            TenantId UNIQUEIDENTIFIER NULL FOREIGN KEY REFERENCES altdesk.Tenant(TenantId),
            ContextKey NVARCHAR(120) NOT NULL,
            Title NVARCHAR(200) NOT NULL,
            Content NVARCHAR(MAX) NOT NULL,
            Category NVARCHAR(100) NULL,
            PagePath NVARCHAR(200) NULL,
            IsActive BIT NOT NULL DEFAULT 1,
            CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
            UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
            DeletedAt DATETIME2 NULL
        );
        PRINT 'Table altdesk.HelpArticle created.';
      END
      ELSE
      BEGIN
        PRINT 'Table altdesk.HelpArticle already exists.';
      END
    `);

        // 2. Create unique indexes if they do not exist
        await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UK_HelpArticle_Tenant_ContextKey' AND object_id = OBJECT_ID('altdesk.HelpArticle'))
      BEGIN
        CREATE UNIQUE INDEX UK_HelpArticle_Tenant_ContextKey 
        ON altdesk.HelpArticle(TenantId, ContextKey) 
        WHERE TenantId IS NOT NULL AND DeletedAt IS NULL;
        PRINT 'Index UK_HelpArticle_Tenant_ContextKey created.';
      END

      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UK_HelpArticle_Global_ContextKey' AND object_id = OBJECT_ID('altdesk.HelpArticle'))
      BEGIN
        CREATE UNIQUE INDEX UK_HelpArticle_Global_ContextKey 
        ON altdesk.HelpArticle(ContextKey) 
        WHERE TenantId IS NULL AND DeletedAt IS NULL;
        PRINT 'Index UK_HelpArticle_Global_ContextKey created.';
      END
    `);

        // 3. Seed default global help articles if they don't already exist
        console.log("Seeding default global help articles...");
        
        const seedArticles = [
            {
                key: "tickets.index",
                title: "Gestão de Chamados",
                category: "Geral",
                page: "/tickets",
                content: `
                    <h2>Central de Chamados</h2>
                    <p>Nesta tela você gerencia os atendimentos estruturados da sua plataforma. Os chamados ajudam a organizar solicitações complexas que demandam acompanhamento de prazo (SLA).</p>
                    <h3>Principais Ações:</h3>
                    <ul>
                        <li><strong>Visualizar Detalhes:</strong> Clique em qualquer chamado na lista para ver o histórico completo e interagir.</li>
                        <li><strong>Filtros Avançados:</strong> Utilize a barra superior para filtrar chamados por status (Aberto, Pendente, Resolvido), prioridade (Baixa, Média, Alta, Urgente) ou agente responsável.</li>
                        <li><strong>Painel Kanban:</strong> Alterne a visualização para o modo Kanban para arrastar e soltar chamados entre os diferentes estágios de atendimento.</li>
                    </ul>
                `
            },
            {
                key: "kanban.index",
                title: "Visão Kanban de Tickets",
                category: "Geral",
                page: "/tickets",
                content: `
                    <h2>Visão Kanban</h2>
                    <p>Nesta tela você visualiza seus chamados organizados em colunas de status. Arraste e solte os cartões para atualizar o andamento do suporte.</p>
                    <h3>Estágios:</h3>
                    <ul>
                        <li><strong>Novo:</strong> Chamados recém-criados aguardando triagem.</li>
                        <li><strong>Triagem / Atendimento:</strong> Chamados sendo analisados ou ativamente tratados pela equipe técnica.</li>
                        <li><strong>Pendente / Pausado:</strong> Chamados aguardando resposta do cliente ou terceiros.</li>
                    </ul>
                `
            },
            {
                key: "reports.index",
                title: "Relatórios Analíticos",
                category: "Métricas",
                page: "/reports",
                content: `
                    <h2>Relatórios e Indicadores</h2>
                    <p>Acompanhe o desempenho da sua equipe e a satisfação dos seus clientes através de gráficos consolidados e exportações de dados.</p>
                    <h3>Métricas Principais:</h3>
                    <ul>
                        <li><strong>Tempo de Resposta:</strong> Monitora quanto tempo a equipe leva para realizar a primeira interação com o cliente.</li>
                        <li><strong>Conformidade de SLA:</strong> Percentual de chamados atendidos dentro do prazo estipulado nas configurações.</li>
                        <li><strong>Avaliações de CSAT:</strong> Média de satisfação dada pelos clientes após a resolução dos atendimentos (escala de 1 a 5).</li>
                    </ul>
                `
            },
            {
                key: "settings.index",
                title: "Configurações do Sistema",
                category: "Administração",
                page: "/settings",
                content: `
                    <h2>Configurações Globais</h2>
                    <p>Ajuste as preferências de perfil pessoal e os parâmetros de funcionamento da plataforma para toda a sua organização.</p>
                    <h3>Módulos de Configuração:</h3>
                    <ul>
                        <li><strong>Calendário (Horários):</strong> Defina a jornada de atendimento oficial da sua empresa para envio de mensagens automáticas de fora do horário.</li>
                        <li><strong>Filas de Atendimento:</strong> Crie departamentos (Suporte, Comercial, Financeiro) para direcionar as conversas adequadamente.</li>
                        <li><strong>Canais de E-mail:</strong> Integre contas de e-mail IMAP/SMTP para que o AltDesk receba e envie mensagens como chamados automaticamente.</li>
                    </ul>
                `
            },
            {
                key: "chat.index",
                title: "Central de Mensagens",
                category: "Atendimento",
                page: "/chat",
                content: `
                    <h2>Conversas em Tempo Real</h2>
                    <p>A Central de Mensagens unifica chats de múltiplos canais (como WhatsApp e Webchat) em uma única tela conversacional dinâmica.</p>
                    <h3>Dicas de Atendimento:</h3>
                    <ul>
                        <li><strong>Respostas Rápidas:</strong> Digite <code>/</code> na caixa de texto para buscar atalhos de mensagens pré-cadastradas pela empresa.</li>
                        <li><strong>Transferir Atendimento:</strong> Use o botão de transferência no topo da conversa para enviar o chat para outro colega ou outra fila departamental.</li>
                        <li><strong>Notas Internas:</strong> Agentes podem adicionar anotações privadas que ficam salvas na timeline do chat sem que o cliente veja.</li>
                    </ul>
                `
            },
            {
                key: "dashboard.index",
                title: "Painel Executivo",
                category: "Métricas",
                page: "/dashboard",
                content: `
                    <h2>Dashboard Operacional</h2>
                    <p>Tenha uma visão panorâmica instantânea da operação de suporte da sua empresa no dia de hoje.</p>
                    <h3>Informações Disponíveis:</h3>
                    <ul>
                        <li><strong>Atendimentos em Aberto:</strong> Total de conversas ativas aguardando ação dos agentes.</li>
                        <li><strong>Carga por Fila:</strong> Descubra quais departamentos estão mais sobrecarregados no momento.</li>
                        <li><strong>Status dos Agentes:</strong> Monitore quem está online, ocupado ou ausente para planejar a distribuição de novas conversas.</li>
                    </ul>
                `
            },
            {
                key: "contacts.index",
                title: "Gestão de Contatos",
                category: "Geral",
                page: "/contacts",
                content: `
                    <h2>Gestão de Contatos e Clientes</h2>
                    <p>Esta tela permite o gerenciamento centralizado de seus contatos e clientes.</p>
                    <h3>Recursos Principais:</h3>
                    <ul>
                        <li><strong>Gestão:</strong> Crie, edite e organize informações básicas de contato (Nome, Telefone, Email, Anotações).</li>
                        <li><strong>Início Rápido:</strong> Use o botão <strong>Chat</strong> para abrir uma conversa em tempo real imediatamente.</li>
                        <li><strong>Busca:</strong> Localize qualquer cliente de forma rápida pelo nome ou número de telefone.</li>
                        <li><strong>Rastreamento CRM:</strong> Salve a Origem (Google, Instagram, Indicação), Tipo de Canal e Campanha de marketing para cada contato.</li>
                    </ul>
                `
            },
            {
                key: "users.management",
                title: "Equipe e Colaboradores",
                category: "Administração",
                page: "/users",
                content: `
                    <h2>Gestão da Equipe</h2>
                    <p>Gerencie quem tem acesso à plataforma e quais níveis de permissão cada membro possui.</p>
                    <h3>Regras e Níveis de Acesso:</h3>
                    <ul>
                        <li><strong>Administrador/Supervisor:</strong> Acesso total a todas as áreas, incluindo relatórios, faturamento, configurações e gestão de usuários.</li>
                        <li><strong>Agente/Técnico:</strong> Focado no atendimento ao cliente, gestão de tickets e chat.</li>
                        <li><strong>Colaborador (Não faz parte do corpo técnico):</strong> Usuários finais/solicitantes com acesso apenas ao Portal para abertura e acompanhamento de chamados.</li>
                        <li><strong>Áreas de Acesso:</strong> Permite personalizar de forma granular quais telas (Dashboard, Chat, Tickets, Relatórios, etc.) cada usuário poderá acessar.</li>
                    </ul>
                `
            }
        ];

        for (const article of seedArticles) {
            const checkRes = await pool.request()
                .input("contextKey", article.key)
                .query("SELECT COUNT(*) as cnt FROM altdesk.HelpArticle WHERE TenantId IS NULL AND ContextKey = @contextKey AND DeletedAt IS NULL");
            
            if (checkRes.recordset[0].cnt === 0) {
                await pool.request()
                    .input("contextKey", article.key)
                    .input("title", article.title)
                    .input("content", article.content.trim())
                    .input("category", article.category)
                    .input("pagePath", article.page)
                    .query(`
                        INSERT INTO altdesk.HelpArticle (ContextKey, Title, Content, Category, PagePath, IsActive)
                        VALUES (@contextKey, @title, @content, @category, @pagePath, 1)
                    `);
                console.log(`Global help article seeded: ${article.key}`);
            } else {
                console.log(`Global help article already exists: ${article.key}`);
            }
        }

        console.log("Help articles migration finished successfully.");
        process.exit(0);
    } catch (err) {
        console.error("Help articles migration failed:", err);
        process.exit(1);
    }
}

run();
