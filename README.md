# 🚗 SELF Proteção Veicular - Sistema CRM com WhatsApp v4.0.0

![Version](https://img.shields.io/badge/version-4.0.0-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-green.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

Sistema completo de CRM com integração WhatsApp para gestão de leads, automação de mensagens e construtor de fluxos estilo BotConversa.

## ✨ Funcionalidades

### Core
- ✅ **Dashboard Profissional** com métricas e funil de vendas
- ✅ **Integração WhatsApp** via Baileys (sem API paga)
- ✅ **Inbox de Conversas** - chat em tempo real com leads
- ✅ **Conexão via QR Code** - similar ao BotConversa
- ✅ **Sessão persistente** - conecta uma vez, usa sempre
- ✅ **Reconexão automática** - sistema robusto

### Automação (v4.0)
- ✅ **Construtor de Fluxos** - crie automações visuais
- ✅ **Fila de Mensagens** - disparo em massa com controle de rate limit
- ✅ **Templates** - mensagens pré-definidas com variáveis
- ✅ **Webhooks** - integração com sistemas externos
- ✅ **Multi-agentes** - atribuição de conversas

### Segurança
- ✅ **Criptografia de mensagens** - AES-256
- ✅ **Rate limiting** - proteção contra abusos
- ✅ **Autenticação JWT** - sessões seguras
- ✅ **Helmet** - headers de segurança

## 🛠️ Requisitos

- **Node.js** versão 20 ou superior (obrigatório para Baileys)
- **npm** versão 10 ou superior
- **VPS/Servidor** com acesso SSH (ou Railway)

## ⚠️ Hardening obrigatório (produção)
- API `/api/*` e WebSocket exigem JWT (`Authorization: Bearer <token>` e `auth.token` no Socket.IO).
- Índices únicos criados na migração: `leads.phone` e `conversations(lead_id, session_id)` para evitar duplicidade/erros de `ON CONFLICT` (garanta que não existam duplicados antes de rodar `npm run db:migrate`).
- Sessões do WhatsApp são persistidas em disco (`SESSIONS_DIR`) e reidratadas no boot; no Railway, monte volume persistente e aponte `SESSIONS_DIR` para `/mnt/data/sessions`.
- Configure `JWT_SECRET` e `ENCRYPTION_KEY` com valores fortes; defina `CORS_ORIGINS` com as URLs do frontend/Railway.

## 🚀 Instalação Local

### 1. Clone o repositório

```bash
git clone https://github.com/fullpropt/self-protecao-veicular.git
cd self-protecao-veicular
```

### 2. Configure as variáveis de ambiente

```bash
cp .env.example .env
# Edite o arquivo .env com suas configurações
```

### 3. Instale as dependências

```bash
npm install
```

### 4. Execute a migração do banco de dados

```bash
npm run db:migrate
```

### 5. (Opcional) Popule com dados de exemplo

```bash
npm run db:seed
```

### 6. Inicie o servidor

```bash
# Modo desenvolvimento
npm run dev

# Modo produção
npm start
```

### 7. Acesse o sistema

Abra no navegador: `http://localhost:3001`

**Credenciais padrão:**
- Usuário: `thyago`
- Senha: `thyago123`

## 🌐 Deploy no Railway

### Opção 1: Deploy Automático

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template)

### Opção 2: Deploy Manual

1. Acesse [Railway](https://railway.app)
2. Crie um novo projeto
3. Conecte seu repositório GitHub
4. Configure as variáveis de ambiente:

| Variável | Descrição | Obrigatório |
|----------|-----------|-------------|
| `PORT` | Porta do servidor (Railway define automaticamente) | Não |
| `NODE_ENV` | `production` | Sim |
| `JWT_SECRET` | Chave secreta para tokens JWT (min 32 chars) | Sim |
| `ENCRYPTION_KEY` | Chave para criptografia de mensagens | Sim |
| `WEBHOOK_SECRET` | Chave para validar webhooks externos | Não |
| `CORS_ORIGINS` | URLs permitidas (ex.: https://web-production-a38e.up.railway.app) | Sim |
| `SESSIONS_DIR` | Diretorio persistente das sessões Baileys (`/mnt/data/sessions` no Railway) | Sim |

5. Deploy será automático a cada push

### Configurações Railway

O projeto já inclui os arquivos de configuração:
- `railway.toml` - Configuração de build e deploy
- `nixpacks.toml` - Configuração do Nixpacks para Node.js 20
- `railway.json` - Configuração adicional
- Monte um volume persistente e aponte `SESSIONS_DIR` para `/mnt/data/sessions` para manter sessões após restart.

## 📱 Conectando o WhatsApp

1. Acesse o sistema no navegador
2. Clique em **"WhatsApp"** no menu lateral
3. Clique em **"Conectar WhatsApp"**
4. Escaneie o QR Code com seu celular (WhatsApp > Dispositivos conectados)
5. Pronto! A sessão fica salva automaticamente

## 📁 Estrutura do Projeto

```
self-protecao-veicular/
├── server/
│   ├── index.js              # Servidor principal
│   ├── database/
│   │   ├── connection.js     # Conexão SQLite
│   │   ├── migrate.js        # Script de migração
│   │   ├── models.js         # Modelos de dados
│   │   ├── schema.sql        # Esquema do banco
│   │   └── seed.js           # Dados de exemplo
│   ├── middleware/
│   │   └── auth.js           # Middleware de autenticação
│   ├── services/
│   │   ├── flowService.js    # Serviço de fluxos
│   │   ├── queueService.js   # Serviço de fila
│   │   └── webhookService.js # Serviço de webhooks
│   └── utils/
│       └── encryption.js     # Utilitários de criptografia
├── public/
│   ├── css/
│   │   ├── style.css         # Estilos globais
│   │   └── modern-style.css  # Estilos modernos
│   ├── js/
│   │   ├── config.js         # Configurações do frontend
│   │   ├── dashboard.js      # Lógica do dashboard
│   │   └── whatsapp.js       # Lógica do WhatsApp
│   ├── img/
│   │   └── logo-self.png     # Logo do sistema
│   ├── dashboard.html        # Dashboard principal
│   ├── whatsapp.html         # Conexão WhatsApp
│   ├── conversas.html        # Inbox de conversas
│   ├── conversas-v2.html     # Inbox v2 (melhorado)
│   ├── flow-builder.html     # Construtor de fluxos
│   ├── funil.html            # Funil de vendas
│   ├── configuracoes.html    # Configurações
│   └── login.html            # Página de login
├── sessions/                 # Sessões WhatsApp (auto-gerado)
├── data/                     # Banco de dados SQLite (auto-gerado)
├── uploads/                  # Arquivos enviados (auto-gerado)
├── docs/
│   └── ARCHITECTURE.md       # Documentação de arquitetura
├── package.json
├── railway.toml              # Configuração Railway
├── nixpacks.toml             # Configuração Nixpacks
├── Dockerfile                # Build Docker
├── Procfile                  # Comando de inicialização
├── .env.example              # Exemplo de variáveis de ambiente
└── README.md
```

## 🔧 API REST

### Health Check
```http
GET /health
```

### Status do Servidor
```http
GET /api/status
```

### Leads

```http
# Listar leads
GET /api/leads?status=1&search=nome&limit=50&offset=0

# Obter lead específico
GET /api/leads/:id

# Criar lead
POST /api/leads
Content-Type: application/json
{
    "phone": "27999999999",
    "name": "João Silva",
    "email": "joao@email.com",
    "vehicle": "Honda Civic",
    "plate": "ABC-1234"
}

# Atualizar lead
PUT /api/leads/:id

# Deletar lead
DELETE /api/leads/:id
```

### Mensagens

```http
# Enviar mensagem
POST /api/send
Content-Type: application/json
{
    "sessionId": "self_whatsapp_session",
    "to": "5527999999999",
    "message": "Olá! Esta é uma mensagem de teste.",
    "type": "text"
}

# Listar mensagens de um lead
GET /api/messages/:leadId
```

### Fila de Mensagens

```http
# Status da fila
GET /api/queue/status

# Adicionar à fila
POST /api/queue/add
{
    "leadId": 1,
    "content": "Mensagem para enviar",
    "priority": 0
}

# Disparo em massa
POST /api/queue/bulk
{
    "leadIds": [1, 2, 3],
    "content": "Mensagem para todos"
}

# Cancelar mensagem
DELETE /api/queue/:id

# Limpar fila
DELETE /api/queue
```

### Templates

```http
# Listar templates
GET /api/templates

# Criar template
POST /api/templates
{
    "name": "Boas-vindas",
    "content": "Olá {{nome}}, bem-vindo à SELF!",
    "category": "welcome"
}

# Atualizar template
PUT /api/templates/:id

# Deletar template
DELETE /api/templates/:id
```

### Fluxos de Automação

```http
# Listar fluxos
GET /api/flows

# Obter fluxo específico
GET /api/flows/:id

# Criar fluxo
POST /api/flows
{
    "name": "Fluxo de Boas-vindas",
    "trigger_type": "new_contact",
    "nodes": [...],
    "edges": [...]
}

# Atualizar fluxo
PUT /api/flows/:id

# Deletar fluxo
DELETE /api/flows/:id
```

### Webhooks

```http
# Listar webhooks
GET /api/webhooks

# Criar webhook
POST /api/webhooks
{
    "name": "Notificação CRM",
    "url": "https://seu-sistema.com/webhook",
    "events": ["lead.created", "message.received"],
    "secret": "sua-chave-secreta"
}

# Webhook de entrada (receber dados externos)
POST /api/webhook/incoming
{
    "event": "lead.create",
    "data": { "phone": "27999999999", "name": "Novo Lead" },
    "secret": "webhook-secret"
}
```

### Configurações

```http
# Obter configurações
GET /api/settings

# Atualizar configurações
PUT /api/settings
{
    "company_name": "SELF Proteção",
    "bulk_message_delay": 5000
}
```

## 🔄 Eventos Socket.IO

### Cliente → Servidor

| Evento | Descrição | Payload |
|--------|-----------|---------|
| `check-session` | Verificar sessão existente | `{ sessionId }` |
| `start-session` | Iniciar nova sessão | `{ sessionId }` |
| `send-message` | Enviar mensagem | `{ sessionId, to, message, type, options }` |
| `get-contacts` | Obter lista de contatos | `{ sessionId }` |
| `get-messages` | Obter mensagens | `{ sessionId, contactJid, leadId }` |
| `get-leads` | Obter lista de leads | `{ status, search, limit }` |
| `mark-read` | Marcar como lida | `{ sessionId, contactJid, conversationId }` |
| `toggle-bot` | Ativar/desativar bot | `{ conversationId, active }` |
| `assign-conversation` | Atribuir conversa | `{ conversationId, userId }` |
| `logout` | Desconectar WhatsApp | `{ sessionId }` |

### Servidor → Cliente

| Evento | Descrição |
|--------|-----------|
| `qr` | QR Code para escaneamento |
| `connecting` | Conectando ao WhatsApp |
| `connected` | WhatsApp conectado |
| `disconnected` | WhatsApp desconectado |
| `new-message` | Nova mensagem recebida |
| `message-sent` | Mensagem enviada com sucesso |
| `message-status` | Atualização de status |
| `whatsapp-status` | Status geral do WhatsApp |
| `error` | Erro na operação |

## 🌐 Deploy em VPS (Alternativo)

### Usando PM2 (Recomendado)

```bash
# Instalar PM2 globalmente
npm install -g pm2

# Iniciar aplicação
pm2 start server/index.js --name "self-whatsapp"

# Configurar para iniciar com o sistema
pm2 startup
pm2 save

# Ver logs
pm2 logs self-whatsapp

# Reiniciar
pm2 restart self-whatsapp
```

### Configurar Nginx (Proxy Reverso)

```nginx
server {
    listen 80;
    server_name seu-dominio.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Configurar SSL com Certbot

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d seu-dominio.com
```

## 📝 Variáveis de Ambiente

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `PORT` | Porta do servidor | 3001 |
| `NODE_ENV` | Ambiente | development |
| `SESSIONS_DIR` | Diretório de sessões | ./sessions |
| `DATA_DIR` | Diretório de dados | ./data |
| `DATABASE_PATH` | Caminho do banco SQLite | ./data/self.db |
| `JWT_SECRET` | Chave secreta JWT | - |
| `ENCRYPTION_KEY` | Chave de criptografia | - |
| `MAX_RECONNECT_ATTEMPTS` | Tentativas de reconexão | 5 |
| `RECONNECT_DELAY` | Delay entre reconexões (ms) | 3000 |
| `QR_TIMEOUT` | Timeout do QR Code (ms) | 60000 |
| `BULK_MESSAGE_DELAY` | Delay entre mensagens (ms) | 3000 |
| `MAX_MESSAGES_PER_MINUTE` | Limite de mensagens/minuto | 30 |
| `RATE_LIMIT_WINDOW_MS` | Janela de rate limit (ms) | 60000 |
| `RATE_LIMIT_MAX_REQUESTS` | Máximo de requisições | 100 |
| `WEBHOOK_SECRET` | Chave para webhooks | - |

## ❓ Problemas Comuns

### QR Code não aparece
- Verifique se o servidor está rodando
- Verifique o console do navegador para erros
- Tente limpar a pasta `sessions/` e reconectar

### Mensagens não enviam
- Verifique se o WhatsApp está conectado (indicador verde)
- Verifique se o número está no formato correto (com DDD)
- Verifique os logs do servidor

### Sessão desconecta sozinha
- O WhatsApp pode desconectar se o celular ficar muito tempo offline
- Mantenha o celular conectado à internet
- Verifique se não há outra sessão web ativa

### Erro de banco de dados
- Execute `npm run db:migrate` para criar/atualizar tabelas
- Verifique permissões na pasta `data/`

### Deploy no Railway falha
- Verifique se a versão do Node.js está correta (>=20)
- Verifique as variáveis de ambiente obrigatórias
- Consulte os logs de build no Railway

## 📞 Suporte

Para dúvidas ou problemas, abra uma issue no GitHub.

## 📄 Licença

MIT License - Livre para uso comercial e modificações.

---

**SELF Proteção Veicular** © 2026 - Todos os direitos reservados
