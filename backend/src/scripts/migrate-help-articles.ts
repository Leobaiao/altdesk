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
                category: "Atendimento",
                page: "/tickets",
                content: `
                    <h2>Gestão de Chamados (Fila de Atendimento)</h2>
                    <p>A visualização em formato de <strong>Lista</strong> é a central de controle ideal para triagem rápida, buscas precisas e acompanhamento minucioso de prazos e conformidade.</p>
                    <h3>💡 Dicas para Produtividade:</h3>
                    <ul>
                        <li><strong>Acesso Imediato:</strong> Clique em qualquer chamado para abrir os detalhes na lateral, permitindo responder ao cliente, adicionar notas internas privativas ou transferir o ticket.</li>
                        <li><strong>Filtros Inteligentes:</strong> Refine a visualização ocultando chamados resolvidos ou segmentando por prioridade, técnico responsável e tags específicas.</li>
                        <li><strong>Status de SLA:</strong> Acompanhe a etiqueta colorida ao lado do ticket para identificar na hora o tempo restante de resposta ou resolução.</li>
                    </ul>
                `
            },
            {
                key: "kanban.index",
                title: "Visão Kanban de Tickets",
                category: "Atendimento",
                page: "/tickets",
                content: `
                    <h2>Quadro Ágil (Kanban de Tickets)</h2>
                    <p>A visualização em <strong>Kanban</strong> organiza seus chamados em colunas visuais de acordo com o status, otimizando o fluxo de trabalho (Workflow) da equipe de suporte.</p>
                    <h3>🚀 Melhores Práticas:</h3>
                    <ul>
                        <li><strong>Atualização Visual:</strong> Arraste e solte (Drag & Drop) os cartões para atualizar o status do chamado instantaneamente (ex: mover de "Novo" para "Em Atendimento").</li>
                        <li><strong>Priorização Rápida:</strong> Foque nos cartões com alertas vermelhos ou amarelos (SLA em risco ou estourado) para garantir o cumprimento dos prazos acordados.</li>
                        <li><strong>Informações do Card:</strong> Sem precisar abrir o chamado, você visualiza o ID, título, prioridade, técnico atribuído e solicitante diretamente no cartão.</li>
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
                key: "users.index",
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
            },
            {
                key: "knowledge.index",
                title: "Base de Conhecimento",
                category: "Conteúdo",
                page: "/knowledge",
                content: `
                    <h2>Base de Conhecimento</h2>
                    <p>A Base de Conhecimento centraliza documentos, manuais, guias e FAQs para auxiliar a equipe no suporte e fornecer autoatendimento de qualidade.</p>
                    <h3>💡 Dicas e Melhores Práticas:</h3>
                    <ul>
                        <li><strong>Organização por Categoria:</strong> Agrupe os artigos por assunto (ex: Financeiro, Configurações, FAQ) para facilitar a busca rápida.</li>
                        <li><strong>Visibilidade Flexível:</strong> Defina os artigos como Públicos para exibição no Widget de autoatendimento ou Privados para uso exclusivo interno dos agentes.</li>
                        <li><strong>Acesso via Chat/Ticket:</strong> No painel de conversas e nos detalhes do ticket, utilize a aba de Base de Conhecimento para pesquisar e inserir links de artigos nas mensagens aos clientes.</li>
                    </ul>
                `
            },
            {
                key: "queues.index",
                title: "Filas de Atendimento",
                category: "Administração",
                page: "/queues",
                content: `
                    <h2>Filas de Atendimento</h2>
                    <p>As Filas de Atendimento representam os departamentos ou setores da sua empresa (ex: Suporte Técnico, Comercial, Financeiro) e ajudam a organizar a distribuição de chamados e conversas.</p>
                    <h3>🚀 Configuração e Fluxo:</h3>
                    <ul>
                        <li><strong>Divisão por Departamentos:</strong> Crie filas distintas para segmentar o fluxo de mensagens de entrada de forma organizada.</li>
                        <li><strong>Atribuição de Agentes:</strong> Associe os agentes às filas correspondentes em suas respectivas configurações de usuário.</li>
                        <li><strong>Transferências:</strong> Direcione atendimentos entre filas diferentes a qualquer momento para garantir que o cliente seja atendido pelo especialista ideal.</li>
                    </ul>
                `
            },
            {
                key: "classification.index",
                title: "Classificação e SLAs",
                category: "Administração",
                page: "/classification",
                content: `
                    <h2>Classificação e SLAs</h2>
                    <p>Gerencie as tags das conversas e as políticas de tempo de atendimento (SLA) para garantir a qualidade do suporte.</p>
                    <h3>🏷️ Tags de Conversa:</h3>
                    <ul>
                        <li><strong>Padronização:</strong> Crie tags claras (ex: "Urgente", "Bug") e use cores distintas para facilitar a identificação e priorização visual.</li>
                        <li><strong>Filtros e Relatórios:</strong> Utilize tags para categorizar tickets e monitorar problemas recorrentes através dos relatórios gerenciais.</li>
                    </ul>
                    <h3>⏱️ Políticas de SLA:</h3>
                    <ul>
                        <li><strong>Prazos:</strong> Defina o tempo máximo de "Primeira Resposta" e de "Resolução" dos chamados.</li>
                        <li><strong>Monitoramento Visual:</strong> Chamados próximos do vencimento exibirão alertas visuais, garantindo o cumprimento dos acordos de nível de serviço.</li>
                    </ul>
                `
            },
            {
                key: "canned.index",
                title: "Respostas Rápidas",
                category: "Atendimento",
                page: "/canned",
                content: `
                    <h2>Respostas Rápidas</h2>
                    <p>Modelos de mensagens pré-configurados que agilizam e padronizam o atendimento ao cliente, otimizando o tempo de resposta da equipe.</p>
                    <h3>⚡ Atalhos e Agilidade:</h3>
                    <ul>
                        <li><strong>Ativação com barra (/):</strong> No campo de digitação do chat, digite <code>/</code> seguido pelo atalho configurado (ex: <code>/saudacao</code>) para preencher a mensagem instantaneamente.</li>
                        <li><strong>Padronização de Tom:</strong> Mantenha a comunicação corporativa consistente usando respostas homologadas para dúvidas frequentes.</li>
                        <li><strong>Gestão Compartilhada:</strong> Crie e edite respostas que ficam imediatamente disponíveis para todos os agentes da plataforma.</li>
                    </ul>
                `
            },
            {
                key: "business-hours.index",
                title: "Horário de Funcionamento",
                category: "Administração",
                page: "/business-hours",
                content: `
                    <h2>Horário de Funcionamento</h2>
                    <p>Defina o horário de expediente e atendimento oficial da sua empresa para controlar o envio de mensagens automáticas de ausência.</p>
                    <h3>🕒 Regras e Funcionamento:</h3>
                    <ul>
                        <li><strong>Jornada Semanal:</strong> Configure o horário de entrada, saída e intervalos para cada dia da semana.</li>
                        <li><strong>Mensagens de Ausência:</strong> Clientes que entrarem em contato fora do horário comercial receberão uma resposta automática informativa configurada no sistema.</li>
                        <li><strong>Plantão e Exceções:</strong> Ative ou desative o controle de horário conforme feriados ou necessidades específicas da operação.</li>
                    </ul>
                `
            },
            {
                key: "billing.index",
                title: "Faturamento e Assinatura",
                category: "Financeiro",
                page: "/billing",
                content: `
                    <h2>Faturamento e Assinatura</h2>
                    <p>Acompanhe os detalhes da sua assinatura AltDesk, histórico de pagamentos, plano contratado e quantidade de licenças de agentes ativas.</p>
                    <h3>💳 Gestão Financeira:</h3>
                    <ul>
                        <li><strong>Upgrade de Plano:</strong> Altere seu plano de assinatura ou adicione mais licenças de agentes conforme a sua operação cresce.</li>
                        <li><strong>Histórico de Faturas:</strong> Consulte faturas passadas e baixe comprovantes de pagamento diretamente pelo painel.</li>
                        <li><strong>Formas de Pagamento:</strong> Atualize seus dados de cartão de crédito e métodos de cobrança a qualquer momento de forma segura.</li>
                    </ul>
                `
            },
            {
                key: "audit.index",
                title: "Logs de Auditoria",
                category: "Administração",
                page: "/audit",
                content: `
                    <h2>Logs de Auditoria</h2>
                    <p>O painel de auditoria registra um histórico detalhado e imutável de todas as ações administrativas e alterações de dados realizadas no sistema.</p>
                    <h3>🔍 Rastreamento e Segurança:</h3>
                    <ul>
                        <li><strong>Ações Mapeadas:</strong> Registra criações, edições, exclusões, logins e transferências de dados relevantes.</li>
                        <li><strong>Identificação:</strong> Cada registro contém o autor da alteração, a data/hora exata (UTC), o endereço IP de origem e os valores antes/depois da modificação.</li>
                        <li><strong>Conformidade (Compliance):</strong> Ferramenta essencial para investigações internas, segurança da informação e auditorias de conformidade com a LGPD.</li>
                    </ul>
                `
            },
            {
                key: "help-admin.index",
                title: "Gerenciamento de Ajuda",
                category: "Administração",
                page: "/help-admin",
                content: `
                    <h2>Gerenciamento de Ajuda</h2>
                    <p>Este painel exclusivo para Super Administradores gerencia a base de conhecimento de ajuda contextual exibida na lateral direita da plataforma.</p>
                    <h3>✍️ Criação de Conteúdo:</h3>
                    <ul>
                        <li><strong>Mapeamento por Tela:</strong> Vincule cada artigo de ajuda a uma tela específica selecionando a respectiva chave de contexto (ContextKey).</li>
                        <li><strong>Editor de Texto Rico:</strong> Escreva artigos estruturados utilizando cabeçalhos, listas, formatação em negrito e blocos de código.</li>
                        <li><strong>Global vs Tenant:</strong> Crie guias globais padronizados para toda a plataforma ou artigos personalizados e específicos para cada cliente (Tenant).</li>
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
                await pool.request()
                    .input("contextKey", article.key)
                    .input("title", article.title)
                    .input("content", article.content.trim())
                    .input("category", article.category)
                    .input("pagePath", article.page)
                    .query(`
                        UPDATE altdesk.HelpArticle
                        SET Title = @title, Content = @content, Category = @category, PagePath = @pagePath, UpdatedAt = SYSUTCDATETIME()
                        WHERE TenantId IS NULL AND ContextKey = @contextKey AND DeletedAt IS NULL
                    `);
                console.log(`Global help article updated: ${article.key}`);
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
