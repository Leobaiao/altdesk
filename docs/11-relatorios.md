# Sistema de Relatórios e Business Intelligence - AltDesk

Para acessar, visualizar e exportar os relatórios no AltDesk, siga as etapas abaixo:

---

### 1. Como acessar a tela de Relatórios
1. Acesse a plataforma no seu navegador (geralmente em `http://localhost` no seu ambiente local) e faça login com uma conta que tenha permissão de acesso (Supervisor, Admin ou Superadmin).
2. Na **barra lateral esquerda** do sistema, você verá um novo ícone de gráfico de barras (📊). Clique nele ou acesse o caminho direto:
   `http://localhost/reports`

---

### 2. Escolhendo e filtrando o relatório
Uma vez dentro da tela de Relatórios:
- **Painel Lateral de Seleção**: No lado esquerdo do painel, escolha um dos 7 tipos de relatórios disponíveis:
  1. **Tickets por Status** (Visão geral de chamados abertos/fechados)
  2. **Tickets por Prioridade** (Volume de chamados por urgência)
  3. **Tickets por Canal** (Chamados via WhatsApp, E-mail, Chat, etc.)
  4. **Performance por Técnico** (SLA cumprido, tempos médios de resposta/resolução)
  5. **SLA Compliance** (Auditoria de cumprimento dos prazos acordados)
  6. **Conversas** (Estatísticas gerais de chats e satisfação CSAT)
  7. **Agentes** (Performance de atendimentos concluídos por agente)

- **Filtros Interativos**: No topo, use o painel de filtros para delimitar os dados:
  - **Período**: Selecione uma data de início (**De**) e término (**Até**).
  - **Filtros Específicos**: Filtre por *Status*, *Prioridade*, *Canal*, *Situação do SLA*, ou selecione um *Técnico/Agente* e *Fila* específicos.
  - O sistema recarrega os dados, KPIs e gráficos automaticamente após alterar qualquer filtro ou clicar em **Filtrar Relatório**.

---

### 3. Visualizando os Dados
- **KPIs (Indicadores Rápidos)**: Cartões com borda colorida (de 3 a 6 cartões de KPI, dependendo do relatório selecionado) mostram os principais números consolidados.
- **Gráficos Dinâmicos**: A seção **Resumo Gráfico** exibe gráficos de barras ou pizza interativos mostrando as distribuições dos dados.
- **Tabela Detalhada**: No final da página, uma tabela com paginação lista cada registro individual.
  - **Dica de Ação**: Toda linha da tabela é interativa! Se você clicar em uma linha que contém um chamado ou uma conversa, o sistema **navegará automaticamente** para a tela correspondente (Kanban de Tickets ou Chat) e focará/abrirá o registro selecionado.

---

### 4. Exportando os Relatórios
No canto superior direito do painel de relatórios, você encontrará três botões de exportação:
- **Exportar CSV**: Baixa os dados em formato de texto delimitado pronto para importar.
- **Exportar XLSX**: Gera uma planilha formatada do Excel com colunas ajustadas e cabeçalhos em negrito.
- **Exportar PDF**: Gera um documento PDF em layout otimizado (paisagem ou retrato dependendo do relatório) com os primeiros registros formatados para impressão ou relatórios de gerência.
