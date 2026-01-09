# ============================================
# SELF Proteção Veicular - Dockerfile v2.0.1
# Build: 2026-01-09-v2 (cache buster)
# ============================================

# IMPORTANTE: Usar Node.js 20+ (requerido pelo Baileys)
FROM node:20-alpine

# Metadados
LABEL maintainer="SELF Proteção Veicular"
LABEL version="2.0.1"

# Instalar dependências do sistema
RUN apk add --no-cache \
    git \
    python3 \
    make \
    g++ \
    wget

# Criar diretório da aplicação
WORKDIR /app

# Limpar cache do npm para evitar conflitos
RUN npm cache clean --force

# Copiar arquivos de dependências primeiro (para cache de layers)
COPY package*.json ./

# Instalar dependências de produção
RUN npm install --omit=dev --legacy-peer-deps

# Copiar código fonte
COPY . .

# Criar diretórios necessários com permissões
RUN mkdir -p sessions data && \
    chmod 755 sessions data

# Expor porta
EXPOSE 3001

# Variáveis de ambiente
ENV NODE_ENV=production
ENV PORT=3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Comando de inicialização
CMD ["node", "server/index.js"]
