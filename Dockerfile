# Dockerfile para Railway
FROM node:20-alpine

# Instalar git e outras dependências necessárias para compilação
RUN apk add --no-cache git python3 make g++

# Criar diretório da aplicação
WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências
RUN npm install --omit=dev

# Copiar código fonte
COPY . .

# Criar diretórios necessários
RUN mkdir -p sessions data

# Expor porta
EXPOSE 3001

# Variáveis de ambiente
ENV NODE_ENV=production
ENV PORT=3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Comando de inicialização
CMD ["npm", "start"]
