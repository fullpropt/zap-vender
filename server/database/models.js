/**
 * SELF PROTEÇÃO VEICULAR - Modelos de Dados
 * Funções CRUD para todas as entidades do sistema
 */

const { query, queryOne, run, transaction, generateUUID } = require('./connection');

function normalizeDigits(value) {
    return String(value || '').replace(/\D/g, '');
}

function sanitizeLeadName(name) {
    const value = String(name || '').trim();
    if (!value) return '';
    const lower = value.toLowerCase();
    if (
        lower === 'sem nome' ||
        lower === 'unknown' ||
        lower === 'undefined' ||
        lower === 'null' ||
        value.includes('@s.whatsapp.net') ||
        value.includes('@lid')
    ) {
        return '';
    }
    if (/^\d+$/.test(value)) return '';
    return value;
}

function parseLeadCustomFields(value) {
    if (!value) return {};

    if (typeof value === 'object') {
        return Array.isArray(value) ? {} : { ...value };
    }

    if (typeof value !== 'string') return {};

    try {
        const parsed = JSON.parse(value);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return {};
        }
        return parsed;
    } catch (_) {
        return {};
    }
}

function mergeLeadCustomFields(baseValue, overrideValue) {
    const base = parseLeadCustomFields(baseValue);
    const override = parseLeadCustomFields(overrideValue);
    const merged = { ...base, ...override };

    const baseSystem = base.__system && typeof base.__system === 'object' && !Array.isArray(base.__system)
        ? base.__system
        : {};
    const overrideSystem = override.__system && typeof override.__system === 'object' && !Array.isArray(override.__system)
        ? override.__system
        : {};

    if (Object.keys(baseSystem).length > 0 || Object.keys(overrideSystem).length > 0) {
        merged.__system = { ...baseSystem, ...overrideSystem };
    }

    return merged;
}

function lockLeadNameAsManual(customFields) {
    const merged = mergeLeadCustomFields(customFields);
    const currentSystem = merged.__system && typeof merged.__system === 'object' && !Array.isArray(merged.__system)
        ? merged.__system
        : {};

    merged.__system = {
        ...currentSystem,
        manual_name_locked: true,
        manual_name_source: 'manual',
        manual_name_updated_at: new Date().toISOString()
    };

    return merged;
}

function isLeadNameManuallyLocked(customFields) {
    const parsed = parseLeadCustomFields(customFields);
    return parsed?.__system?.manual_name_locked === true;
}

function shouldReplaceLeadName(currentName, incomingName, phone, options = {}) {
    if (options.manualNameLocked) return false;

    const next = sanitizeLeadName(incomingName);
    if (!next) return false;

    const current = String(currentName || '').trim();
    if (!current) return true;

    const currentLower = current.toLowerCase();
    if (
        currentLower === 'sem nome' ||
        currentLower === 'unknown' ||
        currentLower === 'undefined' ||
        currentLower === 'null' ||
        currentLower === 'você' ||
        currentLower === 'voce' ||
        currentLower === 'usuário (você)' ||
        currentLower === 'usuario (voce)' ||
        currentLower === 'usuario (você)'
    ) {
        return true;
    }

    const phoneDigits = normalizeDigits(phone);
    const currentDigits = normalizeDigits(current);
    if (phoneDigits && currentDigits && currentDigits === phoneDigits) return true;
    if (/^\d+$/.test(current)) return true;

    return false;
}

function deriveUserName(name, email) {
    const provided = String(name || '').trim();
    if (provided) return provided;

    const localPart = String(email || '').split('@')[0] || 'Usuario';
    const normalized = localPart.replace(/[._-]+/g, ' ').trim();
    if (!normalized) return 'Usuario';

    return normalized
        .split(/\s+/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function normalizeTagValue(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeTagKey(value) {
    return normalizeTagValue(value).toLowerCase();
}

function normalizeCustomEventName(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 100);
}

function normalizeCustomEventKey(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .replace(/_+/g, '_')
        .slice(0, 80);
}

function buildCustomEventKey(name) {
    const fromName = normalizeCustomEventKey(name);
    if (fromName) return fromName;
    return `evento_${Date.now()}`;
}

function parseTagList(rawValue) {
    if (!rawValue) return [];

    if (Array.isArray(rawValue)) {
        return rawValue
            .map(normalizeTagValue)
            .filter(Boolean);
    }

    const raw = String(rawValue).trim();
    if (!raw) return [];

    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return parsed
                .map(normalizeTagValue)
                .filter(Boolean);
        }
    } catch (_) {
        // fallback para lista separada por delimitadores
    }

    return raw
        .split(/[,;|]/)
        .map(normalizeTagValue)
        .filter(Boolean);
}

function uniqueTags(list) {
    const seen = new Set();
    const result = [];

    for (const tag of list.map(normalizeTagValue).filter(Boolean)) {
        const key = normalizeTagKey(tag);
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(tag);
    }

    return result;
}

function normalizeFlowKeywordText(value = '') {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function extractFlowKeywords(value = '') {
    return String(value || '')
        .split(',')
        .map((keyword) => normalizeFlowKeywordText(keyword))
        .filter(Boolean);
}

function includesFlowKeyword(normalizedMessage, normalizedKeyword) {
    if (!normalizedMessage || !normalizedKeyword) return false;
    return ` ${normalizedMessage} `.includes(` ${normalizedKeyword} `);
}

function scoreFlowKeywordMatch(matchedKeywords = [], priority = 0) {
    const longestMatchWords = matchedKeywords.reduce((max, keyword) => {
        return Math.max(max, keyword.split(' ').length);
    }, 0);

    const longestMatchLength = matchedKeywords.reduce((max, keyword) => {
        return Math.max(max, keyword.length);
    }, 0);

    return {
        longestMatchWords,
        longestMatchLength,
        matchedCount: matchedKeywords.length,
        priority: Number(priority) || 0
    };
}

function compareFlowKeywordScoreDesc(a, b) {
    if (a.longestMatchWords !== b.longestMatchWords) {
        return b.longestMatchWords - a.longestMatchWords;
    }

    if (a.longestMatchLength !== b.longestMatchLength) {
        return b.longestMatchLength - a.longestMatchLength;
    }

    if (a.matchedCount !== b.matchedCount) {
        return b.matchedCount - a.matchedCount;
    }

    if (a.priority !== b.priority) {
        return b.priority - a.priority;
    }

    return 0;
}

function toJsonStringOrNull(value) {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed || null;
    }
    try {
        return JSON.stringify(value);
    } catch (_) {
        return null;
    }
}

function parseNonNegativeInteger(value, fallback = 0) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    const normalized = Math.floor(num);
    return normalized >= 0 ? normalized : fallback;
}

function parsePositiveInteger(value, fallback = null) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    const normalized = Math.floor(num);
    return normalized > 0 ? normalized : fallback;
}

function normalizeBooleanFlag(value, fallback = 1) {
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'number') return value > 0 ? 1 : 0;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['1', 'true', 'yes', 'sim', 'on'].includes(normalized)) return 1;
        if (['0', 'false', 'no', 'nao', 'não', 'off'].includes(normalized)) return 0;
    }
    return fallback;
}

// ============================================
// LEADS
// ============================================

const Lead = {
    async create(data) {
        const uuid = generateUUID();
        const jid = data.jid || `55${data.phone.replace(/\D/g, '')}@s.whatsapp.net`;
        const source = String(data.source || 'manual');
        const normalizedSource = source.toLowerCase();
        const sanitizedName = sanitizeLeadName(data.name);
        const incomingName = sanitizedName || data.phone;
        const initialCustomFields = parseLeadCustomFields(data.custom_fields);
        const customFields = normalizedSource !== 'whatsapp' && sanitizedName
            ? lockLeadNameAsManual(initialCustomFields)
            : initialCustomFields;
        
        const result = await run(`
            INSERT INTO leads (uuid, phone, phone_formatted, jid, name, email, vehicle, plate, status, tags, custom_fields, source, assigned_to)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            uuid,
            data.phone?.replace(/\D/g, ''),
            data.phone_formatted || data.phone,
            jid,
            incomingName,
            data.email,
            data.vehicle,
            data.plate,
            data.status || 1,
            JSON.stringify(data.tags || []),
            JSON.stringify(customFields),
            source,
            data.assigned_to
        ]);
        
        return { id: result.lastInsertRowid, uuid };
    },
    
    async findById(id) {
        return await queryOne('SELECT * FROM leads WHERE id = ?', [id]);
    },
    
    async findByUuid(uuid) {
        return await queryOne('SELECT * FROM leads WHERE uuid = ?', [uuid]);
    },
    
    async findByPhone(phone) {
        const cleaned = normalizeDigits(phone);
        if (!cleaned) return null;

        const suffixLength = Math.min(cleaned.length, 11);
        const suffix = cleaned.slice(-suffixLength);

        return await queryOne(
            `
            SELECT *
            FROM leads
            WHERE phone = ?
               OR phone LIKE ?
               OR (? <> '' AND substr(phone, length(phone) - ${suffixLength} + 1) = ?)
            ORDER BY
                CASE
                    WHEN phone = ? THEN 0
                    WHEN phone LIKE ? THEN 1
                    WHEN (? <> '' AND substr(phone, length(phone) - ${suffixLength} + 1) = ?) THEN 2
                    ELSE 3
                END,
                CASE WHEN jid LIKE '%@s.whatsapp.net' THEN 0 ELSE 1 END,
                COALESCE(last_message_at, updated_at, created_at) DESC,
                id DESC
            LIMIT 1
            `,
            [cleaned, `%${cleaned}`, suffix, suffix, cleaned, `%${cleaned}`, suffix, suffix]
        );
    },
    
    async findByJid(jid) {
        return await queryOne('SELECT * FROM leads WHERE jid = ?', [jid]);
    },
    
    async findOrCreate(data) {
        let lead = null;
        if (data.jid) {
            lead = await this.findByJid(data.jid);
        }
        if (!lead) {
            lead = await this.findByPhone(data.phone);
        }
        
        if (lead) {
            // Atualizar dados se necessario
            const nextName = sanitizeLeadName(data.name);
            const manualNameLocked = isLeadNameManuallyLocked(lead.custom_fields);
            if (shouldReplaceLeadName(lead.name, nextName, lead.phone || data.phone, { manualNameLocked })) {
                await this.update(lead.id, { name: nextName });
                lead.name = nextName;
            }

            const requestedAssignee = Number(data?.assigned_to);
            if (
                Number.isInteger(requestedAssignee)
                && requestedAssignee > 0
                && (!Number.isInteger(Number(lead.assigned_to)) || Number(lead.assigned_to) <= 0)
            ) {
                await this.update(lead.id, { assigned_to: requestedAssignee });
                lead.assigned_to = requestedAssignee;
            }
            return { lead, created: false };
        }
        
        const result = await this.create(data);
        return { lead: await this.findById(result.id), created: true };
    },
    
    async update(id, data) {
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
        
        fields.push("updated_at = CURRENT_TIMESTAMP");
        values.push(id);
        
        return await run(`UPDATE leads SET ${fields.join(', ')} WHERE id = ?`, values);
    },
    
    async delete(id) {
        return await transaction(async (client) => {
            await client.query('DELETE FROM message_queue WHERE lead_id = $1', [id]);
            await client.query('DELETE FROM flow_executions WHERE lead_id = $1', [id]);
            await client.query('DELETE FROM messages WHERE lead_id = $1', [id]);

            const result = await client.query('DELETE FROM leads WHERE id = $1', [id]);
            return {
                lastInsertRowid: null,
                changes: result.rowCount
            };
        });
    },
    
    async list(options = {}) {
        let sql = `
            SELECT
                leads.*,
                (
                    SELECT c.session_id
                    FROM conversations c
                    WHERE c.lead_id = leads.id
                    ORDER BY COALESCE(c.updated_at, c.created_at) DESC, c.id DESC
                    LIMIT 1
                ) AS session_id,
                (
                    SELECT COALESCE(NULLIF(TRIM(ws.name), ''), NULLIF(TRIM(ws.phone), ''), c.session_id)
                    FROM conversations c
                    LEFT JOIN whatsapp_sessions ws ON ws.session_id = c.session_id
                    WHERE c.lead_id = leads.id
                    ORDER BY COALESCE(c.updated_at, c.created_at) DESC, c.id DESC
                    LIMIT 1
                ) AS session_label
            FROM leads
            WHERE 1=1
        `;
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

        if (options.session_id) {
            sql += ' AND EXISTS (SELECT 1 FROM conversations c WHERE c.lead_id = leads.id AND c.session_id = ?)';
            params.push(String(options.session_id).trim());
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
        
        return await query(sql, params);
    },
    
    async count(options = {}) {
        let sql = 'SELECT COUNT(*) as total FROM leads WHERE 1=1';
        const params = [];
        
        if (options.status) {
            sql += ' AND status = ?';
            params.push(options.status);
        }

        if (options.assigned_to) {
            sql += ' AND assigned_to = ?';
            params.push(options.assigned_to);
        }

        if (options.session_id) {
            sql += ' AND EXISTS (SELECT 1 FROM conversations c WHERE c.lead_id = leads.id AND c.session_id = ?)';
            params.push(String(options.session_id).trim());
        }
        
        return await queryOne(sql, params)?.total || 0;
    }
};

// ============================================
// CONVERSATIONS
// ============================================

const Conversation = {
    async create(data) {
        const uuid = generateUUID();
        
        const result = await run(`
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
    
    async findById(id) {
        return await queryOne('SELECT * FROM conversations WHERE id = ?', [id]);
    },
    
    async findByLeadId(leadId, sessionId = null) {
        const normalizedSessionId = String(sessionId || '').trim();
        if (normalizedSessionId) {
            return await queryOne(
                'SELECT * FROM conversations WHERE lead_id = ? AND session_id = ? ORDER BY updated_at DESC LIMIT 1',
                [leadId, normalizedSessionId]
            );
        }
        return await queryOne('SELECT * FROM conversations WHERE lead_id = ? ORDER BY updated_at DESC LIMIT 1', [leadId]);
    },
    
    async findOrCreate(data) {
        const normalizedSessionId = String(data.session_id || '').trim();
        let conversation = await this.findByLeadId(data.lead_id, normalizedSessionId || null);
        
        if (conversation) {
            return { conversation, created: false };
        }

        let assignedTo = Number(data?.assigned_to);
        if (!Number.isInteger(assignedTo) || assignedTo <= 0) {
            const lead = await Lead.findById(data.lead_id);
            const leadAssignedTo = Number(lead?.assigned_to);
            assignedTo = Number.isInteger(leadAssignedTo) && leadAssignedTo > 0 ? leadAssignedTo : null;
        }
        
        const result = await this.create({
            ...data,
            assigned_to: assignedTo
        });
        return { conversation: await this.findById(result.id), created: true };
    },
    
    async update(id, data) {
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
        
        fields.push("updated_at = CURRENT_TIMESTAMP");
        values.push(id);
        
        return await run(`UPDATE conversations SET ${fields.join(', ')} WHERE id = ?`, values);
    },
    
    async incrementUnread(id) {
        return await run("UPDATE conversations SET unread_count = unread_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [id]);
    },
    
    async touch(id, lastMessageId = null, sentAt = null) {
        const updates = [];
        const params = [];

        if (lastMessageId) {
            updates.push('last_message_id = ?');
            params.push(lastMessageId);
        }

        if (sentAt) {
            updates.push('updated_at = ?');
            params.push(sentAt);
        } else {
            updates.push('updated_at = CURRENT_TIMESTAMP');
        }

        params.push(id);
        return await run(`UPDATE conversations SET ${updates.join(', ')} WHERE id = ?`, params);
    },
    
    async markAsRead(id) {
        return await run("UPDATE conversations SET unread_count = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [id]);
    },
    
    async list(options = {}) {
        let sql = `
            SELECT c.*, l.name as lead_name, l.phone, l.vehicle, l.custom_fields as lead_custom_fields, u.name as agent_name
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
        
        return await query(sql, params);
    }
};

// ============================================
// MESSAGES
// ============================================

const Message = {
    async create(data) {
        const uuid = generateUUID();
        
        const result = await run(`
            INSERT INTO messages (uuid, message_id, conversation_id, lead_id, sender_type, sender_id, content, content_encrypted, media_type, media_url, media_mime_type, media_filename, status, is_from_me, reply_to_id, campaign_id, metadata, sent_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            data.campaign_id || null,
            JSON.stringify(data.metadata || {}),
            data.sent_at || new Date().toISOString()
        ]);
        
        return { id: result.lastInsertRowid, uuid };
    },
    
    async findById(id) {
        return await queryOne('SELECT * FROM messages WHERE id = ?', [id]);
    },
    
    async findByMessageId(messageId) {
        return await queryOne('SELECT * FROM messages WHERE message_id = ?', [messageId]);
    },
    
    async updateStatus(messageId, status, timestamp = null) {
        const updates = { status };
        
        if (status === 'delivered' && timestamp) {
            updates.delivered_at = timestamp;
        } else if (status === 'read' && timestamp) {
            updates.read_at = timestamp;
        }
        
        const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
        const values = [...Object.values(updates), messageId];
        
        return await run(`UPDATE messages SET ${fields} WHERE message_id = ?`, values);
    },
    
    async listByConversation(conversationId, options = {}) {
        let sql = 'SELECT * FROM messages WHERE conversation_id = ?';
        const params = [conversationId];
        
        sql += " ORDER BY COALESCE(sent_at, created_at) ASC, id ASC";
        
        if (options.limit) {
            sql += ' LIMIT ?';
            params.push(options.limit);
        }
        
        if (options.offset) {
            sql += ' OFFSET ?';
            params.push(options.offset);
        }
        
        return await query(sql, params);
    },
    
    async listByLead(leadId, options = {}) {
        let sql = 'SELECT * FROM messages WHERE lead_id = ?';
        const params = [leadId];
        
        sql += " ORDER BY COALESCE(sent_at, created_at) ASC, id ASC";
        
        if (options.limit) {
            sql += ' LIMIT ?';
            params.push(options.limit);
        }
        
        return await query(sql, params);
    },

    async getLastByLead(leadId) {
        return await queryOne("SELECT * FROM messages WHERE lead_id = ? ORDER BY COALESCE(sent_at, created_at) DESC, id DESC LIMIT 1", [leadId]);
    },
    
    async getLastMessage(conversationId) {
        return await queryOne("SELECT * FROM messages WHERE conversation_id = ? ORDER BY COALESCE(sent_at, created_at) DESC, id DESC LIMIT 1", [conversationId]);
    },

    async hasCampaignDelivery(campaignId, leadId) {
        const row = await queryOne(`
            SELECT id
            FROM messages
            WHERE campaign_id = ?
              AND lead_id = ?
              AND is_from_me = 1
            LIMIT 1
        `, [campaignId, leadId]);
        return !!row;
    }
};

// ============================================
// TEMPLATES
// ============================================

const Template = {
    async create(data) {
        const uuid = generateUUID();
        
        const result = await run(`
            INSERT INTO templates (uuid, name, category, content, variables, media_url, media_type, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            uuid,
            data.name,
            data.category || 'general',
            data.content,
            JSON.stringify(data.variables || ['nome', 'telefone', 'email']),
            data.media_url,
            data.media_type,
            data.created_by
        ]);
        
        return { id: result.lastInsertRowid, uuid };
    },
    
    async findById(id) {
        return await queryOne('SELECT * FROM templates WHERE id = ?', [id]);
    },
    
    async list(options = {}) {
        let sql = 'SELECT * FROM templates WHERE is_active = 1';
        const params = [];
        
        if (options.category) {
            sql += ' AND category = ?';
            params.push(options.category);
        }

        if (options.created_by) {
            sql += ' AND created_by = ?';
            params.push(options.created_by);
        }
        
        sql += ' ORDER BY usage_count DESC, name ASC';
        
        return await query(sql, params);
    },
    
    async incrementUsage(id) {
        return await run('UPDATE templates SET usage_count = usage_count + 1 WHERE id = ?', [id]);
    },
    
    async update(id, data) {
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
        
        fields.push("updated_at = CURRENT_TIMESTAMP");
        values.push(id);
        
        return await run(`UPDATE templates SET ${fields.join(', ')} WHERE id = ?`, values);
    },
    
    async delete(id) {
        return await run('UPDATE templates SET is_active = 0 WHERE id = ?', [id]);
    }
};

// ============================================
// CAMPAIGNS
// ============================================

const Campaign = {
    async create(data) {
        const uuid = generateUUID();

        const result = await run(`
            INSERT INTO campaigns (
                uuid, name, description, type, distribution_strategy, distribution_config,
                status, segment, tag_filter, message, delay, delay_min, delay_max, start_at, created_by
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            uuid,
            data.name,
            data.description,
            data.type || 'broadcast',
            String(data.distribution_strategy || 'single').trim() || 'single',
            toJsonStringOrNull(data.distribution_config),
            data.status || 'draft',
            data.segment,
            data.tag_filter || null,
            data.message,
            data.delay || data.delay_min || 0,
            data.delay_min || data.delay || 0,
            data.delay_max || data.delay_min || data.delay || 0,
            data.start_at,
            data.created_by
        ]);

        return { id: result.lastInsertRowid, uuid };
    },

    async findById(id) {
        return await queryOne('SELECT * FROM campaigns WHERE id = ?', [id]);
    },

    async list(options = {}) {
        let sql = 'SELECT * FROM campaigns WHERE 1=1';
        const params = [];

        if (options.status) {
            sql += ' AND status = ?';
            params.push(options.status);
        }

        if (options.type) {
            sql += ' AND type = ?';
            params.push(options.type);
        }

        if (options.created_by) {
            sql += ' AND created_by = ?';
            params.push(options.created_by);
        }

        if (options.search) {
            sql += ' AND (name LIKE ? OR description LIKE ?)';
            params.push(`%${options.search}%`, `%${options.search}%`);
        }

        sql += ' ORDER BY created_at DESC';

        if (options.limit) {
            sql += ' LIMIT ?';
            params.push(options.limit);
        }

        if (options.offset) {
            sql += ' OFFSET ?';
            params.push(options.offset);
        }

        return await query(sql, params);
    },

    async update(id, data) {
        const fields = [];
        const values = [];

        const allowedFields = [
            'name', 'description', 'type', 'status', 'segment', 'tag_filter',
            'message', 'delay', 'delay_min', 'delay_max', 'start_at', 'sent', 'delivered', 'read', 'replied',
            'distribution_strategy', 'distribution_config'
        ];

        for (const [key, value] of Object.entries(data)) {
            if (allowedFields.includes(key)) {
                fields.push(`${key} = ?`);
                if (key === 'distribution_strategy') {
                    values.push(String(value || '').trim() || 'single');
                } else if (key === 'distribution_config') {
                    values.push(toJsonStringOrNull(value));
                } else {
                    values.push(value);
                }
            }
        }

        if (fields.length === 0) return null;

        fields.push("updated_at = CURRENT_TIMESTAMP");
        values.push(id);

        return await run(`UPDATE campaigns SET ${fields.join(', ')} WHERE id = ?`, values);
    },

    async refreshMetrics(id) {
        const sentStats = await queryOne(`
            SELECT
                COUNT(*) as sent,
                SUM(CASE WHEN status IN ('delivered', 'read') THEN 1 ELSE 0 END) as delivered,
                SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) as read
            FROM messages
            WHERE campaign_id = ?
        `, [id]);

        const repliedStats = await queryOne(`
            SELECT COUNT(DISTINCT incoming.lead_id) as replied
            FROM messages incoming
            WHERE incoming.is_from_me = 0
              AND EXISTS (
                SELECT 1
                FROM messages outgoing
                WHERE outgoing.campaign_id = ?
                  AND outgoing.is_from_me = 1
                  AND outgoing.lead_id = incoming.lead_id
                  AND COALESCE(outgoing.sent_at, outgoing.created_at) <= COALESCE(incoming.sent_at, incoming.created_at)
              )
        `, [id]);

        const metrics = {
            sent: Number(sentStats?.sent || 0),
            delivered: Number(sentStats?.delivered || 0),
            read: Number(sentStats?.read || 0),
            replied: Number(repliedStats?.replied || 0)
        };

        await run(`
            UPDATE campaigns
            SET sent = ?, delivered = ?, read = ?, replied = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [metrics.sent, metrics.delivered, metrics.read, metrics.replied, id]);

        return metrics;
    },

    async refreshMetricsByLead(leadId) {
        const rows = await query(`
            SELECT DISTINCT campaign_id
            FROM messages
            WHERE lead_id = ? AND campaign_id IS NOT NULL
        `, [leadId]);

        for (const row of rows) {
            await this.refreshMetrics(row.campaign_id);
        }
    },

    async delete(id) {
        return await run('DELETE FROM campaigns WHERE id = ?', [id]);
    }
};

const CampaignSenderAccount = {
    normalizeRows(rows = []) {
        return rows.map((row) => ({
            ...row,
            weight: parseNonNegativeInteger(row.weight, 1) || 1,
            daily_limit: parseNonNegativeInteger(row.daily_limit, 0),
            is_active: normalizeBooleanFlag(row.is_active, 1)
        }));
    },

    async listByCampaignId(campaignId, options = {}) {
        const onlyActive = options.onlyActive !== false;
        const rows = await query(`
            SELECT id, campaign_id, session_id, weight, daily_limit, is_active, created_at, updated_at
            FROM campaign_sender_accounts
            WHERE campaign_id = ?
              ${onlyActive ? 'AND is_active = 1' : ''}
            ORDER BY id ASC
        `, [campaignId]);
        return this.normalizeRows(rows);
    },

    async replaceForCampaign(campaignId, accounts = []) {
        await run('DELETE FROM campaign_sender_accounts WHERE campaign_id = ?', [campaignId]);

        const normalized = [];
        const seen = new Set();

        for (const entry of accounts || []) {
            const sessionId = String(entry?.session_id || entry?.sessionId || '').trim();
            if (!sessionId || seen.has(sessionId)) continue;
            seen.add(sessionId);

            const payload = {
                session_id: sessionId,
                weight: Math.max(1, parseNonNegativeInteger(entry?.weight, 1)),
                daily_limit: parseNonNegativeInteger(entry?.daily_limit ?? entry?.dailyLimit, 0),
                is_active: normalizeBooleanFlag(entry?.is_active ?? entry?.isActive, 1)
            };
            normalized.push(payload);
        }

        for (const account of normalized) {
            await run(`
                INSERT INTO campaign_sender_accounts (campaign_id, session_id, weight, daily_limit, is_active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `, [campaignId, account.session_id, account.weight, account.daily_limit, account.is_active]);
        }

        return this.listByCampaignId(campaignId, { onlyActive: false });
    }
};

const WhatsAppSession = {
    async list(options = {}) {
        const includeDisabled = options.includeDisabled !== false;
        const createdBy = parsePositiveInteger(options.created_by);
        const filters = [];
        const params = [];

        if (createdBy) {
            filters.push('created_by = ?');
            params.push(createdBy);
        }

        if (!includeDisabled) {
            filters.push('COALESCE(campaign_enabled, 1) = 1');
        }

        const rows = await query(`
            SELECT
                id,
                session_id,
                phone,
                name,
                status,
                COALESCE(campaign_enabled, 1) AS campaign_enabled,
                COALESCE(daily_limit, 0) AS daily_limit,
                COALESCE(dispatch_weight, 1) AS dispatch_weight,
                COALESCE(hourly_limit, 0) AS hourly_limit,
                cooldown_until,
                qr_code,
                last_connected_at,
                created_by,
                created_at,
                updated_at
            FROM whatsapp_sessions
            ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
            ORDER BY updated_at DESC, id DESC
        `, params);
        return rows.map((row) => ({
            ...row,
            campaign_enabled: normalizeBooleanFlag(row.campaign_enabled, 1),
            daily_limit: parseNonNegativeInteger(row.daily_limit, 0),
            dispatch_weight: Math.max(1, parseNonNegativeInteger(row.dispatch_weight, 1) || 1),
            hourly_limit: parseNonNegativeInteger(row.hourly_limit, 0),
            created_by: parsePositiveInteger(row.created_by)
        }));
    },

    async findBySessionId(sessionId, options = {}) {
        const normalizedSessionId = String(sessionId || '').trim();
        if (!normalizedSessionId) return null;
        const createdBy = parsePositiveInteger(options.created_by);
        const params = [normalizedSessionId];
        let ownerFilter = '';
        if (createdBy) {
            ownerFilter = ' AND created_by = ?';
            params.push(createdBy);
        }

        const row = await queryOne(`
            SELECT
                id,
                session_id,
                phone,
                name,
                status,
                COALESCE(campaign_enabled, 1) AS campaign_enabled,
                COALESCE(daily_limit, 0) AS daily_limit,
                COALESCE(dispatch_weight, 1) AS dispatch_weight,
                COALESCE(hourly_limit, 0) AS hourly_limit,
                cooldown_until,
                qr_code,
                last_connected_at,
                created_by,
                created_at,
                updated_at
            FROM whatsapp_sessions
            WHERE session_id = ?
            ${ownerFilter}
        `, params);

        if (!row) return null;

        return {
            ...row,
            campaign_enabled: normalizeBooleanFlag(row.campaign_enabled, 1),
            daily_limit: parseNonNegativeInteger(row.daily_limit, 0),
            dispatch_weight: Math.max(1, parseNonNegativeInteger(row.dispatch_weight, 1) || 1),
            hourly_limit: parseNonNegativeInteger(row.hourly_limit, 0),
            created_by: parsePositiveInteger(row.created_by)
        };
    },

    async upsertDispatchConfig(sessionId, data = {}) {
        const normalizedSessionId = String(sessionId || '').trim();
        if (!normalizedSessionId) {
            throw new Error('session_id e obrigatorio');
        }

        const existing = await this.findBySessionId(normalizedSessionId);
        const existingCreatedBy = parsePositiveInteger(existing?.created_by);
        const requestedCreatedBy = parsePositiveInteger(data.created_by);
        if (existingCreatedBy && requestedCreatedBy && existingCreatedBy !== requestedCreatedBy) {
            throw new Error('Sem permissao para atualizar esta sessao');
        }
        const resolvedCreatedBy = existingCreatedBy || requestedCreatedBy || null;
        const resolvedName = Object.prototype.hasOwnProperty.call(data, 'name')
            ? (data.name ? String(data.name).trim().slice(0, 120) : null)
            : (existing?.name || null);
        const campaignEnabled = Object.prototype.hasOwnProperty.call(data, 'campaign_enabled')
            ? normalizeBooleanFlag(data.campaign_enabled, existing?.campaign_enabled ?? 1)
            : (existing?.campaign_enabled ?? 1);
        const dailyLimit = Object.prototype.hasOwnProperty.call(data, 'daily_limit')
            ? parseNonNegativeInteger(data.daily_limit, existing?.daily_limit ?? 0)
            : (existing?.daily_limit ?? 0);
        const dispatchWeight = Object.prototype.hasOwnProperty.call(data, 'dispatch_weight')
            ? Math.max(1, parseNonNegativeInteger(data.dispatch_weight, existing?.dispatch_weight ?? 1) || 1)
            : Math.max(1, parseNonNegativeInteger(existing?.dispatch_weight, 1) || 1);
        const hourlyLimit = Object.prototype.hasOwnProperty.call(data, 'hourly_limit')
            ? parseNonNegativeInteger(data.hourly_limit, existing?.hourly_limit ?? 0)
            : (existing?.hourly_limit ?? 0);
        const cooldownUntil = Object.prototype.hasOwnProperty.call(data, 'cooldown_until')
            ? (data.cooldown_until ? String(data.cooldown_until) : null)
            : (existing?.cooldown_until || null);

        await run(`
            INSERT INTO whatsapp_sessions (
                session_id, name, status, campaign_enabled, daily_limit, dispatch_weight, hourly_limit, cooldown_until, created_by, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT (session_id) DO UPDATE SET
                name = EXCLUDED.name,
                campaign_enabled = EXCLUDED.campaign_enabled,
                daily_limit = EXCLUDED.daily_limit,
                dispatch_weight = EXCLUDED.dispatch_weight,
                hourly_limit = EXCLUDED.hourly_limit,
                cooldown_until = EXCLUDED.cooldown_until,
                created_by = COALESCE(whatsapp_sessions.created_by, EXCLUDED.created_by),
                updated_at = CURRENT_TIMESTAMP
        `, [
            normalizedSessionId,
            resolvedName,
            existing?.status || 'disconnected',
            campaignEnabled,
            dailyLimit,
            dispatchWeight,
            hourlyLimit,
            cooldownUntil,
            resolvedCreatedBy
        ]);

        return this.findBySessionId(normalizedSessionId);
    },

    async deleteBySessionId(sessionId, options = {}) {
        const normalizedSessionId = String(sessionId || '').trim();
        if (!normalizedSessionId) {
            throw new Error('session_id e obrigatorio');
        }

        const requesterCreatedBy = parsePositiveInteger(options.created_by);
        if (requesterCreatedBy) {
            const existing = await this.findBySessionId(normalizedSessionId);
            const owner = parsePositiveInteger(existing?.created_by);
            if (!existing || owner !== requesterCreatedBy) {
                throw new Error('Sem permissao para remover esta sessao');
            }
        }

        await run('DELETE FROM whatsapp_sessions WHERE session_id = ?', [normalizedSessionId]);
        await run('DELETE FROM campaign_sender_accounts WHERE session_id = ?', [normalizedSessionId]);
        return { session_id: normalizedSessionId };
    }
};

// ============================================
// AUTOMATIONS
// ============================================

const Automation = {
    async create(data) {
        const uuid = generateUUID();
        const isActive = typeof data.is_active === 'boolean' ? (data.is_active ? 1 : 0) : (data.is_active ?? 1);

        const result = await run(`
            INSERT INTO automations (uuid, name, description, trigger_type, trigger_value, action_type, action_value, delay, session_scope, is_active, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            uuid,
            data.name,
            data.description,
            data.trigger_type,
            data.trigger_value,
            data.action_type,
            data.action_value,
            data.delay || 0,
            data.session_scope || null,
            isActive,
            data.created_by
        ]);

        return { id: result.lastInsertRowid, uuid };
    },

    async findById(id) {
        return await queryOne('SELECT * FROM automations WHERE id = ?', [id]);
    },

    async list(options = {}) {
        let sql = 'SELECT * FROM automations WHERE 1=1';
        const params = [];

        if (options.is_active !== undefined) {
            sql += ' AND is_active = ?';
            params.push(options.is_active ? 1 : 0);
        }

        if (options.trigger_type) {
            sql += ' AND trigger_type = ?';
            params.push(options.trigger_type);
        }

        if (options.created_by) {
            sql += ' AND created_by = ?';
            params.push(options.created_by);
        }

        if (options.search) {
            sql += ' AND (name LIKE ? OR description LIKE ?)';
            params.push(`%${options.search}%`, `%${options.search}%`);
        }

        sql += ' ORDER BY created_at DESC';

        if (options.limit) {
            sql += ' LIMIT ?';
            params.push(options.limit);
        }

        if (options.offset) {
            sql += ' OFFSET ?';
            params.push(options.offset);
        }

        return await query(sql, params);
    },

    async update(id, data) {
        const fields = [];
        const values = [];

        const allowedFields = [
            'name', 'description', 'trigger_type', 'trigger_value',
            'action_type', 'action_value', 'delay', 'session_scope', 'is_active', 'executions', 'last_execution'
        ];

        for (const [key, value] of Object.entries(data)) {
            if (allowedFields.includes(key)) {
                fields.push(`${key} = ?`);
                if (key === 'is_active' && typeof value === 'boolean') {
                    values.push(value ? 1 : 0);
                } else {
                    values.push(value);
                }
            }
        }

        if (fields.length === 0) return null;

        fields.push("updated_at = CURRENT_TIMESTAMP");
        values.push(id);

        return await run(`UPDATE automations SET ${fields.join(', ')} WHERE id = ?`, values);
    },

    async delete(id) {
        return await run('DELETE FROM automations WHERE id = ?', [id]);
    }
};

// ============================================
// FLOWS
// ============================================

const Flow = {
    async create(data) {
        const uuid = generateUUID();
        
        const result = await run(`
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
    
    async findById(id) {
        const flow = await queryOne('SELECT * FROM flows WHERE id = ?', [id]);
        if (flow) {
            flow.nodes = JSON.parse(flow.nodes || '[]');
            flow.edges = JSON.parse(flow.edges || '[]');
        }
        return flow;
    },
    
    async findByTrigger(triggerType, triggerValue = null) {
        let sql = 'SELECT * FROM flows WHERE trigger_type = ? AND is_active = 1';
        const params = [triggerType];
        
        if (triggerValue) {
            sql += ' AND (trigger_value = ? OR trigger_value IS NULL)';
            params.push(triggerValue);
        }
        
        sql += ' ORDER BY priority DESC LIMIT 1';
        
        const flow = await queryOne(sql, params);
        if (flow) {
            flow.nodes = JSON.parse(flow.nodes || '[]');
            flow.edges = JSON.parse(flow.edges || '[]');
        }
        return flow;
    },

    async findActiveKeywordFlows() {
        const rows = await query(`
            SELECT * FROM flows
            WHERE trigger_type = 'keyword' AND is_active = 1
            ORDER BY priority DESC, id ASC
        `);

        return rows.map((flow) => ({
            ...flow,
            nodes: JSON.parse(flow.nodes || '[]'),
            edges: JSON.parse(flow.edges || '[]')
        }));
    },
    
    async findKeywordMatches(messageText) {
        const normalizedMessage = normalizeFlowKeywordText(messageText);
        if (!normalizedMessage) return [];

        const flows = await query(`
            SELECT * FROM flows 
            WHERE trigger_type = 'keyword' AND is_active = 1
            ORDER BY priority DESC, id ASC
        `);

        const matches = [];

        for (const flow of flows) {
            const keywords = extractFlowKeywords(flow.trigger_value || '');
            if (keywords.length === 0) continue;

            const matchedKeywords = keywords.filter((keyword) => includesFlowKeyword(normalizedMessage, keyword));
            if (matchedKeywords.length === 0) continue;

            const score = scoreFlowKeywordMatch(matchedKeywords, flow.priority);
            matches.push({ flow, score, matchedKeywords });
        }

        matches.sort((a, b) => {
            const scoreCompare = compareFlowKeywordScoreDesc(a.score, b.score);
            if (scoreCompare !== 0) return scoreCompare;
            return Number(a.flow.id || 0) - Number(b.flow.id || 0);
        });

        return matches.map(({ flow, score, matchedKeywords }) => ({
            ...flow,
            nodes: JSON.parse(flow.nodes || '[]'),
            edges: JSON.parse(flow.edges || '[]'),
            _keywordMatch: {
                ...score,
                matchedKeywords
            }
        }));
    },

    async findByKeyword(messageText) {
        const matches = await this.findKeywordMatches(messageText);
        if (matches.length === 0) return null;
        return matches[0];
    },
    
    async list(options = {}) {
        let sql = 'SELECT * FROM flows WHERE 1=1';
        const params = [];
        
        if (options.is_active !== undefined) {
            sql += ' AND is_active = ?';
            params.push(options.is_active);
        }

        if (options.created_by) {
            sql += ' AND created_by = ?';
            params.push(options.created_by);
        }
        
        sql += ' ORDER BY priority DESC, name ASC';
        
        const rows = await query(sql, params);
        return rows.map(flow => ({
            ...flow,
            nodes: JSON.parse(flow.nodes || '[]'),
            edges: JSON.parse(flow.edges || '[]')
        }));
    },
    
    async update(id, data) {
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
        
        fields.push("updated_at = CURRENT_TIMESTAMP");
        values.push(id);
        
        return await run(`UPDATE flows SET ${fields.join(', ')} WHERE id = ?`, values);
    },
    
    async delete(id) {
        return await run('DELETE FROM flows WHERE id = ?', [id]);
    }
};

// ============================================
// CUSTOM EVENTS
// ============================================

const CustomEvent = {
    async create(data) {
        const uuid = generateUUID();
        const name = normalizeCustomEventName(data?.name);
        if (!name) {
            throw new Error('Nome do evento e obrigatorio');
        }

        const eventKey = normalizeCustomEventKey(
            data?.event_key ?? data?.eventKey ?? data?.key ?? name
        ) || buildCustomEventKey(name);

        const description = String(data?.description || '').trim().slice(0, 400) || null;
        const isActive = normalizeBooleanFlag(data?.is_active ?? data?.isActive, 1);

        try {
            const result = await run(`
                INSERT INTO custom_events (uuid, name, event_key, description, is_active, created_by)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [
                uuid,
                name,
                eventKey,
                description,
                isActive,
                data?.created_by || null
            ]);

            return { id: result.lastInsertRowid, uuid };
        } catch (error) {
            const code = String(error?.code || '');
            const detail = String(error?.detail || error?.message || '').toLowerCase();
            if (code === '23505' && (detail.includes('event_key') || detail.includes('custom_events_event_key_key'))) {
                throw new Error('Ja existe um evento com esta chave');
            }
            throw error;
        }
    },

    async findById(id) {
        return await queryOne('SELECT * FROM custom_events WHERE id = ?', [id]);
    },

    async findByKey(eventKey) {
        const normalizedKey = normalizeCustomEventKey(eventKey);
        if (!normalizedKey) return null;
        return await queryOne('SELECT * FROM custom_events WHERE event_key = ?', [normalizedKey]);
    },

    async findByName(name) {
        const normalizedName = normalizeCustomEventName(name);
        if (!normalizedName) return null;
        return await queryOne('SELECT * FROM custom_events WHERE LOWER(name) = LOWER(?)', [normalizedName]);
    },

    async list(options = {}) {
        let sql = `
            SELECT
                ce.id,
                ce.uuid,
                ce.name,
                ce.event_key,
                ce.description,
                ce.is_active,
                ce.created_by,
                ce.created_at,
                ce.updated_at,
                COUNT(cel.id)::int AS total_triggers,
                MAX(cel.occurred_at) AS last_triggered_at
            FROM custom_events ce
            LEFT JOIN custom_event_logs cel ON cel.event_id = ce.id
        `;
        const filters = [];
        const params = [];

        if (options.is_active !== undefined && options.is_active !== null && options.is_active !== '') {
            filters.push('ce.is_active = ?');
            params.push(normalizeBooleanFlag(options.is_active, 1));
        }

        if (options.created_by) {
            filters.push('ce.created_by = ?');
            params.push(options.created_by);
        }

        const search = normalizeCustomEventName(options.search || '');
        if (search) {
            filters.push('(LOWER(ce.name) LIKE LOWER(?) OR LOWER(ce.event_key) LIKE LOWER(?))');
            params.push(`%${search}%`, `%${normalizeCustomEventKey(search)}%`);
        }

        if (filters.length > 0) {
            sql += ` WHERE ${filters.join(' AND ')}`;
        }

        sql += `
            GROUP BY
                ce.id, ce.uuid, ce.name, ce.event_key, ce.description, ce.is_active, ce.created_by, ce.created_at, ce.updated_at
            ORDER BY ce.name ASC
        `;

        return await query(sql, params);
    },

    async listWithPeriodTotals(startAt, endAt, options = {}) {
        let sql = `
            SELECT
                ce.id,
                ce.uuid,
                ce.name,
                ce.event_key,
                ce.description,
                ce.is_active,
                ce.created_by,
                ce.created_at,
                ce.updated_at,
                COUNT(cel.id)::int AS total_period,
                MAX(cel.occurred_at) AS last_triggered_at
            FROM custom_events ce
            LEFT JOIN custom_event_logs cel
                ON cel.event_id = ce.id
               AND cel.occurred_at >= ?
               AND cel.occurred_at < ?
        `;
        const params = [startAt, endAt];
        const filters = [];

        if (options.is_active !== undefined && options.is_active !== null && options.is_active !== '') {
            filters.push('ce.is_active = ?');
            params.push(normalizeBooleanFlag(options.is_active, 1));
        }

        if (options.created_by) {
            filters.push('ce.created_by = ?');
            params.push(options.created_by);
        }

        if (filters.length > 0) {
            sql += ` WHERE ${filters.join(' AND ')}`;
        }

        sql += `
            GROUP BY
                ce.id, ce.uuid, ce.name, ce.event_key, ce.description, ce.is_active, ce.created_by, ce.created_at, ce.updated_at
            ORDER BY total_period DESC, ce.name ASC
        `;

        return await query(sql, params);
    },

    async update(id, data) {
        const current = await this.findById(id);
        if (!current) return null;

        const fields = [];
        const values = [];

        if (Object.prototype.hasOwnProperty.call(data, 'name')) {
            const name = normalizeCustomEventName(data.name);
            if (!name) {
                throw new Error('Nome do evento e obrigatorio');
            }
            fields.push('name = ?');
            values.push(name);
        }

        if (
            Object.prototype.hasOwnProperty.call(data, 'event_key')
            || Object.prototype.hasOwnProperty.call(data, 'eventKey')
            || Object.prototype.hasOwnProperty.call(data, 'key')
        ) {
            const keySource = data.event_key ?? data.eventKey ?? data.key;
            const eventKey = normalizeCustomEventKey(keySource);
            if (!eventKey) {
                throw new Error('Chave do evento invalida');
            }
            fields.push('event_key = ?');
            values.push(eventKey);
        }

        if (Object.prototype.hasOwnProperty.call(data, 'description')) {
            const description = String(data.description || '').trim().slice(0, 400) || null;
            fields.push('description = ?');
            values.push(description);
        }

        if (Object.prototype.hasOwnProperty.call(data, 'is_active') || Object.prototype.hasOwnProperty.call(data, 'isActive')) {
            const isActive = normalizeBooleanFlag(data.is_active ?? data.isActive, current.is_active ? 1 : 0);
            fields.push('is_active = ?');
            values.push(isActive);
        }

        if (fields.length === 0) return current;

        fields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);

        try {
            await run(`UPDATE custom_events SET ${fields.join(', ')} WHERE id = ?`, values);
            return await this.findById(id);
        } catch (error) {
            const code = String(error?.code || '');
            const detail = String(error?.detail || error?.message || '').toLowerCase();
            if (code === '23505' && (detail.includes('event_key') || detail.includes('custom_events_event_key_key'))) {
                throw new Error('Ja existe um evento com esta chave');
            }
            throw error;
        }
    },

    async delete(id) {
        return await run('DELETE FROM custom_events WHERE id = ?', [id]);
    },

    async logOccurrence(data) {
        const eventId = Number(data?.event_id ?? data?.eventId);
        if (!Number.isFinite(eventId) || eventId <= 0) {
            throw new Error('event_id invalido');
        }

        const metadata = toJsonStringOrNull(data?.metadata);
        const flowId = Number(data?.flow_id ?? data?.flowId) || null;
        const leadId = Number(data?.lead_id ?? data?.leadId) || null;
        const conversationId = Number(data?.conversation_id ?? data?.conversationId) || null;
        const executionId = Number(data?.execution_id ?? data?.executionId) || null;
        const nodeIdRaw = data?.node_id ?? data?.nodeId ?? '';
        const nodeId = String(nodeIdRaw).trim() || null;

        if (data?.occurred_at || data?.occurredAt) {
            const occurredAt = data.occurred_at || data.occurredAt;
            return await run(`
                INSERT INTO custom_event_logs (
                    event_id, flow_id, node_id, lead_id, conversation_id, execution_id, metadata, occurred_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [eventId, flowId, nodeId, leadId, conversationId, executionId, metadata, occurredAt]);
        }

        return await run(`
            INSERT INTO custom_event_logs (
                event_id, flow_id, node_id, lead_id, conversation_id, execution_id, metadata
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [eventId, flowId, nodeId, leadId, conversationId, executionId, metadata]);
    }
};

// ============================================
// MESSAGE QUEUE
// ============================================

const MessageQueue = {
    async add(data) {
        const uuid = generateUUID();
        
        const result = await run(`
            INSERT INTO message_queue (
                uuid, lead_id, conversation_id, campaign_id, session_id, is_first_contact, assignment_meta,
                content, media_type, media_url, priority, scheduled_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            uuid,
            data.lead_id,
            data.conversation_id,
            data.campaign_id || null,
            data.session_id || null,
            normalizeBooleanFlag(data.is_first_contact, 1),
            toJsonStringOrNull(data.assignment_meta),
            data.content,
            data.media_type || 'text',
            data.media_url,
            data.priority || 0,
            data.scheduled_at
        ]);
        
        return { id: result.lastInsertRowid, uuid };
    },
    
    async getNext() {
        return await queryOne(`
            SELECT * FROM message_queue 
            WHERE status = 'pending' 
            AND (scheduled_at IS NULL OR scheduled_at <= CURRENT_TIMESTAMP)
            AND attempts < max_attempts
            ORDER BY priority DESC, created_at ASC
            LIMIT 1
        `);
    },
    
    async markProcessing(id) {
        return await run(`
            UPDATE message_queue 
            SET status = 'processing', attempts = attempts + 1 
            WHERE id = ?
        `, [id]);
    },
    
    async markSent(id) {
        return await run(`
            UPDATE message_queue 
            SET status = 'sent', processed_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `, [id]);
    },
    
    async markFailed(id, errorMessage) {
        return await run(`
            UPDATE message_queue 
            SET status = CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'pending' END,
                error_message = ?
            WHERE id = ?
        `, [errorMessage, id]);
    },

    async setAssignment(id, sessionId, assignmentMeta = null) {
        return await run(`
            UPDATE message_queue
            SET session_id = ?, assignment_meta = ?
            WHERE id = ?
        `, [sessionId || null, toJsonStringOrNull(assignmentMeta), id]);
    },
    
    async cancel(id) {
        return await run(`UPDATE message_queue SET status = 'cancelled' WHERE id = ?`, [id]);
    },
    
    async getPending() {
        return await query(`
            SELECT * FROM message_queue 
            WHERE status = 'pending' 
            ORDER BY priority DESC, created_at ASC
        `);
    },

    async hasQueuedOrSentForCampaignLead(campaignId, leadId) {
        const row = await queryOne(`
            SELECT id
            FROM message_queue
            WHERE campaign_id = ?
              AND lead_id = ?
              AND status IN ('pending', 'processing', 'sent')
            LIMIT 1
        `, [campaignId, leadId]);
        return !!row;
    }
};

// ============================================
// TAGS
// ============================================

const DEFAULT_TAG_COLOR = '#5a2a6b';

const Tag = {
    async list() {
        return await query(`
            SELECT id, name, color, description, created_at
            FROM tags
            ORDER BY LOWER(name) ASC, id ASC
        `);
    },

    async findById(id) {
        return await queryOne('SELECT id, name, color, description, created_at FROM tags WHERE id = ?', [id]);
    },

    async findByName(name) {
        return await queryOne(
            'SELECT id, name, color, description, created_at FROM tags WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))',
            [name]
        );
    },

    async create(data) {
        const tagName = normalizeTagValue(data.name);
        const tagColor = normalizeTagValue(data.color) || DEFAULT_TAG_COLOR;
        const tagDescription = normalizeTagValue(data.description);

        const result = await run(`
            INSERT INTO tags (name, color, description)
            VALUES (?, ?, ?)
        `, [tagName, tagColor, tagDescription || null]);

        return await this.findById(result.lastInsertRowid);
    },

    async update(id, data) {
        const fields = [];
        const values = [];

        if (Object.prototype.hasOwnProperty.call(data, 'name')) {
            fields.push('name = ?');
            values.push(normalizeTagValue(data.name));
        }
        if (Object.prototype.hasOwnProperty.call(data, 'color')) {
            fields.push('color = ?');
            values.push(normalizeTagValue(data.color) || DEFAULT_TAG_COLOR);
        }
        if (Object.prototype.hasOwnProperty.call(data, 'description')) {
            fields.push('description = ?');
            const description = normalizeTagValue(data.description);
            values.push(description || null);
        }

        if (fields.length === 0) return await this.findById(id);

        values.push(id);
        await run(`UPDATE tags SET ${fields.join(', ')} WHERE id = ?`, values);

        return await this.findById(id);
    },

    async delete(id) {
        return await run('DELETE FROM tags WHERE id = ?', [id]);
    },

    async syncFromLeads() {
        const rows = await query("SELECT tags FROM leads WHERE tags IS NOT NULL AND tags <> ''");
        if (!rows || rows.length === 0) return;

        const existingTags = await this.list();
        const existingKeys = new Set(existingTags.map((tag) => normalizeTagKey(tag.name)));
        const discoveredTags = new Set();

        for (const row of rows) {
            for (const tag of parseTagList(row.tags)) {
                discoveredTags.add(tag);
            }
        }

        for (const tagName of uniqueTags(Array.from(discoveredTags))) {
            const key = normalizeTagKey(tagName);
            if (existingKeys.has(key)) continue;

            await run(
                `INSERT INTO tags (name, color, description)
                 VALUES (?, ?, ?)
                 ON CONFLICT(name) DO NOTHING`,
                [tagName, DEFAULT_TAG_COLOR, null]
            );
            existingKeys.add(key);
        }
    },

    async renameInLeads(previousName, nextName) {
        const previousKey = normalizeTagKey(previousName);
        const sanitizedNext = normalizeTagValue(nextName);
        if (!previousKey || !sanitizedNext) return 0;

        const leads = await query("SELECT id, tags FROM leads WHERE tags IS NOT NULL AND tags <> ''");
        let updatedLeads = 0;

        for (const lead of leads) {
            const originalTags = parseTagList(lead.tags);
            if (originalTags.length === 0) continue;

            let changed = false;
            const replacedTags = [];
            const seen = new Set();

            for (const tag of originalTags) {
                const key = normalizeTagKey(tag);
                const value = key === previousKey ? sanitizedNext : tag;
                if (key === previousKey) changed = true;

                const valueKey = normalizeTagKey(value);
                if (!valueKey || seen.has(valueKey)) continue;
                seen.add(valueKey);
                replacedTags.push(value);
            }

            if (!changed) continue;

            await run(
                "UPDATE leads SET tags = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                [JSON.stringify(replacedTags), lead.id]
            );
            updatedLeads++;
        }

        return updatedLeads;
    },

    async removeFromLeads(tagName) {
        const normalized = normalizeTagKey(tagName);
        if (!normalized) return 0;

        const leads = await query("SELECT id, tags FROM leads WHERE tags IS NOT NULL AND tags <> ''");
        let updatedLeads = 0;

        for (const lead of leads) {
            const originalTags = parseTagList(lead.tags);
            if (originalTags.length === 0) continue;

            const remainingTags = uniqueTags(
                originalTags.filter((tag) => normalizeTagKey(tag) !== normalized)
            );

            if (remainingTags.length === originalTags.length) continue;

            await run(
                "UPDATE leads SET tags = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                [JSON.stringify(remainingTags), lead.id]
            );
            updatedLeads++;
        }

        return updatedLeads;
    }
};

// ============================================
// WEBHOOKS
// ============================================

const Webhook = {
    async create(data) {
        const uuid = generateUUID();
        
        const result = await run(`
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
    
    async findById(id) {
        return await queryOne('SELECT * FROM webhooks WHERE id = ?', [id]);
    },
    
    async findByEvent(event) {
        return await query(`
            SELECT * FROM webhooks 
            WHERE is_active = 1 AND events LIKE ?
        `, [`%"${event}"%`]);
    },
    
    async list() {
        return await query('SELECT * FROM webhooks ORDER BY name ASC');
    },
    
    async update(id, data) {
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
        
        fields.push("updated_at = CURRENT_TIMESTAMP");
        values.push(id);
        
        return await run(`UPDATE webhooks SET ${fields.join(', ')} WHERE id = ?`, values);
    },
    
    async logTrigger(webhookId, event, payload, responseStatus, responseBody, durationMs) {
        return await run(`
            INSERT INTO webhook_logs (webhook_id, event, payload, response_status, response_body, duration_ms)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [webhookId, event, JSON.stringify(payload), responseStatus, responseBody, durationMs]);
    },
    
    async delete(id) {
        return await run('DELETE FROM webhooks WHERE id = ?', [id]);
    }
};

// ============================================
// SETTINGS
// ============================================

const Settings = {
    async get(key) {
        const setting = await queryOne('SELECT * FROM settings WHERE key = ?', [key]);
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
    
    async set(key, value, type = 'string') {
        const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
        
        return await run(`
            INSERT INTO settings (key, value, type, updated_at) 
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET value = ?, type = ?, updated_at = CURRENT_TIMESTAMP
        `, [key, stringValue, type, stringValue, type]);
    },
    
    async getAll() {
        const settings = await query('SELECT * FROM settings');
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
    async create(data) {
        const uuid = generateUUID();
        const safeName = deriveUserName(data.name, data.email);
        
        const result = await run(`
            INSERT INTO users (uuid, name, email, password_hash, role, avatar_url)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [
            uuid,
            safeName,
            data.email,
            data.password_hash,
            data.role || 'agent',
            data.avatar_url
        ]);
        
        return { id: result.lastInsertRowid, uuid };
    },
    
    async findById(id) {
        return await queryOne('SELECT id, uuid, name, email, role, avatar_url, is_active, last_login_at, created_at FROM users WHERE id = ?', [id]);
    },

    async findByIdWithPassword(id) {
        return await queryOne('SELECT * FROM users WHERE id = ?', [id]);
    },
    
    async findByEmail(email) {
        return await queryOne('SELECT * FROM users WHERE email = ?', [email]);
    },
    
    async updateLastLogin(id) {
        return await run("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?", [id]);
    },
    
    async list() {
        return await query('SELECT id, uuid, name, email, role, avatar_url, is_active, last_login_at, created_at FROM users WHERE is_active = 1 ORDER BY name ASC');
    },

    async listAll() {
        return await query('SELECT id, uuid, name, email, role, avatar_url, is_active, last_login_at, created_at FROM users ORDER BY name ASC');
    },

    async update(id, data) {
        const updates = [];
        const params = [];

        if (Object.prototype.hasOwnProperty.call(data, 'name')) {
            const nextName = deriveUserName(data.name, data.email);
            updates.push('name = ?');
            params.push(nextName);
        }

        if (Object.prototype.hasOwnProperty.call(data, 'email')) {
            updates.push('email = ?');
            params.push(String(data.email || '').trim().toLowerCase());
        }

        if (Object.prototype.hasOwnProperty.call(data, 'role')) {
            updates.push('role = ?');
            params.push(String(data.role || '').trim().toLowerCase() || 'agent');
        }

        if (Object.prototype.hasOwnProperty.call(data, 'is_active')) {
            updates.push('is_active = ?');
            params.push(Number(data.is_active) > 0 ? 1 : 0);
        }

        if (!updates.length) {
            return { changes: 0 };
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(id);

        return await run(
            `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
            params
        );
    },

    async updatePassword(id, passwordHash) {
        return await run(
            'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [passwordHash, id]
        );
    }
};

module.exports = {
    Lead,
    Conversation,
    Message,
    Template,
    Campaign,
    CampaignSenderAccount,
    Automation,
    Flow,
    CustomEvent,
    MessageQueue,
    Tag,
    Webhook,
    WhatsAppSession,
    Settings,
    User
};
