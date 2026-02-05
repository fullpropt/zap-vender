-- ============================================
-- SELF PROTEÇÃO VEICULAR - ESQUEMA DO BANCO DE DADOS
-- Versão 4.0 - Sistema de Automação de Mensagens
-- ============================================

-- Tabela de Usuários (Atendentes/Agentes)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'agent' CHECK(role IN ('admin', 'supervisor', 'agent')),
    avatar_url TEXT,
    is_active INTEGER DEFAULT 1,
    last_login_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Tabela de Leads/Contatos
CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    phone_formatted TEXT,
    jid TEXT UNIQUE,
    name TEXT,
    email TEXT,
    vehicle TEXT,
    plate TEXT,
    status INTEGER DEFAULT 1 CHECK(status BETWEEN 1 AND 5),
    tags TEXT,
    custom_fields TEXT,
    source TEXT DEFAULT 'manual',
    assigned_to INTEGER REFERENCES users(id),
    is_blocked INTEGER DEFAULT 0,
    last_message_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Tabela de Fluxos de Automação (criada antes de conversations por causa da FK)
CREATE TABLE IF NOT EXISTS flows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL CHECK(trigger_type IN ('keyword', 'new_contact', 'webhook', 'schedule', 'manual')),
    trigger_value TEXT,
    nodes TEXT NOT NULL,
    edges TEXT,
    is_active INTEGER DEFAULT 1,
    priority INTEGER DEFAULT 0,
    stats TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Tabela de Conversas
CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    status TEXT DEFAULT 'open' CHECK(status IN ('open', 'pending', 'resolved', 'closed')),
    assigned_to INTEGER REFERENCES users(id),
    last_message_id INTEGER,
    unread_count INTEGER DEFAULT 0,
    is_bot_active INTEGER DEFAULT 1,
    current_flow_id INTEGER REFERENCES flows(id),
    current_flow_step TEXT,
    metadata TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Tabela de Mensagens
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    message_id TEXT UNIQUE,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    lead_id INTEGER NOT NULL REFERENCES leads(id),
    sender_type TEXT NOT NULL CHECK(sender_type IN ('lead', 'agent', 'bot', 'system')),
    sender_id INTEGER,
    content TEXT,
    content_encrypted TEXT,
    media_type TEXT DEFAULT 'text' CHECK(media_type IN ('text', 'image', 'video', 'audio', 'document', 'sticker', 'location', 'contact')),
    media_url TEXT,
    media_mime_type TEXT,
    media_filename TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
    is_from_me INTEGER DEFAULT 0,
    reply_to_id INTEGER REFERENCES messages(id),
    metadata TEXT,
    sent_at TEXT,
    delivered_at TEXT,
    read_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Tabela de Templates de Mensagem
CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    content TEXT NOT NULL,
    variables TEXT,
    media_url TEXT,
    media_type TEXT,
    is_active INTEGER DEFAULT 1,
    usage_count INTEGER DEFAULT 0,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Tabela de Execuções de Fluxo
CREATE TABLE IF NOT EXISTS flow_executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    flow_id INTEGER NOT NULL REFERENCES flows(id),
    conversation_id INTEGER REFERENCES conversations(id),
    lead_id INTEGER NOT NULL REFERENCES leads(id),
    current_node TEXT,
    variables TEXT,
    status TEXT DEFAULT 'running' CHECK(status IN ('running', 'paused', 'completed', 'failed', 'cancelled')),
    started_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT,
    error_message TEXT
);

-- Tabela de Fila de Mensagens
CREATE TABLE IF NOT EXISTS message_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    lead_id INTEGER NOT NULL REFERENCES leads(id),
    conversation_id INTEGER REFERENCES conversations(id),
    content TEXT NOT NULL,
    media_type TEXT DEFAULT 'text',
    media_url TEXT,
    priority INTEGER DEFAULT 0,
    scheduled_at TEXT,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    processed_at TEXT
);

-- Tabela de Webhooks
CREATE TABLE IF NOT EXISTS webhooks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    secret TEXT,
    events TEXT NOT NULL,
    headers TEXT,
    is_active INTEGER DEFAULT 1,
    retry_count INTEGER DEFAULT 3,
    last_triggered_at TEXT,
    last_status INTEGER,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Tabela de Log de Webhooks
CREATE TABLE IF NOT EXISTS webhook_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    webhook_id INTEGER NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    event TEXT NOT NULL,
    payload TEXT,
    response_status INTEGER,
    response_body TEXT,
    duration_ms INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Tabela de Sessões WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE NOT NULL,
    phone TEXT,
    name TEXT,
    status TEXT DEFAULT 'disconnected' CHECK(status IN ('disconnected', 'connecting', 'connected', 'qr_pending')),
    qr_code TEXT,
    last_connected_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Tabela de Configurações
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    type TEXT DEFAULT 'string' CHECK(type IN ('string', 'number', 'boolean', 'json')),
    description TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Tabela de Logs de Auditoria
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id INTEGER,
    old_values TEXT,
    new_values TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Tabela de Tags
CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    color TEXT DEFAULT '#5a2a6b',
    description TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Tabela de relação Lead-Tag
CREATE TABLE IF NOT EXISTS lead_tags (
    lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (lead_id, tag_id)
);

-- ============================================
-- ÍNDICES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_jid ON leads(jid);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned ON leads(assigned_to);
CREATE UNIQUE INDEX IF NOT EXISTS leads_phone_unique ON leads(phone);

CREATE INDEX IF NOT EXISTS idx_conversations_lead ON conversations(lead_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_assigned ON conversations(assigned_to);
CREATE UNIQUE INDEX IF NOT EXISTS conv_lead_session_unique ON conversations(lead_id, session_id);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_lead ON messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_messages_message_id ON messages(message_id);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);

CREATE INDEX IF NOT EXISTS idx_flows_trigger ON flows(trigger_type, trigger_value);
CREATE INDEX IF NOT EXISTS idx_flows_active ON flows(is_active);

CREATE INDEX IF NOT EXISTS idx_queue_status ON message_queue(status);
CREATE INDEX IF NOT EXISTS idx_queue_scheduled ON message_queue(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_queue_priority ON message_queue(priority DESC);

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

-- ============================================
-- VIEWS
-- ============================================

CREATE VIEW IF NOT EXISTS v_conversations AS
SELECT 
    c.id,
    c.uuid,
    c.status,
    c.unread_count,
    c.is_bot_active,
    c.created_at,
    c.updated_at,
    l.id as lead_id,
    l.phone,
    l.name as lead_name,
    l.vehicle,
    l.plate,
    l.status as lead_status,
    u.id as agent_id,
    u.name as agent_name,
    (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
    (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_at
FROM conversations c
LEFT JOIN leads l ON c.lead_id = l.id
LEFT JOIN users u ON c.assigned_to = u.id;

-- ============================================
-- DADOS PADRÃO
-- ============================================

INSERT OR IGNORE INTO settings (key, value, type, description) VALUES
    ('company_name', 'SELF Proteção Veicular', 'string', 'Nome da empresa'),
    ('bulk_message_delay', '3000', 'number', 'Delay entre mensagens em massa (ms)'),
    ('max_messages_per_minute', '30', 'number', 'Máximo de mensagens por minuto'),
    ('bot_enabled', 'true', 'boolean', 'Bot de automação ativo'),
    ('working_hours_start', '08:00', 'string', 'Início do horário de atendimento'),
    ('working_hours_end', '18:00', 'string', 'Fim do horário de atendimento'),
    ('away_message', 'Olá! No momento estamos fora do horário de atendimento. Retornaremos em breve!', 'string', 'Mensagem de ausência'),
    ('welcome_message', 'Olá! Bem-vindo à SELF Proteção Veicular! Como posso ajudar?', 'string', 'Mensagem de boas-vindas');
