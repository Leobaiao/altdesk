-- Migration 48: Chat Widget
-- Cria tabela ChatWidget para armazenar configuração do widget embarcável por tenant.
-- Cada tenant tem no máximo 1 widget (UNIQUE em TenantId).
-- ConfigJson contém todas as 14 categorias de customização (aparência, abertura, mensagens, etc.)

USE AltDeskDev;
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ChatWidget' AND schema_id = SCHEMA_ID('altdesk'))
BEGIN
    CREATE TABLE altdesk.ChatWidget (
        WidgetId     UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        TenantId     UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES altdesk.Tenant(TenantId),
        IsActive     BIT DEFAULT 1,
        ConfigJson   NVARCHAR(MAX) NOT NULL DEFAULT '{}',
        PublishedAt  DATETIME2 NULL,
        DeletedAt    DATETIME2 NULL,
        CreatedAt    DATETIME2 DEFAULT SYSUTCDATETIME(),
        UpdatedAt    DATETIME2 DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UK_ChatWidget_Tenant UNIQUE (TenantId)
    );
END
GO

-- Criar widget padrão para todos os tenants existentes que ainda não têm um
DECLARE @defaultConfig NVARCHAR(MAX) = N'{
    "corPrimaria": "#6C63FF",
    "corFundo": "#FFFFFF",
    "corTexto": "#1A1A2E",
    "avatarUrl": "",
    "launcherFormato": "circle",
    "posicao": "bottom-right",
    "tema": "light",
    "fonte": "Inter",
    "animacoesAtivas": true,
    "autoOpen": false,
    "autoOpenDelaySegundos": 5,
    "gatilhoAbertura": "time",
    "mensagemBoasVindas": "Olá! Como podemos ajudar?",
    "mensagemForaHorario": "No momento estamos fora do horário de atendimento. Deixe sua mensagem e retornaremos em breve!",
    "mensagemDespedida": "Obrigado pelo contato! Até logo.",
    "quickReplies": [],
    "camposFormulario": [],
    "exigirEmail": false,
    "exigirNome": false,
    "exigirTelefone": false,
    "camposCustomizados": [],
    "somNotificacao": true,
    "badgeAtivo": true,
    "textoConsentimentoLgpd": "",
    "altoContrasteDisponivel": false
}';

DECLARE @tid UNIQUEIDENTIFIER;
DECLARE tenant_cursor CURSOR LOCAL FAST_FORWARD FOR
    SELECT TenantId FROM altdesk.Tenant WHERE DeletedAt IS NULL;

OPEN tenant_cursor;
FETCH NEXT FROM tenant_cursor INTO @tid;

WHILE @@FETCH_STATUS = 0
BEGIN
    IF NOT EXISTS (SELECT 1 FROM altdesk.ChatWidget WHERE TenantId = @tid)
    BEGIN
        INSERT INTO altdesk.ChatWidget (TenantId, IsActive, ConfigJson)
        VALUES (@tid, 1, @defaultConfig);
    END
    FETCH NEXT FROM tenant_cursor INTO @tid;
END

CLOSE tenant_cursor;
DEALLOCATE tenant_cursor;
GO
