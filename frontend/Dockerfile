# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar arquivos de dependência
COPY frontend/package*.json ./frontend/
COPY shared/ ./shared/

# Instalar dependências do frontend
WORKDIR /app/frontend
RUN npm ci

# Voltar para a raiz para copiar o código e buildar
WORKDIR /app
COPY frontend/ ./frontend/

WORKDIR /app/frontend
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# Stage 2: Serve
FROM nginx:alpine
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
