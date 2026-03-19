# Plano de Separação: AltDesk SuperAdmin

A separação do painel de administração global (SuperAdmin) visa criar um ecossistema onde o produto principal (para os lojistas/atendentes) e o painel administrativo (para gestão de empresas/licenças) operem em repositórios/projetos separados, podendo ter deploy, versão e manutenção de forma independente.

## Como as Dependências se Comportam Hoje
**No Frontend Main (`altdesk/frontend`):**
Existe um componente [SuperAdmin.tsx](file:///f:/Dev/altdesk/frontend/src/SuperAdmin.tsx) que agrupa 3 abas principais:
- Empresas (Tenants)
- Usuários Globais
- Instâncias de Canais de Comunicação

**No Backend Main (`altdesk/backend`):**
Cerca de 10% ou menos das requisições na API são referentes à gerência, todas concentradas em:
- [backend/src/routes/admin.ts](file:///f:/Dev/altdesk/backend/src/routes/admin.ts)
Estes dependem das regras de banco compartilhadas usando os Schemas do SQL Server (Tenants).

## Abordagem de Separação (Separação Completa - Microsserviço Administrativo)

A decisão foi tomada para seguir com a **Via 1**, que consiste em isolar completamente as rotas administrativas em uma API própria e criar uma interface (frontend) dedicada a ela. Ambas continuarão se conectando ao banco de dados SQL Server atual via Docker.

**1. Novo Workspace Admin (`altdesk-admin`)**
Será criada uma nova pasta raiz `altdesk-admin/` contendo 2 subprojetos:
- `/frontend`: Aplicação React (com Vite) contendo apenas o painel SuperAdmin as lógicas abstraídas do `main`.
- `/backend`: API Node (Express + TypeScript) mais enxuta. Possuirá conexões com o DB mas abrigará apenas o equivalente a `admin.ts`.

**2. Mudanças no Projeto Principal (`altdesk`)**
- O arquivo `backend/src/routes/admin.ts` será **deletado**.
- O roteamento no `index.ts` que escuta por `/api/admin` será **removido**.
- A aba de administração global (SuperAdmin.tsx e components/SuperAdmin) do React será **deletada**.
- As permissões e roles no Middleware podem sofrer um leve refactoring para ignorar cargos globais (SUPERADMIN).

**3. Mudanças na Orquestração (Docker)**
- O `docker-compose.yml` raiz passará a construir 4 containers de serviço ao invés de 2, adicionando os services `admin_api` e `admin_web` nas portas (ex: 3003 e 8080).

## Proposed Changes

### Novo Repositório/Projeto Admin
- **[NEW]** Criar o diretório `f:\Dev\altdesk-admin`
- **[NEW]** Criar `altdesk-admin/frontend/` (Vite React app, portado do `SuperAdmin.tsx`).
- **[NEW]** Criar `altdesk-admin/backend/` (Express app consumindo lib db/mssql compartilhada, hospedando `admin.ts` em rotas raízes `/`).
- **[NEW]** Adicionar repositório independente de versionamento caso necessário.

### Backend (Main App - `f:\Dev\altdesk`)
#### [MODIFY] `backend/src/index.ts`
- Remover roteamento `app.use("/api/admin", adminRouter);`.
#### [DELETE] `backend/src/routes/admin.ts`
- Este arquivo inteiro mudará de repousório.

### Frontend (Main App - `f:\Dev\altdesk`)
#### [MODIFY] `frontend/src/App.tsx`
- Remover roteador `/admin`.
#### [DELETE] `frontend/src/SuperAdmin.tsx`
- Remover o componente principal de gestão global.
#### [DELETE] `frontend/src/components/SuperAdmin/*`
- Componentes e modais associados farão parte da base de código do novo projeto.

## Verification Plan

### Automated Tests
* Garantir que `npm run build` roda limpo tanto no monorepo main quanto no monorepo de admin recém-criado.
* Verificar com `docker-compose up` no projeto principal para certificar que ele sobe sem erros a API enxuta.

### Manual Verification
1. Lançar separadamente o banco de dados e os containers do `altdesk` principal e do `altdesk-admin`.
2. O usuário abrirá `http://localhost:80` (Main) em aba anônima e certificará que as opções de SuperAdmin não existem mais.
3. O usuário abrirá (ex: `http://localhost:8080`) (Admin API em 3003) e testará o login com a conta master (`superadmin@teste.com`), garantindo renderização dos Tenants ali.

### Frontend (Main App)
#### [MODIFY] `frontend/src/App.tsx`
- Remover as rotas para o SuperAdmin e seus imports.

#### [DELETE] `frontend/src/SuperAdmin.tsx`
- Extrair sua lógica (bem como de dependências locais `components/SuperAdmin/*`)

### Backend (Main App)
#### [MODIFY] `backend/src/index.ts`
- Remover roteamento para `/api/admin`.

#### [DELETE] `backend/src/routes/admin.ts`
- Excluir o endpoint que afeta a estrutura primária.

### Novo Repositório/Projeto Admin
Será criado um workspace paralelo `altdesk-admin` contendo:
#### [NEW] `altdesk-admin/frontend/`
- Projeto scaffolded do zero copiando tokens de CSS necessários e hospedando as páginas e lógicas extraídas.
#### [NEW] `altdesk-admin/backend/`
- Um novo clone magro do backend atual, contendo apenas:
  - Configuração de DB.
  - O arquivo/lógica de `admin.ts` convertido para uma API Standalone.
#### [MODIFY] `docker-compose.yml` (Na raiz local)
- Novo container do banco (compartilhado), container API-Principal, container Web-Principal, container API-Admin, container Web-Admin.

## Verification Plan

### Automated Tests
* Garantir compilação bem-sucedida dos projetos (`npm run build` independente).
* Subir o novo `docker-compose.yml` e checar `docker ps` se as 4 peças+banco estão ativas sem colisões de porta.

### Manual Verification
1. Abrir o Frontend Principal em `http://localhost`, fazer login com um atendente e confirmar funcionalidade sem quebra.
2. Abrir o Frontend Secundário em (ex: `http://localhost:8080`), logar como Super Admin e confirmar funcionamento da gestão de empresas acessando a API Admin recém desmembrada.
