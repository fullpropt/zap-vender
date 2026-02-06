# ============================================
# SELF Proteção Veicular - Dockerfile
# VERSÃO: 4.1.0
# ============================================

# OBRIGATÓRIO: Node.js 20 (Baileys requer >=20.0.0)
FROM node:20-alpine

# Metadados
LABEL maintainer="SELF Proteção Veicular"
LABEL version="4.1.0"
LABEL description="Sistema CRM com integração WhatsApp"

# Verificar versão do Node imediatamente
RUN node --version && echo "Node.js version check passed"

# Instalar dependências do sistema necessárias para better-sqlite3
RUN apk update && apk add --no-cache \
    git \
    python3 \
    make \
    g++ \
    wget \
    curl \
    && rm -rf /var/cache/apk/*

# Criar usuário não-root para segurança
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Criar diretório da aplicação
WORKDIR /app

# Copiar apenas package.json primeiro (otimização de cache)
COPY package*.json ./

# Instalar dependências (inclui dev para build do frontend)
RUN npm install --legacy-peer-deps && \
    npm cache clean --force

# Copiar resto do código
COPY --chown=nodejs:nodejs . .

# Build do frontend (Vite)
RUN npm run build:frontend

# Remover dependências de desenvolvimento
RUN npm prune --omit=dev

# Criar diretórios necessários com permissões corretas
RUN mkdir -p sessions data uploads && \
    chown -R nodejs:nodejs sessions data uploads && \
    chmod 755 sessions data uploads

# Expor porta
EXPOSE 3001

# Variáveis de ambiente padrão
ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

# NOTA: Healthcheck gerenciado pelo Railway via railway.toml
# Não usar HEALTHCHECK interno do Docker para evitar conflitos

# Iniciar aplicação
CMD ["node", "server/start.js"]
