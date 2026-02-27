/**
 * SELF PROTEÇÃO VEICULAR - Modelos de Dados
 * Funções CRUD para todas as entidades do sistema
 */

const { query, queryOne, run, transaction, generateUUID } = require('./connection');

function normalizeDigits(value) {
    return String(value || '').replace(/\D/g, '');
}

function normalizeLeadPhoneForStorage(value) {
    let digits = normalizeDigits(value);
    if (!digits) return '';

    while (digits.startsWith('55') && digits.length > 13) {
        digits = digits.slice(2);
    }

    return digits;
}

function buildLeadJidFromPhone(phone) {
    const digits = normalizeLeadPhoneForStorage(phone);
    if (!digits) return '';
    const waNumber = digits.startsWith('55') ? digits : `55${digits}`;
    return `${waNumber}@s.whatsapp.net`;
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

function parseLeadOwnerScopeOption(options) {
    if (typeof options === 'number') {
        return parsePositiveInteger(options, null);
    }
    if (!options || typeof options !== 'object') return null;
    return parsePositiveInteger(
        options.owner_user_id !== undefined ? options.owner_user_id : options.ownerUserId,
        null
    );
}

async function resolveLeadOwnerUserIdInput(data = {}) {
    const explicitOwnerUserId = parsePositiveInteger(data?.owner_user_id, null);
    if (explicitOwnerUserId) return explicitOwnerUserId;

    const assignedUserId = parsePositiveInteger(data?.assigned_to, null);
    if (!assignedUserId) return null;

    const assignedUser = await queryOne(
        'SELECT id, owner_user_id FROM users WHERE id = ?',
        [assignedUserId]
    );
    if (!assignedUser) return null;

    return parsePositiveInteger(assignedUser.owner_user_id, null)
        || parsePositiveInteger(assignedUser.id, null)
        || null;
}

function appendLeadOwnerScopeFilter(sql, params, ownerUserId, tableAlias = 'leads') {
    const normalizedOwnerUserId = parsePositiveInteger(ownerUserId, null);
    if (!normalizedOwnerUserId) return sql;

    sql += `
        AND (
            ${tableAlias}.owner_user_id = ?
            OR (
                ${tableAlias}.owner_user_id IS NULL
                AND EXISTS (
                    SELECT 1
                    FROM users owner_scope
                    WHERE owner_scope.id = ${tableAlias}.assigned_to
                      AND (owner_scope.owner_user_id = ? OR owner_scope.id = ?)
                )
            )
        )
    `;
    params.push(normalizedOwnerUserId, normalizedOwnerUserId, normalizedOwnerUserId);
    return sql;
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

async function executeLeadCleanupQuery(client, statement, leadId) {
    try {
        await client.query(statement, [leadId]);
    } catch (error) {
        // Em ambientes com migração parcial, algumas tabelas podem não existir.
        if (error && error.code === '42P01') return;
        throw error;
    }
}

// ============================================
// LEADS
// ============================================

const Lead = {
    async create(data) {
        const uuid = generateUUID();
        const normalizedPhone = normalizeLeadPhoneForStorage(data.phone);
        if (!normalizedPhone) {
            throw new Error('Telefone invalido');
        }
        const jid = String(data.jid || buildLeadJidFromPhone(normalizedPhone)).trim() || buildLeadJidFromPhone(normalizedPhone);
        const source = String(data.source || 'manual');
        const normalizedSource = source.toLowerCase();
        const sanitizedName = sanitizeLeadName(data.name);
        const incomingName = sanitizedName || normalizedPhone;
        const initialCustomFields = parseLeadCustomFields(data.custom_fields);
        const customFields = normalizedSource !== 'whatsapp' && sanitizedName
            ? lockLeadNameAsManual(initialCustomFields)
            : initialCustomFields;
        const ownerUserId = await resolveLeadOwnerUserIdInput(data);
        
        const result = await run(`
            INSERT INTO leads (uuid, phone, phone_formatted, jid, name, email, vehicle, plate, status, tags, custom_fields, source, assigned_to, owner_user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            uuid,
            normalizedPhone,
            data.phone_formatted || normalizedPhone,
            jid,
            incomingName,
            data.email,
            data.vehicle,
            data.plate,
            data.status || 1,
            JSON.stringify(data.tags || []),
            JSON.stringify(customFields),
            source,
            data.assigned_to,
            ownerUserId
        ]);
        
        return { id: result.lastInsertRowid, uuid };
    },
    
    async findById(id) {
        return await queryOne('SELECT * FROM leads WHERE id = ?', [id]);
    },
    
    async findByUuid(uuid) {
        return await queryOne('SELECT * FROM leads WHERE uuid = ?', [uuid]);
    },
    
    async findByPhone(phone, options = {}) {
        const cleaned = normalizeDigits(phone);
        if (!cleaned) return null;
        const ownerUserId = parseLeadOwnerScopeOption(options);

        const suffixLength = Math.min(cleaned.length, 11);
        const suffix = cleaned.slice(-suffixLength);

        let sql = `
            SELECT *
            FROM leads
            WHERE (
                phone = ?
                OR phone LIKE ?
                OR (? <> '' AND substr(phone, length(phone) - ${suffixLength} + 1) = ?)
            )
        `;
        const params = [cleaned, `%${cleaned}`, suffix, suffix];
        sql = appendLeadOwnerScopeFilter(sql, params, ownerUserId, 'leads');
        sql += `
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
        `;
        params.push(cleaned, `%${cleaned}`, suffix, suffix);

        return await queryOne(sql, params);
    },
    
    async findByJid(jid, options = {}) {
        const normalizedJid = String(jid || '').trim();
        if (!normalizedJid) return null;

        const ownerUserId = parseLeadOwnerScopeOption(options);
        let sql = 'SELECT * FROM leads WHERE jid = ?';
        const params = [normalizedJid];
        sql = appendLeadOwnerScopeFilter(sql, params, ownerUserId, 'leads');
        sql += ' ORDER BY COALESCE(last_message_at, updated_at, created_at) DESC, id DESC LIMIT 1';
        return await queryOne(sql, params);
    },
    
    async findOrCreate(data, options = {}) {
        const ownerUserId = await resolveLeadOwnerUserIdInput({
            ...data,
            owner_user_id: data?.owner_user_id ?? options?.owner_user_id
        });
        let lead = null;
        if (data.jid) {
            lead = await this.findByJid(data.jid, { owner_user_id: ownerUserId });
        }
        if (!lead) {
            lead = await this.findByPhone(data.phone, { owner_user_id: ownerUserId });
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
            if (ownerUserId && !parsePositiveInteger(lead.owner_user_id, null)) {
                await run(
                    'UPDATE leads SET owner_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_user_id IS NULL',
                    [ownerUserId, lead.id]
                );
                lead.owner_user_id = ownerUserId;
            }
            return { lead, created: false };
        }
        
        const result = await this.create({
            ...data,
            owner_user_id: ownerUserId || data?.owner_user_id
        });
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
            const leadId = Number(id);
            const cleanupStatements = [
                'DELETE FROM message_queue WHERE lead_id = $1',
                'DELETE FROM flow_executions WHERE lead_id = $1',
                'DELETE FROM messages WHERE lead_id = $1',
                'DELETE FROM lead_tags WHERE lead_id = $1',
                'DELETE FROM automation_lead_runs WHERE lead_id = $1',
                'UPDATE custom_event_logs SET lead_id = NULL WHERE lead_id = $1',
                'DELETE FROM conversations WHERE lead_id = $1'
            ];

            for (const statement of cleanupStatements) {
                await executeLeadCleanupQuery(client, statement, leadId);
            }

            const result = await client.query('DELETE FROM leads WHERE id = $1', [leadId]);
            return {
                lastInsertRowid: null,
                changes: result.rowCount
            };
        });
    },

    async bulkDelete(ids = []) {
        const leadIds = Array.from(
            new Set(
                (Array.isArray(ids) ? ids : [])
                    .map((value) => parseInt(value, 10))
                    .filter((value) => Number.isInteger(value) && value > 0)
            )
        );

        if (!leadIds.length) {
            return {
                lastInsertRowid: null,
                changes: 0
            };
        }

        return await transaction(async (client) => {
            const cleanupStatements = [
                'DELETE FROM message_queue WHERE lead_id = ANY($1::int[])',
                'DELETE FROM flow_executions WHERE lead_id = ANY($1::int[])',
                'DELETE FROM messages WHERE lead_id = ANY($1::int[])',
                'DELETE FROM lead_tags WHERE lead_id = ANY($1::int[])',
                'DELETE FROM automation_lead_runs WHERE lead_id = ANY($1::int[])',
                'UPDATE custom_event_logs SET lead_id = NULL WHERE lead_id = ANY($1::int[])',
                'DELETE FROM conversations WHERE lead_id = ANY($1::int[])'
            ];

            for (const statement of cleanupStatements) {
                await executeLeadCleanupQuery(client, statement, leadIds);
            }

            const result = await client.query('DELETE FROM leads WHERE id = ANY($1::int[])', [leadIds]);
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
                latest_conversation.session_id,
                latest_conversation.session_label
            FROM leads
            LEFT JOIN LATERAL (
                SELECT
                    c.session_id,
                    COALESCE(NULLIF(TRIM(ws.name), ''), NULLIF(TRIM(ws.phone), ''), c.session_id) AS session_label
                FROM conversations c
                LEFT JOIN whatsapp_sessions ws ON ws.session_id = c.session_id
                WHERE c.lead_id = leads.id
                ORDER BY COALESCE(c.updated_at, c.created_at) DESC, c.id DESC
                LIMIT 1
            ) latest_conversation ON TRUE
            WHERE 1=1
        `;
        const params = [];
        
        if (options.status) {
            sql += ' AND leads.status = ?';
            params.push(options.status);
        }
        
        if (options.assigned_to) {
            sql += ' AND leads.assigned_to = ?';
            params.push(options.assigned_to);
        }

        sql = appendLeadOwnerScopeFilter(sql, params, parsePositiveInteger(options.owner_user_id, null), 'leads');
        
        if (options.search) {
            sql += ' AND (leads.name LIKE ? OR leads.phone LIKE ?)';
            params.push(`%${options.search}%`, `%${options.search}%`);
        }

        if (options.session_id) {
            sql += ' AND EXISTS (SELECT 1 FROM conversations c WHERE c.lead_id = leads.id AND c.session_id = ?)';
            params.push(String(options.session_id).trim());
        }
        
        sql += ' ORDER BY leads.updated_at DESC';
        
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

        sql = appendLeadOwnerScopeFilter(sql, params, parsePositiveInteger(options.owner_user_id, null), 'leads');

        if (options.session_id) {
            sql += ' AND EXISTS (SELECT 1 FROM conversations c WHERE c.lead_id = leads.id AND c.session_id = ?)';
            params.push(String(options.session_id).trim());
        }
        
        const row = await queryOne(sql, params);
        const total = Number(row?.total || 0);
        return Number.isFinite(total) && total >= 0 ? total : 0;
    },

    async summary(options = {}) {
        let sql = `
            SELECT leads.status AS status, COUNT(*)::int AS total
            FROM leads
            WHERE 1=1
        `;
        const params = [];

        if (options.assigned_to) {
            sql += ' AND assigned_to = ?';
            params.push(options.assigned_to);
        }

        sql = appendLeadOwnerScopeFilter(sql, params, parsePositiveInteger(options.owner_user_id, null), 'leads');

        if (options.session_id) {
            sql += ' AND EXISTS (SELECT 1 FROM conversations c WHERE c.lead_id = leads.id AND c.session_id = ?)';
            params.push(String(options.session_id).trim());
        }

        sql += ' GROUP BY leads.status';

        const rows = await query(sql, params);
        const byStatus = { 1: 0, 2: 0, 3: 0, 4: 0 };
        let total = 0;

        for (const row of rows || []) {
            const status = Number(row?.status);
            const amount = Number(row?.total || 0);
            if (!Number.isFinite(amount) || amount <= 0) continue;
            total += amount;
            if (status === 1 || status === 2 || status === 3 || status === 4) {
                byStatus[status] = amount;
            }
        }

        return {
            total,
            by_status: byStatus,
            pending: byStatus[1] + byStatus[2],
            completed: byStatus[3]
        };
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

        if (options.owner_user_id) {
            const ownerUserId = parsePositiveInteger(options.owner_user_id, null);
            if (ownerUserId) {
                sql += `
                    AND (
                        l.owner_user_id = ?
                        OR
                        EXISTS (
                            SELECT 1
                            FROM users owner_scope
                            WHERE owner_scope.id = COALESCE(c.assigned_to, l.assigned_to)
                              AND (owner_scope.owner_user_id = ? OR owner_scope.id = ?)
                        )
                        OR EXISTS (
                            SELECT 1
                            FROM whatsapp_sessions ws
                            WHERE ws.session_id = c.session_id
                              AND (
                                  ws.created_by = ?
                                  OR EXISTS (
                                      SELECT 1
                                      FROM users ws_owner
                                      WHERE ws_owner.id = ws.created_by
                                        AND (ws_owner.owner_user_id = ? OR ws_owner.id = ?)
                                  )
                              )
                        )
                    )
                `;
                params.push(ownerUserId, ownerUserId, ownerUserId, ownerUserId, ownerUserId, ownerUserId);
            }
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

        if (options.offset) {
            sql += ' OFFSET ?';
            params.push(options.offset);
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
        const limit = Number(options.limit || 0);
        const offset = Number(options.offset || 0);

        if (Number.isFinite(limit) && limit > 0 && (!Number.isFinite(offset) || offset <= 0)) {
            return await query(`
                SELECT *
                FROM (
                    SELECT *
                    FROM messages
                    WHERE conversation_id = ?
                    ORDER BY COALESCE(sent_at, created_at) DESC, id DESC
                    LIMIT ?
                ) recent_messages
                ORDER BY COALESCE(sent_at, created_at) ASC, id ASC
            `, [conversationId, Math.floor(limit)]);
        }

        let sql = 'SELECT * FROM messages WHERE conversation_id = ?';
        const params = [conversationId];
        
        sql += " ORDER BY COALESCE(sent_at, created_at) ASC, id ASC";
        
        if (Number.isFinite(limit) && limit > 0) {
            sql += ' LIMIT ?';
            params.push(Math.floor(limit));
        }
        
        if (Number.isFinite(offset) && offset > 0) {
            sql += ' OFFSET ?';
            params.push(Math.floor(offset));
        }
        
        return await query(sql, params);
    },
    
    async listByLead(leadId, options = {}) {
        const limit = Number(options.limit || 0);
        const offset = Number(options.offset || 0);

        if (Number.isFinite(limit) && limit > 0 && (!Number.isFinite(offset) || offset <= 0)) {
            return await query(`
                SELECT *
                FROM (
                    SELECT *
                    FROM messages
                    WHERE lead_id = ?
                    ORDER BY COALESCE(sent_at, created_at) DESC, id DESC
                    LIMIT ?
                ) recent_messages
                ORDER BY COALESCE(sent_at, created_at) ASC, id ASC
            `, [leadId, Math.floor(limit)]);
        }

        let sql = 'SELECT * FROM messages WHERE lead_id = ?';
        const params = [leadId];
        
        sql += " ORDER BY COALESCE(sent_at, created_at) ASC, id ASC";
        
        if (Number.isFinite(limit) && limit > 0) {
            sql += ' LIMIT ?';
            params.push(Math.floor(limit));
        }

        if (Number.isFinite(offset) && offset > 0) {
            sql += ' OFFSET ?';
            params.push(Math.floor(offset));
        }
        
        return await query(sql, params);
    },

    async getLastByLead(leadId) {
        return await queryOne("SELECT * FROM messages WHERE lead_id = ? ORDER BY COALESCE(sent_at, created_at) DESC, id DESC LIMIT 1", [leadId]);
    },
    
    async getLastMessage(conversationId) {
        return await queryOne("SELECT * FROM messages WHERE conversation_id = ? ORDER BY COALESCE(sent_at, created_at) DESC, id DESC LIMIT 1", [conversationId]);
    },

    async getLastMessagesByConversationIds(conversationIds = []) {
        const ids = Array.from(
            new Set(
                (Array.isArray(conversationIds) ? conversationIds : [])
                    .map((id) => Number(id))
                    .filter((id) => Number.isInteger(id) && id > 0)
            )
        );

        if (ids.length === 0) return [];

        const placeholders = ids.map(() => '?').join(', ');
        return await query(`
            SELECT DISTINCT ON (conversation_id) *
            FROM messages
            WHERE conversation_id IN (${placeholders})
            ORDER BY conversation_id, COALESCE(sent_at, created_at) DESC, id DESC
        `, ids);
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
    
    async findById(id, options = {}) {
        const ownerUserId = parsePositiveInteger(options.owner_user_id, null);
        const createdBy = parsePositiveInteger(options.created_by, null);
        const params = [id];
        let filters = '';

        if (ownerUserId) {
            filters += `
                AND (
                    templates.created_by = ?
                    OR EXISTS (
                        SELECT 1
                        FROM users u
                        WHERE u.id = templates.created_by
                          AND (u.owner_user_id = ? OR u.id = ?)
                    )
                )
            `;
            params.push(ownerUserId, ownerUserId, ownerUserId);
        }

        if (createdBy) {
            filters += ' AND templates.created_by = ?';
            params.push(createdBy);
        }

        return await queryOne(`
            SELECT templates.*
            FROM templates
            WHERE templates.id = ?
            ${filters}
        `, params);
    },
    
    async list(options = {}) {
        let sql = 'SELECT templates.* FROM templates WHERE templates.is_active = 1';
        const params = [];
        
        if (options.category) {
            sql += ' AND templates.category = ?';
            params.push(options.category);
        }

        const ownerUserId = parsePositiveInteger(options.owner_user_id, null);
        const createdBy = parsePositiveInteger(options.created_by, null);

        if (ownerUserId) {
            sql += `
                AND (
                    templates.created_by = ?
                    OR EXISTS (
                        SELECT 1
                        FROM users u
                        WHERE u.id = templates.created_by
                          AND (u.owner_user_id = ? OR u.id = ?)
                    )
                )
            `;
            params.push(ownerUserId, ownerUserId, ownerUserId);
        }

        if (createdBy) {
            sql += ' AND templates.created_by = ?';
            params.push(createdBy);
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
        const sendWindowEnabled = normalizeBooleanFlag(data.send_window_enabled, 0);
        const sendWindowStart = String(data.send_window_start || '').trim() || null;
        const sendWindowEnd = String(data.send_window_end || '').trim() || null;

        const result = await run(`
            INSERT INTO campaigns (
                uuid, name, description, type, distribution_strategy, distribution_config,
                status, segment, tag_filter, message, delay, delay_min, delay_max, start_at,
                send_window_enabled, send_window_start, send_window_end, created_by
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            sendWindowEnabled,
            sendWindowStart,
            sendWindowEnd,
            data.created_by
        ]);

        return { id: result.lastInsertRowid, uuid };
    },

    async findById(id, options = {}) {
        const ownerUserId = parsePositiveInteger(options.owner_user_id, null);
        const createdBy = parsePositiveInteger(options.created_by, null);
        const params = [id];
        let filters = '';

        if (ownerUserId) {
            filters += `
                AND (
                    campaigns.created_by = ?
                    OR EXISTS (
                        SELECT 1
                        FROM users u
                        WHERE u.id = campaigns.created_by
                          AND (u.owner_user_id = ? OR u.id = ?)
                    )
                )
            `;
            params.push(ownerUserId, ownerUserId, ownerUserId);
        }

        if (createdBy) {
            filters += ' AND campaigns.created_by = ?';
            params.push(createdBy);
        }

        return await queryOne(`
            SELECT campaigns.*
            FROM campaigns
            WHERE campaigns.id = ?
            ${filters}
        `, params);
    },

    async list(options = {}) {
        let sql = 'SELECT campaigns.* FROM campaigns WHERE 1=1';
        const params = [];
        const ownerUserId = parsePositiveInteger(options.owner_user_id, null);
        const createdBy = parsePositiveInteger(options.created_by, null);

        if (options.status) {
            sql += ' AND status = ?';
            params.push(options.status);
        }

        if (options.type) {
            sql += ' AND type = ?';
            params.push(options.type);
        }

        if (ownerUserId) {
            sql += `
                AND (
                    campaigns.created_by = ?
                    OR EXISTS (
                        SELECT 1
                        FROM users u
                        WHERE u.id = campaigns.created_by
                          AND (u.owner_user_id = ? OR u.id = ?)
                    )
                )
            `;
            params.push(ownerUserId, ownerUserId, ownerUserId);
        }

        if (createdBy) {
            sql += ' AND campaigns.created_by = ?';
            params.push(createdBy);
        }

        if (options.search) {
            sql += ' AND (campaigns.name LIKE ? OR campaigns.description LIKE ?)';
            params.push(`%${options.search}%`, `%${options.search}%`);
        }

        sql += ' ORDER BY campaigns.created_at DESC';

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
            'distribution_strategy', 'distribution_config',
            'send_window_enabled', 'send_window_start', 'send_window_end'
        ];

        for (const [key, value] of Object.entries(data)) {
            if (allowedFields.includes(key)) {
                fields.push(`${key} = ?`);
                if (key === 'distribution_strategy') {
                    values.push(String(value || '').trim() || 'single');
                } else if (key === 'distribution_config') {
                    values.push(toJsonStringOrNull(value));
                } else if (key === 'send_window_enabled') {
                    values.push(normalizeBooleanFlag(value, 0));
                } else if (key === 'send_window_start' || key === 'send_window_end') {
                    values.push(String(value || '').trim() || null);
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
        const ownerUserId = parsePositiveInteger(options.owner_user_id);
        const filters = [];
        const params = [];

        if (ownerUserId) {
            filters.push(`
                (
                    whatsapp_sessions.created_by = ?
                    OR EXISTS (
                        SELECT 1
                        FROM users u
                        WHERE u.id = whatsapp_sessions.created_by
                          AND (u.owner_user_id = ? OR u.id = ?)
                    )
                )
            `);
            params.push(ownerUserId, ownerUserId, ownerUserId);
        } else if (createdBy) {
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
        const ownerUserId = parsePositiveInteger(options.owner_user_id);
        const createdBy = parsePositiveInteger(options.created_by);
        const params = [normalizedSessionId];
        let ownerFilter = '';
        if (ownerUserId) {
            ownerFilter = `
                AND (
                    whatsapp_sessions.created_by = ?
                    OR EXISTS (
                        SELECT 1
                        FROM users u
                        WHERE u.id = whatsapp_sessions.created_by
                          AND (u.owner_user_id = ? OR u.id = ?)
                    )
                )
            `;
            params.push(ownerUserId, ownerUserId, ownerUserId);
        } else if (createdBy) {
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
        const requestedOwnerUserId = parsePositiveInteger(data.owner_user_id);
        const requestedCreatedBy = parsePositiveInteger(data.created_by);
        if (requestedOwnerUserId && existing) {
            const ownedExisting = await this.findBySessionId(normalizedSessionId, {
                owner_user_id: requestedOwnerUserId
            });
            if (!ownedExisting) {
                throw new Error('Sem permissao para atualizar esta sessao');
            }
        } else if (existingCreatedBy && requestedCreatedBy && existingCreatedBy !== requestedCreatedBy) {
            throw new Error('Sem permissao para atualizar esta sessao');
        }
        const resolvedCreatedBy = requestedOwnerUserId || requestedCreatedBy || existingCreatedBy || null;
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
                created_by = COALESCE(EXCLUDED.created_by, whatsapp_sessions.created_by),
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

        const requesterOwnerUserId = parsePositiveInteger(options.owner_user_id);
        const requesterCreatedBy = parsePositiveInteger(options.created_by);
        if (requesterOwnerUserId) {
            const existing = await this.findBySessionId(normalizedSessionId, {
                owner_user_id: requesterOwnerUserId
            });
            if (!existing) {
                throw new Error('Sem permissao para remover esta sessao');
            }
        } else if (requesterCreatedBy) {
            const existing = await this.findBySessionId(normalizedSessionId, {
                created_by: requesterCreatedBy
            });
            if (!existing) {
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
            INSERT INTO automations (uuid, name, description, trigger_type, trigger_value, action_type, action_value, delay, session_scope, tag_filter, is_active, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            data.tag_filter || null,
            isActive,
            data.created_by
        ]);

        return { id: result.lastInsertRowid, uuid };
    },

    async findById(id, options = {}) {
        const ownerUserId = parsePositiveInteger(options.owner_user_id);
        const createdBy = parsePositiveInteger(options.created_by);
        const params = [id];
        let ownerFilter = '';

        if (ownerUserId) {
            ownerFilter = `
                AND (
                    automations.created_by = ?
                    OR EXISTS (
                        SELECT 1
                        FROM users u
                        WHERE u.id = automations.created_by
                          AND (u.owner_user_id = ? OR u.id = ?)
                    )
                )
            `;
            params.push(ownerUserId, ownerUserId, ownerUserId);
        } else if (createdBy) {
            ownerFilter = ' AND automations.created_by = ?';
            params.push(createdBy);
        }

        return await queryOne(`
            SELECT automations.*
            FROM automations
            WHERE automations.id = ?
            ${ownerFilter}
        `, params);
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

        const ownerUserId = parsePositiveInteger(options.owner_user_id);
        const createdBy = parsePositiveInteger(options.created_by);

        if (ownerUserId) {
            sql += `
                AND (
                    automations.created_by = ?
                    OR EXISTS (
                        SELECT 1
                        FROM users u
                        WHERE u.id = automations.created_by
                          AND (u.owner_user_id = ? OR u.id = ?)
                    )
                )
            `;
            params.push(ownerUserId, ownerUserId, ownerUserId);
        } else if (createdBy) {
            sql += ' AND automations.created_by = ?';
            params.push(createdBy);
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
            'action_type', 'action_value', 'delay', 'session_scope', 'tag_filter', 'is_active', 'executions', 'last_execution'
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
    
    async findById(id, options = {}) {
        const ownerUserId = parsePositiveInteger(options.owner_user_id);
        const createdBy = parsePositiveInteger(options.created_by);
        const params = [id];
        let ownerFilter = '';
        if (ownerUserId) {
            ownerFilter = `
                AND (
                    flows.created_by = ?
                    OR EXISTS (
                        SELECT 1
                        FROM users u
                        WHERE u.id = flows.created_by
                          AND (u.owner_user_id = ? OR u.id = ?)
                    )
                )
            `;
            params.push(ownerUserId, ownerUserId, ownerUserId);
        } else if (createdBy) {
            ownerFilter = ' AND flows.created_by = ?';
            params.push(createdBy);
        }

        const flow = await queryOne(`
            SELECT flows.*
            FROM flows
            WHERE flows.id = ?
            ${ownerFilter}
        `, params);
        if (flow) {
            flow.nodes = JSON.parse(flow.nodes || '[]');
            flow.edges = JSON.parse(flow.edges || '[]');
        }
        return flow;
    },
    
    async findByTrigger(triggerType, triggerValue = null, options = {}) {
        let sql = 'SELECT * FROM flows WHERE trigger_type = ? AND is_active = 1';
        const params = [triggerType];
        
        if (triggerValue) {
            sql += ' AND (trigger_value = ? OR trigger_value IS NULL)';
            params.push(triggerValue);
        }

        const ownerUserId = parsePositiveInteger(options.owner_user_id);
        const createdBy = parsePositiveInteger(options.created_by);

        if (ownerUserId) {
            sql += `
                AND (
                    flows.created_by = ?
                    OR EXISTS (
                        SELECT 1
                        FROM users u
                        WHERE u.id = flows.created_by
                          AND (u.owner_user_id = ? OR u.id = ?)
                    )
                )
            `;
            params.push(ownerUserId, ownerUserId, ownerUserId);
        } else if (createdBy) {
            sql += ' AND flows.created_by = ?';
            params.push(createdBy);
        }
        
        sql += ' ORDER BY priority DESC LIMIT 1';
        
        const flow = await queryOne(sql, params);
        if (flow) {
            flow.nodes = JSON.parse(flow.nodes || '[]');
            flow.edges = JSON.parse(flow.edges || '[]');
        }
        return flow;
    },

    async findActiveKeywordFlows(options = {}) {
        const ownerUserId = parsePositiveInteger(options.owner_user_id);
        const createdBy = parsePositiveInteger(options.created_by);
        const params = [];
        let ownerFilter = '';
        if (ownerUserId) {
            ownerFilter = `
                AND (
                    flows.created_by = ?
                    OR EXISTS (
                        SELECT 1
                        FROM users u
                        WHERE u.id = flows.created_by
                          AND (u.owner_user_id = ? OR u.id = ?)
                    )
                )
            `;
            params.push(ownerUserId, ownerUserId, ownerUserId);
        } else if (createdBy) {
            ownerFilter = ' AND flows.created_by = ?';
            params.push(createdBy);
        }

        const rows = await query(`
            SELECT * FROM flows
            WHERE trigger_type = 'keyword' AND is_active = 1
            ${ownerFilter}
            ORDER BY priority DESC, id ASC
        `, params);

        return rows.map((flow) => ({
            ...flow,
            nodes: JSON.parse(flow.nodes || '[]'),
            edges: JSON.parse(flow.edges || '[]')
        }));
    },
    
    async findKeywordMatches(messageText, options = {}) {
        const normalizedMessage = normalizeFlowKeywordText(messageText);
        if (!normalizedMessage) return [];

        const ownerUserId = parsePositiveInteger(options.owner_user_id);
        const createdBy = parsePositiveInteger(options.created_by);
        const params = [];
        let ownerFilter = '';
        if (ownerUserId) {
            ownerFilter = `
                AND (
                    flows.created_by = ?
                    OR EXISTS (
                        SELECT 1
                        FROM users u
                        WHERE u.id = flows.created_by
                          AND (u.owner_user_id = ? OR u.id = ?)
                    )
                )
            `;
            params.push(ownerUserId, ownerUserId, ownerUserId);
        } else if (createdBy) {
            ownerFilter = ' AND flows.created_by = ?';
            params.push(createdBy);
        }

        const flows = await query(`
            SELECT * FROM flows 
            WHERE trigger_type = 'keyword' AND is_active = 1
            ${ownerFilter}
            ORDER BY priority DESC, id ASC
        `, params);

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

    async findByKeyword(messageText, options = {}) {
        const matches = await this.findKeywordMatches(messageText, options);
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

        const ownerUserId = parsePositiveInteger(options.owner_user_id);
        const createdBy = parsePositiveInteger(options.created_by);

        if (ownerUserId) {
            sql += `
                AND (
                    flows.created_by = ?
                    OR EXISTS (
                        SELECT 1
                        FROM users u
                        WHERE u.id = flows.created_by
                          AND (u.owner_user_id = ? OR u.id = ?)
                    )
                )
            `;
            params.push(ownerUserId, ownerUserId, ownerUserId);
        } else if (createdBy) {
            sql += ' AND flows.created_by = ?';
            params.push(createdBy);
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

    async findById(id, options = {}) {
        const ownerUserId = parsePositiveInteger(options.owner_user_id, null);
        if (ownerUserId) {
            return await queryOne(`
                SELECT ce.*
                FROM custom_events ce
                WHERE ce.id = ?
                  AND EXISTS (
                      SELECT 1
                      FROM users owner_scope
                      WHERE owner_scope.id = ce.created_by
                        AND (owner_scope.owner_user_id = ? OR owner_scope.id = ?)
                  )
            `, [id, ownerUserId, ownerUserId]);
        }
        return await queryOne('SELECT * FROM custom_events WHERE id = ?', [id]);
    },

    async findByKey(eventKey, options = {}) {
        const normalizedKey = normalizeCustomEventKey(eventKey);
        if (!normalizedKey) return null;
        const ownerUserId = parsePositiveInteger(options.owner_user_id, null);
        if (ownerUserId) {
            return await queryOne(`
                SELECT ce.*
                FROM custom_events ce
                WHERE ce.event_key = ?
                  AND EXISTS (
                      SELECT 1
                      FROM users owner_scope
                      WHERE owner_scope.id = ce.created_by
                        AND (owner_scope.owner_user_id = ? OR owner_scope.id = ?)
                  )
            `, [normalizedKey, ownerUserId, ownerUserId]);
        }
        return await queryOne('SELECT * FROM custom_events WHERE event_key = ?', [normalizedKey]);
    },

    async findByName(name, options = {}) {
        const normalizedName = normalizeCustomEventName(name);
        if (!normalizedName) return null;
        const ownerUserId = parsePositiveInteger(options.owner_user_id, null);
        if (ownerUserId) {
            return await queryOne(`
                SELECT ce.*
                FROM custom_events ce
                WHERE LOWER(ce.name) = LOWER(?)
                  AND EXISTS (
                      SELECT 1
                      FROM users owner_scope
                      WHERE owner_scope.id = ce.created_by
                        AND (owner_scope.owner_user_id = ? OR owner_scope.id = ?)
                  )
            `, [normalizedName, ownerUserId, ownerUserId]);
        }
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

        if (options.owner_user_id) {
            const ownerUserId = parsePositiveInteger(options.owner_user_id, null);
            if (ownerUserId) {
                filters.push(`
                    EXISTS (
                        SELECT 1
                        FROM users owner_scope
                        WHERE owner_scope.id = ce.created_by
                          AND (owner_scope.owner_user_id = ? OR owner_scope.id = ?)
                    )
                `);
                params.push(ownerUserId, ownerUserId);
            }
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

        if (options.owner_user_id) {
            const ownerUserId = parsePositiveInteger(options.owner_user_id, null);
            if (ownerUserId) {
                filters.push(`
                    EXISTS (
                        SELECT 1
                        FROM users owner_scope
                        WHERE owner_scope.id = ce.created_by
                          AND (owner_scope.owner_user_id = ? OR owner_scope.id = ?)
                    )
                `);
                params.push(ownerUserId, ownerUserId);
            }
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
            SET status = 'sent',
                error_message = NULL,
                processed_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `, [id]);
    },
    
    async markFailed(id, errorMessage, options = {}) {
        const nextScheduledAt = options?.next_scheduled_at || options?.nextScheduledAt || null;
        const errorText = String(errorMessage || '');
        const normalizedError = errorText
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
        const isDisconnectedSessionError =
            normalizedError.includes('not connected') ||
            normalizedError.includes('nao esta conectado') ||
            normalizedError.includes('não está conectado') ||
            (
                normalizedError.includes('conectad') &&
                (normalizedError.includes('sess') || normalizedError.includes('whatsapp') || normalizedError.includes('conexao'))
            );

        if (!nextScheduledAt && isDisconnectedSessionError) {
            const retryAt = new Date(Date.now() + 60 * 1000).toISOString();
            console.log(`[QueueDebug][model] MODEL_MARKFAILED_FALLBACK_TO_REQUEUE messageId=${id} retryAt=${retryAt} error=${errorText}`);
            return await this.requeueTransient(id, `[M_REQUEUE] ${errorMessage}`, retryAt);
        }

        if (nextScheduledAt) {
            console.log(`[QueueDebug][model] MODEL_MARKFAILED_WITH_SCHEDULE messageId=${id} nextScheduledAt=${nextScheduledAt} error=${errorText}`);
            return await run(`
                UPDATE message_queue 
                SET status = CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'pending' END,
                    error_message = ?,
                    scheduled_at = CASE
                        WHEN attempts >= max_attempts THEN scheduled_at
                        ELSE ?
                    END
                WHERE id = ?
            `, [errorMessage, nextScheduledAt, id]);
        }

        console.log(`[QueueDebug][model] MODEL_MARKFAILED_DIRECT messageId=${id} error=${errorText}`);
        return await run(`
            UPDATE message_queue 
            SET status = CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'pending' END,
                error_message = ?
            WHERE id = ?
        `, [`[M_FAIL_DIRECT] ${errorMessage}`, id]);
    },

    async requeueTransient(id, errorMessage, nextScheduledAt) {
        const scheduledAt = nextScheduledAt || new Date(Date.now() + 60 * 1000).toISOString();
        console.log(`[QueueDebug][model] MODEL_REQUEUE_TRANSIENT messageId=${id} scheduledAt=${scheduledAt} error=${String(errorMessage || '')}`);

        return await run(`
            UPDATE message_queue
            SET status = 'pending',
                error_message = ?,
                scheduled_at = ?,
                processed_at = NULL,
                attempts = CASE WHEN attempts > 0 THEN attempts - 1 ELSE 0 END
            WHERE id = ?
        `, [errorMessage, scheduledAt, id]);
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
    
    async getPending(options = {}) {
        const params = [];
        const readyOnly = options?.ready_only === true || options?.readyOnly === true;
        const limit = Number(options?.limit || 0);

        let sql = `
            SELECT * FROM message_queue 
            WHERE status = 'pending'
        `;

        if (readyOnly) {
            sql += `
                AND (scheduled_at IS NULL OR scheduled_at <= CURRENT_TIMESTAMP)
                AND attempts < max_attempts
            `;
        }

        sql += ' ORDER BY priority DESC, created_at ASC';

        if (Number.isFinite(limit) && limit > 0) {
            sql += ' LIMIT ?';
            params.push(Math.floor(limit));
        }

        return await query(sql, params);
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
    },

    async getCampaignProgress(campaignId) {
        const row = await queryOne(`
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
                SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) AS processing,
                SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
                SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled
            FROM message_queue
            WHERE campaign_id = ?
        `, [campaignId]);

        return {
            total: Number(row?.total || 0),
            pending: Number(row?.pending || 0),
            processing: Number(row?.processing || 0),
            sent: Number(row?.sent || 0),
            failed: Number(row?.failed || 0),
            cancelled: Number(row?.cancelled || 0)
        };
    }
};

// ============================================
// TAGS
// ============================================

const DEFAULT_TAG_COLOR = '#5a2a6b';
let hasTagCreatedByColumnCache = null;

async function tagsTableHasCreatedByColumn() {
    if (hasTagCreatedByColumnCache !== null) {
        return hasTagCreatedByColumnCache;
    }

    try {
        await queryOne('SELECT created_by FROM tags LIMIT 1');
        hasTagCreatedByColumnCache = true;
        return true;
    } catch (error) {
        const message = String(error?.message || '').toLowerCase();
        if (
            message.includes('no such column') ||
            message.includes('does not exist')
        ) {
            hasTagCreatedByColumnCache = false;
            return false;
        }
        throw error;
    }
}

function appendOwnerCreatedByFilters(filters, params, options = {}, config = {}) {
    if (!Array.isArray(filters) || !Array.isArray(params)) {
        return { ownerUserId: null, createdBy: null };
    }

    const ownerUserId = parsePositiveInteger(options?.owner_user_id, null);
    const createdBy = parsePositiveInteger(options?.created_by, null);
    const tableAlias = normalizeTagValue(config?.tableAlias || '');
    const createdByColumn = normalizeTagValue(config?.createdByColumn || 'created_by') || 'created_by';
    const columnRef = tableAlias ? `${tableAlias}.${createdByColumn}` : createdByColumn;

    if (ownerUserId) {
        filters.push(`(
            ${columnRef} = ?
            OR EXISTS (
                SELECT 1
                FROM users owner_scope
                WHERE owner_scope.id = ${columnRef}
                  AND (owner_scope.owner_user_id = ? OR owner_scope.id = ?)
            )
        )`);
        params.push(ownerUserId, ownerUserId, ownerUserId);
    }

    if (createdBy) {
        filters.push(`${columnRef} = ?`);
        params.push(createdBy);
    }

    return { ownerUserId, createdBy };
}

async function listOwnerScopedTagNames(ownerUserId) {
    const normalizedOwnerUserId = parsePositiveInteger(ownerUserId, null);
    if (!normalizedOwnerUserId) return [];

    const discoveredTags = new Set();

    const leadRows = await query(`
        SELECT tags
        FROM leads
        WHERE owner_user_id = ?
          AND tags IS NOT NULL
          AND tags <> ''
    `, [normalizedOwnerUserId]);

    for (const row of leadRows || []) {
        for (const tag of parseTagList(row.tags)) {
            discoveredTags.add(tag);
        }
    }

    const campaignRows = await query(`
        SELECT c.tag_filter
        FROM campaigns c
        WHERE c.tag_filter IS NOT NULL
          AND TRIM(c.tag_filter) <> ''
          AND (
              c.created_by = ?
              OR EXISTS (
                  SELECT 1
                  FROM users owner_scope
                  WHERE owner_scope.id = c.created_by
                    AND (owner_scope.owner_user_id = ? OR owner_scope.id = ?)
              )
          )
    `, [normalizedOwnerUserId, normalizedOwnerUserId, normalizedOwnerUserId]);

    for (const row of campaignRows || []) {
        for (const tag of parseTagList(row?.tag_filter)) {
            discoveredTags.add(tag);
        }
    }

    return uniqueTags(Array.from(discoveredTags));
}

async function isTagVisibleInOwnerScope(tagName, ownerUserId) {
    const normalizedOwnerUserId = parsePositiveInteger(ownerUserId, null);
    if (!normalizedOwnerUserId) return true;

    const targetKey = normalizeTagKey(tagName);
    if (!targetKey) return false;

    const visibleTagNames = await listOwnerScopedTagNames(normalizedOwnerUserId);
    return visibleTagNames.some((candidate) => normalizeTagKey(candidate) === targetKey);
}

const Tag = {
    async list(options = {}) {
        const hasCreatedByColumn = await tagsTableHasCreatedByColumn();

        if (hasCreatedByColumn) {
            const filters = [];
            const params = [];
            appendOwnerCreatedByFilters(filters, params, options, { tableAlias: 'tags' });

            const whereClause = filters.length > 0
                ? `WHERE ${filters.join(' AND ')}`
                : '';

            return await query(`
                SELECT id, name, color, description, created_at, created_by
                FROM tags
                ${whereClause}
                ORDER BY LOWER(name) ASC, id ASC
            `, params);
        }

        const allTags = await query(`
            SELECT id, name, color, description, created_at
            FROM tags
            ORDER BY LOWER(name) ASC, id ASC
        `);

        const ownerUserId = parsePositiveInteger(options.owner_user_id, null);
        if (!ownerUserId) {
            return allTags;
        }

        const visibleTagNames = await listOwnerScopedTagNames(ownerUserId);
        if (visibleTagNames.length === 0) {
            return [];
        }

        const visibleKeys = new Set(visibleTagNames.map((tagName) => normalizeTagKey(tagName)));
        return (allTags || []).filter((tag) => visibleKeys.has(normalizeTagKey(tag.name)));
    },

    async findById(id, options = {}) {
        const hasCreatedByColumn = await tagsTableHasCreatedByColumn();

        if (hasCreatedByColumn) {
            const filters = ['tags.id = ?'];
            const params = [id];
            appendOwnerCreatedByFilters(filters, params, options, { tableAlias: 'tags' });

            return await queryOne(`
                SELECT id, name, color, description, created_at, created_by
                FROM tags
                WHERE ${filters.join(' AND ')}
            `, params);
        }

        const tag = await queryOne('SELECT id, name, color, description, created_at FROM tags WHERE id = ?', [id]);
        if (!tag) return null;

        const ownerUserId = parsePositiveInteger(options.owner_user_id, null);
        if (!ownerUserId) return tag;

        const visible = await isTagVisibleInOwnerScope(tag.name, ownerUserId);
        return visible ? tag : null;
    },

    async findByName(name, options = {}) {
        const hasCreatedByColumn = await tagsTableHasCreatedByColumn();
        const normalizedName = normalizeTagValue(name);
        if (!normalizedName) return null;

        if (hasCreatedByColumn) {
            const filters = ['LOWER(TRIM(tags.name)) = LOWER(TRIM(?))'];
            const params = [normalizedName];
            appendOwnerCreatedByFilters(filters, params, options, { tableAlias: 'tags' });

            return await queryOne(`
                SELECT id, name, color, description, created_at, created_by
                FROM tags
                WHERE ${filters.join(' AND ')}
            `, params);
        }

        const tag = await queryOne(
            'SELECT id, name, color, description, created_at FROM tags WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))',
            [normalizedName]
        );
        if (!tag) return null;

        const ownerUserId = parsePositiveInteger(options.owner_user_id, null);
        if (!ownerUserId) return tag;

        const visible = await isTagVisibleInOwnerScope(tag.name, ownerUserId);
        return visible ? tag : null;
    },

    async create(data, options = {}) {
        const tagName = normalizeTagValue(data.name);
        const tagColor = normalizeTagValue(data.color) || DEFAULT_TAG_COLOR;
        const tagDescription = normalizeTagValue(data.description);
        const hasCreatedByColumn = await tagsTableHasCreatedByColumn();
        const createdBy = parsePositiveInteger(data?.created_by ?? options?.created_by, null);

        let result;
        if (hasCreatedByColumn && createdBy) {
            result = await run(`
                INSERT INTO tags (name, color, description, created_by)
                VALUES (?, ?, ?, ?)
            `, [tagName, tagColor, tagDescription || null, createdBy]);
        } else {
            result = await run(`
                INSERT INTO tags (name, color, description)
                VALUES (?, ?, ?)
            `, [tagName, tagColor, tagDescription || null]);
        }

        return await this.findById(
            result.lastInsertRowid,
            hasCreatedByColumn ? options : {}
        );
    },

    async update(id, data, options = {}) {
        const existingTag = await this.findById(id, options);
        if (!existingTag) return null;

        const fields = [];
        const values = [];
        const hasCreatedByColumn = await tagsTableHasCreatedByColumn();

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

        if (fields.length === 0) return existingTag;

        values.push(id);
        await run(`UPDATE tags SET ${fields.join(', ')} WHERE id = ?`, values);

        return await this.findById(id, hasCreatedByColumn ? options : {});
    },

    async delete(id, options = {}) {
        const existingTag = await this.findById(id, options);
        if (!existingTag) return null;
        return await run('DELETE FROM tags WHERE id = ?', [id]);
    },

    async syncFromLeads(options = {}) {
        const ownerUserId = parsePositiveInteger(options.owner_user_id, null);
        const createdBy = parsePositiveInteger(options.created_by, null);
        const hasCreatedByColumn = await tagsTableHasCreatedByColumn();

        let rows;
        if (ownerUserId) {
            rows = await query(`
                SELECT tags
                FROM leads
                WHERE owner_user_id = ?
                  AND tags IS NOT NULL
                  AND tags <> ''
            `, [ownerUserId]);
        } else {
            rows = await query("SELECT tags FROM leads WHERE tags IS NOT NULL AND tags <> ''");
        }
        if (!rows || rows.length === 0) return;

        const existingTags = await this.list(options);
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

            if (hasCreatedByColumn && (createdBy || ownerUserId)) {
                await run(
                    `INSERT INTO tags (name, color, description, created_by)
                     VALUES (?, ?, ?, ?)
                     ON CONFLICT(name) DO NOTHING`,
                    [tagName, DEFAULT_TAG_COLOR, null, createdBy || ownerUserId]
                );
            } else {
                await run(
                    `INSERT INTO tags (name, color, description)
                     VALUES (?, ?, ?)
                     ON CONFLICT(name) DO NOTHING`,
                    [tagName, DEFAULT_TAG_COLOR, null]
                );
            }
            existingKeys.add(key);
        }
    },

    async renameInLeads(previousName, nextName, options = {}) {
        const previousKey = normalizeTagKey(previousName);
        const sanitizedNext = normalizeTagValue(nextName);
        if (!previousKey || !sanitizedNext) return 0;

        const ownerUserId = parsePositiveInteger(options.owner_user_id, null);
        const leads = ownerUserId
            ? await query(`
                SELECT id, tags
                FROM leads
                WHERE owner_user_id = ?
                  AND tags IS NOT NULL
                  AND tags <> ''
            `, [ownerUserId])
            : await query("SELECT id, tags FROM leads WHERE tags IS NOT NULL AND tags <> ''");
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

    async removeFromLeads(tagName, options = {}) {
        const normalized = normalizeTagKey(tagName);
        if (!normalized) return 0;

        const ownerUserId = parsePositiveInteger(options.owner_user_id, null);
        const leads = ownerUserId
            ? await query(`
                SELECT id, tags
                FROM leads
                WHERE owner_user_id = ?
                  AND tags IS NOT NULL
                  AND tags <> ''
            `, [ownerUserId])
            : await query("SELECT id, tags FROM leads WHERE tags IS NOT NULL AND tags <> ''");
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
    
    async findById(id, options = {}) {
        const filters = ['webhooks.id = ?'];
        const params = [id];
        appendOwnerCreatedByFilters(filters, params, options, { tableAlias: 'webhooks' });

        return await queryOne(`
            SELECT webhooks.*
            FROM webhooks
            WHERE ${filters.join(' AND ')}
        `, params);
    },
    
    async findByEvent(event, options = {}) {
        const filters = [
            'webhooks.is_active = 1',
            'webhooks.events LIKE ?'
        ];
        const params = [`%"${event}"%`];
        appendOwnerCreatedByFilters(filters, params, options, { tableAlias: 'webhooks' });

        return await query(`
            SELECT webhooks.*
            FROM webhooks
            WHERE ${filters.join(' AND ')}
        `, params);
    },
    
    async list(options = {}) {
        const filters = [];
        const params = [];
        appendOwnerCreatedByFilters(filters, params, options, { tableAlias: 'webhooks' });

        const whereClause = filters.length > 0
            ? `WHERE ${filters.join(' AND ')}`
            : '';

        return await query(`
            SELECT webhooks.*
            FROM webhooks
            ${whereClause}
            ORDER BY webhooks.name ASC
        `, params);
    },
    
    async update(id, data, options = {}) {
        const existing = await this.findById(id, options);
        if (!existing) return null;

        const fields = [];
        const values = [];
        
        const allowedFields = ['name', 'url', 'secret', 'events', 'headers', 'is_active', 'retry_count'];
        
        for (const [key, value] of Object.entries(data)) {
            if (allowedFields.includes(key)) {
                fields.push(`${key} = ?`);
                values.push(typeof value === 'object' ? JSON.stringify(value) : value);
            }
        }
        
        if (fields.length === 0) return existing;
        
        fields.push("updated_at = CURRENT_TIMESTAMP");
        values.push(id);
        
        await run(`UPDATE webhooks SET ${fields.join(', ')} WHERE id = ?`, values);
        return await this.findById(id, options);
    },
    
    async logTrigger(webhookId, event, payload, responseStatus, responseBody, durationMs) {
        return await run(`
            INSERT INTO webhook_logs (webhook_id, event, payload, response_status, response_body, duration_ms)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [webhookId, event, JSON.stringify(payload), responseStatus, responseBody, durationMs]);
    },
    
    async delete(id, options = {}) {
        const existing = await this.findById(id, options);
        if (!existing) return null;
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
        const ownerUserId = Number(data.owner_user_id);
        const normalizedOwnerUserId = Number.isInteger(ownerUserId) && ownerUserId > 0 ? ownerUserId : null;
        const hasEmailConfirmed = Object.prototype.hasOwnProperty.call(data, 'email_confirmed');
        const hasEmailConfirmedAt = Object.prototype.hasOwnProperty.call(data, 'email_confirmed_at');
        const hasEmailConfirmationTokenHash = Object.prototype.hasOwnProperty.call(data, 'email_confirmation_token_hash');
        const hasEmailConfirmationExpiresAt = Object.prototype.hasOwnProperty.call(data, 'email_confirmation_expires_at');
        
        const result = await run(`
            INSERT INTO users (
                uuid,
                name,
                email,
                password_hash,
                email_confirmed,
                email_confirmed_at,
                email_confirmation_token_hash,
                email_confirmation_expires_at,
                role,
                avatar_url,
                owner_user_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            uuid,
            safeName,
            data.email,
            data.password_hash,
            hasEmailConfirmed ? (Number(data.email_confirmed) > 0 ? 1 : 0) : 1,
            hasEmailConfirmedAt ? (data.email_confirmed_at || null) : null,
            hasEmailConfirmationTokenHash ? (String(data.email_confirmation_token_hash || '').trim() || null) : null,
            hasEmailConfirmationExpiresAt ? (data.email_confirmation_expires_at || null) : null,
            data.role || 'agent',
            data.avatar_url,
            normalizedOwnerUserId
        ]);
        
        return { id: result.lastInsertRowid, uuid };
    },
    
    async findById(id) {
        return await queryOne(
            'SELECT id, uuid, name, email, role, avatar_url, is_active, owner_user_id, email_confirmed, email_confirmed_at, last_login_at, created_at FROM users WHERE id = ?',
            [id]
        );
    },

    async findByIdWithPassword(id) {
        return await queryOne('SELECT * FROM users WHERE id = ?', [id]);
    },
    
    async findByEmail(email, options = {}) {
        const normalizedEmail = String(email || '').trim().toLowerCase();
        if (!normalizedEmail) return null;

        const includeInactive = options?.includeInactive !== false;
        const whereActive = includeInactive ? '' : ' AND is_active = 1';
        return await queryOne(
            `SELECT *
             FROM users
             WHERE email = ?${whereActive}
             ORDER BY is_active DESC, id DESC
             LIMIT 1`,
            [normalizedEmail]
        );
    },

    async findActiveByEmail(email) {
        return await this.findByEmail(email, { includeInactive: false });
    },

    async findByEmailConfirmationTokenHash(tokenHash) {
        const normalizedHash = String(tokenHash || '').trim().toLowerCase();
        if (!normalizedHash) return null;
        return await queryOne(
            `SELECT *
             FROM users
             WHERE email_confirmation_token_hash = ?
             ORDER BY id DESC
             LIMIT 1`,
            [normalizedHash]
        );
    },

    async consumeEmailConfirmationToken(tokenHash) {
        const normalizedHash = String(tokenHash || '').trim().toLowerCase();
        if (!normalizedHash) return null;
        return await queryOne(
            `UPDATE users
             SET email_confirmed = 1,
                 email_confirmed_at = CURRENT_TIMESTAMP,
                 email_confirmation_token_hash = NULL,
                 email_confirmation_expires_at = NULL,
                 updated_at = CURRENT_TIMESTAMP
             WHERE email_confirmation_token_hash = ?
               AND COALESCE(email_confirmed, 1) = 0
               AND (
                    email_confirmation_expires_at IS NULL
                    OR email_confirmation_expires_at >= CURRENT_TIMESTAMP
               )
             RETURNING id, uuid, name, email, role, avatar_url, is_active, owner_user_id, email_confirmed, email_confirmed_at, last_login_at, created_at`,
            [normalizedHash]
        );
    },
    
    async updateLastLogin(id) {
        return await run("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?", [id]);
    },
    
    async list() {
        return await query('SELECT id, uuid, name, email, role, avatar_url, is_active, owner_user_id, email_confirmed, email_confirmed_at, last_login_at, created_at FROM users WHERE is_active = 1 ORDER BY name ASC');
    },

    async listAll() {
        return await query('SELECT id, uuid, name, email, role, avatar_url, is_active, owner_user_id, email_confirmed, email_confirmed_at, last_login_at, created_at FROM users ORDER BY name ASC');
    },

    async listByOwner(ownerUserId, options = {}) {
        const ownerId = Number(ownerUserId);
        if (!Number.isInteger(ownerId) || ownerId <= 0) return [];

        const includeInactive = options?.includeInactive === true;
        const whereActive = includeInactive ? '' : ' AND is_active = 1';
        return await query(
            `SELECT id, uuid, name, email, role, avatar_url, is_active, owner_user_id, email_confirmed, email_confirmed_at, last_login_at, created_at
             FROM users
             WHERE owner_user_id = ?${whereActive}
             ORDER BY name ASC`,
            [ownerId]
        );
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

        if (Object.prototype.hasOwnProperty.call(data, 'email_confirmed')) {
            updates.push('email_confirmed = ?');
            params.push(Number(data.email_confirmed) > 0 ? 1 : 0);
        }

        if (Object.prototype.hasOwnProperty.call(data, 'email_confirmed_at')) {
            updates.push('email_confirmed_at = ?');
            params.push(data.email_confirmed_at || null);
        }

        if (Object.prototype.hasOwnProperty.call(data, 'email_confirmation_token_hash')) {
            updates.push('email_confirmation_token_hash = ?');
            params.push(String(data.email_confirmation_token_hash || '').trim() || null);
        }

        if (Object.prototype.hasOwnProperty.call(data, 'email_confirmation_expires_at')) {
            updates.push('email_confirmation_expires_at = ?');
            params.push(data.email_confirmation_expires_at || null);
        }

        if (Object.prototype.hasOwnProperty.call(data, 'is_active')) {
            updates.push('is_active = ?');
            params.push(Number(data.is_active) > 0 ? 1 : 0);
        }

        if (Object.prototype.hasOwnProperty.call(data, 'owner_user_id')) {
            const ownerUserId = Number(data.owner_user_id);
            const normalizedOwnerUserId = Number.isInteger(ownerUserId) && ownerUserId > 0 ? ownerUserId : null;
            updates.push('owner_user_id = ?');
            params.push(normalizedOwnerUserId);
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
