-- SQL Server 2019/Express compatible
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'SystemSetting' AND schema_id = SCHEMA_ID('altdesk'))
BEGIN
    CREATE TABLE altdesk.SystemSetting (
        SettingKey NVARCHAR(100) NOT NULL PRIMARY KEY,
        SettingValueJson NVARCHAR(MAX) NOT NULL,
        UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

-- Inserir registro inicial para pricing_config se não existir
IF NOT EXISTS (SELECT 1 FROM altdesk.SystemSetting WHERE SettingKey = 'pricing_config')
BEGIN
    -- Configuração padrão vazia/básica
    INSERT INTO altdesk.SystemSetting (SettingKey, SettingValueJson, UpdatedAt)
    VALUES ('pricing_config', '{"pageTitle":"Preços Simples e Transparentes","pageSubtitle":"Escolha o plano ideal para a sua operação de atendimento.","billingNote":"Todos os valores são cobrados mensalmente.","status":"draft","version":1,"updatedAt":"' + CONVERT(NVARCHAR(30), SYSUTCDATETIME(), 126) + 'Z","founders":{"enabled":false,"eyebrow":"EDIÇÃO LIMITADA","title":"Founders Edition","subtitle":"Aproveite o preço de lançamento garantido para os primeiros assinantes.","price":"R$ 297/mês","durationMonths":12,"savingsText":"Economize 40% no primeiro ano","limitedOfferText":"Apenas para os 50 primeiros clientes","ctaText":"Assinar Founders Edition","ctaUrl":"#","description":""},"plans":[],"addOnsTitle":"Itens Adicionais e Implantação","addOnsSubtitle":"Personalize sua estrutura conforme a necessidade da sua operação.","addOns":[]}', SYSUTCDATETIME());
END
GO
