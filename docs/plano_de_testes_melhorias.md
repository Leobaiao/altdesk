# Plano de Testes — Refinamentos Enterprise AltDesk

Este documento serve como um guia prático para testar e validar cada uma das 6 melhorias e novos recursos corporativos implementados na branch `development`.

---

## 🚀 Como Iniciar o Ambiente

1. **Docker Compose:**
   Certifique-se de que os containers do Docker estão de pé. Na raiz do projeto (`c:\dev\altdesk`), execute:
   ```bash
   docker-compose up --build -d
   ```

2. **Portas Disponíveis:**
   - **Frontend Principal:** `http://localhost:3000` (ou `http://localhost`)
   - **Admin Frontend (SuperAdmin):** `http://localhost:8080`
   - **MailHog (SMTP):** `http://localhost:8025`

---

## 🧪 Casos de Teste

### Caso de Teste 1: Reset de Dados Transacionais (Purge)
* **Objetivo:** Garantir que o SuperAdmin possa resetar dados de demonstração de um Tenant mantendo usuários e configurações intactos.
* **Onde:** Painel SuperAdmin (`http://localhost:8080`).

**Passos:**
1. Acesse o Painel SuperAdmin.
2. Vá para a aba **Empresas** (Tenants).
3. Selecione uma empresa de teste da lista lateral.
4. No canto superior direito da tela de detalhes, localize o botão amarelo **"🧹 Zerar Dados"**.
5. Clique no botão e valide se o **Modal de Segurança** se abre exibindo um aviso claro de que a ação é irreversível.
6. Confirme a ação clicando em **"Sim, Zerar Tudo"**.
7. **Resultado Esperado:** 
   - Uma notificação de sucesso deve aparecer no topo.
   - Todos os tickets, mensagens, contatos e conversas daquela empresa específica devem ser removidos do banco de dados.
   - Os usuários e canais cadastrados na empresa **devem permanecer** intactos.

---

### Caso de Teste 2: Data de Onboarding no SuperAdmin
* **Objetivo:** Exibir comercialmente a data de início da empresa.
* **Onde:** Painel SuperAdmin (`http://localhost:8080`).

**Passos:**
1. Acesse o Painel SuperAdmin na aba de **Empresas**.
2. Examine a lista de empresas no sidebar lateral esquerdo.
3. **Resultado Esperado:** Logo abaixo do nome e do contador de usuários/instâncias, deve aparecer um ícone de calendário com a data de criação formatada (ex: `📅 18/05/2026`).

---

### Caso de Teste 3: Campos CRM e Badges nos Contatos
* **Objetivo:** Capturar e exibir informações de origem, canal e campanha dos clientes.
* **Onde:** Aplicativo principal (`http://localhost`).

**Passos:**
1. Faça login no sistema como um Agente.
2. Navegue até o módulo de **Contatos** no menu principal.
3. Clique em **"Novo Contato"** ou edite um contato existente.
4. Localize a nova seção **"Rastreamento CRM"** ao final do formulário.
5. Preencha os campos:
   - **Origem:** Ex: *Google Ads*
   - **Tipo de Canal:** Selecione *Whatsapp*
   - **Campanha / UTM:** Ex: *promocao_maio*
6. Salve o contato.
7. **Resultado Esperado:**
   - Na listagem de contatos, o card do contato salvo deve exibir badges coloridos e estilizados:
     - 📍 Google Ads (roxo)
     - 📱 Whatsapp (verde)
     - 🏷️ promocao_maio (amarelo)

---

### Caso de Teste 4: Data de Última Atividade do Contato
* **Objetivo:** Exibir visualmente quando o contato teve a última interação.
* **Onde:** Aplicativo principal (`http://localhost`).

**Passos:**
1. No mesmo módulo de **Contatos**, observe o card de cada contato.
2. **Resultado Esperado:** 
   - No rodapé do card, deve constar o texto com o ícone de relógio indicando a última atividade formatada no padrão brasileiro (ex: `🕐 18/05/2026 16:30`).

---

### Caso de Teste 5: Edição Rápida (Quick Edit) no Kanban
* **Objetivo:** Editar o título de um chamado diretamente no board sem precisar abrir os detalhes.
* **Onde:** Aplicativo principal (`http://localhost`) na tela do quadro Kanban.

**Passos:**
1. Vá até a tela do Kanban.
2. Passe o mouse sobre qualquer card de ticket e observe o pequeno ícone de lápis (✏️) que aparece ao lado do título.
3. Dê **duplo-clique** sobre o título do ticket OU clique no ícone do lápis.
4. O título deve se transformar em um campo de texto (`input`) com borda roxa de foco.
5. Altere o título e pressione a tecla **Enter** (ou clique fora do card).
6. **Resultado Esperado:** 
   - O título deve ser salvo no banco de dados.
   - O card deve atualizar imediatamente exibindo o novo título de forma fluida.
