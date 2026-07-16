# 🧪 Plano de Testes - Estabilização e Novas Funcionalidades

Este documento descreve os cenários de teste necessários para validar as implementações recentes, incluindo o portal do solicitante, Kanban, SLA, integração de e-mail e o pipeline de deploy.

---

## 1. Portal do Solicitante (Colaborador)
- [ ] **Login e Acesso:** Logar com um usuário `END_USER` e garantir que ele seja redirecionado para o Dashboard do portal.
- [ ] **Abertura de Ticket:** Abrir um novo ticket e verificar:
    - [ ] Se o ticket aparece instantaneamente na barra lateral do Agente (sem refresh).
    - [ ] Se o título da conversa é o **Nome do Colaborador**.
- [ ] **Troca de Mensagens:**
    - [ ] Mensagens enviadas pelo colaborador devem aparecer no balão branco (lado esquerdo) para o agente.
    - [ ] Mensagens enviadas pelo agente devem aparecer no portal.
- [ ] **Persistência:** Atualizar a página do portal e garantir que o chat continue visível.
- [ ] **Privacidade:** Garantir que o colaborador **NÃO veja** nenhuma mensagem marcada como "Nota Interna".

---

## 2. Kanban e SLA
- [ ] **Visualização Kanban:** Acessar a aba Kanban e verificar:
    - [ ] Se todos os tickets estão distribuídos corretamente nas colunas de status.
    - [ ] Se tickets com status antigos/legados estão visíveis (se configurado).
- [ ] **SLA (Timers):** Verificar nos cards do Kanban:
    - [ ] Se o cronômetro de SLA está visível e contando regressivamente.
    - [ ] Se a cor do timer muda (ex: de verde para vermelho) conforme se aproxima do vencimento.
- [ ] **Movimentação:** Arrastar um ticket de uma coluna para outra e validar se o status é atualizado no banco de dados.
- [ ] **Sincronização:** Abrir um ticket pelo Kanban e verificar se os detalhes (histórico) carregam corretamente.

---

## 3. Integração de E-mail
- [ ] **Configuração de Canais:** Verificar em Configurações > Canais de E-mail se os canais estão ativos.
- [ ] **Recebimento (Inbound):** Enviar um e-mail para um dos endereços configurados e validar:
    - [ ] Criação automática de um ticket com o assunto do e-mail.
    - [ ] O conteúdo do e-mail aparece como a primeira mensagem.
- [ ] **Envio (Outbound):** Responder um ticket via interface AltDesk e verificar:
    - [ ] Se o e-mail chega ao destinatário final.
    - [ ] Se o remetente está correto (conforme configurado no canal).
- [ ] **Threading:** Responder ao e-mail recebido (pelo cliente) e garantir que a resposta caia no **mesmo ticket**.

---

## 4. Visão do Agente e Operação
- [ ] **Nova Conversa (Interna):** Clicar no ícone de chat na barra lateral e verificar:
    - [ ] Se existe a seção "Equipe" com outros agentes e colaboradores.
    - [ ] Se é possível iniciar um chat direto com um colega.
- [ ] **Transferência de Chamado:** Abrir o modal de transferência (ícone de usuários) e garantir:
    - [ ] Que apenas Agentes e Admins apareçam na lista de busca.
    - [ ] Que **nenhum** Colaborador (`END_USER`) esteja disponível para atribuição.
- [ ] **Notas Internas:** Adicionar uma nota amarela em um chamado e verificar se ela permanece visível apenas para a equipe.

---

## 5. Gestão Administrativa
- [ ] **Lista de Colaboradores:** Acessar a página "Colaboradores" e verificar:
    - [ ] Se todos os membros da empresa aparecem (Agentes e Solicitantes).
    - [ ] Se os solicitantes possuem o badge escrito **COLABORADOR**.
- [ ] **Criação de Membros:** Criar um novo usuário com a função "Colaborador" e validar se ele aparece imediatamente na lista após salvar.

---

## 6. Infraestrutura e Deploy (CI/CD)
- [ ] **GitHub Actions:** Realizar um push para a branch `main` e verificar no GitHub se o workflow `Deploy to Production` completa com sucesso.
- [ ] **SSH & VPS:** Após o deploy, acessar o servidor via SSH e verificar:
    - [ ] Se os containers foram recriados (`docker ps`).
    - [ ] Se as variáveis de ambiente (Secrets) foram injetadas corretamente nos containers.
- [ ] **Estabilidade Técnica:**
    - [ ] Executar `docker compose logs -f backend` e procurar por erros de conexão com banco de dados ou e-mail.
    - [ ] Verificar se os eventos de Socket.IO estão funcionando no ambiente de produção.
