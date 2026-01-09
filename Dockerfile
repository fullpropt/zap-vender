# ============================================
# SELF Proteção Veicular - Dockerfile
# VERSÃO: 3.0.0 - FORÇAR NODE 20
# TIMESTAMP: 2026-01-09T20:00:00Z
# ============================================

# ARG para invalidar cache - mude este valor para forçar rebuild
ARG CACHE_BUST=v3.0.0-20260109

# OBRIGATÓRIO: Node.js 20 (Baileys requer >=20.0.0)
FROM node:20-alpine

# Verificar versão do Node imediatamente
RUN node --version && echo "Node.js version check passed"

# Instalar dependências do sistema
RUN apk update && apk add --no-cache \
    git \
    python3 \
    make \
    g++ \
    wget \
    curl

# Criar diretório da aplicação
WORKDIR /app

# Limpar cache npm completamente
RUN npm cache clean --force && rm -rf /root/.npm

# Copiar apenas package.json primeiro (otimização de cache)
COPY package.json ./

# Gerar novo package-lock.json limpo
RUN npm install --omit=dev --legacy-peer-deps --no-audit

# Copiar resto do código
COPY . .

# Criar diretórios necessários
RUN mkdir -p sessions data && chmod 755 sessions data

# Expor porta
EXPOSE 3001

# Variáveis de ambiente
ENV NODE_ENV=production
ENV PORT=3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget -q --spider http://localhost:3001/health || exit 1

# Iniciar aplicação
CMD ["node", "server/index.js"]
