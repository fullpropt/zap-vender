const { queryOne, query } = require('../database/connection');

const PLAN_DEFINITIONS = Object.freeze({
    starter: Object.freeze({
        code: 'starter',
        name: 'Starter',
        maxWhatsAppSessions: 1,
        maxContacts: 1000
    }),
    premium: Object.freeze({
        code: 'premium',
        name: 'Premium',
        maxWhatsAppSessions: 3,
        maxContacts: null
    }),
    advanced: Object.freeze({
        code: 'advanced',
        name: 'Avancado',
        maxWhatsAppSessions: 5,
        maxContacts: null
    }),
    monster: Object.freeze({
        code: 'monster',
        name: 'Monster',
        maxWhatsAppSessions: null,
        maxContacts: null
    }),
    unknown: Object.freeze({
        code: 'unknown',
        name: 'Plano',
        maxWhatsAppSessions: null,
        maxContacts: null
    })
});

const PLAN_LIMIT_ERROR_CODES = new Set([
    'PLAN_CONTACT_LIMIT_REACHED',
    'PLAN_WHATSAPP_SESSION_LIMIT_REACHED'
]);

function normalizeTextToken(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ');
}

function normalizePlanCode(value) {
    const normalized = normalizeTextToken(value);
    if (!normalized) return '';
    if (normalized === 'starter') return 'starter';
    if (normalized === 'premium') return 'premium';
    if (normalized === 'advanced' || normalized === 'avancado') return 'advanced';
    if (normalized === 'monster') return 'monster';
    return normalized;
}

function getPlanDefinition(planCodeOrName) {
    const normalizedCode = normalizePlanCode(
        typeof planCodeOrName === 'object'
            ? (planCodeOrName?.code || planCodeOrName?.name)
            : planCodeOrName
    );

    if (normalizedCode && PLAN_DEFINITIONS[normalizedCode]) {
        return PLAN_DEFINITIONS[normalizedCode];
    }

    return PLAN_DEFINITIONS.unknown;
}

function buildPlanSettingsKey(ownerUserId, suffix) {
    return `user:${ownerUserId}:${suffix}`;
}

function toPositiveInteger(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    const normalized = Math.floor(parsed);
    return normalized > 0 ? normalized : null;
}

function isFiniteLimit(value) {
    return Number.isInteger(value) && value >= 0;
}

function createPlanLimitError({ code, message, limit, current, requested, plan }) {
    const error = new Error(message);
    error.code = code;
    error.statusCode = 409;
    error.limit = limit;
    error.current = current;
    error.requested = requested;
    error.planCode = plan?.code || '';
    error.planName = plan?.name || 'Plano';
    return error;
}

async function resolveOwnerPlan(ownerUserId) {
    const normalizedOwnerUserId = toPositiveInteger(ownerUserId);
    if (!normalizedOwnerUserId) {
        return {
            ...PLAN_DEFINITIONS.unknown,
            source: 'missing_owner'
        };
    }

    const planCodeKey = buildPlanSettingsKey(normalizedOwnerUserId, 'plan_code');
    const planNameKey = buildPlanSettingsKey(normalizedOwnerUserId, 'plan_name');
    const rows = await query(
        'SELECT key, value FROM settings WHERE key IN (?, ?)',
        [planCodeKey, planNameKey]
    );

    const valuesByKey = new Map(
        (rows || []).map((row) => [String(row?.key || ''), String(row?.value || '').trim()])
    );

    const configuredCode = valuesByKey.get(planCodeKey) || '';
    const configuredName = valuesByKey.get(planNameKey) || '';
    const resolvedPlan = getPlanDefinition(configuredCode || configuredName);

    return {
        ...resolvedPlan,
        configuredCode,
        configuredName,
        source: configuredCode || configuredName ? 'settings' : 'default'
    };
}

async function countOwnerContacts(ownerUserId) {
    const normalizedOwnerUserId = toPositiveInteger(ownerUserId);
    if (!normalizedOwnerUserId) return 0;

    const row = await queryOne(`
        SELECT COUNT(*)::int AS total
        FROM leads
        WHERE (
            leads.owner_user_id = ?
            OR (
                leads.owner_user_id IS NULL
                AND EXISTS (
                    SELECT 1
                    FROM users owner_scope
                    WHERE owner_scope.id = leads.assigned_to
                      AND (owner_scope.owner_user_id = ? OR owner_scope.id = ?)
                )
            )
        )
    `, [normalizedOwnerUserId, normalizedOwnerUserId, normalizedOwnerUserId]);

    return Math.max(0, Number(row?.total || 0) || 0);
}

async function countOwnerWhatsAppSessions(ownerUserId) {
    const normalizedOwnerUserId = toPositiveInteger(ownerUserId);
    if (!normalizedOwnerUserId) return 0;

    const row = await queryOne(`
        SELECT COUNT(*)::int AS total
        FROM whatsapp_sessions
        WHERE (
            whatsapp_sessions.created_by = ?
            OR EXISTS (
                SELECT 1
                FROM users u
                WHERE u.id = whatsapp_sessions.created_by
                  AND (u.owner_user_id = ? OR u.id = ?)
            )
        )
    `, [normalizedOwnerUserId, normalizedOwnerUserId, normalizedOwnerUserId]);

    return Math.max(0, Number(row?.total || 0) || 0);
}

async function assertOwnerCanCreateLead(ownerUserId, requestedNewContacts = 1) {
    const normalizedOwnerUserId = toPositiveInteger(ownerUserId);
    if (!normalizedOwnerUserId) return;

    const requested = Math.max(0, Number(requestedNewContacts) || 0);
    if (requested <= 0) return;

    const plan = await resolveOwnerPlan(normalizedOwnerUserId);
    if (!isFiniteLimit(plan.maxContacts)) return;

    const current = await countOwnerContacts(normalizedOwnerUserId);
    if (current + requested <= plan.maxContacts) return;

    throw createPlanLimitError({
        code: 'PLAN_CONTACT_LIMIT_REACHED',
        message: `Seu plano ${plan.name} permite ate ${plan.maxContacts} contatos. Remova contatos existentes ou altere seu plano para cadastrar novos.`,
        limit: plan.maxContacts,
        current,
        requested,
        plan
    });
}

async function assertOwnerCanCreateWhatsAppSession(ownerUserId, requestedNewSessions = 1) {
    const normalizedOwnerUserId = toPositiveInteger(ownerUserId);
    if (!normalizedOwnerUserId) return;

    const requested = Math.max(0, Number(requestedNewSessions) || 0);
    if (requested <= 0) return;

    const plan = await resolveOwnerPlan(normalizedOwnerUserId);
    if (!isFiniteLimit(plan.maxWhatsAppSessions)) return;

    const current = await countOwnerWhatsAppSessions(normalizedOwnerUserId);
    if (current + requested <= plan.maxWhatsAppSessions) return;

    throw createPlanLimitError({
        code: 'PLAN_WHATSAPP_SESSION_LIMIT_REACHED',
        message: `Seu plano ${plan.name} permite ate ${plan.maxWhatsAppSessions} conex${plan.maxWhatsAppSessions === 1 ? 'ao' : 'oes'} WhatsApp. Remova uma conta existente ou altere seu plano para adicionar outra.`,
        limit: plan.maxWhatsAppSessions,
        current,
        requested,
        plan
    });
}

function isPlanLimitError(error) {
    return PLAN_LIMIT_ERROR_CODES.has(String(error?.code || '').trim());
}

module.exports = {
    PLAN_DEFINITIONS,
    assertOwnerCanCreateLead,
    assertOwnerCanCreateWhatsAppSession,
    countOwnerContacts,
    countOwnerWhatsAppSessions,
    getPlanDefinition,
    isPlanLimitError,
    normalizePlanCode,
    resolveOwnerPlan
};
