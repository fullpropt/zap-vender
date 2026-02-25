-- ============================================
-- SELF PROTEÇÃO VEICULAR - ESQUEMA DO BANCO DE DADOS
-- Versão 4.0 - Sistema de Automação de Mensagens
-- ============================================

-- Tabela de Usuários (Atendentes/Agentes)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    email_confirmed INTEGER DEFAULT 1,
    email_confirmed_at TEXT,
    email_confirmation_token_hash TEXT,
    email_confirmation_expires_at TEXT,
    role TEXT DEFAULT 'agent' CHECK(role IN ('admin', 'supervisor', 'agent')),
    avatar_url TEXT,
    is_active INTEGER DEFAULT 1,
    owner_user_id INTEGER REFERENCES users(id),
    last_login_at TEXT,
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
);

-- Tabela de Leads/Contatos
CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    phone_formatted TEXT,
    jid TEXT,
    name TEXT,
    email TEXT,
    vehicle TEXT,
    plate TEXT,
    status INTEGER DEFAULT 1 CHECK(status BETWEEN 1 AND 5),
    tags TEXT,
    custom_fields TEXT,
    source TEXT DEFAULT 'manual',
    assigned_to INTEGER REFERENCES users(id),
    owner_user_id INTEGER REFERENCES users(id),
    is_blocked INTEGER DEFAULT 0,
    last_message_at TEXT,
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
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
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
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
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
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
    campaign_id INTEGER,
    metadata TEXT,
    sent_at TEXT,
    delivered_at TEXT,
    read_at TEXT,
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
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
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
);

-- Tabela de Campanhas
CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT DEFAULT 'broadcast' CHECK(type IN ('broadcast', 'drip')),
    distribution_strategy TEXT DEFAULT 'single',
    distribution_config TEXT,
    status TEXT DEFAULT 'draft' CHECK(status IN ('active', 'paused', 'completed', 'draft')),
    segment TEXT,
    tag_filter TEXT,
    message TEXT,
    delay INTEGER DEFAULT 0,
    delay_min INTEGER DEFAULT 0,
    delay_max INTEGER DEFAULT 0,
    start_at TEXT,
    sent INTEGER DEFAULT 0,
    delivered INTEGER DEFAULT 0,
    read INTEGER DEFAULT 0,
    replied INTEGER DEFAULT 0,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE IF NOT EXISTS campaign_sender_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    weight INTEGER DEFAULT 1,
    daily_limit INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    UNIQUE (campaign_id, session_id)
);

-- Tabela de Automações
CREATE TABLE IF NOT EXISTS automations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL CHECK(trigger_type IN ('new_lead', 'status_change', 'message_received', 'keyword', 'schedule', 'inactivity')),
    trigger_value TEXT,
    action_type TEXT NOT NULL CHECK(action_type IN ('send_message', 'change_status', 'add_tag', 'start_flow', 'notify')),
    action_value TEXT,
    delay INTEGER DEFAULT 0,
    session_scope TEXT,
    is_active INTEGER DEFAULT 1,
    executions INTEGER DEFAULT 0,
    last_execution TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
);

-- Tabela de Execuções de Fluxo
-- Controle de execucao unica por lead para automacoes
CREATE TABLE IF NOT EXISTS automation_lead_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    automation_id INTEGER NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
    lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    UNIQUE (automation_id, lead_id)
);

-- Mapeamento de campanhas legado migradas para automacoes
CREATE TABLE IF NOT EXISTS campaign_automation_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL UNIQUE REFERENCES campaigns(id) ON DELETE CASCADE,
    automation_id INTEGER NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
    notes TEXT,
    migrated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE IF NOT EXISTS flow_executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    flow_id INTEGER NOT NULL REFERENCES flows(id),
    conversation_id INTEGER REFERENCES conversations(id),
    lead_id INTEGER NOT NULL REFERENCES leads(id),
    current_node TEXT,
    variables TEXT,
    status TEXT DEFAULT 'running' CHECK(status IN ('running', 'paused', 'completed', 'failed', 'cancelled')),
    started_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    completed_at TEXT,
    error_message TEXT
);

CREATE TABLE IF NOT EXISTS custom_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    event_key TEXT UNIQUE NOT NULL,
    description TEXT,
    is_active INTEGER DEFAULT 1,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE IF NOT EXISTS custom_event_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES custom_events(id) ON DELETE CASCADE,
    flow_id INTEGER REFERENCES flows(id) ON DELETE SET NULL,
    node_id TEXT,
    lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE SET NULL,
    execution_id INTEGER REFERENCES flow_executions(id) ON DELETE SET NULL,
    metadata TEXT,
    occurred_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
);

-- Tabela de Fila de Mensagens
CREATE TABLE IF NOT EXISTS message_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    lead_id INTEGER NOT NULL REFERENCES leads(id),
    conversation_id INTEGER REFERENCES conversations(id),
    campaign_id INTEGER,
    session_id TEXT,
    is_first_contact INTEGER DEFAULT 1,
    assignment_meta TEXT,
    content TEXT NOT NULL,
    media_type TEXT DEFAULT 'text',
    media_url TEXT,
    priority INTEGER DEFAULT 0,
    scheduled_at TEXT,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
    error_message TEXT,
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
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
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
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
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
);

-- Tabela de Sessões WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE NOT NULL,
    phone TEXT,
    name TEXT,
    status TEXT DEFAULT 'disconnected' CHECK(status IN ('disconnected', 'connecting', 'connected', 'qr_pending')),
    campaign_enabled INTEGER DEFAULT 1,
    daily_limit INTEGER DEFAULT 0,
    dispatch_weight INTEGER DEFAULT 1,
    hourly_limit INTEGER DEFAULT 0,
    cooldown_until TEXT,
    qr_code TEXT,
    last_connected_at TEXT,
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE IF NOT EXISTS whatsapp_auth_state (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    state_type TEXT NOT NULL,
    state_key TEXT NOT NULL,
    data_json TEXT NOT NULL,
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    UNIQUE (session_id, state_type, state_key)
);

-- Tabela de Configurações
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    type TEXT DEFAULT 'string' CHECK(type IN ('string', 'number', 'boolean', 'json')),
    description TEXT,
    updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
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
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
);

-- Tabela de Tags
CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    color TEXT DEFAULT '#5a2a6b',
    description TEXT,
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
);

-- Tabela de relação Lead-Tag
CREATE TABLE IF NOT EXISTS lead_tags (
    lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    PRIMARY KEY (lead_id, tag_id)
);

-- ============================================
-- ÍNDICES
-- ============================================

ALTER TABLE messages ADD COLUMN campaign_id INTEGER;
ALTER TABLE message_queue ADD COLUMN campaign_id INTEGER;
ALTER TABLE message_queue ADD COLUMN session_id TEXT;
ALTER TABLE message_queue ADD COLUMN is_first_contact INTEGER DEFAULT 1;
ALTER TABLE message_queue ADD COLUMN assignment_meta TEXT;
ALTER TABLE campaigns ADD COLUMN delay_min INTEGER;
ALTER TABLE campaigns ADD COLUMN delay_max INTEGER;
ALTER TABLE campaigns ADD COLUMN tag_filter TEXT;
ALTER TABLE campaigns ADD COLUMN distribution_strategy TEXT DEFAULT 'single';
ALTER TABLE campaigns ADD COLUMN distribution_config TEXT;
ALTER TABLE automations ADD COLUMN session_scope TEXT;
ALTER TABLE leads ADD COLUMN owner_user_id INTEGER REFERENCES users(id);
ALTER TABLE whatsapp_sessions ADD COLUMN campaign_enabled INTEGER DEFAULT 1;
ALTER TABLE whatsapp_sessions ADD COLUMN daily_limit INTEGER DEFAULT 0;
ALTER TABLE whatsapp_sessions ADD COLUMN dispatch_weight INTEGER DEFAULT 1;
ALTER TABLE whatsapp_sessions ADD COLUMN hourly_limit INTEGER DEFAULT 0;
ALTER TABLE whatsapp_sessions ADD COLUMN cooldown_until TEXT;

UPDATE leads
SET owner_user_id = (
    SELECT COALESCE(u.owner_user_id, u.id)
    FROM users u
    WHERE u.id = leads.assigned_to
)
WHERE owner_user_id IS NULL
  AND assigned_to IS NOT NULL;

UPDATE leads
SET owner_user_id = (
    SELECT COALESCE(u.owner_user_id, u.id)
    FROM conversations c
    JOIN whatsapp_sessions ws ON ws.session_id = c.session_id
    JOIN users u ON u.id = ws.created_by
    WHERE c.lead_id = leads.id
      AND ws.created_by IS NOT NULL
    ORDER BY COALESCE(c.updated_at, c.created_at) DESC, c.id DESC
    LIMIT 1
)
WHERE owner_user_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_jid ON leads(jid);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_owner ON leads(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_email_confirmation_token_hash ON users(email_confirmation_token_hash);
CREATE INDEX IF NOT EXISTS idx_whatsapp_auth_state_session ON whatsapp_auth_state(session_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_auth_state_lookup ON whatsapp_auth_state(session_id, state_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_active_unique ON users(email) WHERE is_active = 1;
DROP INDEX IF EXISTS leads_phone_unique;
CREATE UNIQUE INDEX IF NOT EXISTS leads_owner_phone_unique ON leads(owner_user_id, phone) WHERE owner_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS leads_owner_jid_unique ON leads(owner_user_id, jid) WHERE owner_user_id IS NOT NULL AND jid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_lead ON conversations(lead_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_assigned ON conversations(assigned_to);
CREATE UNIQUE INDEX IF NOT EXISTS conv_lead_session_unique ON conversations(lead_id, session_id);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_lead ON messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_messages_message_id ON messages(message_id);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_campaign ON messages(campaign_id);

CREATE INDEX IF NOT EXISTS idx_flows_trigger ON flows(trigger_type, trigger_value);
CREATE INDEX IF NOT EXISTS idx_flows_active ON flows(is_active);
CREATE INDEX IF NOT EXISTS idx_automation_lead_runs_lead ON automation_lead_runs(lead_id);
CREATE INDEX IF NOT EXISTS idx_campaign_automation_migrations_automation ON campaign_automation_migrations(automation_id);
CREATE INDEX IF NOT EXISTS idx_custom_events_active ON custom_events(is_active);
CREATE INDEX IF NOT EXISTS idx_custom_events_key ON custom_events(event_key);
CREATE INDEX IF NOT EXISTS idx_custom_event_logs_event_date ON custom_event_logs(event_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_custom_event_logs_flow ON custom_event_logs(flow_id);
CREATE INDEX IF NOT EXISTS idx_custom_event_logs_lead ON custom_event_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_custom_event_logs_conversation ON custom_event_logs(conversation_id);

CREATE INDEX IF NOT EXISTS idx_queue_status ON message_queue(status);
CREATE INDEX IF NOT EXISTS idx_queue_scheduled ON message_queue(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_queue_priority ON message_queue(priority DESC);
CREATE INDEX IF NOT EXISTS idx_queue_campaign ON message_queue(campaign_id);
CREATE INDEX IF NOT EXISTS idx_queue_session ON message_queue(session_id);
CREATE INDEX IF NOT EXISTS idx_campaign_sender_accounts_campaign ON campaign_sender_accounts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_sender_accounts_session ON campaign_sender_accounts(session_id);

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
