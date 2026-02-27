# SELF Proteção Veicular - Documentação de Arquitetura v4.0

## Visão Geral

Este documento descreve a arquitetura completa do sistema SELF Proteção Veicular após a refatoração para v4.0, transformando o MVP em um sistema de automação de mensagens WhatsApp de nível empresarial.

---

## Arquitetura do Sistema

### Diagrama de Componentes

```
┌─────────────────────────────────────────────────────────────────────┐
│                           FRONTEND                                   │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐       │
│  │ Dashboard  │ │   Funil    │ │   Chat     │ │   Fluxos   │       │
│  │   .html    │ │   .html    │ │   v2.html  │ │ builder.html│       │
│  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └─────┬──────┘       │
│        └──────────────┴──────────────┴──────────────┘               │
│                              │                                       │
│                         Socket.IO                                    │
│                         REST API                                     │
└──────────────────────────────┼───────────────────────────────────────┘
                               │
┌──────────────────────────────┼───────────────────────────────────────┐
│                          BACKEND                                      │
│  ┌───────────────────────────┴───────────────────────────┐           │
│  │                    Express Server                      │           │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │           │
│  │  │  REST API   │  │  Socket.IO  │  │   Baileys   │   │           │
│  │  │  Endpoints  │  │   Handler   │  │  WhatsApp   │   │           │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘   │           │
│  └─────────┼────────────────┼────────────────┼───────────┘           │
│            │                │                │                        │
│  ┌─────────┴────────────────┴────────────────┴───────────┐           │
│  │                      MIDDLEWARE                        │           │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  │           │
│  │  │  Auth   │  │  Rate   │  │Sanitize │  │  CORS   │  │           │
│  │  │   JWT   │  │  Limit  │  │  Input  │  │ Headers │  │           │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘  │           │
│  └───────────────────────────────────────────────────────┘           │
│                              │                                        │
│  ┌───────────────────────────┴───────────────────────────┐           │
│  │                       SERVICES                         │           │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │           │
│  │  │   Queue     │  │   Webhook   │  │    Flow     │   │           │
│  │  │  Service    │  │   Service   │  │   Service   │   │           │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘   │           │
│  └─────────┼────────────────┼────────────────┼───────────┘           │
│            │                │                │                        │
│  ┌─────────┴────────────────┴────────────────┴───────────┐           │
│  │                       DATABASE                         │           │
│  │  ┌─────────────────────────────────────────────────┐  │           │
│  │  │                    SQLite                        │  │           │
│  │  │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────────┐  │  │           │
│  │  │  │Users│ │Leads│ │Msgs │ │Flows│ │Webhooks │  │  │           │
│  │  │  └─────┘ └─────┘ └─────┘ └─────┘ └─────────┘  │  │           │
│  │  └─────────────────────────────────────────────────┘  │           │
│  └───────────────────────────────────────────────────────┘           │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Estrutura de Pastas

```
zap-vender/
├── data/                          # Banco de dados SQLite
│   └── database.db                # Arquivo do banco
│
├── docs/                          # Documentação
│   └── ARCHITECTURE.md            # Este arquivo
│
├── public/                        # Frontend estático
│   ├── css/
│   │   ├── style.css              # Estilos originais
│   │   └── modern-style.css       # Novos estilos v4.0
│   ├── js/
│   │   └── config.js              # Configurações frontend
│   ├── img/
│   │   └── logo-self.png          # Logo
│   ├── dashboard.html             # Dashboard
│   ├── funil.html                 # Funil de vendas
│   ├── whatsapp.html              # Conexão WhatsApp
│   ├── conversas.html             # Chat original
│   ├── conversas-v2.html          # Chat moderno v4.0
│   ├── flow-builder.html          # Construtor de fluxos v4.0
│   ├── configuracoes.html         # Configurações
│   └── login.html                 # Login
│
├── server/                        # Backend Node.js
│   ├── database/
│   │   ├── connection.js          # Conexão SQLite
│   │   ├── migrate.js             # Script de migração
│   │   ├── models.js              # Modelos de dados
│   │   ├── schema.sql             # Schema SQL completo
│   │   └── seed.js                # Dados iniciais
│   │
│   ├── middleware/
│   │   └── auth.js                # Autenticação JWT
│   │
│   ├── services/
│   │   ├── flowService.js         # Execução de fluxos
│   │   ├── queueService.js        # Fila de mensagens
│   │   └── webhookService.js      # Disparo de webhooks
│   │
│   ├── utils/
│   │   └── encryption.js          # Criptografia AES-256
│   │
│   └── index.js                   # Servidor principal
│
├── sessions/                      # Sessões WhatsApp (auto-gerado)
├── uploads/                       # Arquivos enviados (auto-gerado)
│
├── .env.example                   # Exemplo de variáveis
├── .node-version                  # Versão Node.js
├── nixpacks.toml                  # Config Railway
├── railway.toml                   # Config Railway
├── railway.json                   # Config Railway
├── package.json                   # Dependências
└── README.md                      # Documentação principal
```

---

## Banco de Dados

### Schema Completo

#### Tabela: users
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'agent',      -- admin, manager, agent
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### Tabela: leads
```sql
CREATE TABLE leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    jid TEXT,                        -- WhatsApp JID
    name TEXT,
    email TEXT,
    vehicle TEXT,
    plate TEXT,
    status INTEGER DEFAULT 1,        -- 1-4 etapas do funil
    source TEXT DEFAULT 'manual',
    tags TEXT DEFAULT '[]',          -- JSON array
    notes TEXT,
    is_blocked INTEGER DEFAULT 0,
    last_message_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### Tabela: conversations
```sql
CREATE TABLE conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    lead_id INTEGER NOT NULL,
    session_id TEXT,
    assigned_to INTEGER,             -- user_id do atendente
    is_bot_active INTEGER DEFAULT 1,
    unread_count INTEGER DEFAULT 0,
    last_message_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id) REFERENCES leads(id),
    FOREIGN KEY (assigned_to) REFERENCES users(id)
);
```

#### Tabela: messages
```sql
CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    message_id TEXT,                 -- ID do WhatsApp
    conversation_id INTEGER NOT NULL,
    lead_id INTEGER NOT NULL,
    sender_type TEXT NOT NULL,       -- lead, agent, bot
    sender_id INTEGER,               -- user_id se agent
    content TEXT,
    content_encrypted TEXT,          -- Conteúdo criptografado
    media_type TEXT DEFAULT 'text',
    media_url TEXT,
    status TEXT DEFAULT 'pending',   -- pending, sent, delivered, read, failed
    is_from_me INTEGER DEFAULT 0,
    sent_at DATETIME,
    delivered_at DATETIME,
    read_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id),
    FOREIGN KEY (lead_id) REFERENCES leads(id)
);
```

#### Tabela: flows
```sql
CREATE TABLE flows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL,      -- keyword, new_contact, manual
    trigger_value TEXT,              -- Palavra-chave se aplicável
    nodes TEXT NOT NULL DEFAULT '[]', -- JSON dos nós
    edges TEXT NOT NULL DEFAULT '[]', -- JSON das conexões
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### Tabela: message_queue
```sql
CREATE TABLE message_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    lead_id INTEGER NOT NULL,
    conversation_id INTEGER,
    content TEXT NOT NULL,
    media_type TEXT DEFAULT 'text',
    media_url TEXT,
    priority INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',   -- pending, processing, sent, failed, cancelled
    scheduled_at DATETIME,
    sent_at DATETIME,
    error_message TEXT,
    attempts INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id) REFERENCES leads(id)
);
```

#### Tabela: webhooks
```sql
CREATE TABLE webhooks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    events TEXT NOT NULL DEFAULT '[]', -- JSON array de eventos
    secret TEXT,
    headers TEXT DEFAULT '{}',         -- JSON de headers extras
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## Serviços

### QueueService

Gerencia o envio de mensagens em massa com controle de rate limit.

**Funcionalidades:**
- Adicionar mensagens à fila
- Envio em massa com delay configurável
- Limite de mensagens por minuto
- Cancelamento de mensagens pendentes
- Retry automático em caso de falha

**Configurações:**
- `bulk_message_delay`: Delay entre mensagens (padrão: 3000ms)
- `max_messages_per_minute`: Limite por minuto (padrão: 30)

### WebhookService

Dispara webhooks para sistemas externos em eventos específicos.

**Eventos Suportados:**
- `message.received` - Mensagem recebida
- `message.sent` - Mensagem enviada
- `message.delivered` - Mensagem entregue
- `message.read` - Mensagem lida
- `lead.created` - Lead criado
- `lead.updated` - Lead atualizado
- `conversation.assigned` - Conversa atribuída
- `whatsapp.connected` - WhatsApp conectado
- `whatsapp.disconnected` - WhatsApp desconectado
- `flow.started` - Fluxo iniciado
- `flow.completed` - Fluxo completado

**Payload:**
```json
{
    "event": "message.received",
    "timestamp": "2024-01-08T22:00:00.000Z",
    "data": {
        "message": {...},
        "lead": {...}
    }
}
```

### FlowService

Executa fluxos de automação baseados em triggers.

**Tipos de Nós:**
- `trigger` - Gatilho inicial (keyword, new_contact)
- `message` - Enviar mensagem
- `wait` - Aguardar resposta
- `condition` - Ramificação condicional
- `delay` - Aguardar tempo
- `transfer` - Transferir para atendente
- `tag` - Adicionar tag ao lead
- `status` - Alterar status do lead
- `webhook` - Disparar webhook
- `end` - Finalizar fluxo

**Variáveis Disponíveis:**
- `{{nome}}` - Nome do lead
- `{{telefone}}` - Telefone do lead
- `{{veiculo}}` - Veículo do lead
- `{{placa}}` - Placa do veículo

---

## Segurança

### Criptografia

**AES-256-GCM** para mensagens armazenadas:
- Chave derivada via PBKDF2 (100.000 iterações)
- IV aleatório por mensagem
- Tag de autenticação para integridade

### Autenticação

**JWT (JSON Web Tokens):**
- Access token: 24h de validade
- Refresh token: 7 dias de validade
- Roles: admin, manager, agent

### Proteções

- **Rate Limiting**: 100 req/min por IP
- **Helmet**: Headers de segurança
- **CORS**: Configurável por origem
- **Sanitização**: Remoção de scripts maliciosos
- **Hash de Senhas**: PBKDF2 com salt

---

## API REST

### Autenticação
```
POST /api/auth/login
POST /api/auth/register
POST /api/auth/refresh
```

### Leads
```
GET    /api/leads
GET    /api/leads/:id
POST   /api/leads
PUT    /api/leads/:id
DELETE /api/leads/:id
```

### Mensagens
```
POST /api/send
GET  /api/messages/:leadId
```

### Fila
```
GET    /api/queue/status
POST   /api/queue/add
POST   /api/queue/bulk
DELETE /api/queue/:id
DELETE /api/queue
```

### Fluxos
```
GET    /api/flows
GET    /api/flows/:id
POST   /api/flows
PUT    /api/flows/:id
DELETE /api/flows/:id
```

### Webhooks
```
GET    /api/webhooks
POST   /api/webhooks
PUT    /api/webhooks/:id
DELETE /api/webhooks/:id
POST   /api/webhook/incoming
```

---

## Deploy

### Railway

O projeto está configurado para deploy automático no Railway:

1. **package.json**: Engine Node.js >= 20.0.0
2. **nixpacks.toml**: Configuração de build
3. **railway.toml**: Configuração de deploy

### Variáveis de Ambiente

```env
NODE_ENV=production
PORT=3001
JWT_SECRET=sua-chave-jwt-secreta
ENCRYPTION_KEY=sua-chave-criptografia
DATABASE_PATH=./data/database.db
SESSIONS_DIR=./sessions
MAX_RECONNECT_ATTEMPTS=5
RATE_LIMIT_MAX_REQUESTS=100
```

---

## Changelog v4.0

### Novos Recursos
- ✅ Banco de dados SQLite com schema completo
- ✅ Sistema de filas para envio em massa
- ✅ Webhooks para integrações externas
- ✅ Construtor visual de fluxos de automação
- ✅ Interface de chat moderna estilo inbox
- ✅ Indicador de "digitando..."
- ✅ Status de mensagens (enviado, entregue, lido)
- ✅ Criptografia AES-256 para mensagens
- ✅ Autenticação JWT
- ✅ Multi-agentes com atribuição de conversas

### Correções
- ✅ Configuração Node.js 20+ para Railway
- ✅ Reconexão automática robusta
- ✅ Rate limiting para evitar bloqueios

### Melhorias
- ✅ Design system moderno (Tailwind UI style)
- ✅ Código organizado em serviços e módulos
- ✅ Documentação completa

---

**SELF Proteção Veicular** © 2024 - Sistema de Automação WhatsApp v4.0
