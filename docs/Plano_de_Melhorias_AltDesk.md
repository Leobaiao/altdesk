# Plano de Melhorias e Correções - AltDesk (Versão 10)

Abaixo está a lista de melhorias e correções extraídas do documento, organizadas por categoria, seguida de um plano de ação passo a passo para implementação.

## 📋 Lista de Melhorias e Correções Categorizadas

### 1. Banco de Dados e Performance
* **Índices de Banco de Dados:** Criar índices para otimizar as consultas, focando nas colunas utilizadas nas cláusulas `WHERE` (ex: `data`, `agente`, `contato`, `sla`).
* **Carga de SLA:** Garantir que as políticas de SLA sejam devidamente cadastradas e carregadas na base de dados durante o onboarding em todos os volumes (pequeno, médio ou grande), evitando transações órfãs de SLA.

### 2. Onboarding e Experiência do Usuário (UX)
* **Feedback de Carga:** Adicionar indicadores visuais de progresso (loading text) durante a geração de dados massiva no Onboarding (ex: "...carregando chamados", "...carregando usuários").
* **Nova Opção de Volume:** Adicionar uma opção no Onboarding para popular a base de dados com volume "Grande" (Ex: 1000 contatos, 5000 mensagens, 5000 tickets).

### 3. Faturamento, Planos e Assinaturas
* **Gestão de Planos:** O Superadmin deve gerenciar os planos que as empresas visualizarão, não utilizar dados digitáveis nos planos inferiores (apenas leitura).
* **Promoção de Lançamento:** Implementar faixa promocional "APROVEITE O LANÇAMENTO ‘FOUNDERS EDITION’" oferecendo 30 Agentes, 1000 Usuários e Contatos Ilimitados por R$ 7.997,00 (validade de 36 meses, 70% de economia).
* **Definição de Planos Padrão:** Configurar 3 planos: `STARTER`, `PROFESSIONAL` e `ENTERPRISE`.
  * *Detalhes do STARTER:* R$ 290,00/mês, 3 Agentes, 250 Usuários, 250 Contatos. Valor de agente adicional: R$ 99,00.
* **Telas de Comparação:** Adicionar botão "Ver todos os detalhes" / "Ver todos os recursos" com redirecionamento para uma página comparativa de até 3 colunas (estilo tomticket).
* **Regra de Vencimento:** Remover a possibilidade de renovação por mais 7 dias de trial após o primeiro vencimento. No segundo vencimento, direcionar o usuário para uma tela de oferta especial.

### 4. Interface (Frontend)
* **Tradução:** Traduzir termos em inglês na tela de detalhes do ticket à direita (Ex: `SLA BREACHED` para `SLA Violado`, `MEDIUM` para `Média`, `Triagem`).
* **Ajuste de Layout (SLA):** Mover a opção de "Políticas de SLA" para ficar ao lado da opção "Tags", mantendo o mesmo layout visual.
* **Tag Trial:** Remover a palavra/tag "TRIAL" da interface na listagem de conversas.

### 5. Correção de Bugs Críticos
* **Superadmin - Envio de Arquivos:** Corrigir a tela de erro que aparece ao anexar um arquivo no superadmin (Erro relacionado a *"WhatsApp disconnected: session is not reconnectable"*).
* **Admin - Lixeira:** Corrigir falha que impede o envio de uma empresa para a lixeira.
* **Admin - Datas:** Corrigir falha que impede a edição/correção da data de trial da empresa.
* **Recuperação de Senha:** Corrigir o "Erro interno do servidor" que ocorre ao tentar enviar o link de recuperação de senha.

---

## 🚀 Passo a Passo de Implementação

Para otimizar o desenvolvimento, sugiro dividir as entregas em **Sprints** focadas por área de impacto técnico:

### Fase 1: Correção de Bugs Críticos (Hotfixes)
*Estes itens impactam diretamente a usabilidade atual e requerem resolução imediata.*
1. **[Backend]** Investigar e corrigir o Erro 500 na rota de recuperação de senha.
2. **[Backend]** Ajustar o controller de anexos no Superadmin para validar a conexão do WhatsApp corretamente ou tratar o erro silenciosamente sem quebrar a tela.
3. **[Backend]** Revisar as permissões/rotas no painel Admin para garantir que a exclusão (soft-delete para a lixeira) e a edição da data de trial das empresas funcionem.

### Fase 2: Performance e Banco de Dados
*Preparação da fundação para lidar com os dados massivos exigidos nos testes.*
1. **[DB]** Escrever e executar scripts de *migration* criando índices (B-Tree) nas tabelas principais (`tickets`, `contacts`, `users`), especificamente nas colunas `status`, `created_at` (data), `agent_id`, `contact_id` e `sla_id`.
2. **[DB/Backend]** Ajustar o *seeder* do sistema para injetar SLAs padrão antes da criação de tickets fake nos planos Pequeno, Médio e Grande.

### Fase 3: Melhorias Visuais e de UI (Frontend)
*Ajustes rápidos de interface e internacionalização.*
1. **[Frontend]** Localizar o componente da badge "TRIAL" na lista de conversas e removê-lo ou ocultá-lo sob a condição correta.
2. **[Frontend]** Aplicar funções de tradução (`i18n` ou mapeamento manual) para os status e prioridades do ticket (`SLA BREACHED`, `MEDIUM`, etc).
3. **[Frontend]** Refatorar o menu de navegação de configurações para realocar "Políticas de SLA" ao lado do card/botão de "Tags".

### Fase 4: O Novo Onboarding
*Melhorando a recepção de novos usuários baseada em testes pesados.*
1. **[Frontend]** Implementar reatividade (via WebSocket ou Server-Sent Events) no processo de carga do onboarding para mudar o texto (ex: "Criando banco...", "Gerando contatos...", "Carregando chamados...").
2. **[Backend/Frontend]** Criar a nova opção "Ambiente Gigante" (1k contatos, 5k msgs, 5k tickets) no seeder de demonstração e expor a opção na tela final de seleção.

### Fase 5: Faturamento, Módulo Financeiro e Bloqueios
*Regras de negócio mais complexas ligadas à receita.*
1. **[DB/Backend]** Popular a tabela de `Plans` com o *Starter*, *Professional* e *Enterprise* com seus novos limites e preços.
2. **[Backend]** Configurar a trava no middleware de expiração para não conceder 7 dias adicionais. Criar flag no banco (`trial_extended_once`) para direcionar o segundo vencimento para a rota da oferta.
3. **[Frontend]** Construir os banners promocionais "FOUNDERS EDITION" no checkout e nas listagens de planos.
4. **[Frontend]** Desenvolver a página de "Comparar Recursos" com a tabela de colunas (estilo Tomticket).
