-- ============================================
-- ZAPVENDER - ESQUEMA DO BANCO DE DADOS (POSTGRES)
-- ============================================

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    uuid TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'agent' CHECK(role IN ('admin', 'supervisor', 'agent')),
    avatar_url TEXT,
    is_active INTEGER DEFAULT 1,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
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
    last_message_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS flows (
    id SERIAL PRIMARY KEY,
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
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conversations (
    id SERIAL PRIMARY KEY,
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
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
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
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS templates (
    id SERIAL PRIMARY KEY,
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
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS campaigns (
    id SERIAL PRIMARY KEY,
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
    start_at TIMESTAMPTZ,
    sent INTEGER DEFAULT 0,
    delivered INTEGER DEFAULT 0,
    read INTEGER DEFAULT 0,
    replied INTEGER DEFAULT 0,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS campaign_sender_accounts (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    weight INTEGER DEFAULT 1,
    daily_limit INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (campaign_id, session_id)
);

CREATE TABLE IF NOT EXISTS automations (
    id SERIAL PRIMARY KEY,
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
    last_execution TIMESTAMPTZ,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS automation_lead_runs (
    id SERIAL PRIMARY KEY,
    automation_id INTEGER NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
    lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (automation_id, lead_id)
);

CREATE TABLE IF NOT EXISTS campaign_automation_migrations (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL UNIQUE REFERENCES campaigns(id) ON DELETE CASCADE,
    automation_id INTEGER NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
    notes TEXT,
    migrated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS flow_executions (
    id SERIAL PRIMARY KEY,
    uuid TEXT UNIQUE NOT NULL,
    flow_id INTEGER NOT NULL REFERENCES flows(id),
    conversation_id INTEGER REFERENCES conversations(id),
    lead_id INTEGER NOT NULL REFERENCES leads(id),
    current_node TEXT,
    variables TEXT,
    status TEXT DEFAULT 'running' CHECK(status IN ('running', 'paused', 'completed', 'failed', 'cancelled')),
    started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    error_message TEXT
);

CREATE TABLE IF NOT EXISTS custom_events (
    id SERIAL PRIMARY KEY,
    uuid TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    event_key TEXT UNIQUE NOT NULL,
    description TEXT,
    is_active INTEGER DEFAULT 1,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS custom_event_logs (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES custom_events(id) ON DELETE CASCADE,
    flow_id INTEGER REFERENCES flows(id) ON DELETE SET NULL,
    node_id TEXT,
    lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE SET NULL,
    execution_id INTEGER REFERENCES flow_executions(id) ON DELETE SET NULL,
    metadata TEXT,
    occurred_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS message_queue (
    id SERIAL PRIMARY KEY,
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
    scheduled_at TIMESTAMPTZ,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS webhooks (
    id SERIAL PRIMARY KEY,
    uuid TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    secret TEXT,
    events TEXT NOT NULL,
    headers TEXT,
    is_active INTEGER DEFAULT 1,
    retry_count INTEGER DEFAULT 3,
    last_triggered_at TIMESTAMPTZ,
    last_status INTEGER,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS webhook_logs (
    id SERIAL PRIMARY KEY,
    webhook_id INTEGER NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    event TEXT NOT NULL,
    payload TEXT,
    response_status INTEGER,
    response_body TEXT,
    duration_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS whatsapp_sessions (
    id SERIAL PRIMARY KEY,
    session_id TEXT UNIQUE NOT NULL,
    phone TEXT,
    name TEXT,
    status TEXT DEFAULT 'disconnected' CHECK(status IN ('disconnected', 'connecting', 'connected', 'qr_pending')),
    campaign_enabled INTEGER DEFAULT 1,
    daily_limit INTEGER DEFAULT 0,
    dispatch_weight INTEGER DEFAULT 1,
    hourly_limit INTEGER DEFAULT 0,
    cooldown_until TIMESTAMPTZ,
    qr_code TEXT,
    last_connected_at TIMESTAMPTZ,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
    id SERIAL PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    type TEXT DEFAULT 'string' CHECK(type IN ('string', 'number', 'boolean', 'json')),
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id INTEGER,
    old_values TEXT,
    new_values TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tags (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    color TEXT DEFAULT '#5a2a6b',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lead_tags (
    lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (lead_id, tag_id)
);

ALTER TABLE messages ADD COLUMN campaign_id INTEGER;
ALTER TABLE message_queue ADD COLUMN campaign_id INTEGER;
ALTER TABLE message_queue ADD COLUMN IF NOT EXISTS session_id TEXT;
ALTER TABLE message_queue ADD COLUMN IF NOT EXISTS is_first_contact INTEGER DEFAULT 1;
ALTER TABLE message_queue ADD COLUMN IF NOT EXISTS assignment_meta TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS delay_min INTEGER;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS delay_max INTEGER;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS tag_filter TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS distribution_strategy TEXT DEFAULT 'single';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS distribution_config TEXT;
ALTER TABLE automations ADD COLUMN IF NOT EXISTS session_scope TEXT;
ALTER TABLE whatsapp_sessions ADD COLUMN IF NOT EXISTS campaign_enabled INTEGER DEFAULT 1;
ALTER TABLE whatsapp_sessions ADD COLUMN IF NOT EXISTS daily_limit INTEGER DEFAULT 0;
ALTER TABLE whatsapp_sessions ADD COLUMN IF NOT EXISTS dispatch_weight INTEGER DEFAULT 1;
ALTER TABLE whatsapp_sessions ADD COLUMN IF NOT EXISTS hourly_limit INTEGER DEFAULT 0;
ALTER TABLE whatsapp_sessions ADD COLUMN IF NOT EXISTS cooldown_until TIMESTAMPTZ;
ALTER TABLE whatsapp_sessions ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);

ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_lead_id_fkey;
ALTER TABLE messages ADD CONSTRAINT messages_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
ALTER TABLE flow_executions DROP CONSTRAINT IF EXISTS flow_executions_lead_id_fkey;
ALTER TABLE flow_executions ADD CONSTRAINT flow_executions_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
ALTER TABLE message_queue DROP CONSTRAINT IF EXISTS message_queue_lead_id_fkey;
ALTER TABLE message_queue ADD CONSTRAINT message_queue_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;

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
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_created_by ON whatsapp_sessions(created_by);

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

DROP VIEW IF EXISTS v_conversations;
CREATE VIEW v_conversations AS
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

INSERT INTO settings (key, value, type, description) VALUES
    ('company_name', 'ZapVender', 'string', 'Nome da empresa'),
    ('bulk_message_delay', '3000', 'number', 'Delay entre mensagens em massa (ms)'),
    ('max_messages_per_minute', '30', 'number', 'Maximo de mensagens por minuto'),
    ('bot_enabled', 'true', 'boolean', 'Bot de automacao ativo'),
    ('working_hours_start', '08:00', 'string', 'Inicio do horario de atendimento'),
    ('working_hours_end', '18:00', 'string', 'Fim do horario de atendimento'),
    ('away_message', 'Ola! No momento estamos fora do horario de atendimento. Retornaremos em breve!', 'string', 'Mensagem de ausencia'),
    ('welcome_message', 'Ola! Bem-vindo a ZapVender! Como posso ajudar?', 'string', 'Mensagem de boas-vindas')
ON CONFLICT (key) DO NOTHING;
