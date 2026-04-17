# Hospedagem AltDesk na Locaweb Cloud

Este diretório contém os arquivos necessários para configurar um ambiente de produção seguro, automatizado e baseando-se em contêineres Docker na Locaweb.

## Arquitetura

```
Internet (HTTPS)
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  Docker Compose                                         │
│                                                         │
│  ┌─────────┐    ┌──────────┐    ┌───────────────────┐   │
│  │  Caddy   │───▶│ frontend │    │       db          │   │
│  │ :80/:443 │    │  :80     │    │ (SQL Server)      │   │
│  │  HTTPS   │    └──────────┘    └───────────────────┘   │
│  │ Auto-SSL │    ┌──────────┐              ▲             │
│  │          │───▶│ admin-fe │              │             │
│  │          │    │  :80     │    ┌─────────┴─────────┐   │
│  │          │    └──────────┘    │     backend       │   │
│  │          │───▶│ backend  │◀──│     :3002          │   │
│  │          │    │  :3002   │    └───────────────────┘   │
│  │          │    └──────────┘    ┌───────────────────┐   │
│  │          │───▶│admin-api │◀──│  admin-backend     │   │
│  │          │    │  :3002   │    │     :3002          │   │
│  └─────────┘    └──────────┘    └───────────────────┘   │
│                                                         │
│  Rede interna Docker (sem portas expostas ao host)      │
└─────────────────────────────────────────────────────────┘
```

## Passo 1: Criar o Servidor (Cloud-Init)

1. No painel da Locaweb, inicie a criação de um novo Servidor VPS / Cloud com **Ubuntu 22.04** ou superior.
2. Na seção **Dados do Usuário (User Data / Cloud-Init)**, cole todo o conteúdo do arquivo `cloud-init-locaweb.yaml`.
3. **Atenção:** Lembre-se de substituir `COLE_SUA_CHAVE_SSH_PUBLICA_AQUI` pela sua chave SSH real ao colar o código na Locaweb, para que você possa acessar o servidor de forma segura.
4. Conclua a criação do servidor. O script demorará alguns minutos (geralmente de 2 a 5 minutos) para finalizar todas as instalações (Docker, Firewall, etc) em background no primeiro boot.

## Passo 2: Configurar DNS

Antes de prosseguir, certifique-se de que os registros DNS do seu domínio apontem para o IP do servidor:

| Tipo  | Nome         | Valor             |
|-------|--------------|--------------------|
| A     | @            | 191.252.110.173    |
| A     | admin        | 191.252.110.173    |
| A     | api          | 191.252.110.173    |
| A     | api-admin    | 191.252.110.173    |
| CNAME | www          | altdesk.com.br     |

> **Nota:** O DNS pode levar até 24h para propagar, mas geralmente leva minutos.

## Passo 3: Configurar as Variáveis de Ambiente (.env)

Acesse o servidor e configure as variáveis:

```bash
ssh deploy@191.252.110.173
cd /opt/altdesk
git clone https://github.com/Leobaiao/altdesk.git .
cp deploy/.env.example .env
nano .env    # Edite os dados do banco, JWT, SMTP e Asaas
```

Certifique-se de que as URLs de API usem `https://`:
```env
VITE_API_URL_APP=https://api.altdesk.com.br
VITE_API_URL_ADMIN=https://api-admin.altdesk.com.br
```

## Passo 4: Primeiro Deploy

```bash
# Subir todos os serviços (incluindo o Caddy com HTTPS automático)
docker compose -f deploy/docker-compose.prod.yml up -d --build

# Rodar as migrações de banco
docker compose -f deploy/docker-compose.prod.yml up db-migrate
```

O **Caddy irá automaticamente**:
- Obter certificados SSL do Let's Encrypt para todos os domínios
- Configurar HTTPS com TLS 1.3
- Redirecionar HTTP → HTTPS
- Renovar certificados antes de expirarem
- Habilitar HTTP/3 (QUIC) para melhor performance

### Verificar que tudo está funcionando

```bash
# Ver logs do Caddy (certificados sendo gerados)
docker compose -f deploy/docker-compose.prod.yml logs -f caddy

# Ver status de todos os serviços
docker compose -f deploy/docker-compose.prod.yml ps
```

Após alguns segundos, os sites estarão disponíveis:
- 🌐 https://altdesk.com.br — App Cliente
- 🔧 https://admin.altdesk.com.br — Painel SuperAdmin
- 🔌 https://api.altdesk.com.br — API do App
- 🔌 https://api-admin.altdesk.com.br — API do Admin

## Passo 5: CI/CD Automatizado (GitHub Actions)

Agora que sua máquina existe e está funcional, você pode configurar o GitHub para atualizar o projeto sozinho.

1. Vá ao GitHub em `Settings` > `Secrets and variables` > `Actions`.
2. Adicione as seguintes *Repository Secrets*:
   * `SSH_HOST`: O IP público da sua Locaweb (`191.252.110.173`).
   * `SSH_USER`: `deploy`
   * `SSH_KEY`: A sua chave privada RSA/Ed25519 equivalente à pública inserida no Cloud-Init.

A partir desse momento, **qualquer push na branch `main` disparará o arquivo `.github/workflows/deploy.yml`**, reconectando ao servidor e fazendo rebuild da versão nova do AltDesk sem você precisar tocar na máquina!

## Troubleshooting

### Certificados não estão sendo gerados
```bash
# Verificar logs do Caddy para erros de DNS/ACME
docker compose -f deploy/docker-compose.prod.yml logs caddy | grep -i "err\|cert\|tls"
```
Causa mais comum: DNS ainda não propagou. Aguarde alguns minutos e reinicie o Caddy:
```bash
docker compose -f deploy/docker-compose.prod.yml restart caddy
```

### Limpar e recomeçar
```bash
docker compose -f deploy/docker-compose.prod.yml down
docker volume rm deploy_caddy_data deploy_caddy_config
docker compose -f deploy/docker-compose.prod.yml up -d --build
```
