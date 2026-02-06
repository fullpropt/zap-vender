/**
 * SELF PROTEÇÃO VEICULAR - Modelos de Dados
 * Funções CRUD para todas as entidades do sistema
 */

const { query, queryOne, run, transaction, generateUUID } = require('./connection');

// ============================================
// LEADS
// ============================================

const Lead = {
    create(data) {
        const uuid = generateUUID();
        const jid = data.jid || `55${data.phone.replace(/\D/g, '')}@s.whatsapp.net`;
        
        const result = run(`
            INSERT INTO leads (uuid, phone, phone_formatted, jid, name, email, vehicle, plate, status, tags, custom_fields, source, assigned_to)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            uuid,
            data.phone?.replace(/\D/g, ''),
            data.phone_formatted || data.phone,
            jid,
            data.name,
            data.email,
            data.vehicle,
            data.plate,
            data.status || 1,
            JSON.stringify(data.tags || []),
            JSON.stringify(data.custom_fields || {}),
            data.source || 'manual',
            data.assigned_to
        ]);
        
        return { id: result.lastInsertRowid, uuid };
    },
    
    findById(id) {
        return queryOne('SELECT * FROM leads WHERE id = ?', [id]);
    },
    
    findByUuid(uuid) {
        return queryOne('SELECT * FROM leads WHERE uuid = ?', [uuid]);
    },
    
    findByPhone(phone) {
        const cleaned = phone.replace(/\D/g, '');
        return queryOne('SELECT * FROM leads WHERE phone = ? OR phone LIKE ?', [cleaned, `%${cleaned}`]);
    },
    
    findByJid(jid) {
        return queryOne('SELECT * FROM leads WHERE jid = ?', [jid]);
    },
    
    findOrCreate(data) {
        let lead = this.findByPhone(data.phone);
        if (!lead && data.jid) {
            lead = this.findByJid(data.jid);
        }
        
        if (lead) {
            // Atualizar dados se necessário
            if (data.name && !lead.name) {
                this.update(lead.id, { name: data.name });
                lead.name = data.name;
            }
            return { lead, created: false };
        }
        
        const result = this.create(data);
        return { lead: this.findById(result.id), created: true };
    },
    
    update(id, data) {
        const fields = [];
        const values = [];
        
        const allowedFields = ['name', 'email', 'vehicle', 'plate', 'status', 'tags', 'custom_fields', 'assigned_to', 'is_blocked', 'last_message_at'];
        
        for (const [key, value] of Object.entries(data)) {
            if (allowedFields.includes(key)) {
                fields.push(`${key} = ?`);
                values.push(typeof value === 'object' ? JSON.stringify(value) : value);
            }
        }
        
        if (fields.length === 0) return null;
        
        fields.push("updated_at = datetime('now')");
        values.push(id);
        
        return run(`UPDATE leads SET ${fields.join(', ')} WHERE id = ?`, values);
    },
    
    delete(id) {
        return run('DELETE FROM leads WHERE id = ?', [id]);
    },
    
    list(options = {}) {
        let sql = 'SELECT * FROM leads WHERE 1=1';
        const params = [];
        
        if (options.status) {
            sql += ' AND status = ?';
            params.push(options.status);
        }
        
        if (options.assigned_to) {
            sql += ' AND assigned_to = ?';
            params.push(options.assigned_to);
        }
        
        if (options.search) {
            sql += ' AND (name LIKE ? OR phone LIKE ?)';
            params.push(`%${options.search}%`, `%${options.search}%`);
        }
        
        sql += ' ORDER BY updated_at DESC';
        
        if (options.limit) {
            sql += ' LIMIT ?';
            params.push(options.limit);
        }
        
        if (options.offset) {
            sql += ' OFFSET ?';
            params.push(options.offset);
        }
        
        return query(sql, params);
    },
    
    count(options = {}) {
        let sql = 'SELECT COUNT(*) as total FROM leads WHERE 1=1';
        const params = [];
        
        if (options.status) {
            sql += ' AND status = ?';
            params.push(options.status);
        }
        
        return queryOne(sql, params)?.total || 0;
    }
};

// ============================================
// CONVERSATIONS
// ============================================

const Conversation = {
    create(data) {
        const uuid = generateUUID();
        
        const result = run(`
            INSERT INTO conversations (uuid, lead_id, session_id, status, assigned_to, is_bot_active, current_flow_id, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            uuid,
            data.lead_id,
            data.session_id,
            data.status || 'open',
            data.assigned_to,
            data.is_bot_active !== undefined ? data.is_bot_active : 1,
            data.current_flow_id,
            JSON.stringify(data.metadata || {})
        ]);
        
        return { id: result.lastInsertRowid, uuid };
    },
    
    findById(id) {
        return queryOne('SELECT * FROM conversations WHERE id = ?', [id]);
    },
    
    findByLeadId(leadId) {
        return queryOne('SELECT * FROM conversations WHERE lead_id = ? ORDER BY updated_at DESC LIMIT 1', [leadId]);
    },
    
    findOrCreate(data) {
        let conversation = this.findByLeadId(data.lead_id);
        
        if (conversation) {
            return { conversation, created: false };
        }
        
        const result = this.create(data);
        return { conversation: this.findById(result.id), created: true };
    },
    
    update(id, data) {
        const fields = [];
        const values = [];
        
        const allowedFields = ['status', 'assigned_to', 'unread_count', 'is_bot_active', 'current_flow_id', 'current_flow_step', 'metadata'];
        
        for (const [key, value] of Object.entries(data)) {
            if (allowedFields.includes(key)) {
                fields.push(`${key} = ?`);
                values.push(typeof value === 'object' ? JSON.stringify(value) : value);
            }
        }
        
        if (fields.length === 0) return null;
        
        fields.push("updated_at = datetime('now')");
        values.push(id);
        
        return run(`UPDATE conversations SET ${fields.join(', ')} WHERE id = ?`, values);
    },
    
    incrementUnread(id) {
        return run("UPDATE conversations SET unread_count = unread_count + 1, updated_at = datetime('now') WHERE id = ?", [id]);
    },
    
    markAsRead(id) {
        return run("UPDATE conversations SET unread_count = 0, updated_at = datetime('now') WHERE id = ?", [id]);
    },
    
    list(options = {}) {
        let sql = `
            SELECT c.*, l.name as lead_name, l.phone, l.vehicle, u.name as agent_name
            FROM conversations c
            LEFT JOIN leads l ON c.lead_id = l.id
            LEFT JOIN users u ON c.assigned_to = u.id
            WHERE 1=1
        `;
        const params = [];
        
        if (options.status) {
            sql += ' AND c.status = ?';
            params.push(options.status);
        }
        
        if (options.assigned_to) {
            sql += ' AND c.assigned_to = ?';
            params.push(options.assigned_to);
        }
        
        if (options.session_id) {
            sql += ' AND c.session_id = ?';
            params.push(options.session_id);
        }
        
        sql += ' ORDER BY c.updated_at DESC';
        
        if (options.limit) {
            sql += ' LIMIT ?';
            params.push(options.limit);
        }
        
        return query(sql, params);
    }
};

// ============================================
// MESSAGES
// ============================================

const Message = {
    create(data) {
        const uuid = generateUUID();
        
        const result = run(`
            INSERT INTO messages (uuid, message_id, conversation_id, lead_id, sender_type, sender_id, content, content_encrypted, media_type, media_url, media_mime_type, media_filename, status, is_from_me, reply_to_id, metadata, sent_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            uuid,
            data.message_id,
            data.conversation_id,
            data.lead_id,
            data.sender_type || (data.is_from_me ? 'agent' : 'lead'),
            data.sender_id,
            data.content,
            data.content_encrypted,
            data.media_type || 'text',
            data.media_url,
            data.media_mime_type,
            data.media_filename,
            data.status || 'pending',
            data.is_from_me ? 1 : 0,
            data.reply_to_id,
            JSON.stringify(data.metadata || {}),
            data.sent_at || new Date().toISOString()
        ]);
        
        return { id: result.lastInsertRowid, uuid };
    },
    
    findById(id) {
        return queryOne('SELECT * FROM messages WHERE id = ?', [id]);
    },
    
    findByMessageId(messageId) {
        return queryOne('SELECT * FROM messages WHERE message_id = ?', [messageId]);
    },
    
    updateStatus(messageId, status, timestamp = null) {
        const updates = { status };
        
        if (status === 'delivered' && timestamp) {
            updates.delivered_at = timestamp;
        } else if (status === 'read' && timestamp) {
            updates.read_at = timestamp;
        }
        
        const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
        const values = [...Object.values(updates), messageId];
        
        return run(`UPDATE messages SET ${fields} WHERE message_id = ?`, values);
    },
    
    listByConversation(conversationId, options = {}) {
        let sql = 'SELECT * FROM messages WHERE conversation_id = ?';
        const params = [conversationId];
        
        sql += ' ORDER BY created_at ASC';
        
        if (options.limit) {
            sql += ' LIMIT ?';
            params.push(options.limit);
        }
        
        if (options.offset) {
            sql += ' OFFSET ?';
            params.push(options.offset);
        }
        
        return query(sql, params);
    },
    
    listByLead(leadId, options = {}) {
        let sql = 'SELECT * FROM messages WHERE lead_id = ?';
        const params = [leadId];
        
        sql += ' ORDER BY created_at ASC';
        
        if (options.limit) {
            sql += ' LIMIT ?';
            params.push(options.limit);
        }
        
        return query(sql, params);
    },
    
    getLastMessage(conversationId) {
        return queryOne('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1', [conversationId]);
    }
};

// ============================================
// TEMPLATES
// ============================================

const Template = {
    create(data) {
        const uuid = generateUUID();
        
        const result = run(`
            INSERT INTO templates (uuid, name, category, content, variables, media_url, media_type, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            uuid,
            data.name,
            data.category || 'general',
            data.content,
            JSON.stringify(data.variables || ['nome', 'veiculo', 'placa']),
            data.media_url,
            data.media_type,
            data.created_by
        ]);
        
        return { id: result.lastInsertRowid, uuid };
    },
    
    findById(id) {
        return queryOne('SELECT * FROM templates WHERE id = ?', [id]);
    },
    
    list(options = {}) {
        let sql = 'SELECT * FROM templates WHERE is_active = 1';
        const params = [];
        
        if (options.category) {
            sql += ' AND category = ?';
            params.push(options.category);
        }
        
        sql += ' ORDER BY usage_count DESC, name ASC';
        
        return query(sql, params);
    },
    
    incrementUsage(id) {
        return run('UPDATE templates SET usage_count = usage_count + 1 WHERE id = ?', [id]);
    },
    
    update(id, data) {
        const fields = [];
        const values = [];
        
        const allowedFields = ['name', 'category', 'content', 'variables', 'media_url', 'media_type', 'is_active'];
        
        for (const [key, value] of Object.entries(data)) {
            if (allowedFields.includes(key)) {
                fields.push(`${key} = ?`);
                values.push(typeof value === 'object' ? JSON.stringify(value) : value);
            }
        }
        
        if (fields.length === 0) return null;
        
        fields.push("updated_at = datetime('now')");
        values.push(id);
        
        return run(`UPDATE templates SET ${fields.join(', ')} WHERE id = ?`, values);
    },
    
    delete(id) {
        return run('UPDATE templates SET is_active = 0 WHERE id = ?', [id]);
    }
};

// ============================================
// FLOWS
// ============================================

const Flow = {
    create(data) {
        const uuid = generateUUID();
        
        const result = run(`
            INSERT INTO flows (uuid, name, description, trigger_type, trigger_value, nodes, edges, is_active, priority, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            uuid,
            data.name,
            data.description,
            data.trigger_type,
            data.trigger_value,
            JSON.stringify(data.nodes || []),
            JSON.stringify(data.edges || []),
            data.is_active !== undefined ? data.is_active : 1,
            data.priority || 0,
            data.created_by
        ]);
        
        return { id: result.lastInsertRowid, uuid };
    },
    
    findById(id) {
        const flow = queryOne('SELECT * FROM flows WHERE id = ?', [id]);
        if (flow) {
            flow.nodes = JSON.parse(flow.nodes || '[]');
            flow.edges = JSON.parse(flow.edges || '[]');
        }
        return flow;
    },
    
    findByTrigger(triggerType, triggerValue = null) {
        let sql = 'SELECT * FROM flows WHERE trigger_type = ? AND is_active = 1';
        const params = [triggerType];
        
        if (triggerValue) {
            sql += ' AND (trigger_value = ? OR trigger_value IS NULL)';
            params.push(triggerValue);
        }
        
        sql += ' ORDER BY priority DESC LIMIT 1';
        
        const flow = queryOne(sql, params);
        if (flow) {
            flow.nodes = JSON.parse(flow.nodes || '[]');
            flow.edges = JSON.parse(flow.edges || '[]');
        }
        return flow;
    },
    
    findByKeyword(keyword) {
        const flows = query(`
            SELECT * FROM flows 
            WHERE trigger_type = 'keyword' AND is_active = 1
            ORDER BY priority DESC
        `);
        
        for (const flow of flows) {
            const keywords = flow.trigger_value?.split(',').map(k => k.trim().toLowerCase()) || [];
            if (keywords.includes(keyword.toLowerCase())) {
                flow.nodes = JSON.parse(flow.nodes || '[]');
                flow.edges = JSON.parse(flow.edges || '[]');
                return flow;
            }
        }
        
        return null;
    },
    
    list(options = {}) {
        let sql = 'SELECT * FROM flows WHERE 1=1';
        const params = [];
        
        if (options.is_active !== undefined) {
            sql += ' AND is_active = ?';
            params.push(options.is_active);
        }
        
        sql += ' ORDER BY priority DESC, name ASC';
        
        return query(sql, params).map(flow => ({
            ...flow,
            nodes: JSON.parse(flow.nodes || '[]'),
            edges: JSON.parse(flow.edges || '[]')
        }));
    },
    
    update(id, data) {
        const fields = [];
        const values = [];
        
        const allowedFields = ['name', 'description', 'trigger_type', 'trigger_value', 'nodes', 'edges', 'is_active', 'priority'];
        
        for (const [key, value] of Object.entries(data)) {
            if (allowedFields.includes(key)) {
                fields.push(`${key} = ?`);
                values.push(typeof value === 'object' ? JSON.stringify(value) : value);
            }
        }
        
        if (fields.length === 0) return null;
        
        fields.push("updated_at = datetime('now')");
        values.push(id);
        
        return run(`UPDATE flows SET ${fields.join(', ')} WHERE id = ?`, values);
    },
    
    delete(id) {
        return run('DELETE FROM flows WHERE id = ?', [id]);
    }
};

// ============================================
// MESSAGE QUEUE
// ============================================

const MessageQueue = {
    add(data) {
        const uuid = generateUUID();
        
        const result = run(`
            INSERT INTO message_queue (uuid, lead_id, conversation_id, content, media_type, media_url, priority, scheduled_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            uuid,
            data.lead_id,
            data.conversation_id,
            data.content,
            data.media_type || 'text',
            data.media_url,
            data.priority || 0,
            data.scheduled_at
        ]);
        
        return { id: result.lastInsertRowid, uuid };
    },
    
    getNext() {
        return queryOne(`
            SELECT * FROM message_queue 
            WHERE status = 'pending' 
            AND (scheduled_at IS NULL OR scheduled_at <= datetime('now'))
            AND attempts < max_attempts
            ORDER BY priority DESC, created_at ASC
            LIMIT 1
        `);
    },
    
    markProcessing(id) {
        return run(`
            UPDATE message_queue 
            SET status = 'processing', attempts = attempts + 1 
            WHERE id = ?
        `, [id]);
    },
    
    markSent(id) {
        return run(`
            UPDATE message_queue 
            SET status = 'sent', processed_at = datetime('now') 
            WHERE id = ?
        `, [id]);
    },
    
    markFailed(id, errorMessage) {
        return run(`
            UPDATE message_queue 
            SET status = CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'pending' END,
                error_message = ?
            WHERE id = ?
        `, [errorMessage, id]);
    },
    
    cancel(id) {
        return run(`UPDATE message_queue SET status = 'cancelled' WHERE id = ?`, [id]);
    },
    
    getPending() {
        return query(`
            SELECT * FROM message_queue 
            WHERE status = 'pending' 
            ORDER BY priority DESC, created_at ASC
        `);
    }
};

// ============================================
// WEBHOOKS
// ============================================

const Webhook = {
    create(data) {
        const uuid = generateUUID();
        
        const result = run(`
            INSERT INTO webhooks (uuid, name, url, secret, events, headers, is_active, retry_count, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            uuid,
            data.name,
            data.url,
            data.secret,
            JSON.stringify(data.events || []),
            JSON.stringify(data.headers || {}),
            data.is_active !== undefined ? data.is_active : 1,
            data.retry_count || 3,
            data.created_by
        ]);
        
        return { id: result.lastInsertRowid, uuid };
    },
    
    findById(id) {
        return queryOne('SELECT * FROM webhooks WHERE id = ?', [id]);
    },
    
    findByEvent(event) {
        return query(`
            SELECT * FROM webhooks 
            WHERE is_active = 1 AND events LIKE ?
        `, [`%"${event}"%`]);
    },
    
    list() {
        return query('SELECT * FROM webhooks ORDER BY name ASC');
    },
    
    update(id, data) {
        const fields = [];
        const values = [];
        
        const allowedFields = ['name', 'url', 'secret', 'events', 'headers', 'is_active', 'retry_count'];
        
        for (const [key, value] of Object.entries(data)) {
            if (allowedFields.includes(key)) {
                fields.push(`${key} = ?`);
                values.push(typeof value === 'object' ? JSON.stringify(value) : value);
            }
        }
        
        if (fields.length === 0) return null;
        
        fields.push("updated_at = datetime('now')");
        values.push(id);
        
        return run(`UPDATE webhooks SET ${fields.join(', ')} WHERE id = ?`, values);
    },
    
    logTrigger(webhookId, event, payload, responseStatus, responseBody, durationMs) {
        return run(`
            INSERT INTO webhook_logs (webhook_id, event, payload, response_status, response_body, duration_ms)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [webhookId, event, JSON.stringify(payload), responseStatus, responseBody, durationMs]);
    },
    
    delete(id) {
        return run('DELETE FROM webhooks WHERE id = ?', [id]);
    }
};

// ============================================
// SETTINGS
// ============================================

const Settings = {
    get(key) {
        const setting = queryOne('SELECT * FROM settings WHERE key = ?', [key]);
        if (!setting) return null;
        
        switch (setting.type) {
            case 'number':
                return parseFloat(setting.value);
            case 'boolean':
                return setting.value === 'true';
            case 'json':
                return JSON.parse(setting.value);
            default:
                return setting.value;
        }
    },
    
    set(key, value, type = 'string') {
        const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
        
        return run(`
            INSERT INTO settings (key, value, type, updated_at) 
            VALUES (?, ?, ?, datetime('now'))
            ON CONFLICT(key) DO UPDATE SET value = ?, type = ?, updated_at = datetime('now')
        `, [key, stringValue, type, stringValue, type]);
    },
    
    getAll() {
        const settings = query('SELECT * FROM settings');
        const result = {};
        
        for (const setting of settings) {
            switch (setting.type) {
                case 'number':
                    result[setting.key] = parseFloat(setting.value);
                    break;
                case 'boolean':
                    result[setting.key] = setting.value === 'true';
                    break;
                case 'json':
                    result[setting.key] = JSON.parse(setting.value);
                    break;
                default:
                    result[setting.key] = setting.value;
            }
        }
        
        return result;
    }
};

// ============================================
// USERS
// ============================================

const User = {
    create(data) {
        const uuid = generateUUID();
        
        const result = run(`
            INSERT INTO users (uuid, name, email, password_hash, role, avatar_url)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [
            uuid,
            data.name,
            data.email,
            data.password_hash,
            data.role || 'agent',
            data.avatar_url
        ]);
        
        return { id: result.lastInsertRowid, uuid };
    },
    
    findById(id) {
        return queryOne('SELECT id, uuid, name, email, role, avatar_url, is_active, last_login_at, created_at FROM users WHERE id = ?', [id]);
    },
    
    findByEmail(email) {
        return queryOne('SELECT * FROM users WHERE email = ?', [email]);
    },
    
    updateLastLogin(id) {
        return run("UPDATE users SET last_login_at = datetime('now') WHERE id = ?", [id]);
    },
    
    list() {
        return query('SELECT id, uuid, name, email, role, avatar_url, is_active, last_login_at, created_at FROM users WHERE is_active = 1 ORDER BY name ASC');
    }
};

module.exports = {
    Lead,
    Conversation,
    Message,
    Template,
    Flow,
    MessageQueue,
    Webhook,
    Settings,
    User
};
