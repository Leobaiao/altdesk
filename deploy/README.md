# Hospedagem AltDesk na Locaweb Cloud

Este diretório contém os arquivos necessários para configurar um ambiente de produção seguro, automatizado e baseando-se em contêineres Docker na Locaweb.

## Passo 1: Criar o Servidor (Cloud-Init)

1. No painel da Locaweb, inicie a criação de um novo Servidor VPS / Cloud com **Ubuntu 22.04** ou superior.
2. Na seção **Dados do Usuário (User Data / Cloud-Init)**, cole todo o conteúdo do arquivo `cloud-init-locaweb.yaml`.
3. **Atenção:** Lembre-se de substituir `COLE_SUA_CHAVE_SSH_PUBLICA_AQUI` pela sua chave SSH real ao colar o código na Locaweb, para que você possa acessar o servidor de forma segura.
4. Conclua a criação do servidor. O script demorará alguns minutos (geralmente de 2 a 5 minutos) para finalizar todas as instalações (Docker, Firewall, etc) em background no primeiro boot.

## Passo 2: Configurar o Domínio (Nginx)

Seus contêineres rodam internamente nas portas `3000`, `3001`, `3002`, etc. O Nginx do hospedeiro (`host`) vai repassar o tráfego de domínio externo (ex: `app.seudominio.com`) para essas portas.

1. Acesse seu servidor Locaweb recém-criado via SSH:
   `ssh deploy@IP_DO_SERVIDOR`
   
2. Puxe este repositório para o servidor:
   ```bash
   cd /opt/altdesk
   git clone https://github.com/Leobaiao/altdesk.git .
   ```

3. Copie as configurações do Nginx:
   ```bash
   sudo cp deploy/nginx-proxy.conf /etc/nginx/sites-available/altdesk
   sudo ln -s /etc/nginx/sites-available/altdesk /etc/nginx/sites-enabled/
   ```

4. Edite o `/etc/nginx/sites-available/altdesk` e substitua `app.seudominio.com` e `admin.seudominio.com` pelos seus domínios reais.

5. Reinicie o Nginx: `sudo systemctl restart nginx`

## Passo 3: Configurar as Variáveis de Ambiente (.env)

Em `/opt/altdesk`, você deve configurar as variáveis de produção.

```bash
cp deploy/.env.example .env
nano .env # Edite os dados do banco e credenciais do Asaas
```

## Passo 4: Primeiro Deploy Manual

Ainda dentro de `/opt/altdesk`:

```bash
# Iniciar o sistema na versão de produção
docker compose -f deploy/docker-compose.prod.yml up -d --build

# Rodar as migrações de banco (irá configurar os scripts SQL iniciais)
docker compose -f deploy/docker-compose.prod.yml up db-migrate
```

## Passo 5: Gerar Certificados SSL (HTTPS)

Com os contêineres rodando e o DNS devidamente propagado no Registro.br ou Locaweb, rode o Certbot para o Nginx assumir o SSL automaticamente:

```bash
sudo certbot --nginx -d app.seudominio.com -d admin.seudominio.com
```

## Passo 6: CI/CD Automatizado (GitHub Actions)

Agora que sua máquina existe e está funcional, você pode configurar o GitHub para atualizar o projeto sozinho.

1. Vá ao GitHub em `Settings` > `Secrets and variables` > `Actions`.
2. Adicione as seguintes *Repository Secrets*:
   * `SSH_HOST`: O IP público da sua Locaweb.
   * `SSH_USER`: `deploy`
   * `SSH_KEY`: A sua chave privada RSA/Ed25519 equivalente à pública inserida no Cloud-Init.

A partir desse momento, **qualquer push na branch `main` disparará o arquivo `.github/workflows/deploy.yml`**, reconectando ao servidor e fazendo rebuild da versão nova do AltDesk sem você precisar tocar na máquina!
