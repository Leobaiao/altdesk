# 🧪 Plano de Testes - Estabilização do Portal e Comunicação

Este documento descreve os cenários de teste necessários para validar as implementações de estabilização do portal do solicitante, permissões e comunicação interna.

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

## 2. Visão do Agente e Operação
- [ ] **Nova Conversa (Interna):** Clicar no ícone de chat na barra lateral e verificar:
    - [ ] Se existe a seção "Equipe" com outros agentes e colaboradores.
    - [ ] Se é possível iniciar um chat direto com um colega.
- [ ] **Transferência de Chamado:** Abrir o modal de transferência (ícone de usuários) e garantir:
    - [ ] Que apenas Agentes e Admins apareçam na lista de busca.
    - [ ] Que **nenhum** Colaborador (`END_USER`) esteja disponível para atribuição.
- [ ] **Notas Internas:** Adicionar uma nota amarela em um chamado e verificar se ela permanece visível apenas para a equipe.

---

## 3. Gestão Administrativa
- [ ] **Lista de Colaboradores:** Acessar a página "Colaboradores" e verificar:
    - [ ] Se todos os membros da empresa aparecem (Agentes e Solicitantes).
    - [ ] Se os solicitantes possuem o badge escrito **COLABORADOR**.
- [ ] **Criação de Membros:** Criar um novo usuário com a função "Colaborador" e validar se ele aparece imediatamente na lista após salvar.

---

## 4. Estabilidade Técnica
- [ ] **Build Docker:** Executar `docker compose up -d --build` e garantir que não existam erros de compilação TypeScript no backend ou frontend.
- [ ] **Logs:** Verificar no log do backend se os eventos de Socket.IO (`conversation:new`, `message:new`) estão sendo disparados sem erros.
