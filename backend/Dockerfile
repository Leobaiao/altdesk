# Usar node 20 alpine
FROM node:20-alpine

# Instalar dependências para compilar módulos nativos (se necessário)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copiar arquivos de dependência primeiro para aproveitar cache
COPY backend/package*.json ./backend/
COPY shared/ ./shared/

# Instalar dependências do backend (com .dockerignore agindo, isso será limpo)
WORKDIR /app/backend
RUN npm ci

# Copiar o restante do código do backend e a pasta de banco
WORKDIR /app
COPY backend/ ./backend/
COPY db/ ./backend/db/

# Build do projeto
WORKDIR /app/backend
RUN npm run build

# Expor a porta definida no docker-compose (3002)
EXPOSE 3002

# Comando para rodar
CMD ["npm", "start"]
