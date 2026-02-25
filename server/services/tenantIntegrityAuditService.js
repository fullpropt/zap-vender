const crypto = require('crypto');
const { queryOne, query } = require('../database/connection');

function parsePositiveInteger(value, fallback = null) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    const normalized = Math.floor(num);
    return normalized > 0 ? normalized : fallback;
}

function normalizeCount(value) {
    const num = Number(value || 0);
    return Number.isFinite(num) ? Math.max(0, Math.floor(num)) : 0;
}

function normalizeSampleLimit(value, fallback = 10) {
    const parsed = parsePositiveInteger(value, fallback);
    return Math.min(Math.max(parsed || fallback, 1), 100);
}

function buildFingerprint(checks = []) {
    const payload = JSON.stringify(
        (checks || []).map((check) => [check.code, normalizeCount(check.total)])
    );
    return crypto.createHash('sha256').update(payload).digest('hex');
}

function buildSummary(checks = []) {
    const normalizedChecks = Array.isArray(checks) ? checks : [];
    let checksWithIssues = 0;
    let totalIssueRows = 0;

    for (const check of normalizedChecks) {
        const total = normalizeCount(check?.total);
        if (total <= 0) continue;
        checksWithIssues += 1;
        totalIssueRows += total;
    }

    return {
        totalChecks: normalizedChecks.length,
        checksWithIssues,
        totalIssueRows,
        isHealthy: checksWithIssues === 0
    };
}

async function executeCount(sql, params) {
    const row = await queryOne(sql, params);
    return normalizeCount(row?.total);
}

function shouldRunCheckForScope(appliesTo, ownerUserId) {
    if (!ownerUserId) return true;
    if (!appliesTo || appliesTo === 'both') return true;
    return appliesTo === 'owner';
}

async function runAudit(options = {}) {
    const ownerUserId = parsePositiveInteger(
        options.ownerUserId !== undefined ? options.ownerUserId : options.owner_user_id,
        null
    );
    const sampleLimit = normalizeSampleLimit(options.sampleLimit !== undefined ? options.sampleLimit : options.sample_limit, 10);

    const checks = [];
    const samples = {};
    const skippedChecks = [];

    async function addCheck(config) {
        const appliesTo = config?.appliesTo || 'both';
        if (!shouldRunCheckForScope(appliesTo, ownerUserId)) {
            skippedChecks.push({
                code: String(config?.code || 'unknown'),
                reason: 'global_only'
            });
            return;
        }

        const countSql = typeof config?.countSql === 'function'
            ? config.countSql(ownerUserId)
            : String(config?.countSql || '').trim();
        const countParams = typeof config?.countParams === 'function'
            ? config.countParams(ownerUserId)
            : (Array.isArray(config?.countParams) ? config.countParams : []);

        if (!countSql) {
            skippedChecks.push({
                code: String(config?.code || 'unknown'),
                reason: 'missing_sql'
            });
            return;
        }

        const total = await executeCount(countSql, countParams);
        const checkInfo = {
            code: String(config.code || 'unknown'),
            severity: String(config.severity || 'warn'),
            description: String(config.description || ''),
            total
        };
        checks.push(checkInfo);

        if (total <= 0) return;

        const sampleSql = typeof config?.sampleSql === 'function'
            ? config.sampleSql(ownerUserId, sampleLimit)
            : String(config?.sampleSql || '').trim();
        if (!sampleSql) return;

        const sampleParams = typeof config?.sampleParams === 'function'
            ? config.sampleParams(ownerUserId, sampleLimit)
            : (Array.isArray(config?.sampleParams) ? config.sampleParams : []);
        const rows = await query(sampleSql, sampleParams);
        samples[checkInfo.code] = Array.isArray(rows) ? rows : [];
    }

    await addCheck({
        code: 'users_missing_owner',
        severity: 'high',
        appliesTo: 'global',
        description: 'Usuarios sem owner_user_id definido',
        countSql: `SELECT COUNT(*) AS total FROM users WHERE owner_user_id IS NULL OR owner_user_id = 0`,
        sampleSql: (_owner, limit) => `
            SELECT id, role, owner_user_id
            FROM users
            WHERE owner_user_id IS NULL OR owner_user_id = 0
            ORDER BY id ASC
            LIMIT ${limit}
        `
    });

    await addCheck({
        code: 'users_owner_not_found',
        severity: 'high',
        appliesTo: ownerUserId ? 'owner' : 'global',
        description: 'Usuarios apontando para owner inexistente',
        countSql: (owner) => `
            SELECT COUNT(*) AS total
            FROM users u
            LEFT JOIN users ou ON ou.id = u.owner_user_id
            WHERE u.owner_user_id IS NOT NULL
              AND u.owner_user_id <> 0
              AND ou.id IS NULL
              ${owner ? 'AND (u.id = ? OR u.owner_user_id = ?)' : ''}
        `,
        countParams: (owner) => owner ? [owner, owner] : [],
        sampleSql: (owner, limit) => `
            SELECT u.id, u.owner_user_id, u.role
            FROM users u
            LEFT JOIN users ou ON ou.id = u.owner_user_id
            WHERE u.owner_user_id IS NOT NULL
              AND u.owner_user_id <> 0
              AND ou.id IS NULL
              ${owner ? 'AND (u.id = ? OR u.owner_user_id = ?)' : ''}
            ORDER BY u.id ASC
            LIMIT ${limit}
        `,
        sampleParams: (owner) => owner ? [owner, owner] : []
    });

    await addCheck({
        code: 'leads_missing_owner',
        severity: 'high',
        appliesTo: 'global',
        description: 'Leads sem owner_user_id definido',
        countSql: `SELECT COUNT(*) AS total FROM leads WHERE owner_user_id IS NULL OR owner_user_id = 0`,
        sampleSql: (_owner, limit) => `
            SELECT id, assigned_to, owner_user_id
            FROM leads
            WHERE owner_user_id IS NULL OR owner_user_id = 0
            ORDER BY id ASC
            LIMIT ${limit}
        `
    });

    await addCheck({
        code: 'leads_owner_not_found',
        severity: 'high',
        appliesTo: 'global',
        description: 'Leads com owner_user_id inexistente',
        countSql: `
            SELECT COUNT(*) AS total
            FROM leads l
            LEFT JOIN users ou ON ou.id = l.owner_user_id
            WHERE l.owner_user_id IS NOT NULL
              AND l.owner_user_id <> 0
              AND ou.id IS NULL
        `,
        sampleSql: (_owner, limit) => `
            SELECT l.id, l.owner_user_id, l.assigned_to
            FROM leads l
            LEFT JOIN users ou ON ou.id = l.owner_user_id
            WHERE l.owner_user_id IS NOT NULL
              AND l.owner_user_id <> 0
              AND ou.id IS NULL
            ORDER BY l.id ASC
            LIMIT ${limit}
        `
    });

    await addCheck({
        code: 'leads_assigned_user_not_found',
        severity: 'medium',
        description: 'Leads com assigned_to inexistente',
        countSql: (owner) => `
            SELECT COUNT(*) AS total
            FROM leads l
            LEFT JOIN users au ON au.id = l.assigned_to
            WHERE l.assigned_to IS NOT NULL
              AND l.assigned_to <> 0
              AND au.id IS NULL
              ${owner ? 'AND l.owner_user_id = ?' : ''}
        `,
        countParams: (owner) => owner ? [owner] : [],
        sampleSql: (owner, limit) => `
            SELECT l.id, l.owner_user_id, l.assigned_to
            FROM leads l
            LEFT JOIN users au ON au.id = l.assigned_to
            WHERE l.assigned_to IS NOT NULL
              AND l.assigned_to <> 0
              AND au.id IS NULL
              ${owner ? 'AND l.owner_user_id = ?' : ''}
            ORDER BY l.id ASC
            LIMIT ${limit}
        `,
        sampleParams: (owner) => owner ? [owner] : []
    });

    await addCheck({
        code: 'leads_owner_vs_assignee_owner_mismatch',
        severity: 'high',
        description: 'Lead aponta para owner diferente do owner do usuario atribuido',
        countSql: (owner) => `
            SELECT COUNT(*) AS total
            FROM leads l
            JOIN users au ON au.id = l.assigned_to
            WHERE l.assigned_to IS NOT NULL
              AND l.assigned_to <> 0
              AND l.owner_user_id IS NOT NULL
              AND l.owner_user_id <> 0
              AND COALESCE(NULLIF(au.owner_user_id, 0), au.id) <> l.owner_user_id
              ${owner ? 'AND l.owner_user_id = ?' : ''}
        `,
        countParams: (owner) => owner ? [owner] : [],
        sampleSql: (owner, limit) => `
            SELECT
                l.id AS lead_id,
                l.owner_user_id AS lead_owner_user_id,
                l.assigned_to,
                COALESCE(NULLIF(au.owner_user_id, 0), au.id) AS assignee_owner_user_id
            FROM leads l
            JOIN users au ON au.id = l.assigned_to
            WHERE l.assigned_to IS NOT NULL
              AND l.assigned_to <> 0
              AND l.owner_user_id IS NOT NULL
              AND l.owner_user_id <> 0
              AND COALESCE(NULLIF(au.owner_user_id, 0), au.id) <> l.owner_user_id
              ${owner ? 'AND l.owner_user_id = ?' : ''}
            ORDER BY l.id ASC
            LIMIT ${limit}
        `,
        sampleParams: (owner) => owner ? [owner] : []
    });

    await addCheck({
        code: 'sessions_missing_created_by',
        severity: 'high',
        appliesTo: 'global',
        description: 'Sessoes WhatsApp sem created_by',
        countSql: `SELECT COUNT(*) AS total FROM whatsapp_sessions WHERE created_by IS NULL OR created_by = 0`,
        sampleSql: (_owner, limit) => `
            SELECT id, session_id, created_by, status
            FROM whatsapp_sessions
            WHERE created_by IS NULL OR created_by = 0
            ORDER BY id ASC
            LIMIT ${limit}
        `
    });

    await addCheck({
        code: 'sessions_created_by_not_found',
        severity: 'high',
        appliesTo: 'global',
        description: 'Sessoes WhatsApp apontando para usuario inexistente',
        countSql: `
            SELECT COUNT(*) AS total
            FROM whatsapp_sessions s
            LEFT JOIN users u ON u.id = s.created_by
            WHERE s.created_by IS NOT NULL
              AND s.created_by <> 0
              AND u.id IS NULL
        `,
        sampleSql: (_owner, limit) => `
            SELECT s.id, s.session_id, s.created_by, s.status
            FROM whatsapp_sessions s
            LEFT JOIN users u ON u.id = s.created_by
            WHERE s.created_by IS NOT NULL
              AND s.created_by <> 0
              AND u.id IS NULL
            ORDER BY s.id ASC
            LIMIT ${limit}
        `
    });

    await addCheck({
        code: 'sessions_created_by_is_non_owner_user',
        severity: 'high',
        description: 'Sessoes WhatsApp criadas por usuario que nao e owner da conta',
        countSql: (owner) => `
            SELECT COUNT(*) AS total
            FROM whatsapp_sessions s
            JOIN users u ON u.id = s.created_by
            WHERE COALESCE(NULLIF(u.owner_user_id, 0), u.id) <> u.id
              ${owner ? 'AND COALESCE(NULLIF(u.owner_user_id, 0), u.id) = ?' : ''}
        `,
        countParams: (owner) => owner ? [owner] : [],
        sampleSql: (owner, limit) => `
            SELECT
                s.id,
                s.session_id,
                s.created_by,
                COALESCE(NULLIF(u.owner_user_id, 0), u.id) AS creator_owner_user_id
            FROM whatsapp_sessions s
            JOIN users u ON u.id = s.created_by
            WHERE COALESCE(NULLIF(u.owner_user_id, 0), u.id) <> u.id
              ${owner ? 'AND COALESCE(NULLIF(u.owner_user_id, 0), u.id) = ?' : ''}
            ORDER BY s.id ASC
            LIMIT ${limit}
        `,
        sampleParams: (owner) => owner ? [owner] : []
    });

    await addCheck({
        code: 'conversations_lead_not_found',
        severity: 'high',
        appliesTo: 'global',
        description: 'Conversas sem lead correspondente',
        countSql: `
            SELECT COUNT(*) AS total
            FROM conversations c
            LEFT JOIN leads l ON l.id = c.lead_id
            WHERE c.lead_id IS NOT NULL
              AND l.id IS NULL
        `,
        sampleSql: (_owner, limit) => `
            SELECT c.id, c.lead_id, c.session_id, c.assigned_to
            FROM conversations c
            LEFT JOIN leads l ON l.id = c.lead_id
            WHERE c.lead_id IS NOT NULL
              AND l.id IS NULL
            ORDER BY c.id ASC
            LIMIT ${limit}
        `
    });

    await addCheck({
        code: 'conversations_session_not_found',
        severity: 'high',
        description: 'Conversas apontando para sessao WhatsApp inexistente',
        countSql: (owner) => `
            SELECT COUNT(*) AS total
            FROM conversations c
            LEFT JOIN leads l ON l.id = c.lead_id
            LEFT JOIN whatsapp_sessions s ON s.session_id = c.session_id
            WHERE c.session_id IS NOT NULL
              AND s.session_id IS NULL
              ${owner ? 'AND l.owner_user_id = ?' : ''}
        `,
        countParams: (owner) => owner ? [owner] : [],
        sampleSql: (owner, limit) => `
            SELECT c.id, c.lead_id, l.owner_user_id AS lead_owner_user_id, c.session_id, c.assigned_to
            FROM conversations c
            LEFT JOIN leads l ON l.id = c.lead_id
            LEFT JOIN whatsapp_sessions s ON s.session_id = c.session_id
            WHERE c.session_id IS NOT NULL
              AND s.session_id IS NULL
              ${owner ? 'AND l.owner_user_id = ?' : ''}
            ORDER BY c.id ASC
            LIMIT ${limit}
        `,
        sampleParams: (owner) => owner ? [owner] : []
    });

    await addCheck({
        code: 'conversations_assigned_user_not_found',
        severity: 'medium',
        description: 'Conversas com assigned_to inexistente',
        countSql: (owner) => `
            SELECT COUNT(*) AS total
            FROM conversations c
            LEFT JOIN leads l ON l.id = c.lead_id
            LEFT JOIN users u ON u.id = c.assigned_to
            WHERE c.assigned_to IS NOT NULL
              AND c.assigned_to <> 0
              AND u.id IS NULL
              ${owner ? 'AND l.owner_user_id = ?' : ''}
        `,
        countParams: (owner) => owner ? [owner] : [],
        sampleSql: (owner, limit) => `
            SELECT c.id, c.lead_id, l.owner_user_id AS lead_owner_user_id, c.session_id, c.assigned_to
            FROM conversations c
            LEFT JOIN leads l ON l.id = c.lead_id
            LEFT JOIN users u ON u.id = c.assigned_to
            WHERE c.assigned_to IS NOT NULL
              AND c.assigned_to <> 0
              AND u.id IS NULL
              ${owner ? 'AND l.owner_user_id = ?' : ''}
            ORDER BY c.id ASC
            LIMIT ${limit}
        `,
        sampleParams: (owner) => owner ? [owner] : []
    });

    await addCheck({
        code: 'conversations_lead_owner_vs_session_owner_mismatch',
        severity: 'critical',
        description: 'Conversa vinculada a lead e sessao de owners diferentes',
        countSql: (owner) => `
            SELECT COUNT(*) AS total
            FROM conversations c
            JOIN leads l ON l.id = c.lead_id
            JOIN whatsapp_sessions s ON s.session_id = c.session_id
            WHERE l.owner_user_id IS NOT NULL
              AND l.owner_user_id <> 0
              AND s.created_by IS NOT NULL
              AND s.created_by <> 0
              AND l.owner_user_id <> s.created_by
              ${owner ? 'AND (l.owner_user_id = ? OR s.created_by = ?)' : ''}
        `,
        countParams: (owner) => owner ? [owner, owner] : [],
        sampleSql: (owner, limit) => `
            SELECT
                c.id AS conversation_id,
                c.lead_id,
                l.owner_user_id AS lead_owner_user_id,
                c.session_id,
                s.created_by AS session_owner_user_id,
                c.assigned_to
            FROM conversations c
            JOIN leads l ON l.id = c.lead_id
            JOIN whatsapp_sessions s ON s.session_id = c.session_id
            WHERE l.owner_user_id IS NOT NULL
              AND l.owner_user_id <> 0
              AND s.created_by IS NOT NULL
              AND s.created_by <> 0
              AND l.owner_user_id <> s.created_by
              ${owner ? 'AND (l.owner_user_id = ? OR s.created_by = ?)' : ''}
            ORDER BY c.id ASC
            LIMIT ${limit}
        `,
        sampleParams: (owner) => owner ? [owner, owner] : []
    });

    await addCheck({
        code: 'conversations_assignee_owner_vs_lead_owner_mismatch',
        severity: 'high',
        description: 'Owner do usuario atribuido na conversa difere do owner do lead',
        countSql: (owner) => `
            SELECT COUNT(*) AS total
            FROM conversations c
            JOIN leads l ON l.id = c.lead_id
            JOIN users au ON au.id = c.assigned_to
            WHERE c.assigned_to IS NOT NULL
              AND c.assigned_to <> 0
              AND l.owner_user_id IS NOT NULL
              AND l.owner_user_id <> 0
              AND COALESCE(NULLIF(au.owner_user_id, 0), au.id) <> l.owner_user_id
              ${owner ? 'AND l.owner_user_id = ?' : ''}
        `,
        countParams: (owner) => owner ? [owner] : [],
        sampleSql: (owner, limit) => `
            SELECT
                c.id AS conversation_id,
                c.lead_id,
                l.owner_user_id AS lead_owner_user_id,
                c.assigned_to,
                COALESCE(NULLIF(au.owner_user_id, 0), au.id) AS assignee_owner_user_id,
                c.session_id
            FROM conversations c
            JOIN leads l ON l.id = c.lead_id
            JOIN users au ON au.id = c.assigned_to
            WHERE c.assigned_to IS NOT NULL
              AND c.assigned_to <> 0
              AND l.owner_user_id IS NOT NULL
              AND l.owner_user_id <> 0
              AND COALESCE(NULLIF(au.owner_user_id, 0), au.id) <> l.owner_user_id
              ${owner ? 'AND l.owner_user_id = ?' : ''}
            ORDER BY c.id ASC
            LIMIT ${limit}
        `,
        sampleParams: (owner) => owner ? [owner] : []
    });

    await addCheck({
        code: 'tags_created_by_not_found',
        severity: 'medium',
        appliesTo: 'global',
        description: 'Tags com created_by inexistente',
        countSql: `
            SELECT COUNT(*) AS total
            FROM tags t
            LEFT JOIN users u ON u.id = t.created_by
            WHERE t.created_by IS NOT NULL
              AND t.created_by <> 0
              AND u.id IS NULL
        `,
        sampleSql: (_owner, limit) => `
            SELECT t.id, t.name, t.created_by
            FROM tags t
            LEFT JOIN users u ON u.id = t.created_by
            WHERE t.created_by IS NOT NULL
              AND t.created_by <> 0
              AND u.id IS NULL
            ORDER BY t.id ASC
            LIMIT ${limit}
        `
    });

    await addCheck({
        code: 'tags_created_by_is_non_owner_user',
        severity: 'medium',
        description: 'Tags criadas por usuario que nao e owner da conta',
        countSql: (owner) => `
            SELECT COUNT(*) AS total
            FROM tags t
            JOIN users u ON u.id = t.created_by
            WHERE COALESCE(NULLIF(u.owner_user_id, 0), u.id) <> u.id
              ${owner ? 'AND COALESCE(NULLIF(u.owner_user_id, 0), u.id) = ?' : ''}
        `,
        countParams: (owner) => owner ? [owner] : [],
        sampleSql: (owner, limit) => `
            SELECT
                t.id,
                t.name,
                t.created_by,
                COALESCE(NULLIF(u.owner_user_id, 0), u.id) AS creator_owner_user_id
            FROM tags t
            JOIN users u ON u.id = t.created_by
            WHERE COALESCE(NULLIF(u.owner_user_id, 0), u.id) <> u.id
              ${owner ? 'AND COALESCE(NULLIF(u.owner_user_id, 0), u.id) = ?' : ''}
            ORDER BY t.id ASC
            LIMIT ${limit}
        `,
        sampleParams: (owner) => owner ? [owner] : []
    });

    await addCheck({
        code: 'webhooks_created_by_not_found',
        severity: 'medium',
        appliesTo: 'global',
        description: 'Webhooks com created_by inexistente',
        countSql: `
            SELECT COUNT(*) AS total
            FROM webhooks w
            LEFT JOIN users u ON u.id = w.created_by
            WHERE w.created_by IS NOT NULL
              AND w.created_by <> 0
              AND u.id IS NULL
        `,
        sampleSql: (_owner, limit) => `
            SELECT w.id, w.uuid, w.created_by, w.is_active
            FROM webhooks w
            LEFT JOIN users u ON u.id = w.created_by
            WHERE w.created_by IS NOT NULL
              AND w.created_by <> 0
              AND u.id IS NULL
            ORDER BY w.id ASC
            LIMIT ${limit}
        `
    });

    await addCheck({
        code: 'webhooks_created_by_is_non_owner_user',
        severity: 'medium',
        description: 'Webhooks criados por usuario que nao e owner da conta',
        countSql: (owner) => `
            SELECT COUNT(*) AS total
            FROM webhooks w
            JOIN users u ON u.id = w.created_by
            WHERE COALESCE(NULLIF(u.owner_user_id, 0), u.id) <> u.id
              ${owner ? 'AND COALESCE(NULLIF(u.owner_user_id, 0), u.id) = ?' : ''}
        `,
        countParams: (owner) => owner ? [owner] : [],
        sampleSql: (owner, limit) => `
            SELECT
                w.id,
                w.uuid,
                w.created_by,
                COALESCE(NULLIF(u.owner_user_id, 0), u.id) AS creator_owner_user_id,
                w.is_active
            FROM webhooks w
            JOIN users u ON u.id = w.created_by
            WHERE COALESCE(NULLIF(u.owner_user_id, 0), u.id) <> u.id
              ${owner ? 'AND COALESCE(NULLIF(u.owner_user_id, 0), u.id) = ?' : ''}
            ORDER BY w.id ASC
            LIMIT ${limit}
        `,
        sampleParams: (owner) => owner ? [owner] : []
    });

    const summary = buildSummary(checks);
    const result = {
        generatedAt: new Date().toISOString(),
        scope: ownerUserId ? 'owner' : 'global',
        ownerUserId: ownerUserId || null,
        sampleLimit,
        summary,
        checks,
        samples,
        skippedChecks,
        fingerprint: buildFingerprint(checks)
    };

    return result;
}

function compactResultForLog(result) {
    if (!result || typeof result !== 'object') return null;

    return {
        generatedAt: result.generatedAt || null,
        scope: result.scope || 'global',
        ownerUserId: result.ownerUserId || null,
        summary: result.summary || buildSummary([]),
        checks: Array.isArray(result.checks)
            ? result.checks.map((item) => ({
                code: item.code,
                total: normalizeCount(item.total),
                severity: item.severity
            }))
            : [],
        fingerprint: result.fingerprint || null
    };
}

module.exports = {
    runAudit,
    buildSummary,
    compactResultForLog
};
