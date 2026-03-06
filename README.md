# OmniChat - Docker Deployment Guide

Este guia explica como subir a plataforma completa usando Docker.

## Pré-requisitos
- Docker e Docker Compose instalados.
- Se você tiver o SQL Server local rodando, certifique-se de que a porta `14333` esteja livre (o Docker usará ela para não conflitar com a `1433` do seu Windows).

## Como Rodar

1. **Construir e Iniciar os Containers:**
   Abra o terminal na raiz do projeto e execute:
   ```bash
   docker-compose up --build -d
   ```

2. **Inicializar o Banco de Dados (Apenas na primeira vez):**
   Como o banco de dados no Docker começa vazio, você precisa rodar o script de criação de tabelas e semente (seed) dentro do container do backend:
   ```bash
   docker exec -it omnichat_api npm run db:reset
   ```

3. **Acessar a Plataforma:**
   - **Frontend:** [http://localhost](http://localhost) (Porta 80)
   - **Backend API:** [http://localhost:3002](http://localhost:3002)

## Credenciais Padrão (Seed)
- **E-mail:** `superadmin@teste.com`
- **Senha:** `123456`

## Acesso Público Temporário (Cloudflare Tunnel)

Se você quiser que pessoas acessem seu Docker local pela internet sem mexer no firewall:

1. Baixe o [cloudflared](https://github.com/cloudflare/cloudflared/releases).
2. No seu terminal (PowerShell), execute:
   ```powershell
   cloudflared tunnel --url http://localhost:80
   ```
3. O Cloudflare vai gerar um link `.trycloudflare.com` que é público e tem HTTPS automático.

## Comandos Úteis
- Ver logs: `docker-compose logs -f`
- Parar tudo: `docker-compose down`
- Reiniciar apenas o backend: `docker-compose restart backend`
