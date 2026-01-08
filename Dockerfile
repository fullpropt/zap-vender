# Dockerfile para Railway
FROM node:18-alpine

# Instalar git e outras dependências necessárias
RUN apk add --no-cache git python3 make g++

# Criar diretório da aplicação
WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências
RUN npm install --omit=dev

# Copiar código fonte
COPY . .

# Criar diretório de sessões
RUN mkdir -p sessions

# Expor porta
EXPOSE 3001

# Variáveis de ambiente
ENV NODE_ENV=production
ENV PORT=3001

# Comando de inicialização
CMD ["npm", "start"]
