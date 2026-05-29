-- ============================================================
-- Migration 39: altdesk.HelpArticle
-- Sistema de Ajuda Contextual Dinâmica (Help Sliding Window)
-- ============================================================
SET QUOTED_IDENTIFIER ON;
GO

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
GO

-- Unique index for tenant-specific articles
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UK_HelpArticle_Tenant_ContextKey' AND object_id = OBJECT_ID('altdesk.HelpArticle'))
BEGIN
    CREATE UNIQUE INDEX UK_HelpArticle_Tenant_ContextKey 
    ON altdesk.HelpArticle(TenantId, ContextKey) 
    WHERE TenantId IS NOT NULL AND DeletedAt IS NULL;
    PRINT 'Index UK_HelpArticle_Tenant_ContextKey created.';
END
GO

-- Unique index for global articles (TenantId IS NULL)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UK_HelpArticle_Global_ContextKey' AND object_id = OBJECT_ID('altdesk.HelpArticle'))
BEGIN
    CREATE UNIQUE INDEX UK_HelpArticle_Global_ContextKey 
    ON altdesk.HelpArticle(ContextKey) 
    WHERE TenantId IS NULL AND DeletedAt IS NULL;
    PRINT 'Index UK_HelpArticle_Global_ContextKey created.';
END
GO

-- Seed default global help articles
DECLARE @key NVARCHAR(120), @title NVARCHAR(200), @content NVARCHAR(MAX), @category NVARCHAR(100), @page NVARCHAR(200);

-- 1. tickets.index
SET @key = 'tickets.index';
SET @title = 'Gestão de Chamados';
SET @category = 'Atendimento';
SET @page = '/tickets';
SET @content = '<h2>Gestão de Chamados (Fila de Atendimento)</h2>
<p>A visualização em formato de <strong>Lista</strong> é a central de controle ideal para triagem rápida, buscas precisas e acompanhamento minucioso de prazos e conformidade.</p>
<h3>💡 Dicas para Produtividade:</h3>
<ul>
    <li><strong>Acesso Imediato:</strong> Clique em qualquer chamado para abrir os detalhes na lateral, permitindo responder ao cliente, adicionar notas internas privativas ou transferir o ticket.</li>
    <li><strong>Filtros Inteligentes:</strong> Refine a visualização ocultando chamados resolvidos ou segmentando por prioridade, técnico responsável e tags específicas.</li>
    <li><strong>Status de SLA:</strong> Acompanhe a etiqueta colorida ao lado do ticket para identificar na hora o tempo restante de resposta ou resolução.</li>
</ul>';

IF NOT EXISTS (SELECT 1 FROM altdesk.HelpArticle WHERE TenantId IS NULL AND ContextKey = @key AND DeletedAt IS NULL)
BEGIN
    INSERT INTO altdesk.HelpArticle (ContextKey, Title, Content, Category, PagePath, IsActive)
    VALUES (@key, @title, @content, @category, @page, 1);
END
ELSE
BEGIN
    UPDATE altdesk.HelpArticle
    SET Title = @title, Content = @content, Category = @category, PagePath = @page, UpdatedAt = SYSUTCDATETIME()
    WHERE TenantId IS NULL AND ContextKey = @key AND DeletedAt IS NULL;
END

-- 2. kanban.index
SET @key = 'kanban.index';
SET @title = 'Visão Kanban de Tickets';
SET @category = 'Atendimento';
SET @page = '/tickets';
SET @content = '<h2>Quadro Ágil (Kanban de Tickets)</h2>
<p>A visualização em <strong>Kanban</strong> organiza seus chamados em colunas visuais de acordo com o status, otimizando o fluxo de trabalho (Workflow) da equipe de suporte.</p>
<h3>🚀 Melhores Práticas:</h3>
<ul>
    <li><strong>Atualização Visual:</strong> Arraste e solte (Drag & Drop) os cartões para atualizar o status do chamado instantaneamente (ex: mover de "Novo" para "Em Atendimento").</li>
    <li><strong>Priorização Rápida:</strong> Foque nos cartões com alertas vermelhos ou amarelos (SLA em risco ou estourado) para garantir o cumprimento dos prazos acordados.</li>
    <li><strong>Informações do Card:</strong> Sem precisar abrir o chamado, você visualiza o ID, título, prioridade, técnico atribuído e solicitante diretamente no cartão.</li>
</ul>';

IF NOT EXISTS (SELECT 1 FROM altdesk.HelpArticle WHERE TenantId IS NULL AND ContextKey = @key AND DeletedAt IS NULL)
BEGIN
    INSERT INTO altdesk.HelpArticle (ContextKey, Title, Content, Category, PagePath, IsActive)
    VALUES (@key, @title, @content, @category, @page, 1);
END
ELSE
BEGIN
    UPDATE altdesk.HelpArticle
    SET Title = @title, Content = @content, Category = @category, PagePath = @page, UpdatedAt = SYSUTCDATETIME()
    WHERE TenantId IS NULL AND ContextKey = @key AND DeletedAt IS NULL;
END

-- 3. reports.index
SET @key = 'reports.index';
SET @title = 'Relatórios Analíticos';
SET @category = 'Métricas';
SET @page = '/reports';
SET @content = '<h2>Relatórios e Indicadores</h2>
<p>Acompanhe o desempenho da sua equipe e a satisfação dos seus clientes através de gráficos consolidados e exportações de dados.</p>
<h3>Métricas Principais:</h3>
<ul>
    <li><strong>Tempo de Resposta:</strong> Monitora quanto tempo a equipe leva para realizar a primeira interação com o cliente.</li>
    <li><strong>Conformidade de SLA:</strong> Percentual de chamados atendidos dentro do prazo estipulado nas configurações.</li>
    <li><strong>Avaliações de CSAT:</strong> Média de satisfação dada pelos clientes após a resolução dos atendimentos (escala de 1 a 5).</li>
</ul>';

IF NOT EXISTS (SELECT 1 FROM altdesk.HelpArticle WHERE TenantId IS NULL AND ContextKey = @key AND DeletedAt IS NULL)
BEGIN
    INSERT INTO altdesk.HelpArticle (ContextKey, Title, Content, Category, PagePath, IsActive)
    VALUES (@key, @title, @content, @category, @page, 1);
END
ELSE
BEGIN
    UPDATE altdesk.HelpArticle
    SET Title = @title, Content = @content, Category = @category, PagePath = @page, UpdatedAt = SYSUTCDATETIME()
    WHERE TenantId IS NULL AND ContextKey = @key AND DeletedAt IS NULL;
END

-- 4. settings.index
SET @key = 'settings.index';
SET @title = 'Configurações do Sistema';
SET @category = 'Administração';
SET @page = '/settings';
SET @content = '<h2>Configurações Globais</h2>
<p>Ajuste as preferências de perfil pessoal e os parâmetros de funcionamento da plataforma para toda a sua organização.</p>
<h3>Módulos de Configuração:</h3>
<ul>
    <li><strong>Calendário (Horários):</strong> Defina a jornada de atendimento oficial da sua empresa para envio de mensagens automáticas de fora do horário.</li>
    <li><strong>Filas de Atendimento:</strong> Crie departamentos (Suporte, Comercial, Financeiro) para direcionar as conversas adequadamente.</li>
    <li><strong>Canais de E-mail:</strong> Integre contas de e-mail IMAP/SMTP para que o AltDesk receba e envie mensagens como chamados automaticamente.</li>
</ul>';

IF NOT EXISTS (SELECT 1 FROM altdesk.HelpArticle WHERE TenantId IS NULL AND ContextKey = @key AND DeletedAt IS NULL)
BEGIN
    INSERT INTO altdesk.HelpArticle (ContextKey, Title, Content, Category, PagePath, IsActive)
    VALUES (@key, @title, @content, @category, @page, 1);
END
ELSE
BEGIN
    UPDATE altdesk.HelpArticle
    SET Title = @title, Content = @content, Category = @category, PagePath = @page, UpdatedAt = SYSUTCDATETIME()
    WHERE TenantId IS NULL AND ContextKey = @key AND DeletedAt IS NULL;
END

-- 5. chat.index
SET @key = 'chat.index';
SET @title = 'Central de Mensagens';
SET @category = 'Atendimento';
SET @page = '/chat';
SET @content = '<h2>Conversas em Tempo Real</h2>
<p>A Central de Mensagens unifica chats de múltiplos canais (como WhatsApp e Webchat) em uma única tela conversacional dinâmica.</p>
<h3>Dicas de Atendimento:</h3>
<ul>
    <li><strong>Respostas Rápidas:</strong> Digite <code>/</code> na caixa de texto para buscar atalhos de mensagens pré-cadastradas pela empresa.</li>
    <li><strong>Transferir Atendimento:</strong> Use o botão de transferência no topo da conversa para enviar o chat para outro colega ou outra fila departamental.</li>
    <li><strong>Notas Internas:</strong> Agentes podem adicionar anotações privadas que ficam salvas na timeline do chat sem que o cliente veja.</li>
</ul>';

IF NOT EXISTS (SELECT 1 FROM altdesk.HelpArticle WHERE TenantId IS NULL AND ContextKey = @key AND DeletedAt IS NULL)
BEGIN
    INSERT INTO altdesk.HelpArticle (ContextKey, Title, Content, Category, PagePath, IsActive)
    VALUES (@key, @title, @content, @category, @page, 1);
END
ELSE
BEGIN
    UPDATE altdesk.HelpArticle
    SET Title = @title, Content = @content, Category = @category, PagePath = @page, UpdatedAt = SYSUTCDATETIME()
    WHERE TenantId IS NULL AND ContextKey = @key AND DeletedAt IS NULL;
END

-- 6. dashboard.index
SET @key = 'dashboard.index';
SET @title = 'Painel Executivo';
SET @category = 'Métricas';
SET @page = '/dashboard';
SET @content = '<h2>Dashboard Operacional</h2>
<p>Tenha uma visão panorâmica instantânea da operação de suporte da sua empresa no dia de hoje.</p>
<h3>Informações Disponíveis:</h3>
<ul>
    <li><strong>Atendimentos em Aberto:</strong> Total de conversas ativas aguardando ação dos agentes.</li>
    <li><strong>Carga por Fila:</strong> Descubra quais departamentos estão mais sobrecarregados no momento.</li>
    <li><strong>Status dos Agentes:</strong> Monitore quem está online, ocupado ou ausente para planejar a distribuição de novas conversas.</li>
</ul>';

IF NOT EXISTS (SELECT 1 FROM altdesk.HelpArticle WHERE TenantId IS NULL AND ContextKey = @key AND DeletedAt IS NULL)
BEGIN
    INSERT INTO altdesk.HelpArticle (ContextKey, Title, Content, Category, PagePath, IsActive)
    VALUES (@key, @title, @content, @category, @page, 1);
END
ELSE
BEGIN
    UPDATE altdesk.HelpArticle
    SET Title = @title, Content = @content, Category = @category, PagePath = @page, UpdatedAt = SYSUTCDATETIME()
    WHERE TenantId IS NULL AND ContextKey = @key AND DeletedAt IS NULL;
END

-- 7. contacts.index
SET @key = 'contacts.index';
SET @title = 'Gestão de Contatos';
SET @category = 'Geral';
SET @page = '/contacts';
SET @content = '<h2>Gestão de Contatos e Clientes</h2>
<p>Esta tela permite o gerenciamento centralizado de seus contatos e clientes.</p>
<h3>Recursos Principais:</h3>
<ul>
    <li><strong>Gestão:</strong> Crie, edite e organize informações básicas de contato (Nome, Telefone, Email, Anotações).</li>
    <li><strong>Início Rápido:</strong> Use o botão <strong>Chat</strong> para abrir uma conversa em tempo real imediatamente.</li>
    <li><strong>Busca:</strong> Localize qualquer cliente de forma rápida pelo nome ou número de telefone.</li>
    <li><strong>Rastreamento CRM:</strong> Salve a Origem (Google, Instagram, Indicação), Tipo de Canal e Campanha de marketing para cada contato.</li>
</ul>';

IF NOT EXISTS (SELECT 1 FROM altdesk.HelpArticle WHERE TenantId IS NULL AND ContextKey = @key AND DeletedAt IS NULL)
BEGIN
    INSERT INTO altdesk.HelpArticle (ContextKey, Title, Content, Category, PagePath, IsActive)
    VALUES (@key, @title, @content, @category, @page, 1);
END
ELSE
BEGIN
    UPDATE altdesk.HelpArticle
    SET Title = @title, Content = @content, Category = @category, PagePath = @page, UpdatedAt = SYSUTCDATETIME()
    WHERE TenantId IS NULL AND ContextKey = @key AND DeletedAt IS NULL;
END

-- 8. users.management
SET @key = 'users.management';
SET @title = 'Equipe e Colaboradores';
SET @category = 'Administração';
SET @page = '/users';
SET @content = '<h2>Gestão da Equipe</h2>
<p>Gerencie quem tem acesso à plataforma e quais níveis de permissão cada membro possui.</p>
<h3>Regras e Níveis de Acesso:</h3>
<ul>
    <li><strong>Administrador/Supervisor:</strong> Acesso total a todas as áreas, incluindo relatórios, faturamento, configurações e gestão de usuários.</li>
    <li><strong>Agente/Técnico:</strong> Focado no atendimento ao cliente, gestão de tickets e chat.</li>
    <li><strong>Colaborador (Não faz parte do corpo técnico):</strong> Usuários finais/solicitantes com acesso apenas ao Portal para abertura e acompanhamento de chamados.</li>
    <li><strong>Áreas de Acesso:</strong> Permite personalizar de forma granular quais telas (Dashboard, Chat, Tickets, Relatórios, etc.) cada usuário poderá acessar.</li>
</ul>';

IF NOT EXISTS (SELECT 1 FROM altdesk.HelpArticle WHERE TenantId IS NULL AND ContextKey = @key AND DeletedAt IS NULL)
BEGIN
    INSERT INTO altdesk.HelpArticle (ContextKey, Title, Content, Category, PagePath, IsActive)
    VALUES (@key, @title, @content, @category, @page, 1);
END
ELSE
BEGIN
    UPDATE altdesk.HelpArticle
    SET Title = @title, Content = @content, Category = @category, PagePath = @page, UpdatedAt = SYSUTCDATETIME()
    WHERE TenantId IS NULL AND ContextKey = @key AND DeletedAt IS NULL;
END
GO

PRINT 'Migration 39 (help-articles + seed) completed.';
GO
