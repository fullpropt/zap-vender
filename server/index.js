/**

 * SELF PROTEÃ‡ÃƒO VEICULAR - SERVIDOR PRINCIPAL v4.1

 * Carregado por server/start.js (bootstrap) apÃ³s listen - app e server jÃ¡ criados.

 */



module.exports = function init(app, server) {

const express = require('express');

const cors = require('cors');

const helmet = require('helmet');

const path = require('path');

const fs = require('fs');
const crypto = require('crypto');

const multer = require('multer');



// Baileys (loader dinÃ¢mico - ESM)

const baileysLoader = require('./services/whatsapp/baileysLoader');

const pino = require('pino');

const qrcode = require('qrcode');



// Database

const { getDatabase, close: closeDatabase, query, queryOne, run, generateUUID, USE_POSTGRES } = require('./database/connection');

const { migrate } = require('./database/migrate');

const {
    Lead,
    Conversation,
    Message,
    MessageQueue,
    Template,
    Campaign,
    CampaignSenderAccount,
    Automation,
    Flow,
    CustomEvent,
    Tag,
    IncomingWebhookCredential,
    Settings,
    User,
    WhatsAppSession,
    SupportInboxMessage,
    PreCheckoutLead,
    CheckoutRegistration
} = require('./database/models');



// Services

const webhookService = require('./services/webhookService');
const webhookQueueService = require('./services/webhookQueueService');

const queueService = require('./services/queueService');

const flowService = require('./services/flowService');
const aiFlowDraftService = require('./services/aiFlowDraftService');
const openAiFlowDraftService = require('./services/openAiFlowDraftService');
const senderAllocatorService = require('./services/senderAllocatorService');
const tenantIntegrityAuditService = require('./services/tenantIntegrityAuditService');
const { PostgresAdvisoryLock } = require('./services/postgresAdvisoryLock');
const stripeCheckoutService = require('./services/stripeCheckoutService');
const pagarmeCheckoutService = require('./services/pagarmeCheckoutService');
const planLimitsService = require('./services/planLimitsService');
const {
    DEFAULT_APP_NAME,
    DEFAULT_EMAIL_HTML_TEMPLATE,
    DEFAULT_EMAIL_SUBJECT_TEMPLATE,
    DEFAULT_EMAIL_TEXT_TEMPLATE,
    MailMktIntegrationError,
    buildEmailConfirmationUrl,
    buildEmailTemplateContext,
    buildRenderedEmailContent,
    buildRuntimeEmailDeliveryConfig,
    createEmailConfirmationTokenPayload,
    hashEmailConfirmationToken,
    isEmailConfirmed,
    isEmailConfirmationExpired,
    resolveAppUrl,
    sendRegistrationConfirmationEmail,
    tokenFingerprint
} = require('./services/emailConfirmationService');
const {
    DEFAULT_WHATSAPP_SESSION_ID,
    LEGACY_WHATSAPP_SESSION_ALIASES,
    listDefaultSessionCandidates,
    sanitizeSessionId: sanitizeConfiguredSessionId
} = require('./config/sessionDefaults');
const {
    normalizeTagLabel: normalizeUnifiedTagLabel,
    normalizeTagKey: normalizeUnifiedTagKey,
    parseTagList: parseUnifiedTagList,
    uniqueTagLabels: uniqueUnifiedTagLabels,
    normalizeTagFilterInput: normalizeUnifiedTagFilterInput,
    leadMatchesTagFilter: leadMatchesUnifiedTagFilter
} = require('./utils/tagUtils');
const { normalizeLeadStatus, LEAD_STATUS_VALUES } = require('./utils/leadStatus');



// Utils - Fixers (correÃ§Ãµes automÃ¡ticas baseadas em anÃ¡lise de projetos GitHub)

const audioFixer = require('./utils/audioFixer');

const connectionFixer = require('./utils/connectionFixer');
const { scheduleBackup } = require('./utils/backup');



// WhatsApp Service (engine Baileys modular)

const whatsappService = require('./services/whatsapp');
const {
    createBaileysAuthState,
    hasPersistedBaileysAuthState,
    clearPersistedBaileysAuthState
} = require('./services/whatsapp/baileysAuthStateStore');



// Middleware

const { authenticate, requestLogger, verifyToken, rateLimit: authRateLimit } = require('./middleware/auth');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');



// Encryption

const { encrypt, decrypt } = require('./utils/encryption');



// ============================================

// CONFIGURAÃ‡Ã•ES

// ============================================



const PORT = process.env.PORT || 3001;

const HOST = process.env.HOST || '0.0.0.0';

const SESSIONS_DIR = process.env.SESSIONS_DIR || path.join(__dirname, '..', 'sessions');

const UPLOADS_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');

const STATIC_DIR = process.env.NODE_ENV === 'production'

    ? path.join(__dirname, '..', 'dist')

    : path.join(__dirname, '..', 'public');
const LANDING_BRUNO_DIR = path.join(__dirname, '..', 'landing-bruno');

const MAX_RECONNECT_ATTEMPTS = parseInt(process.env.MAX_RECONNECT_ATTEMPTS) || 5;

const RECONNECT_DELAY = parseInt(process.env.RECONNECT_DELAY) || 3000;

const QR_TIMEOUT = parseInt(process.env.QR_TIMEOUT) || 60000;

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'self-protecao-veicular-key-2024';
const APP_BRAND_NAME = 'ZapVender';
const WHATSAPP_BROWSER_VERSION = '120.0.0';
const WHATSAPP_BROWSER_NAME_MAX_LENGTH = 40;
const BUSINESS_HOURS_CACHE_TTL_MS = 30000;
const OUTSIDE_HOURS_AUTO_REPLY_COOLDOWN_MS = 30 * 60 * 1000;
const DEFAULT_BUSINESS_HOURS_AUTO_REPLY = 'Ol\u00E1! Nosso atendimento est\u00E1 fora do hor\u00E1rio de funcionamento no momento. Retornaremos assim que estivermos online.';
const LEAD_AVATAR_SYNC_TTL_MS = parseInt(process.env.LEAD_AVATAR_SYNC_TTL_MS || '', 10) || (6 * 60 * 60 * 1000);
const LEAD_AVATAR_SYNC_TIMEOUT_MS = parseInt(process.env.LEAD_AVATAR_SYNC_TIMEOUT_MS || '', 10) || 2500;
const LEAD_AVATAR_CUSTOM_FIELD_KEY = 'avatar_url';
const WHATSAPP_SYNC_FULL_HISTORY = parseBooleanEnv(process.env.WHATSAPP_SYNC_FULL_HISTORY, false);
const WHATSAPP_USE_LATEST_BAILEYS_VERSION = parseBooleanEnv(process.env.WHATSAPP_USE_LATEST_BAILEYS_VERSION, false);
const WHATSAPP_BAILEYS_VERSION_PIN = parseBaileysVersionFromEnv(process.env.WHATSAPP_BAILEYS_VERSION);
const WHATSAPP_RUNTIME_FALLBACK_BAILEYS_VERSION = Object.freeze([2, 3000, 1033846690]);
const WHATSAPP_KEEPALIVE_INTERVAL_MS = parsePositiveIntEnv(process.env.WHATSAPP_KEEPALIVE_INTERVAL_MS, 15000);
const WHATSAPP_CONNECT_TIMEOUT_MS = parsePositiveIntEnv(process.env.WHATSAPP_CONNECT_TIMEOUT_MS, 60000);
const WHATSAPP_DEFAULT_QUERY_TIMEOUT_MS = parsePositiveIntEnv(process.env.WHATSAPP_DEFAULT_QUERY_TIMEOUT_MS, 60000);
const WHATSAPP_RETRY_REQUEST_DELAY_MS = parsePositiveIntEnv(process.env.WHATSAPP_RETRY_REQUEST_DELAY_MS, 500);
const WHATSAPP_SESSION_SEND_WARMUP_MS = parsePositiveIntEnv(process.env.WHATSAPP_SESSION_SEND_WARMUP_MS, 12000);
const WHATSAPP_SESSION_DISPATCH_BACKOFF_MS = parsePositiveIntEnv(process.env.WHATSAPP_SESSION_DISPATCH_BACKOFF_MS, 60000);
const WHATSAPP_SESSION_RATE_LIMIT_ENABLED = parseBooleanEnv(process.env.WHATSAPP_SESSION_RATE_LIMIT_ENABLED, true);
const WHATSAPP_SESSION_RATE_LIMIT_MAX_PER_MINUTE = parsePositiveIntInRange(
    process.env.WHATSAPP_SESSION_RATE_LIMIT_MAX_PER_MINUTE,
    30,
    1,
    2000
);
const METRICS_ENABLED = parseBooleanEnv(process.env.METRICS_ENABLED, false);
const METRICS_BEARER_TOKEN = String(process.env.METRICS_BEARER_TOKEN || '').trim();
const DANGEROUS_UPLOAD_EXTENSIONS = new Set([
    '.html', '.htm', '.svg', '.xml', '.xhtml', '.js', '.mjs', '.css'
]);
const ALLOWED_UPLOAD_EXTENSIONS = new Set([
    '.jpg', '.jpeg', '.png', '.webp', '.gif',
    '.mp4', '.webm', '.mov', '.ogg',
    '.mp3', '.wav', '.aac', '.m4a', '.amr', '.opus', '.oga',
    '.pdf', '.txt', '.zip', '.csv',
    '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'
]);
const ALLOWED_UPLOAD_MIME_TYPES = new Set([
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm', 'video/quicktime', 'video/ogg',
    'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/aac', 'audio/mp4',
    'audio/ogg', 'audio/amr', 'audio/3gpp', 'audio/webm',
    'application/pdf', 'text/plain', 'application/zip', 'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
]);
const UPLOAD_MIME_EXTENSION_MAP = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/quicktime': '.mov',
    'video/ogg': '.ogg',
    'audio/mpeg': '.mp3',
    'audio/wav': '.wav',
    'audio/x-wav': '.wav',
    'audio/aac': '.aac',
    'audio/mp4': '.m4a',
    'audio/ogg': '.ogg',
    'audio/amr': '.amr',
    'audio/3gpp': '.amr',
    'audio/webm': '.webm',
    'application/pdf': '.pdf',
    'text/plain': '.txt',
    'application/zip': '.zip',
    'text/csv': '.csv'
};
const WHATSAPP_AUTH_STATE_DRIVER = String(process.env.WHATSAPP_AUTH_STATE_DRIVER || 'multi_file').trim().toLowerCase();
const WHATSAPP_AUTH_STATE_DB_FALLBACK_MULTI_FILE = parseBooleanEnv(process.env.WHATSAPP_AUTH_STATE_DB_FALLBACK_MULTI_FILE, true);
let cachedBaileysSocketVersion = null;
let cachedBaileysSocketVersionSource = null;
let forceLatestBaileysVersionByRuntime = false;

function normalizeUploadExtension(fileName = '') {
    const ext = path.extname(String(fileName || '').trim()).toLowerCase();
    return ext.replace(/[^a-z0-9.]/g, '');
}

function sanitizeUploadBaseName(fileName = '') {
    const rawBaseName = path.basename(String(fileName || '').trim(), path.extname(String(fileName || '').trim()));
    const normalized = rawBaseName
        .replace(/[^a-zA-Z0-9._-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^\.+/, '')
        .slice(0, 80);
    return normalized || 'file';
}

function resolveUploadExtension(file = {}) {
    const extFromName = normalizeUploadExtension(file.originalname || '');
    if (ALLOWED_UPLOAD_EXTENSIONS.has(extFromName)) {
        return extFromName;
    }

    const mime = String(file.mimetype || '').trim().toLowerCase();
    return UPLOAD_MIME_EXTENSION_MAP[mime] || '';
}

function isAllowedUploadFile(file = {}) {
    const ext = normalizeUploadExtension(file.originalname || '');
    const mime = String(file.mimetype || '').trim().toLowerCase();
    const hasAllowedExt = ALLOWED_UPLOAD_EXTENSIONS.has(ext);
    const hasAllowedMime = ALLOWED_UPLOAD_MIME_TYPES.has(mime);
    const isDangerousExt = DANGEROUS_UPLOAD_EXTENSIONS.has(ext);
    return (hasAllowedExt || hasAllowedMime) && !isDangerousExt;
}

function parseBooleanEnv(value, fallback = false) {
    if (value === undefined || value === null || value === '') return fallback;
    const normalized = String(value).trim().toLowerCase();
    if (['1', 'true', 'yes', 'sim', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'nao', 'nÃ£o', 'off'].includes(normalized)) return false;
    return fallback;
}

function parsePositiveIntEnv(value, fallback) {
    const parsed = parseInt(String(value ?? ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parsePositiveIntInRange(value, fallback, min = 1, max = Number.POSITIVE_INFINITY) {
    const fallbackValue = parseInt(String(fallback ?? ''), 10);
    const normalizedFallback = Number.isFinite(fallbackValue) && fallbackValue > 0
        ? fallbackValue
        : Math.max(1, parseInt(String(min ?? ''), 10) || 1);

    const parsed = parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return normalizedFallback;
    }

    const normalizedMin = Number.isFinite(Number(min)) && Number(min) > 0
        ? Math.floor(Number(min))
        : 1;
    const normalizedMax = Number.isFinite(Number(max)) && Number(max) > 0
        ? Math.floor(Number(max))
        : Number.POSITIVE_INFINITY;

    return Math.min(normalizedMax, Math.max(normalizedMin, parsed));
}

const POSTGRES_WORKER_LEADER_LOCK_ENABLED = USE_POSTGRES && parseBooleanEnv(
    process.env.POSTGRES_WORKER_LEADER_LOCK_ENABLED,
    process.env.NODE_ENV === 'production'
);
const POSTGRES_WORKER_LEADER_LOCK_POLL_MS = parsePositiveIntEnv(
    process.env.POSTGRES_WORKER_LEADER_LOCK_POLL_MS,
    5000
);
const QUEUE_WORKER_ENABLED = parseBooleanEnv(
    process.env.QUEUE_WORKER_ENABLED,
    true
);
const FLOW_MESSAGE_QUEUE_ENABLED = parseBooleanEnv(
    process.env.FLOW_MESSAGE_QUEUE_ENABLED,
    true
);
const FLOW_MESSAGE_QUEUE_PRIORITY = parsePositiveIntInRange(
    process.env.FLOW_MESSAGE_QUEUE_PRIORITY,
    50,
    1,
    1000
);
const WEBHOOK_QUEUE_WORKER_ENABLED = parseBooleanEnv(
    process.env.WEBHOOK_QUEUE_WORKER_ENABLED,
    true
);
const SCHEDULED_AUTOMATIONS_WORKER_ENABLED = parseBooleanEnv(
    process.env.SCHEDULED_AUTOMATIONS_WORKER_ENABLED,
    true
);
const TENANT_INTEGRITY_AUDIT_WORKER_ENABLED = parseBooleanEnv(
    process.env.TENANT_INTEGRITY_AUDIT_WORKER_ENABLED,
    true
);
const TENANT_INTEGRITY_AUDIT_INTERVAL_MS = parsePositiveIntEnv(
    process.env.TENANT_INTEGRITY_AUDIT_INTERVAL_MS,
    6 * 60 * 60 * 1000
);
const TENANT_INTEGRITY_AUDIT_SAMPLE_LIMIT = parsePositiveIntEnv(
    process.env.TENANT_INTEGRITY_AUDIT_SAMPLE_LIMIT,
    10
);
const TENANT_INTEGRITY_AUDIT_ALLOW_GLOBAL_MANUAL = parseBooleanEnv(
    process.env.TENANT_INTEGRITY_AUDIT_ALLOW_GLOBAL_MANUAL,
    false
);
const BACKUP_AUTO_ENABLED = parseBooleanEnv(
    process.env.BACKUP_AUTO_ENABLED,
    false
);
const BACKUP_INTERVAL_HOURS = parsePositiveIntInRange(
    process.env.BACKUP_INTERVAL_HOURS,
    24,
    1,
    720
);
const USER_PRESENCE_TTL_MS = parsePositiveIntEnv(
    process.env.USER_PRESENCE_TTL_MS,
    90 * 1000
);
const userPresenceByUserId = new Map();

function normalizePresenceUserId(value) {
    const userId = Number(value || 0);
    return Number.isInteger(userId) && userId > 0 ? userId : 0;
}

function markUserPresenceOnline(userId) {
    const normalizedUserId = normalizePresenceUserId(userId);
    if (!normalizedUserId) return;
    userPresenceByUserId.set(normalizedUserId, Date.now());
}

function markUserPresenceOffline(userId) {
    const normalizedUserId = normalizePresenceUserId(userId);
    if (!normalizedUserId) return;
    userPresenceByUserId.delete(normalizedUserId);
}

function isUserPresenceOnline(userId) {
    const normalizedUserId = normalizePresenceUserId(userId);
    if (!normalizedUserId) return false;
    const lastSeenAt = Number(userPresenceByUserId.get(normalizedUserId) || 0);
    if (!lastSeenAt) return false;
    if ((Date.now() - lastSeenAt) > USER_PRESENCE_TTL_MS) {
        userPresenceByUserId.delete(normalizedUserId);
        return false;
    }
    return true;
}

const queueWorkerLeaderLock = new PostgresAdvisoryLock({
    name: 'queue-worker',
    key1: 47321,
    key2: 1,
    pollMs: POSTGRES_WORKER_LEADER_LOCK_POLL_MS,
    enabled: POSTGRES_WORKER_LEADER_LOCK_ENABLED && QUEUE_WORKER_ENABLED
});

const webhookQueueWorkerLeaderLock = new PostgresAdvisoryLock({
    name: 'webhook-queue-worker',
    key1: 47321,
    key2: 4,
    pollMs: POSTGRES_WORKER_LEADER_LOCK_POLL_MS,
    enabled: POSTGRES_WORKER_LEADER_LOCK_ENABLED && WEBHOOK_QUEUE_WORKER_ENABLED
});

const scheduledAutomationLeaderLock = new PostgresAdvisoryLock({
    name: 'scheduled-automations',
    key1: 47321,
    key2: 2,
    pollMs: POSTGRES_WORKER_LEADER_LOCK_POLL_MS,
    enabled: POSTGRES_WORKER_LEADER_LOCK_ENABLED && SCHEDULED_AUTOMATIONS_WORKER_ENABLED
});

const tenantIntegrityAuditLeaderLock = new PostgresAdvisoryLock({
    name: 'tenant-integrity-audit',
    key1: 47321,
    key2: 3,
    pollMs: POSTGRES_WORKER_LEADER_LOCK_POLL_MS,
    enabled: POSTGRES_WORKER_LEADER_LOCK_ENABLED && TENANT_INTEGRITY_AUDIT_WORKER_ENABLED
});

function parseBaileysVersionFromEnv(value) {
    const normalized = String(value || '').trim();
    if (!normalized) return null;
    const parts = normalized
        .split(/[.,]/)
        .map((part) => parseInt(String(part).trim(), 10))
        .filter((part) => Number.isFinite(part) && part >= 0);
    if (parts.length < 3) return null;
    return parts.slice(0, 3);
}

async function resolveBaileysSocketVersion(fetchLatestBaileysVersion, sessionId = '') {
    if (WHATSAPP_BAILEYS_VERSION_PIN && !forceLatestBaileysVersionByRuntime) {
        cachedBaileysSocketVersion = [...WHATSAPP_BAILEYS_VERSION_PIN];
        cachedBaileysSocketVersionSource = 'env-pin';
        return [...cachedBaileysSocketVersion];
    }

    if (cachedBaileysSocketVersion && Array.isArray(cachedBaileysSocketVersion)) {
        return [...cachedBaileysSocketVersion];
    }

    const shouldUseLatestBaileysVersion = WHATSAPP_USE_LATEST_BAILEYS_VERSION || forceLatestBaileysVersionByRuntime;
    if (typeof fetchLatestBaileysVersion !== 'function') {
        cachedBaileysSocketVersion = [...WHATSAPP_RUNTIME_FALLBACK_BAILEYS_VERSION];
        cachedBaileysSocketVersionSource = shouldUseLatestBaileysVersion ? 'runtime-fallback-pin' : 'default-pin';
        return [...cachedBaileysSocketVersion];
    }

    if (shouldUseLatestBaileysVersion) {
        try {
            const latest = await fetchLatestBaileysVersion();
            const version = Array.isArray(latest?.version) ? latest.version : null;
            if (version && version.length >= 3) {
                cachedBaileysSocketVersion = version.slice(0, 3);
                cachedBaileysSocketVersionSource = 'latest';
                return [...cachedBaileysSocketVersion];
            }
        } catch (error) {
            console.warn(`[${sessionId || 'whatsapp'}] Falha ao resolver versao latest do Baileys, usando versao fixa:`, error.message);
        }
    }

    cachedBaileysSocketVersion = [...WHATSAPP_RUNTIME_FALLBACK_BAILEYS_VERSION];
    cachedBaileysSocketVersionSource = shouldUseLatestBaileysVersion ? 'runtime-fallback-pin' : 'default-pin';
    return [...cachedBaileysSocketVersion];
}

function buildWhatsAppBrowserName(companyName) {
    const cleanedCompany = String(companyName || '').replace(/\s+/g, ' ').trim();
    if (!cleanedCompany) return APP_BRAND_NAME;

    const brandLower = APP_BRAND_NAME.toLowerCase();
    const companyLower = cleanedCompany.toLowerCase();
    const combined = companyLower.startsWith(`${brandLower} `) || companyLower === brandLower
        ? cleanedCompany
        : `${APP_BRAND_NAME} ${cleanedCompany}`;

    return combined.slice(0, WHATSAPP_BROWSER_NAME_MAX_LENGTH);
}

async function resolveWhatsAppBrowserName(options = {}) {
    const payload = (options && typeof options === 'object') ? options : {};
    const normalizedSessionId = sanitizeSessionId(payload.sessionId || '');
    const requestedOwnerUserId = normalizeOwnerUserId(payload.ownerUserId);
    let resolvedOwnerUserId = requestedOwnerUserId;

    try {
        if (normalizedSessionId) {
            const storedSession = requestedOwnerUserId
                ? await WhatsAppSession.findBySessionId(normalizedSessionId, {
                    owner_user_id: requestedOwnerUserId
                })
                : await WhatsAppSession.findBySessionId(normalizedSessionId);

            const sessionName = String(storedSession?.name || '').trim();
            if (sessionName) {
                return buildWhatsAppBrowserName(sessionName);
            }

            if (!resolvedOwnerUserId) {
                const createdBy = normalizeOwnerUserId(storedSession?.created_by);
                resolvedOwnerUserId = createdBy || normalizeOwnerUserId(await resolveSessionOwnerUserId(normalizedSessionId));
            }
        }

        if (resolvedOwnerUserId) {
            const scopedCompanyName = await Settings.get(buildScopedSettingsKey('company_name', resolvedOwnerUserId));
            if (String(scopedCompanyName || '').trim()) {
                return buildWhatsAppBrowserName(scopedCompanyName);
            }
        }

        const configuredCompanyName = await Settings.get('company_name');
        return buildWhatsAppBrowserName(configuredCompanyName);
    } catch (error) {
        console.warn('Falha ao carregar company_name para identificacao do WhatsApp:', error.message);
        return APP_BRAND_NAME;
    }
}

function getRequesterUserId(req) {
    const userId = Number(req?.user?.id || 0);
    return Number.isInteger(userId) && userId > 0 ? userId : 0;
}

function getRequesterRole(req) {
    return String(req?.user?.role || '').trim().toLowerCase();
}

function isScopedAgent(req) {
    return getRequesterRole(req) === 'agent' && getRequesterUserId(req) > 0;
}

function getScopedUserId(req) {
    return isScopedAgent(req) ? getRequesterUserId(req) : null;
}

function canAccessAssignedRecord(req, assignedTo) {
    if (!isScopedAgent(req)) return true;
    return Number(assignedTo) === getRequesterUserId(req);
}

function canAccessCreatedRecord(req, createdBy) {
    if (!isScopedAgent(req)) return true;
    return Number(createdBy) === getRequesterUserId(req);
}

async function canAccessAssignedRecordInOwnerScope(req, assignedTo, ownerScopeUserId = null) {
    if (!canAccessAssignedRecord(req, assignedTo)) return false;

    const effectiveOwnerUserId = normalizeOwnerUserId(ownerScopeUserId) || await resolveRequesterOwnerUserId(req);
    if (!effectiveOwnerUserId) return true;

    const assignedUserId = Number(assignedTo || 0);
    if (!Number.isInteger(assignedUserId) || assignedUserId <= 0) return false;
    if (assignedUserId === effectiveOwnerUserId) return true;

    const assignedUser = await User.findById(assignedUserId);
    if (!assignedUser) return false;

    const assignedOwnerUserId = normalizeOwnerUserId(assignedUser.owner_user_id);
    return assignedOwnerUserId === effectiveOwnerUserId || Number(assignedUser.id || 0) === effectiveOwnerUserId;
}

async function canAccessLeadRecordInOwnerScope(req, lead, ownerScopeUserId = null) {
    if (!lead) return false;
    if (!canAccessAssignedRecord(req, lead.assigned_to)) return false;

    const effectiveOwnerUserId = normalizeOwnerUserId(ownerScopeUserId) || await resolveRequesterOwnerUserId(req);
    if (!effectiveOwnerUserId) return true;

    const leadOwnerUserId = normalizeOwnerUserId(lead.owner_user_id);
    if (leadOwnerUserId) {
        return leadOwnerUserId === effectiveOwnerUserId;
    }

    return await canAccessAssignedRecordInOwnerScope(req, lead.assigned_to, effectiveOwnerUserId);
}

async function resolveOwnerScopeUserIdFromAssignees(...assignees) {
    for (const assignee of assignees) {
        const userId = Number(assignee || 0);
        if (!Number.isInteger(userId) || userId <= 0) continue;
        const user = await User.findById(userId);
        if (!user) continue;
        return normalizeOwnerUserId(user.owner_user_id) || Number(user.id || 0) || null;
    }
    return null;
}

async function resolveSessionOwnerUserId(sessionId) {
    const normalizedSessionId = sanitizeSessionId(sessionId);
    if (!normalizedSessionId) return null;

    const runtimeOwnerUserId = normalizeOwnerUserId(sessions.get(normalizedSessionId)?.ownerUserId);
    if (runtimeOwnerUserId) {
        const ownerScopeUserId = await resolveOwnerScopeUserIdFromAssignees(runtimeOwnerUserId);
        return normalizeOwnerUserId(ownerScopeUserId) || runtimeOwnerUserId;
    }

    const storedSession = await WhatsAppSession.findBySessionId(normalizedSessionId);
    const createdByUserId = normalizeOwnerUserId(storedSession?.created_by);
    if (!createdByUserId) return null;

    const ownerScopeUserId = await resolveOwnerScopeUserIdFromAssignees(createdByUserId);
    return normalizeOwnerUserId(ownerScopeUserId) || createdByUserId;
}

async function canAccessSessionRecordInOwnerScope(req, sessionId, ownerScopeUserId = null) {
    if (isScopedAgent(req)) return false;

    const normalizedSessionId = sanitizeSessionId(sessionId);
    if (!normalizedSessionId) return false;

    const effectiveOwnerUserId = normalizeOwnerUserId(ownerScopeUserId) || await resolveRequesterOwnerUserId(req);
    if (!effectiveOwnerUserId) return true;

    const ownedSession = await WhatsAppSession.findBySessionId(normalizedSessionId, {
        owner_user_id: effectiveOwnerUserId
    });
    if (ownedSession) return true;

    const storedSession = await WhatsAppSession.findBySessionId(normalizedSessionId);
    if (storedSession) return false;

    const runtimeOwnerUserId = await resolveSessionOwnerUserId(normalizedSessionId);
    return Boolean(runtimeOwnerUserId && Number(runtimeOwnerUserId) === Number(effectiveOwnerUserId));
}

async function canAccessConversationInOwnerScope(req, conversation, ownerScopeUserId = null) {
    if (!conversation) return false;

    if (await canAccessAssignedRecordInOwnerScope(req, conversation.assigned_to, ownerScopeUserId)) {
        return true;
    }

    return await canAccessSessionRecordInOwnerScope(req, conversation.session_id, ownerScopeUserId);
}

function getScopedSettingsPrefix(userId) {
    const normalizedUserId = Number(userId);
    if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
        return '';
    }
    return `user:${normalizedUserId}:`;
}

function buildScopedSettingsKey(baseKey, userId) {
    const normalizedKey = String(baseKey || '').trim();
    if (!normalizedKey) return normalizedKey;
    const prefix = getScopedSettingsPrefix(userId);
    return prefix ? `${prefix}${normalizedKey}` : normalizedKey;
}

function normalizeSettingsForResponse(settings = {}, scopedUserId = null) {
    const result = {};
    const prefix = getScopedSettingsPrefix(scopedUserId);

    for (const [key, value] of Object.entries(settings || {})) {
        const normalizedKey = String(key || '').trim();
        if (!normalizedKey) continue;
        if (prefix) {
            if (!normalizedKey.startsWith(prefix)) continue;
            result[normalizedKey.slice(prefix.length)] = value;
            continue;
        }

        if (normalizedKey.startsWith('user:')) continue;
        result[normalizedKey] = value;
    }

    return result;
}

function trimTrailingSlash(value) {
    return String(value || '').replace(/\/+$/, '');
}

function buildPublicAppBaseUrl(req) {
    const resolved = trimTrailingSlash(
        resolveAppUrl(req)
        || process.env.APP_URL
        || process.env.FRONTEND_URL
        || ''
    );

    if (resolved) return resolved;

    const host = String(req?.get?.('host') || '').trim();
    const protocol = String(req?.protocol || 'https').trim() || 'https';
    return host ? trimTrailingSlash(`${protocol}://${host}`) : '';
}

function normalizeCheckoutRegistrationStatusValue(value) {
    const normalized = String(value || '').trim().toLowerCase();
    const allowed = new Set([
        'pending_email_confirmation',
        'email_confirmed',
        'completed',
        'linked_existing_account',
        'email_delivery_failed',
        'expired'
    ]);
    return allowed.has(normalized) ? normalized : 'pending_email_confirmation';
}

function isCheckoutRegistrationExpired(registration, now = Date.now()) {
    const expiresAtRaw = registration?.email_confirmation_expires_at;
    if (!expiresAtRaw) return false;
    const expiresAtMs = new Date(expiresAtRaw).getTime();
    if (!Number.isFinite(expiresAtMs)) return true;
    return expiresAtMs < now;
}

function buildStripePlanMessage(status, planName = 'plano') {
    const normalizedStatus = stripeCheckoutService.normalizePlanStatus(status);
    const normalizedPlanName = String(planName || 'plano').trim() || 'plano';

    if (normalizedStatus === 'trialing') {
        return `Assinatura ${normalizedPlanName} em periodo de teste via Stripe.`;
    }
    if (normalizedStatus === 'past_due') {
        return `Pagamento pendente para o plano ${normalizedPlanName} na Stripe.`;
    }
    if (normalizedStatus === 'canceled') {
        return `Assinatura ${normalizedPlanName} cancelada na Stripe.`;
    }
    if (normalizedStatus === 'suspended') {
        return `Assinatura ${normalizedPlanName} suspensa na Stripe.`;
    }
    if (normalizedStatus === 'expired') {
        return `Assinatura ${normalizedPlanName} expirada na Stripe.`;
    }
    return `Assinatura ${normalizedPlanName} ativa e sincronizada via Stripe.`;
}

function resolveStripePlanStatusFromRegistration(registration, fallback = 'active') {
    const metadata = registration?.metadata && typeof registration.metadata === 'object'
        ? registration.metadata
        : {};
    return stripeCheckoutService.normalizePlanStatus(
        metadata.subscriptionStatus
        || metadata.stripeSubscriptionStatus
        || metadata.planStatus
        || fallback
    );
}

async function applyStripePlanSettingsToOwner(ownerUserId, plan = {}) {
    const normalizedOwnerUserId = normalizeOwnerUserId(ownerUserId);
    if (!normalizedOwnerUserId) return;

    const planName = String(plan?.name || 'Plano').trim() || 'Plano';
    const planCode = String(plan?.code || '').trim();
    const planStatus = stripeCheckoutService.normalizePlanStatus(plan?.status);
    const renewalDate = normalizeOptionalIsoDate(plan?.renewalDate || null);
    const externalReference = String(
        plan?.externalReference
        || plan?.subscriptionId
        || plan?.checkoutSessionId
        || ''
    ).trim();
    const message = String(plan?.message || buildStripePlanMessage(planStatus, planName)).trim();
    const nowIso = new Date().toISOString();

    await Promise.all([
        Settings.set(buildScopedSettingsKey('plan_name', normalizedOwnerUserId), planName, 'string'),
        Settings.set(buildScopedSettingsKey('plan_code', normalizedOwnerUserId), planCode, 'string'),
        Settings.set(buildScopedSettingsKey('plan_status', normalizedOwnerUserId), planStatus, 'string'),
        Settings.set(buildScopedSettingsKey('plan_provider', normalizedOwnerUserId), 'stripe', 'string'),
        Settings.set(buildScopedSettingsKey('plan_message', normalizedOwnerUserId), message, 'string'),
        Settings.set(buildScopedSettingsKey('plan_renewal_date', normalizedOwnerUserId), renewalDate || '', 'string'),
        Settings.set(buildScopedSettingsKey('plan_last_verified_at', normalizedOwnerUserId), nowIso, 'string'),
        Settings.set(buildScopedSettingsKey('plan_external_reference', normalizedOwnerUserId), externalReference, 'string')
    ]);
}

function buildStripePlanSnapshot(payload = {}) {
    return {
        name: String(payload?.planName || 'Plano').trim() || 'Plano',
        code: String(payload?.planCode || payload?.planKey || '').trim(),
        status: stripeCheckoutService.normalizePlanStatus(payload?.subscriptionStatus || payload?.status),
        renewalDate: payload?.renewalDate || null,
        externalReference: String(payload?.subscriptionId || payload?.sessionId || '').trim(),
        checkoutSessionId: String(payload?.sessionId || '').trim(),
        subscriptionId: String(payload?.subscriptionId || '').trim()
    };
}

async function sendCheckoutRegistrationConfirmationEmail(req, registration, tokenPayload) {
    const emailSettings = await getRegistrationEmailRuntimeConfig();
    await sendRegistrationConfirmationEmail(req, {
        id: null,
        email: registration.email,
        name: registration.email
    }, tokenPayload, { emailSettings });
}

async function resendCheckoutRegistrationConfirmation(req, registration) {
    const confirmationTokenPayload = createEmailConfirmationTokenPayload();
    await CheckoutRegistration.update(registration.id, {
        email_confirmation_token_hash: confirmationTokenPayload.tokenHash,
        email_confirmation_expires_at: confirmationTokenPayload.expiresAt,
        status: Number(registration?.email_confirmed) > 0 ? 'email_confirmed' : 'pending_email_confirmation'
    });

    try {
        await sendCheckoutRegistrationConfirmationEmail(req, registration, confirmationTokenPayload);
        const updatedRegistration = await CheckoutRegistration.update(registration.id, {
            last_email_sent_at: new Date().toISOString(),
            status: Number(registration?.email_confirmed) > 0 ? 'email_confirmed' : 'pending_email_confirmation'
        });
        return {
            registration: updatedRegistration,
            expiresInText: confirmationTokenPayload.expiresInText
        };
    } catch (error) {
        await CheckoutRegistration.update(registration.id, {
            status: 'email_delivery_failed'
        });
        throw error;
    }
}

async function upsertCheckoutRegistrationFromStripePayload(req, payload, options = {}) {
    const email = String(payload?.customerEmail || '').trim().toLowerCase();
    if (!email) {
        throw new Error('Checkout concluido sem email do cliente');
    }

    const existing = await CheckoutRegistration.findBySessionId(payload.sessionId);
    const existingUser = await User.findActiveByEmail(email);
    const metadata = {
        ...(existing?.metadata && typeof existing.metadata === 'object' ? existing.metadata : {}),
        ...(payload?.metadata && typeof payload.metadata === 'object' ? payload.metadata : {}),
        renewalDate: payload?.renewalDate || null
    };

    if (existingUser && isEmailConfirmed(existingUser)) {
        const ownerUserId = normalizeOwnerUserId(existingUser.owner_user_id) || Number(existingUser.id || 0) || null;
        if (ownerUserId) {
            await applyStripePlanSettingsToOwner(ownerUserId, buildStripePlanSnapshot(payload));
        }

        return CheckoutRegistration.upsertBySession({
            email,
            stripe_checkout_session_id: payload.sessionId,
            stripe_customer_id: payload.customerId,
            stripe_subscription_id: payload.subscriptionId,
            stripe_price_id: payload.priceId,
            stripe_plan_key: payload.planKey,
            stripe_plan_code: payload.planCode,
            stripe_plan_name: payload.planName,
            status: 'linked_existing_account',
            email_confirmed: 1,
            email_confirmed_at: existingUser.email_confirmed_at || new Date().toISOString(),
            email_confirmation_token_hash: null,
            email_confirmation_expires_at: null,
            linked_user_id: existingUser.id,
            owner_user_id: ownerUserId,
            metadata,
            completed_at: existing?.completed_at || new Date().toISOString(),
            last_email_sent_at: existing?.last_email_sent_at || null
        });
    }

    const shouldGenerateNewToken =
        !existing?.email_confirmation_token_hash
        || (!Number(existing?.email_confirmed) && isCheckoutRegistrationExpired(existing))
        || normalizeCheckoutRegistrationStatusValue(existing?.status) === 'email_delivery_failed';
    const confirmationTokenPayload = shouldGenerateNewToken ? createEmailConfirmationTokenPayload() : null;
    const registration = await CheckoutRegistration.upsertBySession({
        email,
        stripe_checkout_session_id: payload.sessionId,
        stripe_customer_id: payload.customerId,
        stripe_subscription_id: payload.subscriptionId,
        stripe_price_id: payload.priceId,
        stripe_plan_key: payload.planKey,
        stripe_plan_code: payload.planCode,
        stripe_plan_name: payload.planName,
        status: Number(existing?.email_confirmed) > 0 ? 'email_confirmed' : 'pending_email_confirmation',
        email_confirmed: Number(existing?.email_confirmed) > 0 ? 1 : 0,
        email_confirmed_at: existing?.email_confirmed_at || null,
        email_confirmation_token_hash: confirmationTokenPayload?.tokenHash || existing?.email_confirmation_token_hash || null,
        email_confirmation_expires_at: confirmationTokenPayload?.expiresAt || existing?.email_confirmation_expires_at || null,
        linked_user_id: existing?.linked_user_id || null,
        owner_user_id: existing?.owner_user_id || null,
        metadata,
        completed_at: existing?.completed_at || null,
        last_email_sent_at: existing?.last_email_sent_at || null
    });

    if (options?.sendEmail === false || !confirmationTokenPayload?.token) {
        return registration;
    }

    try {
        await sendCheckoutRegistrationConfirmationEmail(req, registration, confirmationTokenPayload);
        return await CheckoutRegistration.update(registration.id, {
            last_email_sent_at: new Date().toISOString(),
            status: Number(registration?.email_confirmed) > 0 ? 'email_confirmed' : 'pending_email_confirmation'
        });
    } catch (error) {
        await CheckoutRegistration.update(registration.id, {
            status: 'email_delivery_failed'
        });
        throw error;
    }
}

function getCheckoutRegistrationProvider(registration, fallback = 'stripe') {
    const metadata = registration?.metadata && typeof registration.metadata === 'object'
        ? registration.metadata
        : {};
    const provider = String(
        metadata.provider
        || metadata.checkoutProvider
        || metadata.paymentProvider
        || ''
    ).trim().toLowerCase();

    if (provider === 'pagarme') return 'pagarme';
    if (provider === 'stripe') return 'stripe';
    return String(fallback || 'stripe').trim().toLowerCase() || 'stripe';
}

function buildPagarmePlanMessage(status, planName = 'plano') {
    const normalizedStatus = pagarmeCheckoutService.normalizePlanStatus(status);
    const normalizedPlanName = String(planName || 'plano').trim() || 'plano';

    if (normalizedStatus === 'trialing') {
        return `Assinatura ${normalizedPlanName} em periodo de teste via Pagar.me.`;
    }
    if (normalizedStatus === 'past_due') {
        return `Pagamento pendente para o plano ${normalizedPlanName} no Pagar.me.`;
    }
    if (normalizedStatus === 'canceled') {
        return `Assinatura ${normalizedPlanName} cancelada no Pagar.me.`;
    }
    if (normalizedStatus === 'suspended') {
        return `Assinatura ${normalizedPlanName} suspensa no Pagar.me.`;
    }
    if (normalizedStatus === 'expired') {
        return `Assinatura ${normalizedPlanName} expirada no Pagar.me.`;
    }
    return `Assinatura ${normalizedPlanName} ativa e sincronizada via Pagar.me.`;
}

function resolvePagarmePlanStatusFromRegistration(registration, fallback = 'active') {
    const metadata = registration?.metadata && typeof registration.metadata === 'object'
        ? registration.metadata
        : {};
    return pagarmeCheckoutService.normalizePlanStatus(
        metadata.subscriptionStatus
        || metadata.pagarmeSubscriptionStatus
        || metadata.planStatus
        || fallback
    );
}

function resolveCheckoutRegistrationPlanStatus(registration, fallback = 'active') {
    const provider = getCheckoutRegistrationProvider(registration, 'stripe');
    if (provider === 'pagarme') {
        return resolvePagarmePlanStatusFromRegistration(registration, fallback);
    }
    return resolveStripePlanStatusFromRegistration(registration, fallback);
}

async function applyPagarmePlanSettingsToOwner(ownerUserId, plan = {}) {
    const normalizedOwnerUserId = normalizeOwnerUserId(ownerUserId);
    if (!normalizedOwnerUserId) return;

    const planName = String(plan?.name || 'Plano').trim() || 'Plano';
    const planCode = String(plan?.code || '').trim();
    const planStatus = pagarmeCheckoutService.normalizePlanStatus(plan?.status);
    const renewalDate = normalizeOptionalIsoDate(plan?.renewalDate || null);
    const externalReference = String(
        plan?.externalReference
        || plan?.subscriptionId
        || plan?.checkoutSessionId
        || ''
    ).trim();
    const message = String(plan?.message || buildPagarmePlanMessage(planStatus, planName)).trim();
    const nowIso = new Date().toISOString();

    await Promise.all([
        Settings.set(buildScopedSettingsKey('plan_name', normalizedOwnerUserId), planName, 'string'),
        Settings.set(buildScopedSettingsKey('plan_code', normalizedOwnerUserId), planCode, 'string'),
        Settings.set(buildScopedSettingsKey('plan_status', normalizedOwnerUserId), planStatus, 'string'),
        Settings.set(buildScopedSettingsKey('plan_provider', normalizedOwnerUserId), 'pagarme', 'string'),
        Settings.set(buildScopedSettingsKey('plan_message', normalizedOwnerUserId), message, 'string'),
        Settings.set(buildScopedSettingsKey('plan_renewal_date', normalizedOwnerUserId), renewalDate || '', 'string'),
        Settings.set(buildScopedSettingsKey('plan_last_verified_at', normalizedOwnerUserId), nowIso, 'string'),
        Settings.set(buildScopedSettingsKey('plan_external_reference', normalizedOwnerUserId), externalReference, 'string')
    ]);
}

function buildPagarmePlanSnapshot(payload = {}) {
    return {
        name: String(payload?.planName || 'Plano').trim() || 'Plano',
        code: String(payload?.planCode || payload?.planKey || '').trim(),
        status: pagarmeCheckoutService.normalizePlanStatus(payload?.subscriptionStatus || payload?.status),
        renewalDate: payload?.renewalDate || null,
        externalReference: String(payload?.subscriptionId || payload?.sessionId || '').trim(),
        checkoutSessionId: String(payload?.sessionId || '').trim(),
        subscriptionId: String(payload?.subscriptionId || '').trim()
    };
}

async function upsertCheckoutRegistrationFromPagarmePayload(req, payload, options = {}) {
    const email = String(payload?.customerEmail || '').trim().toLowerCase();
    if (!email) {
        throw new Error('Checkout concluido sem email do cliente');
    }

    let existing = null;
    if (payload?.sessionId) {
        existing = await CheckoutRegistration.findBySessionId(payload.sessionId);
    }
    if (!existing && payload?.subscriptionId) {
        existing = await CheckoutRegistration.findByStripeSubscriptionId(payload.subscriptionId);
    }
    if (!existing && payload?.customerId) {
        existing = await CheckoutRegistration.findByStripeCustomerId(payload.customerId);
    }
    if (!existing) {
        existing = await CheckoutRegistration.findLatestByEmail(email, { onlyIncomplete: true });
    }

    const sessionId = String(
        payload?.sessionId
        || existing?.stripe_checkout_session_id
        || payload?.subscriptionId
        || ''
    ).trim();
    if (!sessionId) {
        throw new Error('Checkout do Pagar.me sem identificador persistivel');
    }

    const existingUser = await User.findActiveByEmail(email);
    const metadata = {
        ...(existing?.metadata && typeof existing.metadata === 'object' ? existing.metadata : {}),
        ...(payload?.metadata && typeof payload.metadata === 'object' ? payload.metadata : {}),
        provider: 'pagarme',
        subscriptionStatus: pagarmeCheckoutService.normalizePlanStatus(payload?.subscriptionStatus),
        pagarmeSubscriptionStatus: String(payload?.metadata?.pagarmeSubscriptionStatus || payload?.subscriptionStatus || '').trim() || null,
        renewalDate: payload?.renewalDate || null
    };

    if (existingUser && isEmailConfirmed(existingUser)) {
        const ownerUserId = normalizeOwnerUserId(existingUser.owner_user_id) || Number(existingUser.id || 0) || null;
        if (ownerUserId) {
            await applyPagarmePlanSettingsToOwner(ownerUserId, buildPagarmePlanSnapshot(payload));
        }

        return CheckoutRegistration.upsertBySession({
            email,
            stripe_checkout_session_id: sessionId,
            stripe_customer_id: payload.customerId,
            stripe_subscription_id: payload.subscriptionId,
            stripe_price_id: payload.priceId,
            stripe_plan_key: payload.planKey,
            stripe_plan_code: payload.planCode,
            stripe_plan_name: payload.planName,
            status: 'linked_existing_account',
            email_confirmed: 1,
            email_confirmed_at: existingUser.email_confirmed_at || new Date().toISOString(),
            email_confirmation_token_hash: null,
            email_confirmation_expires_at: null,
            linked_user_id: existingUser.id,
            owner_user_id: ownerUserId,
            metadata,
            completed_at: existing?.completed_at || new Date().toISOString(),
            last_email_sent_at: existing?.last_email_sent_at || null
        });
    }

    const shouldGenerateNewToken =
        !existing?.email_confirmation_token_hash
        || (!Number(existing?.email_confirmed) && isCheckoutRegistrationExpired(existing))
        || normalizeCheckoutRegistrationStatusValue(existing?.status) === 'email_delivery_failed';
    const confirmationTokenPayload = shouldGenerateNewToken ? createEmailConfirmationTokenPayload() : null;
    const registration = await CheckoutRegistration.upsertBySession({
        email,
        stripe_checkout_session_id: sessionId,
        stripe_customer_id: payload.customerId,
        stripe_subscription_id: payload.subscriptionId,
        stripe_price_id: payload.priceId,
        stripe_plan_key: payload.planKey,
        stripe_plan_code: payload.planCode,
        stripe_plan_name: payload.planName,
        status: Number(existing?.email_confirmed) > 0 ? 'email_confirmed' : 'pending_email_confirmation',
        email_confirmed: Number(existing?.email_confirmed) > 0 ? 1 : 0,
        email_confirmed_at: existing?.email_confirmed_at || null,
        email_confirmation_token_hash: confirmationTokenPayload?.tokenHash || existing?.email_confirmation_token_hash || null,
        email_confirmation_expires_at: confirmationTokenPayload?.expiresAt || existing?.email_confirmation_expires_at || null,
        linked_user_id: existing?.linked_user_id || null,
        owner_user_id: existing?.owner_user_id || null,
        metadata,
        completed_at: existing?.completed_at || null,
        last_email_sent_at: existing?.last_email_sent_at || null
    });

    if (options?.sendEmail === false || !confirmationTokenPayload?.token) {
        return registration;
    }

    try {
        await sendCheckoutRegistrationConfirmationEmail(req, registration, confirmationTokenPayload);
        return await CheckoutRegistration.update(registration.id, {
            last_email_sent_at: new Date().toISOString(),
            status: Number(registration?.email_confirmed) > 0 ? 'email_confirmed' : 'pending_email_confirmation'
        });
    } catch (error) {
        await CheckoutRegistration.update(registration.id, {
            status: 'email_delivery_failed'
        });
        throw error;
    }
}

function getSocketRequesterUserId(socket) {
    const userId = Number(socket?.user?.id || 0);
    return Number.isInteger(userId) && userId > 0 ? userId : 0;
}

async function resolveSocketOwnerUserId(socket) {
    const requesterId = getSocketRequesterUserId(socket);
    if (!requesterId) return null;

    const currentUser = await User.findById(requesterId);
    let ownerUserId = Number(currentUser?.owner_user_id || socket?.user?.owner_user_id || 0);
    if (!Number.isInteger(ownerUserId) || ownerUserId <= 0) {
        ownerUserId = requesterId;
        await User.update(requesterId, { owner_user_id: ownerUserId });
    }
    if (socket.user) {
        socket.user.owner_user_id = ownerUserId;
    }
    if (currentUser && Number(currentUser.owner_user_id || 0) !== ownerUserId) {
        await User.update(requesterId, { owner_user_id: ownerUserId });
    }
    return ownerUserId;
}



// Avisar se chaves de seguranÃ§a nÃ£o foram configuradas (nÃ£o bloqueia startup para deploy funcionar)

if (process.env.NODE_ENV === 'production') {

    if (!process.env.ENCRYPTION_KEY || ENCRYPTION_KEY === 'self-protecao-veicular-key-2024') {

        console.warn('??  AVISO: Configure ENCRYPTION_KEY nas variÃ¡veis de ambiente para produÃ§Ã£o.');

    }

    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'self-protecao-jwt-secret-2024') {

        console.warn('??  AVISO: Configure JWT_SECRET nas variÃ¡veis de ambiente para produÃ§Ã£o.');

    }

}



// Criar diretÃ³rios necessÃ¡rios

[SESSIONS_DIR, UPLOADS_DIR, path.join(__dirname, '..', 'data')].forEach(dir => {

    if (!fs.existsSync(dir)) {

        fs.mkdirSync(dir, { recursive: true });

    }

});



// Migracao roda aqui (servidor ja esta ouvindo via start.js)
async function bootstrapDatabase() {
    try {
        const ok = await migrate({ closeConnection: false });
        if (ok) {
            console.log('Banco de dados inicializado');
        }

        try {
            const legacyTagRepair = await Tag.repairLegacyOwnership({ maxRows: 20000 });
            const scannedLegacyTags = Number(legacyTagRepair?.scanned || 0);
            const repairedLegacyTags = Number(legacyTagRepair?.updated || 0) + Number(legacyTagRepair?.inserted || 0);
            if (scannedLegacyTags > 0 || repairedLegacyTags > 0 || Number(legacyTagRepair?.removed || 0) > 0 || Number(legacyTagRepair?.unresolved || 0) > 0) {
                console.log(
                    `[TagsRepair] scanned=${scannedLegacyTags} updated=${Number(legacyTagRepair?.updated || 0)} `
                    + `inserted=${Number(legacyTagRepair?.inserted || 0)} removed=${Number(legacyTagRepair?.removed || 0)} `
                    + `unresolved=${Number(legacyTagRepair?.unresolved || 0)}`
                );
            }
        } catch (tagRepairError) {
            console.error('[TagsRepair] Falha ao reparar ownership legado de tags:', tagRepairError.message);
        }

        try {
            await ensureLegacyIncomingWebhookCredentialBridge();
        } catch (incomingWebhookBridgeError) {
            console.error('[IncomingWebhook] Falha ao sincronizar credencial legada:', incomingWebhookBridgeError.message);
        }

        await cleanupDuplicateMessages();
        await cleanupLidLeads();
        await cleanupInvalidPhones();
        await cleanupEmptyWhatsappLeads();
        await cleanupDuplicatePhoneSuffixLeads();
        await cleanupBrokenLeadNames();
        await cleanupMissingLeadNames();
        await migrateLegacyTriggerCampaignsToAutomations();
    } catch (error) {
        console.error('Erro ao inicializar banco de dados:', error.message);
    }
}

const bootstrapPromise = bootstrapDatabase();

// ============================================

// MIDDLEWARES E ROTAS (app jÃ¡ tem /health do start.js)

// ============================================



// SeguranÃ§a

app.use(helmet({

    contentSecurityPolicy: false,

    crossOriginEmbedderPolicy: false

}));



// Railway/Proxy: confiar no proxy para X-Forwarded-For

app.set('trust proxy', 1);



// Rate limiting

const limiter = authRateLimit({

    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,

    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,

    message: 'Muitas requisicoes, tente novamente mais tarde'

});

app.use('/api/', limiter);



// CORS - configuravel por CORS_ORIGINS.
// Aceita:
// - origem completa: https://dominio.com
// - host sem protocolo: dominio.com
// - varios valores separados por virgula
const sanitizeOriginEntry = (value = '') =>
    String(value).trim().replace(/^['"]|['"]$/g, '').replace(/\/$/, '');

const isProductionEnv = process.env.NODE_ENV === 'production';

const parseOriginHost = (value) => {
    if (!value) return '';
    try {
        return new URL(value).hostname.toLowerCase();
    } catch (error) {
        return sanitizeOriginEntry(value).replace(/^https?:\/\//i, '').split('/')[0].split(':')[0].toLowerCase();
    }
};
const allowedOriginEntries = (process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(sanitizeOriginEntry).filter(Boolean)
    : (isProductionEnv
        ? []
        : ['http://localhost:3000', 'http://localhost:3001']))
    .map(sanitizeOriginEntry);

const allowedOriginSet = new Set(allowedOriginEntries.map((entry) => {
    if (/^https?:\/\//i.test(entry)) {
        try {
            return new URL(entry).origin;
        } catch (error) {
            return entry;
        }
    }
    return entry;
}));

const allowedHostSet = new Set(allowedOriginEntries.map(parseOriginHost).filter(Boolean));
const allowOpenCorsFallback = !isProductionEnv && allowedOriginEntries.length === 0;

if (isProductionEnv && allowedOriginEntries.length === 0) {
    console.warn('[CORS] CORS_ORIGINS nao configurado em producao. Apenas same-origin sera aceito.');
}

const getRequestHost = (req) => {
    const forwardedHost = req.header('X-Forwarded-Host');
    const host = (forwardedHost || req.header('Host') || '').split(',')[0].trim();
    return host.split(':')[0].toLowerCase();
};

const isOriginAllowed = (origin, requestHost = '') => {
    const normalizedOrigin = sanitizeOriginEntry(origin);
    const originHost = parseOriginHost(normalizedOrigin);
    const isSameOrigin = Boolean(
        normalizedOrigin &&
        originHost &&
        requestHost &&
        originHost === requestHost
    );

    return (
        !normalizedOrigin ||
        allowedOriginSet.has('*') ||
        allowOpenCorsFallback ||
        isSameOrigin ||
        allowedOriginSet.has(normalizedOrigin) ||
        allowedHostSet.has(originHost)
    );
};

const corsOptionsDelegate = (req, callback) => {
    const origin = req.header('Origin');
    const requestHost = getRequestHost(req);
    const isAllowed = isOriginAllowed(origin, requestHost);

    if (!isAllowed) {
        return callback(new Error('NÃ£o permitido por CORS'));
    }

    return callback(null, {
        origin: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    });
};

app.use(cors(corsOptionsDelegate));



app.get('/metrics', async (req, res) => {
    if (!METRICS_ENABLED) {
        return res.status(404).send('Not found');
    }

    if (process.env.NODE_ENV === 'production' && !METRICS_BEARER_TOKEN) {
        return res.status(503).send('Metrics token not configured');
    }

    if (METRICS_BEARER_TOKEN) {
        const authHeader = String(req.header('Authorization') || '').trim();
        const queryToken = String(req.query?.token || '').trim();
        const bearerToken = authHeader.startsWith('Bearer ')
            ? authHeader.slice('Bearer '.length).trim()
            : '';
        if (bearerToken !== METRICS_BEARER_TOKEN && queryToken !== METRICS_BEARER_TOKEN) {
            return res.status(401).send('Unauthorized');
        }
    }

    try {
        const connectedSessions = Array.from(sessions.values()).filter((session) => session?.isConnected === true).length;
        const totalSessions = sessions.size;
        const queueStatsRow = await queryOne(`
            SELECT
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
                SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) AS processing,
                SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
            FROM message_queue
        `);
        const runningFlowsRow = await queryOne(`
            SELECT COUNT(*)::int AS total
            FROM flow_executions
            WHERE status = 'running'
        `);

        const queuePending = Number(queueStatsRow?.pending || 0) || 0;
        const queueProcessing = Number(queueStatsRow?.processing || 0) || 0;
        const queueSent = Number(queueStatsRow?.sent || 0) || 0;
        const queueFailed = Number(queueStatsRow?.failed || 0) || 0;
        const flowRunning = Number(runningFlowsRow?.total || 0) || 0;

        const metricsLines = [
            '# HELP zapvender_process_uptime_seconds Node process uptime in seconds',
            '# TYPE zapvender_process_uptime_seconds gauge',
            `zapvender_process_uptime_seconds ${Math.floor(process.uptime())}`,
            '# HELP zapvender_whatsapp_sessions_total Total WhatsApp sessions loaded in runtime',
            '# TYPE zapvender_whatsapp_sessions_total gauge',
            `zapvender_whatsapp_sessions_total ${totalSessions}`,
            '# HELP zapvender_whatsapp_sessions_connected Connected WhatsApp sessions in runtime',
            '# TYPE zapvender_whatsapp_sessions_connected gauge',
            `zapvender_whatsapp_sessions_connected ${connectedSessions}`,
            '# HELP zapvender_queue_pending_messages Pending messages in queue',
            '# TYPE zapvender_queue_pending_messages gauge',
            `zapvender_queue_pending_messages ${queuePending}`,
            '# HELP zapvender_queue_processing_messages Processing messages in queue',
            '# TYPE zapvender_queue_processing_messages gauge',
            `zapvender_queue_processing_messages ${queueProcessing}`,
            '# HELP zapvender_queue_sent_messages Sent messages in queue table',
            '# TYPE zapvender_queue_sent_messages gauge',
            `zapvender_queue_sent_messages ${queueSent}`,
            '# HELP zapvender_queue_failed_messages Failed messages in queue table',
            '# TYPE zapvender_queue_failed_messages gauge',
            `zapvender_queue_failed_messages ${queueFailed}`,
            '# HELP zapvender_flow_executions_running Running flow executions',
            '# TYPE zapvender_flow_executions_running gauge',
            `zapvender_flow_executions_running ${flowRunning}`
        ];

        res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
        return res.send(`${metricsLines.join('\n')}\n`);
    } catch (error) {
        return res.status(500).send(`metrics_error ${String(error?.message || 'unknown')}`);
    }
});



// Request logging

if (process.env.NODE_ENV !== 'production') {

    app.use(requestLogger);

}

app.post('/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
        const signature = String(req.headers['stripe-signature'] || '').trim();
        const event = await stripeCheckoutService.constructWebhookEvent(req.body, signature);
        await handleStripeWebhookEvent(req, event);
        return res.json({ received: true });
    } catch (error) {
        console.error('[stripe/webhook] Falha ao processar evento:', error.message);
        return res.status(400).send(`Webhook Error: ${String(error?.message || 'invalid_event')}`);
    }
});

app.post('/pagarme/webhook', express.json({ type: 'application/json' }), async (req, res) => {
    try {
        const event = await pagarmeCheckoutService.constructWebhookEvent(req.body);
        await handlePagarmeWebhookEvent(req, event);
        return res.json({ received: true });
    } catch (error) {
        console.error('[pagarme/webhook] Falha ao processar evento:', error.message);
        return res.status(400).send(`Webhook Error: ${String(error?.message || 'invalid_event')}`);
    }
});



// Body parser

app.use(express.json({ limit: '50mb' }));

app.use(express.urlencoded({ extended: true, limit: '50mb' }));



// AutenticaÃ§Ã£o obrigatÃ³ria para /api (exceto login/refresh)

app.use('/api', (req, res, next) => {

    const path = req.path || '';

    if (
        path.startsWith('/public/billing/checkout/') ||
        path.startsWith('/auth/login') ||
        path.startsWith('/auth/refresh') ||
        path.startsWith('/auth/register') ||
        path.startsWith('/auth/complete-registration') ||
        path.startsWith('/auth/confirm-email') ||
        path.startsWith('/auth/resend-confirmation') ||
        path.startsWith('/pre-checkout/capture')
    ) {

        return next();

    }

    return authenticate(req, res, next);

});



// Arquivos estÃ¡ticos

const PUBLIC_IMG_DIR = path.join(__dirname, '..', 'public', 'img');
if (fs.existsSync(PUBLIC_IMG_DIR)) {
    app.use('/img', express.static(PUBLIC_IMG_DIR));
}

app.use(express.static(STATIC_DIR, {

    setHeaders: (res, filePath) => {

        if (filePath.endsWith('app.html')) {

            res.setHeader('Cache-Control', 'no-store');
            res.setHeader('Clear-Site-Data', '"cache"');

        }

    }

}));

if (fs.existsSync(LANDING_BRUNO_DIR)) {
    app.use('/landing-bruno', express.static(LANDING_BRUNO_DIR));
}

app.use('/uploads', express.static(UPLOADS_DIR, {
    setHeaders: (res, filePath) => {
        const ext = normalizeUploadExtension(filePath);
        res.setHeader('X-Content-Type-Options', 'nosniff');

        if (DANGEROUS_UPLOAD_EXTENSIONS.has(ext)) {
            res.setHeader('Content-Disposition', 'attachment');
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        }
    }
}));



// Upload de arquivos

const storage = multer.diskStorage({

    destination: (req, file, cb) => cb(null, UPLOADS_DIR),

    filename: (req, file, cb) => {

        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const safeBaseName = sanitizeUploadBaseName(file.originalname || '');
        const safeExtension = resolveUploadExtension(file);
        cb(null, `${uniqueSuffix}-${safeBaseName}${safeExtension}`);

    }

});

const upload = multer({ 

    storage,
    fileFilter: (req, file, cb) => {
        if (!isAllowedUploadFile(file)) {
            const uploadTypeError = new Error('Tipo de arquivo nao permitido');
            uploadTypeError.status = 400;
            uploadTypeError.statusCode = 400;
            return cb(uploadTypeError);
        }

        return cb(null, true);
    },

    limits: { fileSize: 50 * 1024 * 1024 } // 50MB

});



// ============================================

// SOCKET.IO

// ============================================



const { Server } = require('socket.io');

const io = new Server(server, {

    cors: {

        origin: true,

        methods: ['GET', 'POST']

    },

    allowRequest: (req, callback) => {
        try {
            const origin = String(req?.headers?.origin || '').trim();
            const forwardedHost = String(req?.headers?.['x-forwarded-host'] || '').split(',')[0].trim();
            const hostHeader = String(req?.headers?.host || '').split(',')[0].trim();
            const requestHost = (forwardedHost || hostHeader).split(':')[0].toLowerCase();
            const isAllowed = isOriginAllowed(origin, requestHost);

            if (!isAllowed) {
                console.warn(
                    `[socket.io] cors_reject origin=${origin || 'n/a'} host=${requestHost || 'n/a'} ` +
                    `url=${String(req?.url || '').trim() || 'n/a'}`
                );
                return callback('NÃ£o permitido por CORS', false);
            }

            return callback(null, true);
        } catch (error) {
            return callback('NÃ£o permitido por CORS', false);
        }
    },

    pingTimeout: 60000,

    pingInterval: 25000,

    transports: ['websocket', 'polling']

});

const SOCKET_ERROR_LOG_MAX_LENGTH = 1800;
const SOCKET_ERROR_LOG_SENSITIVE_KEYS = new Set([
    'authorization',
    'cookie',
    'set-cookie',
    'token',
    'access_token',
    'refresh_token'
]);

function truncateSocketErrorLogValue(value, maxLength = SOCKET_ERROR_LOG_MAX_LENGTH) {
    const normalized = String(value || '');
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, maxLength)}...<truncated>`;
}

function safeSerializeSocketErrorContext(value) {
    if (value === null || typeof value === 'undefined') return 'n/a';

    try {
        const seen = new WeakSet();
        const serialized = JSON.stringify(value, (key, currentValue) => {
            const normalizedKey = String(key || '').trim().toLowerCase();
            if (SOCKET_ERROR_LOG_SENSITIVE_KEYS.has(normalizedKey)) {
                return '<redacted>';
            }

            if (typeof currentValue === 'string') {
                return currentValue.length > 250
                    ? `${currentValue.slice(0, 250)}...<truncated>`
                    : currentValue;
            }

            if (typeof currentValue === 'function') {
                return '<function>';
            }

            if (Buffer.isBuffer(currentValue)) {
                return `<buffer length=${currentValue.length}>`;
            }

            if (currentValue && typeof currentValue === 'object') {
                if (seen.has(currentValue)) {
                    return '<circular>';
                }
                seen.add(currentValue);
            }

            return currentValue;
        });

        return truncateSocketErrorLogValue(serialized || 'n/a');
    } catch (error) {
        return truncateSocketErrorLogValue(String(error?.message || 'serialize_failed'));
    }
}

io.engine.on('connection_error', (error) => {
    const request = error?.req || {};
    const clientIp = String(
        request?.headers?.['x-forwarded-for']
        || request?.socket?.remoteAddress
        || ''
    ).split(',')[0].trim();
    const origin = String(request?.headers?.origin || '').trim();
    const code = String(error?.code || '').trim();
    const message = String(error?.message || '').trim();
    const requestUrl = String(request?.url || '').trim();
    const requestMethod = String(request?.method || '').trim();
    const userAgent = truncateSocketErrorLogValue(String(request?.headers?.['user-agent'] || '').trim(), 220);
    const context = safeSerializeSocketErrorContext(error?.context);
    console.warn(
        `[socket.io] connection_error code=${code || 'n/a'} message=${message || 'n/a'} ` +
        `origin=${origin || 'n/a'} ip=${clientIp || 'n/a'} method=${requestMethod || 'n/a'} ` +
        `url=${requestUrl || 'n/a'} ua=${userAgent || 'n/a'} context=${context}`
    );
});



// AutenticaÃ§Ã£o via JWT no handshake do Socket.IO

function getOwnerScopeRoom(ownerUserId) {
    const normalizedOwnerUserId = normalizeOwnerUserId(ownerUserId);
    return normalizedOwnerUserId > 0 ? `owner:${normalizedOwnerUserId}` : '';
}

function emitToOwnerScope(ownerUserId, eventName, payload, options = {}) {
    const room = getOwnerScopeRoom(ownerUserId);
    if (room) {
        io.to(room).emit(eventName, payload);
        return true;
    }

    if (options.allowGlobalFallback === true) {
        io.emit(eventName, payload);
        return true;
    }

    return false;
}

async function emitToSessionOwnerScope(sessionId, eventName, payload, options = {}) {
    const explicitOwnerUserId = normalizeOwnerUserId(options.ownerUserId);
    const ownerUserId = explicitOwnerUserId || await resolveSessionOwnerUserId(sessionId);
    return emitToOwnerScope(ownerUserId, eventName, payload, options);
}

async function ensureSocketOwnerScopeRoom(socket) {
    const ownerUserId = await resolveSocketOwnerUserId(socket);
    const roomName = getOwnerScopeRoom(ownerUserId);
    const socketData = socket && typeof socket === 'object'
        ? (socket.data = socket.data || {})
        : {};
    const previousRoomName = String(socketData.ownerScopeRoom || '').trim();

    if (previousRoomName && previousRoomName !== roomName) {
        socket.leave(previousRoomName);
    }
    if (roomName && previousRoomName !== roomName) {
        socket.join(roomName);
    }

    socketData.ownerScopeUserId = ownerUserId || null;
    socketData.ownerScopeRoom = roomName || null;
    return ownerUserId || null;
}

function buildSocketRequestLike(socket) {
    return { user: socket?.user || null };
}

function getSocketClientIp(socket) {
    return String(
        socket?.handshake?.headers?.['x-forwarded-for']
        || socket?.request?.socket?.remoteAddress
        || socket?.conn?.remoteAddress
        || ''
    ).split(',')[0].trim();
}

io.use((socket, next) => {

    try {

        const headerToken = socket.handshake.headers?.authorization;

        const token = socket.handshake.auth?.token || (headerToken ? headerToken.replace(/Bearer\s+/i, '') : null);

        if (!token) {
            console.warn(
                `[socket.io] unauthorized_handshake reason=missing_token origin=${String(socket?.handshake?.headers?.origin || '').trim() || 'n/a'} ip=${getSocketClientIp(socket) || 'n/a'}`
            );
            return next(new Error('unauthorized'));
        }

        const decoded = verifyToken(token);

        if (!decoded) {
            console.warn(
                `[socket.io] unauthorized_handshake reason=invalid_token origin=${String(socket?.handshake?.headers?.origin || '').trim() || 'n/a'} ip=${getSocketClientIp(socket) || 'n/a'}`
            );
            return next(new Error('unauthorized'));

        }

        socket.user = decoded;

        return next();

    } catch (error) {
        console.warn(
            `[socket.io] unauthorized_handshake reason=exception origin=${String(socket?.handshake?.headers?.origin || '').trim() || 'n/a'} ip=${getSocketClientIp(socket) || 'n/a'} message=${String(error?.message || '').trim() || 'n/a'}`
        );
        return next(new Error('unauthorized'));

    }

});



// ============================================

// WHATSAPP - GERENCIAMENTO DE SESSÃ•ES (via whatsapp service)

// ============================================



const sessions = whatsappService.sessions;

const reconnectAttempts = whatsappService.reconnectAttempts;

const qrTimeouts = whatsappService.qrTimeouts;

const logger = pino({ level: 'silent' });

const typingStatus = new Map();

const jidAliasMap = new Map();
const sessionInitLocks = new Set();
const sessionInitLockTimestamps = new Map();
const pendingCiphertextRecoveries = new Map();
const pendingLidResolutionRecoveries = new Map();
const recoveredFlowMessageIds = new Map();
const sessionReconnectCatchupTimers = new Map();
const sessionReconnectCatchupInFlight = new Set();
const sessionHistorySyncQueues = new Map();
const sessionSendRateStateBySessionId = new Map();
const reconnectInFlight = new Set();
const sessionStartupErrors = new Map();
let isServerShuttingDown = false;
let inboxReconciliationIntervalId = null;
let inboxReconciliationBootstrapTimeoutId = null;
let inboxReconciliationIsRunning = false;
let inboxReconciliationLastSummary = null;
let flowAwaitingInputRecoveryIntervalId = null;
let flowAwaitingInputRecoveryBootstrapTimeoutId = null;
let flowAwaitingInputRecoveryIsRunning = false;
let flowAwaitingInputRecoveryLastSummary = null;
const FLOW_RECOVERY_DELAY_MS = parseInt(process.env.FLOW_RECOVERY_DELAY_MS || '', 10) || 2500;
const FLOW_RECOVERY_WINDOW_MS = parseInt(process.env.FLOW_RECOVERY_WINDOW_MS || '', 10) || (5 * 60 * 1000);
const FLOW_RECOVERY_TRACKER_LIMIT = 4000;
const FLOW_RECOVERY_MAX_ATTEMPTS = parseInt(process.env.FLOW_RECOVERY_MAX_ATTEMPTS || '', 10) || 7;
const FLOW_RECOVERY_MAX_DELAY_MS = parseInt(process.env.FLOW_RECOVERY_MAX_DELAY_MS || '', 10) || 30000;
const LID_RESOLUTION_RECOVERY_MAX_ATTEMPTS = parseInt(process.env.LID_RESOLUTION_RECOVERY_MAX_ATTEMPTS || '', 10) || 4;
const LID_RESOLUTION_RECOVERY_BASE_DELAY_MS = parseInt(process.env.LID_RESOLUTION_RECOVERY_BASE_DELAY_MS || '', 10) || 1200;
const LID_RESOLUTION_RECOVERY_MAX_DELAY_MS = parseInt(process.env.LID_RESOLUTION_RECOVERY_MAX_DELAY_MS || '', 10) || 9000;
const BAILEYS_CIPHERTEXT_STUB_TYPE = 1;
const WHATSAPP_RECONNECT_CATCHUP_ENABLED = parseBooleanEnv(process.env.WHATSAPP_RECONNECT_CATCHUP_ENABLED, true);
const WHATSAPP_RECONNECT_CATCHUP_DELAY_MS = parsePositiveIntEnv(process.env.WHATSAPP_RECONNECT_CATCHUP_DELAY_MS, 7000);
const WHATSAPP_RECONNECT_CATCHUP_MAX_CONVERSATIONS = parsePositiveIntEnv(process.env.WHATSAPP_RECONNECT_CATCHUP_MAX_CONVERSATIONS, 40);
const WHATSAPP_RECONNECT_CATCHUP_MESSAGES_PER_CONVERSATION = parsePositiveIntEnv(process.env.WHATSAPP_RECONNECT_CATCHUP_MESSAGES_PER_CONVERSATION, 80);
const WHATSAPP_RECONNECT_CATCHUP_MAX_RUNTIME_MS = parsePositiveIntEnv(process.env.WHATSAPP_RECONNECT_CATCHUP_MAX_RUNTIME_MS, 45000);
const WHATSAPP_RECONNECT_CATCHUP_MAX_CONVERSATIONS_HARD_LIMIT = parsePositiveIntEnv(
    process.env.WHATSAPP_RECONNECT_CATCHUP_MAX_CONVERSATIONS_HARD_LIMIT,
    500
);
const WHATSAPP_RECONNECT_CATCHUP_MESSAGES_PER_CONVERSATION_HARD_LIMIT = parsePositiveIntEnv(
    process.env.WHATSAPP_RECONNECT_CATCHUP_MESSAGES_PER_CONVERSATION_HARD_LIMIT,
    1200
);
const WHATSAPP_RECONNECT_CATCHUP_MAX_RUNTIME_HARD_LIMIT_MS = parsePositiveIntEnv(
    process.env.WHATSAPP_RECONNECT_CATCHUP_MAX_RUNTIME_HARD_LIMIT_MS,
    300000
);
const WHATSAPP_MANUAL_RECONNECT_CATCHUP_MAX_CONVERSATIONS = parsePositiveIntEnv(
    process.env.WHATSAPP_MANUAL_RECONNECT_CATCHUP_MAX_CONVERSATIONS,
    Math.max(200, WHATSAPP_RECONNECT_CATCHUP_MAX_CONVERSATIONS)
);

function setSessionStartupError(sessionId, payload = {}) {
    const normalizedSessionId = sanitizeSessionId(sessionId);
    if (!normalizedSessionId) return;

    const statusCodeRaw = Number(payload?.statusCode);
    const statusCode = Number.isFinite(statusCodeRaw) ? Math.floor(statusCodeRaw) : null;
    const message = String(payload?.message || '').trim().slice(0, 400);
    const errorType = String(payload?.errorType || '').trim().slice(0, 80) || null;
    const attemptRaw = Number(payload?.attempt);
    const attempt = Number.isFinite(attemptRaw) && attemptRaw > 0 ? Math.floor(attemptRaw) : null;
    const occurredAt = String(payload?.at || new Date().toISOString());

    sessionStartupErrors.set(normalizedSessionId, {
        message: message || 'Falha ao inicializar sessao WhatsApp',
        statusCode,
        errorType,
        attempt,
        at: occurredAt
    });

    if (sessionStartupErrors.size > 500) {
        const oldestKey = sessionStartupErrors.keys().next().value;
        if (oldestKey) {
            sessionStartupErrors.delete(oldestKey);
        }
    }
}

function clearSessionStartupError(sessionId) {
    const normalizedSessionId = sanitizeSessionId(sessionId);
    if (!normalizedSessionId) return;
    sessionStartupErrors.delete(normalizedSessionId);
}
const WHATSAPP_MANUAL_RECONNECT_CATCHUP_MESSAGES_PER_CONVERSATION = parsePositiveIntEnv(
    process.env.WHATSAPP_MANUAL_RECONNECT_CATCHUP_MESSAGES_PER_CONVERSATION,
    Math.max(220, WHATSAPP_RECONNECT_CATCHUP_MESSAGES_PER_CONVERSATION)
);
const WHATSAPP_MANUAL_RECONNECT_CATCHUP_MAX_RUNTIME_MS = parsePositiveIntEnv(
    process.env.WHATSAPP_MANUAL_RECONNECT_CATCHUP_MAX_RUNTIME_MS,
    Math.max(180000, WHATSAPP_RECONNECT_CATCHUP_MAX_RUNTIME_MS)
);
const WHATSAPP_HISTORY_SYNC_ENABLED = parseBooleanEnv(process.env.WHATSAPP_HISTORY_SYNC_ENABLED, true);
const WHATSAPP_HISTORY_SYNC_MESSAGES_LIMIT = parsePositiveIntEnv(process.env.WHATSAPP_HISTORY_SYNC_MESSAGES_LIMIT, 600);
const INBOX_RECONCILIATION_WORKER_ENABLED = parseBooleanEnv(
    process.env.INBOX_RECONCILIATION_WORKER_ENABLED,
    true
);
const INBOX_RECONCILIATION_INTERVAL_MS = parsePositiveIntEnv(
    process.env.INBOX_RECONCILIATION_INTERVAL_MS,
    15 * 60 * 1000
);
const INBOX_RECONCILIATION_MAX_CONVERSATIONS = parsePositiveIntInRange(
    process.env.INBOX_RECONCILIATION_MAX_CONVERSATIONS,
    Math.min(80, WHATSAPP_MANUAL_RECONNECT_CATCHUP_MAX_CONVERSATIONS),
    1,
    WHATSAPP_RECONNECT_CATCHUP_MAX_CONVERSATIONS_HARD_LIMIT
);
const INBOX_RECONCILIATION_MESSAGES_PER_CONVERSATION = parsePositiveIntInRange(
    process.env.INBOX_RECONCILIATION_MESSAGES_PER_CONVERSATION,
    Math.min(120, WHATSAPP_MANUAL_RECONNECT_CATCHUP_MESSAGES_PER_CONVERSATION),
    10,
    WHATSAPP_RECONNECT_CATCHUP_MESSAGES_PER_CONVERSATION_HARD_LIMIT
);
const INBOX_RECONCILIATION_MAX_RUNTIME_MS = parsePositiveIntInRange(
    process.env.INBOX_RECONCILIATION_MAX_RUNTIME_MS,
    Math.min(90000, WHATSAPP_MANUAL_RECONNECT_CATCHUP_MAX_RUNTIME_MS),
    3000,
    WHATSAPP_RECONNECT_CATCHUP_MAX_RUNTIME_HARD_LIMIT_MS
);
const FLOW_AWAITING_INPUT_RECOVERY_ENABLED = parseBooleanEnv(
    process.env.FLOW_AWAITING_INPUT_RECOVERY_ENABLED,
    true
);
const FLOW_AWAITING_INPUT_RECOVERY_INTERVAL_MS = parsePositiveIntEnv(
    process.env.FLOW_AWAITING_INPUT_RECOVERY_INTERVAL_MS,
    12000
);
const FLOW_AWAITING_INPUT_RECOVERY_MAX_EXECUTIONS = parsePositiveIntInRange(
    process.env.FLOW_AWAITING_INPUT_RECOVERY_MAX_EXECUTIONS,
    40,
    1,
    500
);
const FLOW_AWAITING_INPUT_RECOVERY_BACKFILL_LIMIT = parsePositiveIntInRange(
    process.env.FLOW_AWAITING_INPUT_RECOVERY_BACKFILL_LIMIT,
    40,
    10,
    250
);
const FLOW_AWAITING_INPUT_RECOVERY_MAX_MESSAGES_PER_EXECUTION = parsePositiveIntInRange(
    process.env.FLOW_AWAITING_INPUT_RECOVERY_MAX_MESSAGES_PER_EXECUTION,
    2,
    1,
    20
);
const FLOW_EXECUTION_RUNNING_TIMEOUT_HOURS = parsePositiveIntInRange(
    process.env.FLOW_EXECUTION_RUNNING_TIMEOUT_HOURS,
    72,
    1,
    720
);

senderAllocatorService.setRuntimeSessionsGetter(() => sessions);
senderAllocatorService.setDefaultSessionId(DEFAULT_WHATSAPP_SESSION_ID);

function stopSessionHealthMonitor(session) {
    if (!session) return;
    if (session.healthMonitor && typeof session.healthMonitor.stop === 'function') {
        try {
            session.healthMonitor.stop();
        } catch (error) {
            // ignore monitor shutdown errors
        }
    }
    session.healthMonitor = null;
}

function isActiveSessionSocket(sessionId, sock) {
    const session = sessions.get(sessionId);
    return Boolean(session && session.socket === sock);
}

function normalizeSessionErrorText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

function isDisconnectedSessionRuntimeError(error) {
    const code = String(error?.code || '').trim().toUpperCase();
    if (code === 'SESSION_DISCONNECTED' || code === 'SESSION_RECONNECTING' || code === 'SESSION_COOLDOWN') {
        return true;
    }

    const message = normalizeSessionErrorText(error?.message || error);
    if (!message) return false;

    return (
        message.includes('not connected') ||
        message.includes('connection closed') ||
        message.includes('connection lost') ||
        message.includes('stream errored') ||
        message.includes('stream error') ||
        message.includes('socket closed') ||
        (message.includes('sess') && message.includes('conect'))
    );
}

function setRuntimeSessionDispatchBackoff(session, backoffMs = WHATSAPP_SESSION_DISPATCH_BACKOFF_MS, reason = 'unavailable') {
    if (!session) return 0;
    const durationMs = Number(backoffMs);
    const normalizedBackoffMs = Number.isFinite(durationMs) && durationMs > 0
        ? Math.floor(durationMs)
        : WHATSAPP_SESSION_DISPATCH_BACKOFF_MS;
    const nextBlockedUntilMs = Date.now() + normalizedBackoffMs;
    session.dispatchBlockedUntilMs = Math.max(Number(session.dispatchBlockedUntilMs || 0), nextBlockedUntilMs);
    const normalizedReason = String(reason || '').trim().toLowerCase();
    session.dispatchBlockReason = normalizedReason || null;
    return session.dispatchBlockedUntilMs;
}

function clearRuntimeSessionDispatchBackoff(session) {
    if (!session) return;
    session.dispatchBlockedUntilMs = 0;
    session.dispatchBlockReason = null;
}

function consumeSessionSendRateSlot(sessionId) {
    const normalizedSessionId = sanitizeSessionId(sessionId);
    if (!normalizedSessionId || !WHATSAPP_SESSION_RATE_LIMIT_ENABLED) {
        return {
            allowed: true,
            retryAfterMs: 0,
            limitPerMinute: WHATSAPP_SESSION_RATE_LIMIT_MAX_PER_MINUTE
        };
    }

    const nowMs = Date.now();
    const windowMs = 60000;
    const limitPerMinute = Math.max(1, WHATSAPP_SESSION_RATE_LIMIT_MAX_PER_MINUTE);
    let state = sessionSendRateStateBySessionId.get(normalizedSessionId);

    if (!state || Number(state.windowEndsAtMs || 0) <= nowMs) {
        state = {
            count: 0,
            windowEndsAtMs: nowMs + windowMs
        };
        sessionSendRateStateBySessionId.set(normalizedSessionId, state);
    }

    if (Number(state.count || 0) >= limitPerMinute) {
        return {
            allowed: false,
            retryAfterMs: Math.max(1000, Number(state.windowEndsAtMs || nowMs + 1000) - nowMs),
            limitPerMinute
        };
    }

    state.count = Number(state.count || 0) + 1;
    return {
        allowed: true,
        retryAfterMs: 0,
        limitPerMinute,
        remaining: Math.max(0, limitPerMinute - state.count)
    };
}

function enforceSessionSendRateLimit(sessionId, session = null) {
    const rateState = consumeSessionSendRateSlot(sessionId);
    if (rateState.allowed) return;

    const retryAfterMs = Math.max(1000, Number(rateState.retryAfterMs || 0) || 1000);
    const normalizedSessionId = sanitizeSessionId(sessionId);
    const runtimeSession = session || sessions.get(normalizedSessionId);
    if (runtimeSession) {
        setRuntimeSessionDispatchBackoff(runtimeSession, retryAfterMs, 'cooldown');
    }

    throw buildSessionUnavailableError({
        status: 'cooldown',
        retryAfterMs,
        reason: `Limite de envio por sessao atingido (${rateState.limitPerMinute}/min)`
    }, 'Sessao em cooldown de envio');
}

function clearRuntimeSessionReconnectTimer(session) {
    if (!session || !session.reconnectScheduleTimer) return;
    clearTimeout(session.reconnectScheduleTimer);
    session.reconnectScheduleTimer = null;
}

async function resetSessionRuntimeAndAuth(sessionId, options = {}) {
    const normalizedSessionId = sanitizeSessionId(sessionId);
    if (!normalizedSessionId) return;

    const runtimeSession = sessions.get(normalizedSessionId);
    const shouldLogoutSocket = options?.logoutSocket === true;
    clearSessionReconnectCatchupTimer(normalizedSessionId);
    if (qrTimeouts.has(normalizedSessionId)) {
        clearTimeout(qrTimeouts.get(normalizedSessionId));
        qrTimeouts.delete(normalizedSessionId);
    }
    clearPendingSessionRecoveryEntries(normalizedSessionId, pendingCiphertextRecoveries);
    clearPendingSessionRecoveryEntries(normalizedSessionId, pendingLidResolutionRecoveries);

    if (runtimeSession) {
        clearRuntimeSessionReconnectTimer(runtimeSession);
        stopSessionHealthMonitor(runtimeSession);
        try {
            if (typeof runtimeSession.socket?.ev?.removeAllListeners === 'function') {
                runtimeSession.socket.ev.removeAllListeners();
            }
        } catch (_) {
            // ignore listener cleanup failure
        }
        try {
            if (shouldLogoutSocket && typeof runtimeSession.socket?.logout === 'function') {
                await runtimeSession.socket.logout();
            } else if (typeof runtimeSession.socket?.end === 'function') {
                await runtimeSession.socket.end(new Error('force_fresh_qr'));
            }
        } catch (_) {
            // ignore socket shutdown failure
        }
    }

    sessions.delete(normalizedSessionId);
    reconnectAttempts.delete(normalizedSessionId);
    reconnectInFlight.delete(normalizedSessionId);
    sessionInitLocks.delete(normalizedSessionId);
    sessionInitLockTimestamps.delete(normalizedSessionId);
    sessionReconnectCatchupInFlight.delete(normalizedSessionId);
    sessionHistorySyncQueues.delete(normalizedSessionId);
    sessionSendRateStateBySessionId.delete(normalizedSessionId);
    sessionStartupErrors.delete(normalizedSessionId);

    const sessionPath = path.join(SESSIONS_DIR, normalizedSessionId);
    if (fs.existsSync(sessionPath)) {
        try {
            fs.rmSync(sessionPath, { recursive: true, force: true });
        } catch (error) {
            console.warn(`[${normalizedSessionId}] Falha ao limpar pasta da sessao para QR novo:`, error.message);
        }
    }

    try {
        await clearPersistedBaileysAuthState(normalizedSessionId);
    } catch (error) {
        console.warn(`[${normalizedSessionId}] Falha ao limpar auth state persistido para QR novo:`, error.message);
    }

    const requestedOwnerUserId = Number(options?.ownerUserId || runtimeSession?.ownerUserId || 0);
    const ownerUserId = Number.isInteger(requestedOwnerUserId) && requestedOwnerUserId > 0
        ? requestedOwnerUserId
        : null;
    await persistWhatsappSession(normalizedSessionId, 'disconnected', {
        eventTimestamp: new Date().toISOString(),
        ownerUserId
    });
}

function clearPendingSessionRecoveryEntries(sessionId, recoveryMap) {
    const normalizedSessionId = sanitizeSessionId(sessionId);
    if (!normalizedSessionId || !recoveryMap || typeof recoveryMap.entries !== 'function') {
        return;
    }

    const recoveryKeyPrefix = `${normalizedSessionId}:`;
    for (const [recoveryKey, recoveryState] of recoveryMap.entries()) {
        if (!String(recoveryKey || '').startsWith(recoveryKeyPrefix)) continue;
        if (recoveryState?.timer) {
            clearTimeout(recoveryState.timer);
        }
        recoveryMap.delete(recoveryKey);
    }
}

async function removeSessionCompletely(sessionId, options = {}) {
    const normalizedSessionId = sanitizeSessionId(sessionId);
    if (!normalizedSessionId) {
        throw new Error('sessionId invalido');
    }

    const explicitOwnerUserId = normalizeOwnerUserId(options.ownerUserId);
    const explicitCreatedBy = normalizeOwnerUserId(options.createdBy);
    const runtimeSession = sessions.get(normalizedSessionId);
    const resolvedOwnerUserId = explicitOwnerUserId
        || normalizeOwnerUserId(runtimeSession?.ownerUserId)
        || await resolveSessionOwnerUserId(normalizedSessionId);

    clearSessionReconnectCatchupTimer(normalizedSessionId);
    if (qrTimeouts.has(normalizedSessionId)) {
        clearTimeout(qrTimeouts.get(normalizedSessionId));
        qrTimeouts.delete(normalizedSessionId);
    }
    clearPendingSessionRecoveryEntries(normalizedSessionId, pendingCiphertextRecoveries);
    clearPendingSessionRecoveryEntries(normalizedSessionId, pendingLidResolutionRecoveries);

    if (runtimeSession) {
        clearRuntimeSessionReconnectTimer(runtimeSession);
        stopSessionHealthMonitor(runtimeSession);
        try {
            if (typeof runtimeSession.socket?.ev?.removeAllListeners === 'function') {
                runtimeSession.socket.ev.removeAllListeners();
            }
        } catch (_) {
            // ignore listener cleanup failure
        }
        try {
            if (typeof runtimeSession.socket?.logout === 'function') {
                await runtimeSession.socket.logout();
            }
        } catch (_) {
            // ignore logout failure during explicit removal
        }
    }

    sessions.delete(normalizedSessionId);
    reconnectAttempts.delete(normalizedSessionId);
    reconnectInFlight.delete(normalizedSessionId);
    sessionInitLocks.delete(normalizedSessionId);
    sessionInitLockTimestamps.delete(normalizedSessionId);
    sessionReconnectCatchupInFlight.delete(normalizedSessionId);
    sessionHistorySyncQueues.delete(normalizedSessionId);
    sessionSendRateStateBySessionId.delete(normalizedSessionId);
    sessionStartupErrors.delete(normalizedSessionId);

    const sessionPath = path.join(SESSIONS_DIR, normalizedSessionId);
    if (fs.existsSync(sessionPath)) {
        try {
            fs.rmSync(sessionPath, { recursive: true, force: true });
        } catch (error) {
            console.warn(`[${normalizedSessionId}] Falha ao limpar pasta da sessao removida:`, error.message);
        }
    }

    try {
        await clearPersistedBaileysAuthState(normalizedSessionId);
    } catch (error) {
        console.warn(`[${normalizedSessionId}] Falha ao limpar auth state persistido da sessao removida:`, error.message);
    }

    const deletion = await WhatsAppSession.deleteBySessionId(normalizedSessionId, {
        owner_user_id: explicitOwnerUserId || undefined,
        created_by: explicitCreatedBy || undefined
    });

    invalidateBusinessHoursSettingsCache();
    emitToOwnerScope(resolvedOwnerUserId || null, 'whatsapp-status', {
        sessionId: normalizedSessionId,
        status: 'disconnected'
    });

    return {
        sessionId: normalizedSessionId,
        ownerUserId: resolvedOwnerUserId || null,
        deletion
    };
}

async function disconnectSessionPreservingRecord(sessionId, options = {}) {
    const normalizedSessionId = sanitizeSessionId(sessionId);
    if (!normalizedSessionId) {
        throw new Error('sessionId invalido');
    }

    const explicitOwnerUserId = normalizeOwnerUserId(options.ownerUserId);
    await resetSessionRuntimeAndAuth(normalizedSessionId, {
        ownerUserId: explicitOwnerUserId || undefined,
        logoutSocket: options.logoutSocket !== false
    });

    const resolvedOwnerUserId = explicitOwnerUserId || await resolveSessionOwnerUserId(normalizedSessionId);
    emitToOwnerScope(resolvedOwnerUserId || null, 'whatsapp-status', {
        sessionId: normalizedSessionId,
        status: 'disconnected'
    });

    return {
        sessionId: normalizedSessionId,
        ownerUserId: resolvedOwnerUserId || null
    };
}

function getSessionDispatchState(sessionId) {
    const normalizedSessionId = sanitizeSessionId(sessionId);
    const session = sessions.get(normalizedSessionId);
    if (!session) {
        const hasStoredSession = normalizedSessionId ? sessionExists(normalizedSessionId) : false;
        return {
            available: false,
            status: hasStoredSession ? 'reconnecting' : 'disconnected',
            retryAfterMs: hasStoredSession
                ? Math.min(20000, Math.max(RECONNECT_DELAY, 3000))
                : WHATSAPP_SESSION_DISPATCH_BACKOFF_MS,
            reason: hasStoredSession
                ? 'Sessao reidratando/reconectando no servidor'
                : 'Sessao nao inicializada no runtime'
        };
    }

    const nowMs = Date.now();
    const blockedUntilMs = Number(session.dispatchBlockedUntilMs || 0);
    if (blockedUntilMs > nowMs) {
        const retryAfterMs = Math.max(1000, blockedUntilMs - nowMs);
        const blockReason = String(session.dispatchBlockReason || '').trim().toLowerCase();
        if (blockReason === 'cooldown') {
            return {
                available: false,
                status: 'cooldown',
                retryAfterMs,
                reason: 'Sessao em cooldown por limite de envio'
            };
        }
        if (blockReason === 'warming_up') {
            return {
                available: false,
                status: 'warming_up',
                retryAfterMs,
                reason: 'Sessao em aquecimento apos reconexao'
            };
        }
        return {
            available: false,
            status: session.isConnected ? 'warming_up' : (session.reconnecting ? 'reconnecting' : 'disconnected'),
            retryAfterMs,
            reason: session.isConnected
                ? 'Sessao em aquecimento apos reconexao'
                : (session.reconnecting ? 'Sessao reconectando' : 'Sessao temporariamente indisponivel')
        };
    }

    if (!session.isConnected) {
        return {
            available: false,
            status: session.reconnecting ? 'reconnecting' : 'disconnected',
            retryAfterMs: session.reconnecting ? Math.min(20000, Math.max(RECONNECT_DELAY, 3000)) : WHATSAPP_SESSION_DISPATCH_BACKOFF_MS,
            reason: session.reconnecting ? 'Sessao reconectando' : 'Sessao nao conectada'
        };
    }

    const sendReadyAtMs = Number(session.sendReadyAtMs || 0);
    if (sendReadyAtMs > nowMs) {
        return {
            available: false,
            status: 'warming_up',
            retryAfterMs: Math.max(1000, sendReadyAtMs - nowMs),
            reason: 'Sessao em aquecimento apos reconexao'
        };
    }

    return {
        available: true,
        status: 'connected',
        retryAfterMs: null,
        reason: ''
    };
}

function buildSessionUnavailableError(sessionState, fallbackMessage = 'Sessao nao conectada') {
    const status = String(sessionState?.status || '').trim().toLowerCase();
    const retryAfterMs = Number(sessionState?.retryAfterMs);
    let message = String(sessionState?.reason || '').trim();
    let code = 'SESSION_DISCONNECTED';

    if (status === 'warming_up') {
        code = 'SESSION_WARMING_UP';
        if (!message) message = 'Sessao em aquecimento apos reconexao';
    } else if (status === 'reconnecting') {
        code = 'SESSION_RECONNECTING';
        if (!message) message = 'Sessao reconectando';
    } else if (status === 'cooldown') {
        code = 'SESSION_COOLDOWN';
        if (!message) message = 'Sessao em cooldown temporario';
    }

    if (!message) message = fallbackMessage;

    const error = new Error(message);
    error.code = code;
    if (Number.isFinite(retryAfterMs) && retryAfterMs > 0) {
        error.retryAfterMs = Math.floor(retryAfterMs);
    }
    return error;
}

function scheduleRuntimeSessionReconnect(sessionId, session = null) {
    const normalizedSessionId = sanitizeSessionId(sessionId);
    if (!normalizedSessionId) return;
    if (isServerShuttingDown) return;

    const runtimeSession = session || sessions.get(normalizedSessionId);
    if (!runtimeSession) return;
    if (runtimeSession.reconnecting) return;
    if (sessionInitLocks.has(normalizedSessionId)) return;
    if (reconnectInFlight.has(normalizedSessionId)) return;

    clearRuntimeSessionReconnectTimer(runtimeSession);
    runtimeSession.reconnecting = true;

    runtimeSession.reconnectScheduleTimer = setTimeout(() => {
        runtimeSession.reconnectScheduleTimer = null;
        if (isServerShuttingDown) return;

        const latestSession = sessions.get(normalizedSessionId);
        if (!latestSession) return;
        if (sessionInitLocks.has(normalizedSessionId)) return;
        if (latestSession.isConnected) return;

        const currentAttempt = reconnectAttempts.get(normalizedSessionId) || 0;
        const clientSocket = latestSession.clientSocket || null;
        const ownerUserId = Number(latestSession.ownerUserId || 0) > 0 ? Number(latestSession.ownerUserId) : undefined;

        createSession(normalizedSessionId, clientSocket, currentAttempt, {
            ownerUserId
        }).catch((error) => {
            console.error(`[${normalizedSessionId}] Falha ao reconectar apos erro de envio:`, error.message);
        });
    }, 50);
}



function getSessionUser(sessionId) {

    return sessions.get(sessionId)?.user || null;

}



function getSessionDisplayName(sessionId) {
    const user = getSessionUser(sessionId);
    const name = user?.pushName || user?.name || null;
    return name ? normalizeText(name) : null;
}



function getSessionPhone(sessionId) {

    const user = getSessionUser(sessionId);

    return user?.phone || (user?.id ? extractNumber(user.id) : null);

}

function sanitizeSessionId(value, fallback = '') {
    return sanitizeConfiguredSessionId(value, fallback);
}

function hasRuntimeOrStoredSession(sessionId) {
    const normalizedSessionId = sanitizeSessionId(sessionId);
    if (!normalizedSessionId) return false;
    if (sessions.has(normalizedSessionId)) return true;
    return sessionExists(normalizedSessionId);
}

function resolveDefaultSessionId(preferredSessionId = '') {
    const preferred = sanitizeSessionId(preferredSessionId);
    if (preferred) return preferred;

    const candidates = listDefaultSessionCandidates();
    for (const candidate of candidates) {
        const runtimeSession = sessions.get(candidate);
        if (runtimeSession?.isConnected) {
            return candidate;
        }
    }

    for (const candidate of candidates) {
        if (hasRuntimeOrStoredSession(candidate)) {
            return candidate;
        }
    }

    for (const [runtimeSessionId, runtimeSession] of sessions.entries()) {
        if (runtimeSession?.isConnected) {
            return sanitizeSessionId(runtimeSessionId, DEFAULT_WHATSAPP_SESSION_ID);
        }
    }

    return DEFAULT_WHATSAPP_SESSION_ID;
}

function resolveFirstConnectedSessionId(preferredSessionId = '') {
    const preferred = sanitizeSessionId(preferredSessionId);
    if (preferred && sessions.get(preferred)?.isConnected) {
        return preferred;
    }

    for (const candidate of listDefaultSessionCandidates()) {
        const normalizedCandidate = sanitizeSessionId(candidate);
        if (normalizedCandidate && sessions.get(normalizedCandidate)?.isConnected) {
            return normalizedCandidate;
        }
    }

    for (const [runtimeSessionId, runtimeSession] of sessions.entries()) {
        if (!runtimeSession?.isConnected) continue;
        const normalizedRuntimeSessionId = sanitizeSessionId(runtimeSessionId);
        if (normalizedRuntimeSessionId) {
            return normalizedRuntimeSessionId;
        }
    }

    return '';
}

function resolveSessionIdOrDefault(sessionId, fallbackSessionId = '') {
    const normalizedSessionId = sanitizeSessionId(sessionId);
    if (normalizedSessionId && !LEGACY_WHATSAPP_SESSION_ALIASES.includes(normalizedSessionId)) {
        return normalizedSessionId;
    }

    const fallback = resolveDefaultSessionId(fallbackSessionId);
    const resolvedSessionId = sanitizeSessionId(normalizedSessionId, fallback);
    if (LEGACY_WHATSAPP_SESSION_ALIASES.includes(resolvedSessionId) && hasRuntimeOrStoredSession(resolvedSessionId)) {
        return resolvedSessionId;
    }

    return resolvedSessionId;
}

function normalizeSenderAccountsPayload(value) {
    if (!Array.isArray(value)) return [];
    return senderAllocatorService.normalizeSenderAccounts(value);
}

function normalizeCampaignDistributionStrategy(value, fallback = 'single') {
    return senderAllocatorService.normalizeStrategy(value, fallback);
}

function parseCampaignDistributionConfig(value) {
    if (value === undefined || value === null || value === '') {
        return null;
    }
    if (typeof value === 'object') {
        return value;
    }
    try {
        return JSON.parse(String(value));
    } catch (_) {
        return null;
    }
}



function isLidJid(jid) {

    return typeof jid === 'string' && jid.includes('@lid');

}



function isUserJid(jid) {

    return typeof jid === 'string' && jid.includes('@s.whatsapp.net');

}

function normalizeLidJid(jid) {
    const raw = String(jid || '').trim();
    if (!raw || !isLidJid(raw)) return '';

    const [userPart] = raw.split('@');
    const baseUser = String(userPart || '').split(':')[0].trim();
    if (!baseUser) return '';

    return `${baseUser}@lid`;
}

function normalizeUserJidCandidate(candidate) {
    const raw = String(candidate || '').trim();
    if (!raw) return '';

    if (isLidJid(raw)) {
        const normalizedLid = normalizeLidJid(raw);
        const mapped = jidAliasMap.get(raw) || (normalizedLid ? jidAliasMap.get(normalizedLid) : '');
        return mapped ? normalizeUserJidCandidate(mapped) : '';
    }

    if (isUserJid(raw)) {
        const digits = normalizePhoneDigits(raw);
        return digits ? `${digits}@s.whatsapp.net` : raw;
    }

    if (raw.includes('@c.us')) {
        const digits = normalizePhoneDigits(raw);
        return digits ? `${digits}@s.whatsapp.net` : '';
    }

    const digits = normalizePhoneDigits(raw);
    if (digits.length >= 10 && digits.length <= 15) {
        return `${digits}@s.whatsapp.net`;
    }

    return '';
}

function registerJidAlias(lidCandidate, userCandidate, sessionDigits = '') {
    const normalizedLid = normalizeLidJid(lidCandidate);
    const normalizedUser = normalizeUserJidCandidate(userCandidate);

    if (!normalizedLid || !normalizedUser) return null;

    const userDigits = normalizePhoneDigits(extractNumber(normalizedUser));
    if (sessionDigits && isSelfPhone(userDigits, sessionDigits)) {
        return null;
    }

    jidAliasMap.set(normalizedLid, normalizedUser);

    const rawLid = String(lidCandidate || '').trim();
    if (rawLid && rawLid !== normalizedLid) {
        jidAliasMap.set(rawLid, normalizedUser);
    }

    return normalizedUser;
}

function registerMessageJidAliases(msg, sessionPhone = '') {
    const sessionDigits = normalizePhoneDigits(sessionPhone);
    const key = msg?.key || {};
    const aliasPairs = [
        [key.senderLid, key.senderPn],
        [key.participantLid, key.participantPn],
        [key.remoteJid, key.senderPn],
        [key.remoteJid, key.participantPn],
        [key.participant, key.participantPn],
        [msg?.participant, key.participantPn]
    ];

    for (const [lidCandidate, userCandidate] of aliasPairs) {
        if (!lidCandidate || !userCandidate) continue;
        registerJidAlias(lidCandidate, userCandidate, sessionDigits);
    }
}



function normalizePhoneFromJid(jid) {

    if (!jid) return '';

    const jidStr = String(jid);

    if (jidStr.includes('@lid')) return '';

    const base = jidStr.split('@')[0].split(':')[0];

    return base.replace(/\D/g, '');

}



function normalizePhoneSuffix(value) {
    if (!value) return '';
    const digits = String(value).replace(/\D/g, '');
    if (!digits) return '';
    return digits.length >= 11 ? digits.slice(-11) : digits;
}

function normalizePhoneDigits(value) {
    if (!value) return '';
    return String(value).replace(/\D/g, '');
}

function isSelfPhone(phoneDigits, sessionDigits) {
    if (!phoneDigits || !sessionDigits) return false;
    if (phoneDigits === sessionDigits) return true;

    const isBrazilSession = sessionDigits.startsWith('55') && sessionDigits.length >= 13;
    const isBrazilPhone = phoneDigits.startsWith('55') && phoneDigits.length >= 13;

    if (isBrazilSession && sessionDigits.endsWith(phoneDigits) && phoneDigits.length === 11) return true;
    if (isBrazilPhone && phoneDigits.endsWith(sessionDigits) && sessionDigits.length === 11) return true;

    return false;
}

function normalizeText(value) {
    if (!value || typeof value !== 'string') return value;
    let text = value;

    if (text.includes('Ãƒ') || text.includes('Ã‚')) {
        try {
            const decoded = Buffer.from(text, 'latin1').toString('utf8');
            if (decoded && !decoded.includes('\uFFFD')) {
                text = decoded;
            }
        } catch (error) {
            // ignore
        }
    }

    if (text.includes('?') || text.includes('\uFFFD')) {
        const fixes = [
            [/Usu[?\uFFFD]rio/g, 'UsuÃ¡rio'],
            [/Voc[?\uFFFD]/g, 'VocÃª'],
            [/N[?\uFFFD]o/g, 'NÃ£o'],
            [/n[?\uFFFD]o/g, 'nÃ£o'],
            [/Conex[?\uFFFD]o/g, 'ConexÃ£o'],
            [/Sess[?\uFFFD]es/g, 'SessÃµes'],
            [/Automa[?\uFFFD][?\uFFFD]o/g, 'AutomaÃ§Ã£o'],
            [/Prote[?\uFFFD][?\uFFFD]o/g, 'ProteÃ§Ã£o']
        ];
        for (const [regex, replacement] of fixes) {
            text = text.replace(regex, replacement);
        }
    }

    return text;
}

function sanitizeAutoName(value) {
    const text = normalizeText(String(value || '').trim());
    if (!text) return '';

    const lower = text.toLowerCase();
    if (
        lower === 'sem nome' ||
        lower === 'unknown' ||
        lower === 'undefined' ||
        lower === 'null' ||
        lower === 'vocÃª' ||
        lower === 'voce'
    ) {
        return '';
    }

    if (text.includes('@s.whatsapp.net') || text.includes('@lid')) return '';
    if (/^\d+$/.test(text)) return '';

    return text;
}

function parseLeadCustomFields(value) {
    if (!value) return {};

    if (typeof value === 'object') {
        return Array.isArray(value) ? {} : { ...value };
    }

    if (typeof value !== 'string') return {};

    let current = value;
    for (let depth = 0; depth < 3; depth += 1) {
        if (typeof current !== 'string') break;
        const trimmed = current.trim();
        if (!trimmed) return {};
        try {
            current = JSON.parse(trimmed);
        } catch (_) {
            return {};
        }
    }

    if (!current || typeof current !== 'object' || Array.isArray(current)) {
        return {};
    }

    return { ...current };
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

function lockLeadNameAsManual(customFields, manualName = '') {
    const merged = mergeLeadCustomFields(customFields);
    const system = merged.__system && typeof merged.__system === 'object' && !Array.isArray(merged.__system)
        ? merged.__system
        : {};
    const sanitizedManualName = sanitizeAutoName(manualName);

    merged.__system = {
        ...system,
        manual_name_locked: true,
        manual_name_source: 'manual',
        manual_name_updated_at: new Date().toISOString(),
        ...(sanitizedManualName ? { manual_name_value: sanitizedManualName } : {})
    };

    return merged;
}

function resolveManualNameSnapshotFromLead(lead) {
    const customFields = parseLeadCustomFields(lead?.custom_fields);
    const snapshot = sanitizeAutoName(customFields?.__system?.manual_name_value);
    return snapshot || '';
}

function isLeadNameManuallyLocked(lead) {
    const customFields = parseLeadCustomFields(lead?.custom_fields);
    return customFields?.__system?.manual_name_locked === true;
}

function normalizeLeadAvatarUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (raw.startsWith('https://') || raw.startsWith('http://')) return raw;
    if (raw.startsWith('/uploads/')) return raw;
    return '';
}

function shouldSyncLeadAvatar(customFields) {
    const system = customFields?.__system && typeof customFields.__system === 'object' && !Array.isArray(customFields.__system)
        ? customFields.__system
        : {};
    const lastSyncRaw = String(system.avatar_last_sync_at || '').trim();
    if (!lastSyncRaw) return true;

    const lastSyncAt = Date.parse(lastSyncRaw);
    if (!Number.isFinite(lastSyncAt)) return true;

    return (Date.now() - lastSyncAt) >= LEAD_AVATAR_SYNC_TTL_MS;
}

async function syncLeadAvatarFromWhatsApp({ sessionId, lead, jid }) {
    if (!lead?.id) return null;

    const targetJid = normalizeUserJidCandidate(jid || lead.jid) || normalizeJid(jid || lead.jid);
    if (!targetJid || !isUserJid(targetJid)) return null;

    const session = sessions.get(sessionId);
    if (!session?.isConnected || typeof session?.socket?.profilePictureUrl !== 'function') {
        return null;
    }

    const currentCustomFields = parseLeadCustomFields(lead.custom_fields);
    if (!shouldSyncLeadAvatar(currentCustomFields)) {
        return normalizeLeadAvatarUrl(
            currentCustomFields?.[LEAD_AVATAR_CUSTOM_FIELD_KEY] || currentCustomFields?.avatarUrl
        ) || null;
    }

    const previousAvatar = normalizeLeadAvatarUrl(
        currentCustomFields?.[LEAD_AVATAR_CUSTOM_FIELD_KEY] || currentCustomFields?.avatarUrl
    );

    const nowIso = new Date().toISOString();
    let resolvedAvatar = '';

    try {
        const timeoutMs = Math.max(1000, LEAD_AVATAR_SYNC_TIMEOUT_MS);
        resolvedAvatar = await Promise.race([
            Promise.resolve(session.socket.profilePictureUrl(targetJid, 'image'))
                .then((url) => normalizeLeadAvatarUrl(url))
                .catch(() => ''),
            new Promise((resolve) => setTimeout(() => resolve(''), timeoutMs))
        ]);
    } catch (_) {
        resolvedAvatar = '';
    }

    const nextCustomFields = mergeLeadCustomFields(currentCustomFields, {
        __system: {
            avatar_last_sync_at: nowIso,
            avatar_jid: targetJid
        }
    });

    if (resolvedAvatar) {
        nextCustomFields[LEAD_AVATAR_CUSTOM_FIELD_KEY] = resolvedAvatar;
    }

    await Lead.update(lead.id, { custom_fields: nextCustomFields });
    lead.custom_fields = nextCustomFields;

    return resolvedAvatar || previousAvatar || null;
}

function parseLeadTagsForMerge(rawTags) {
    return uniqueUnifiedTagLabels(parseUnifiedTagList(rawTags));
}

function normalizeImportedLeadPhone(value) {
    let digits = String(value || '').replace(/\D/g, '');
    if (!digits) return '';

    // Remove DDI repetido (ex.: 5555...)
    while (digits.startsWith('55') && digits.length > 13) {
        digits = digits.slice(2);
    }

    return digits;
}

function buildLeadJidFromPhone(phone) {
    const digits = normalizeImportedLeadPhone(phone);
    if (!digits) return '';
    const waNumber = digits.startsWith('55') ? digits : `55${digits}`;
    return `${waNumber}@s.whatsapp.net`;
}

function sanitizeLeadNameForInsert(value) {
    const text = normalizeText(String(value || '').trim());
    if (!text) return '';

    const lower = text.toLowerCase();
    if (
        lower === 'sem nome' ||
        lower === 'unknown' ||
        lower === 'undefined' ||
        lower === 'null'
    ) {
        return '';
    }

    if (text.includes('@s.whatsapp.net') || text.includes('@lid')) return '';
    if (/^\d+$/.test(text)) return '';

    return text;
}

function resolveImportedLeadName(input) {
    if (!input || typeof input !== 'object') return '';

    const nameCandidates = [
        input.name,
        input.nome,
        input.nome_completo,
        input.nomecompleto,
        input['nome completo'],
        input.full_name,
        input.fullname,
        input.lead_name,
        input.lead,
        input.contato,
        input.cliente
    ];

    for (const candidate of nameCandidates) {
        const value = String(candidate || '').trim();
        if (value) return value;
    }

    return '';
}

function normalizeLeadStatusForImport(value, fallback = 1) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 5) {
        return parsed;
    }
    return fallback;
}

function normalizeLeadSource(source) {
    return String(source || '').trim().toLowerCase();
}

function resolvePreferredLeadName(primaryLead, duplicateLead) {
    const primaryName = sanitizeAutoName(primaryLead?.name) || resolveManualNameSnapshotFromLead(primaryLead);
    const duplicateName = sanitizeAutoName(duplicateLead?.name) || resolveManualNameSnapshotFromLead(duplicateLead);

    if (!primaryName && duplicateName) return duplicateName;
    if (primaryName && !duplicateName) return primaryName;
    if (!primaryName && !duplicateName) return '';

    const primaryLocked = isLeadNameManuallyLocked(primaryLead);
    const duplicateLocked = isLeadNameManuallyLocked(duplicateLead);
    if (duplicateLocked && !primaryLocked) return duplicateName;

    const primarySource = normalizeLeadSource(primaryLead?.source);
    const duplicateSource = normalizeLeadSource(duplicateLead?.source);
    if (primarySource === 'whatsapp' && duplicateSource !== 'whatsapp') return duplicateName;

    return primaryName;
}

function resolveMostRecentTimestamp(first, second) {
    const firstTime = first ? Date.parse(String(first)) : NaN;
    const secondTime = second ? Date.parse(String(second)) : NaN;

    if (Number.isFinite(firstTime) && Number.isFinite(secondTime)) {
        return firstTime >= secondTime ? first : second;
    }
    if (Number.isFinite(firstTime)) return first;
    if (Number.isFinite(secondTime)) return second;
    return first || second || null;
}

function getLeadMergeScore(lead) {
    let score = 0;

    if (sanitizeAutoName(lead?.name) || resolveManualNameSnapshotFromLead(lead)) score += 4;
    if (isLeadNameManuallyLocked(lead)) score += 3;
    const source = normalizeLeadSource(lead?.source);
    if (source && source !== 'whatsapp') score += 2;
    if (lead?.jid && String(lead.jid).includes('@s.whatsapp.net')) score += 1;

    return score;
}

function shouldAutoUpdateLeadName(lead, phone, sessionDisplayName = '') {
    if (isLeadNameManuallyLocked(lead)) return false;
    const source = normalizeLeadSource(lead?.source);
    if (source && source !== 'whatsapp') return false;

    const currentRaw = normalizeText(String(lead?.name || '').trim());
    if (!currentRaw) return true;

    const current = currentRaw.toLowerCase();
    if (
        current === 'sem nome' ||
        current === 'unknown' ||
        current === 'undefined' ||
        current === 'null' ||
        current === 'vocÃª' ||
        current === 'voce' ||
        current === 'usuÃ¡rio (vocÃª)' ||
        current === 'usuario (voce)'
    ) {
        return true;
    }

    const currentDigits = normalizePhoneDigits(currentRaw);
    const phoneDigits = normalizePhoneDigits(phone);
    if (phoneDigits && currentDigits && currentDigits === phoneDigits) return true;
    if (/^\d+$/.test(currentRaw)) return true;

    const sessionName = normalizeText(String(sessionDisplayName || '').trim());
    if (sessionName && (currentRaw === sessionName || currentRaw === `${sessionName} (VocÃª)`)) {
        return true;
    }

    return false;
}

function previewForMedia(mediaType) {
    switch (mediaType) {
        case 'image':
            return '[imagem]';
        case 'video':
            return '[video]';
        case 'audio':
            return '[audio]';
        case 'document':
            return '[documento]';
        case 'sticker':
            return '[sticker]';
        case 'contact':
            return '[contato]';
        case 'location':
            return '[localizacao]';
        default:
            return '[mensagem]';
    }
}

function unwrapMessageContent(message) {
    if (!message) return null;

    let current = message;
    for (let i = 0; i < 6; i += 1) {
        if (current?.ephemeralMessage?.message) {
            current = current.ephemeralMessage.message;
            continue;
        }
        if (current?.viewOnceMessageV2Extension?.message) {
            current = current.viewOnceMessageV2Extension.message;
            continue;
        }
        if (current?.viewOnceMessageV2?.message) {
            current = current.viewOnceMessageV2.message;
            continue;
        }
        if (current?.viewOnceMessage?.message) {
            current = current.viewOnceMessage.message;
            continue;
        }
        if (current?.deviceSentMessage?.message) {
            current = current.deviceSentMessage.message;
            continue;
        }
        if (current?.editedMessage?.message) {
            current = current.editedMessage.message;
            continue;
        }
        if (current?.documentWithCaptionMessage?.message) {
            current = current.documentWithCaptionMessage.message;
            continue;
        }
        break;
    }

    return current;
}

function extractTextFromMessageContent(content) {
    if (!content) return '';
    const interactiveSelection = extractInteractiveSelectionFromMessageContent(content);
    return (
        content.conversation ||
        content.extendedTextMessage?.text ||
        content.imageMessage?.caption ||
        content.videoMessage?.caption ||
        content.documentMessage?.caption ||
        interactiveSelection?.text ||
        interactiveSelection?.id ||
        ''
    );
}

function extractInteractiveSelectionFromMessageContent(content) {
    if (!content) return null;

    const listReply = content?.listResponseMessage?.singleSelectReply;
    if (listReply) {
        const id = normalizeText(listReply.selectedRowId || listReply.selectedId || '');
        const text = normalizeText(listReply.title || listReply.selectedDisplayText || listReply.description || '');
        const description = normalizeText(listReply.description || '');
        if (id || text || description) {
            return { id, text, description, source: 'list' };
        }
    }

    const buttonReply = content?.buttonsResponseMessage;
    if (buttonReply) {
        const id = normalizeText(buttonReply.selectedButtonId || buttonReply.selectedId || '');
        const text = normalizeText(buttonReply.selectedDisplayText || buttonReply.text || '');
        if (id || text) {
            return { id, text, description: '', source: 'buttons' };
        }
    }

    const templateButtonReply = content?.templateButtonReplyMessage;
    if (templateButtonReply) {
        const id = normalizeText(templateButtonReply.selectedId || templateButtonReply.id || '');
        const text = normalizeText(templateButtonReply.selectedDisplayText || templateButtonReply.displayText || '');
        if (id || text) {
            return { id, text, description: '', source: 'template_button' };
        }
    }

    const paramsJson = content?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson;
    if (paramsJson) {
        try {
            let parsed = paramsJson;
            if (typeof parsed === 'string') {
                const raw = parsed.trim();
                if (raw) {
                    try {
                        parsed = JSON.parse(raw);
                    } catch (_) {
                        parsed = JSON.parse(decodeURIComponent(raw));
                    }
                }
            }
            const id = normalizeText(
                parsed?.id
                || parsed?.selectedId
                || parsed?.selected_id
                || parsed?.selectedRowId
                || parsed?.selected_row_id
                || parsed?.rowId
                || parsed?.row_id
                || parsed?.optionId
                || parsed?.option_id
                || parsed?.value
                || ''
            );
            const text = normalizeText(
                parsed?.text
                || parsed?.title
                || parsed?.display_text
                || parsed?.selectedDisplayText
                || parsed?.displayText
                || parsed?.label
                || parsed?.optionLabel
                || ''
            );
            const description = normalizeText(parsed?.description || '');
            if (id || text || description) {
                return { id, text, description, source: 'interactive' };
            }
        } catch (_) {
            // payload invalido nao impede o processamento da mensagem
        }
    }

    const interactiveBodyText = normalizeText(
        content?.interactiveResponseMessage?.body?.text
        || content?.interactiveResponseMessage?.body?.title
        || ''
    );
    if (interactiveBodyText) {
        return { id: '', text: interactiveBodyText, description: '', source: 'interactive_body' };
    }

    return null;
}

function detectMediaTypeFromMessageContent(content) {
    if (!content) return 'text';
    if (content.imageMessage) return 'image';
    if (content.videoMessage) return 'video';
    if (content.audioMessage) return 'audio';
    if (content.documentMessage) return 'document';
    if (content.stickerMessage) return 'sticker';
    if (content.contactMessage || content.contactsArrayMessage) return 'contact';
    if (content.locationMessage || content.liveLocationMessage) return 'location';
    return 'text';
}

const MEDIA_MIME_EXTENSION_MAP = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'audio/ogg': 'ogg',
    'audio/ogg; codecs=opus': 'ogg',
    'audio/mp4': 'm4a',
    'audio/mpeg': 'mp3',
    'audio/aac': 'aac',
    'audio/wav': 'wav',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/webm': 'webm',
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx'
};

function normalizeMediaMimeType(value) {
    if (!value) return '';
    return String(value).split(';')[0].trim().toLowerCase();
}

function resolveMediaExtension({ mimetype = '', fileName = '', fallback = 'bin' } = {}) {
    const normalizedMime = normalizeMediaMimeType(mimetype);
    if (normalizedMime && MEDIA_MIME_EXTENSION_MAP[normalizedMime]) {
        return MEDIA_MIME_EXTENSION_MAP[normalizedMime];
    }

    const fileExt = path.extname(String(fileName || '')).replace('.', '').trim().toLowerCase();
    if (fileExt) return fileExt;

    return fallback;
}

function sanitizeMediaFilePart(value, fallback = 'file') {
    const normalized = String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
    return normalized || fallback;
}

function resolveIncomingMediaPayload(content, mediaType) {
    if (!content || !mediaType) return null;

    if (mediaType === 'image' && content.imageMessage) {
        return {
            payload: content.imageMessage,
            downloadType: 'image',
            mimetype: content.imageMessage.mimetype || 'image/jpeg',
            fileName: content.imageMessage.fileName || '',
            fallbackExtension: 'jpg'
        };
    }

    if (mediaType === 'audio' && content.audioMessage) {
        return {
            payload: content.audioMessage,
            downloadType: 'audio',
            mimetype: content.audioMessage.mimetype || 'audio/ogg; codecs=opus',
            fileName: content.audioMessage.fileName || '',
            fallbackExtension: 'ogg'
        };
    }

    if (mediaType === 'video' && content.videoMessage) {
        return {
            payload: content.videoMessage,
            downloadType: 'video',
            mimetype: content.videoMessage.mimetype || 'video/mp4',
            fileName: content.videoMessage.fileName || '',
            fallbackExtension: 'mp4'
        };
    }

    if (mediaType === 'document' && content.documentMessage) {
        return {
            payload: content.documentMessage,
            downloadType: 'document',
            mimetype: content.documentMessage.mimetype || 'application/octet-stream',
            fileName: content.documentMessage.fileName || '',
            fallbackExtension: 'bin'
        };
    }

    if (mediaType === 'sticker' && content.stickerMessage) {
        return {
            payload: content.stickerMessage,
            downloadType: 'sticker',
            mimetype: content.stickerMessage.mimetype || 'image/webp',
            fileName: content.stickerMessage.fileName || '',
            fallbackExtension: 'webp'
        };
    }

    return null;
}

async function streamToBuffer(stream) {
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
}

async function persistIncomingMedia({ sessionId, messageId, content, mediaType, sourceMessage = null }) {
    try {
        let descriptor = resolveIncomingMediaPayload(content, mediaType);
        if (!descriptor) return null;

        const baileys = await baileysLoader.getBaileys();
        const downloadContentFromMessage = baileys?.downloadContentFromMessage;
        if (typeof downloadContentFromMessage !== 'function') return null;

        const downloadBuffer = async (currentDescriptor) => {
            const stream = await downloadContentFromMessage(currentDescriptor.payload, currentDescriptor.downloadType);
            return await streamToBuffer(stream);
        };

        let buffer = null;
        try {
            buffer = await downloadBuffer(descriptor);
        } catch (downloadError) {
            const session = sessions.get(sessionId);
            const socket = session?.socket;
            const canRefreshMediaMessage = Boolean(
                sourceMessage &&
                socket &&
                typeof socket.updateMediaMessage === 'function'
            );

            if (!canRefreshMediaMessage) {
                throw downloadError;
            }

            try {
                await socket.updateMediaMessage(sourceMessage);
                const refreshedContent = unwrapMessageContent(sourceMessage?.message);
                const refreshedDescriptor = resolveIncomingMediaPayload(refreshedContent, mediaType);
                if (refreshedDescriptor) {
                    descriptor = refreshedDescriptor;
                }
                buffer = await downloadBuffer(descriptor);
            } catch (refreshError) {
                throw refreshError;
            }
        }

        if (!buffer || buffer.length === 0) return null;

        const ext = resolveMediaExtension({
            mimetype: descriptor.mimetype,
            fileName: descriptor.fileName,
            fallback: descriptor.fallbackExtension
        });
        const safeSession = sanitizeMediaFilePart(sessionId || 'session');
        const safeMessage = sanitizeMediaFilePart(messageId || `msg-${Date.now()}`);
        const filename = `${Date.now()}-${safeSession}-${safeMessage}.${ext}`;
        const filePath = path.join(UPLOADS_DIR, filename);

        await fs.promises.writeFile(filePath, buffer);

        return {
            url: `/uploads/${filename}`,
            mimetype: descriptor.mimetype || null,
            filename: descriptor.fileName || filename,
            size: buffer.length
        };
    } catch (error) {
        console.warn(`[${sessionId}] Falha ao persistir media recebida (${mediaType}):`, error.message);
        return null;
    }
}

function parseMessageTimestampMs(value) {
    if (value === undefined || value === null) return 0;

    if (typeof value === 'number') {
        if (!Number.isFinite(value)) return 0;
        return value > 1e12 ? value : value * 1000;
    }

    if (typeof value === 'string') {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return 0;
        return parsed > 1e12 ? parsed : parsed * 1000;
    }

    if (typeof value === 'object') {
        if (typeof value.toNumber === 'function') {
            const parsed = Number(value.toNumber());
            if (Number.isFinite(parsed)) return parsed > 1e12 ? parsed : parsed * 1000;
        }
        if (typeof value.toString === 'function') {
            const parsed = Number(value.toString());
            if (Number.isFinite(parsed)) return parsed > 1e12 ? parsed : parsed * 1000;
        }
        if (typeof value.low === 'number') {
            if (!Number.isFinite(value.low)) return 0;
            return value.low > 1e12 ? Number(value.low) : Number(value.low) * 1000;
        }
    }

    return 0;
}
function normalizeJid(jid) {

    if (!jid) return null;

    if (isLidJid(jid)) {
        const normalizedLid = normalizeLidJid(jid);
        const mapped = jidAliasMap.get(jid) || (normalizedLid ? jidAliasMap.get(normalizedLid) : null);
        if (mapped) {
            return normalizeUserJidCandidate(mapped) || mapped;
        }

    }

    if (isUserJid(jid) || String(jid).includes('@c.us')) {
        return normalizeUserJidCandidate(jid) || jid;
    }

    return jid;

}



async function registerContactAlias(contact, sessionId = '', sessionPhone = '') {
    if (!contact) return;
    const sessionOwnerUserId = await resolveSessionOwnerUserId(sessionId);

    const candidates = [

        contact.id,

        contact.jid,

        contact.lid,

        contact.lidJid,

        contact?.lid?.id,

        contact?.lid?.jid

    ].filter(Boolean);



    if (candidates.length === 0) return;

    const notifyName = sanitizeAutoName(
        contact?.notify ||
        contact?.name ||
        contact?.verifiedName ||
        contact?.pushName ||
        contact?.vname ||
        contact?.short
    );
    const sessionDisplayName = getSessionDisplayName(sessionId);


    let lidJid = null;

    let userJid = null;
    const userJids = [];
    const sessionDigits = normalizePhoneDigits(sessionPhone);



    for (const cand of candidates) {

        if (!lidJid && isLidJid(cand)) {
            lidJid = normalizeLidJid(cand) || cand;
        }

        const normalizedUserJid = normalizeUserJidCandidate(cand);
        if (normalizedUserJid) {
            userJids.push(normalizedUserJid);
            if (!userJid) {
                const candidateDigits = normalizePhoneDigits(extractNumber(normalizedUserJid));
                if (!isSelfPhone(candidateDigits, sessionDigits)) {
                    userJid = normalizedUserJid;
                }
            }
        }

    }

    if (notifyName) {
        for (const candidateJid of userJids) {
            const normalizedCandidateJid = normalizeJid(candidateJid) || candidateJid;
            const candidatePhone = extractNumber(normalizedCandidateJid);
            const lead = await Lead.findByJid(normalizedCandidateJid, { owner_user_id: sessionOwnerUserId || undefined })
                || await Lead.findByPhone(candidatePhone, { owner_user_id: sessionOwnerUserId || undefined });
            if (!lead) continue;

            if (shouldAutoUpdateLeadName(lead, lead.phone || candidatePhone, sessionDisplayName)) {
                await Lead.update(lead.id, { name: notifyName });
            }
        }
    }

    if (candidates.length < 2) return;



    if (lidJid && userJid) {

        const mappedUserJid = registerJidAlias(lidJid, userJid, sessionDigits) || userJid;



        const primary = await Lead.findByJid(mappedUserJid, { owner_user_id: sessionOwnerUserId || undefined })
            || await Lead.findByPhone(extractNumber(mappedUserJid), { owner_user_id: sessionOwnerUserId || undefined });

        const duplicate = await Lead.findByJid(lidJid, { owner_user_id: sessionOwnerUserId || undefined })
            || await Lead.findByPhone(extractNumber(lidJid), { owner_user_id: sessionOwnerUserId || undefined });



        if (primary && duplicate && primary.id !== duplicate.id) {

            await mergeLeads(primary, duplicate);

        } else if (!primary && duplicate) {

            await updateLeadIdentity(duplicate, mappedUserJid, extractNumber(mappedUserJid));

        } else if (primary && primary.jid !== mappedUserJid) {

            await updateLeadIdentity(primary, mappedUserJid, extractNumber(mappedUserJid));

        }

    }
}

function isGroupMessage(msg) {
    const remoteJid = msg?.key?.remoteJid || '';
    const hasParticipant = Boolean(msg?.key?.participant || msg?.participant);
    const hasGroupSenderKey = Boolean(msg?.message?.senderKeyDistributionMessage?.groupId);

    return Boolean(
        remoteJid.endsWith('@g.us') ||
        remoteJid.endsWith('@broadcast') ||
        hasGroupSenderKey ||
        (hasParticipant && remoteJid && !isUserJid(remoteJid) && !isLidJid(remoteJid))
    );
}

function resolveMessageJid(msg, sessionPhone = '') {
    registerMessageJidAliases(msg, sessionPhone);
    const content = unwrapMessageContent(msg?.message);
    const candidates = [

        msg?.key?.senderPn,

        msg?.key?.participantPn,

        msg?.key?.senderLid,

        msg?.key?.participantLid,

        msg?.key?.remoteJid,

        msg?.key?.participant,

        msg?.participant,

        msg?.message?.deviceSentMessage?.destinationJid,

        msg?.message?.extendedTextMessage?.contextInfo?.participant,

        content?.extendedTextMessage?.contextInfo?.participant,

        msg?.message?.senderKeyDistributionMessage?.groupId

    ].filter(Boolean);

    const sessionDigits = normalizePhoneDigits(sessionPhone);

    let lidJid = null;
    const userJids = [];

    for (const jid of candidates) {

        const normalizedLid = normalizeLidJid(jid);
        if (!lidJid && normalizedLid) {
            lidJid = normalizedLid;
        }

        const normalizedUserJid = normalizeUserJidCandidate(jid);
        if (normalizedUserJid) userJids.push(normalizedUserJid);

    }

    const uniqueUserJids = [...new Set(userJids)];
    const nonSelfUserJid = uniqueUserJids.find((jid) => {
        const phoneDigits = normalizePhoneDigits(extractNumber(jid));
        return !isSelfPhone(phoneDigits, sessionDigits);
    });

    const preferredUserJid = nonSelfUserJid || uniqueUserJids[0] || null;

    // NÃƒÂ£o mapear LID para o prÃƒÂ³prio nÃƒÂºmero da sessÃƒÂ£o, pois isso causa
    // roteamento incorreto para o chat "VocÃƒÂª".
    if (lidJid && nonSelfUserJid) {

        registerJidAlias(lidJid, nonSelfUserJid, sessionDigits);

    }

    for (const jid of uniqueUserJids) {
        const normalized = normalizeJid(jid);
        if (!normalized || !isUserJid(normalized)) continue;

        const phoneDigits = normalizePhoneDigits(extractNumber(normalized));
        const isSelfJid = isSelfPhone(phoneDigits, sessionDigits);
        if (!isSelfJid) {
            return normalized;
        }
    }

    if (preferredUserJid) {
        return normalizeJid(preferredUserJid);
    }

    return normalizeUserJidCandidate(msg?.key?.remoteJid) || normalizeJid(msg?.key?.remoteJid);

}



async function mergeConversationsForLeads(primaryLeadId, duplicateLeadId) {

    const conversations = await query(

        'SELECT id, lead_id, unread_count, updated_at FROM conversations WHERE lead_id IN (?, ?) ORDER BY updated_at DESC',

        [primaryLeadId, duplicateLeadId]

    );



    if (!conversations || conversations.length === 0) return;



    const primaryConversation = conversations[0];

    const primaryConversationId = primaryConversation.id;

    const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);



    // Reatribuir mensagens e remover conversas duplicadas

    for (const conversation of conversations) {

        if (conversation.id === primaryConversationId) continue;

        await run('UPDATE messages SET conversation_id = ? WHERE conversation_id = ?', [primaryConversationId, conversation.id]);

        await run('DELETE FROM conversations WHERE id = ?', [conversation.id]);

    }



    // Garantir lead correto na conversa principal

    await run('UPDATE conversations SET lead_id = ?, unread_count = ? WHERE id = ?', [

        primaryLeadId,

        totalUnread,

        primaryConversationId

    ]);

}



async function mergeLeads(primaryLead, duplicateLead) {

    if (!primaryLead || !duplicateLead || primaryLead.id === duplicateLead.id) return;
    const primaryOwnerUserId = Number(primaryLead.owner_user_id || 0);
    const duplicateOwnerUserId = Number(duplicateLead.owner_user_id || 0);
    if (
        Number.isInteger(primaryOwnerUserId) && primaryOwnerUserId > 0
        && Number.isInteger(duplicateOwnerUserId) && duplicateOwnerUserId > 0
        && primaryOwnerUserId !== duplicateOwnerUserId
    ) {
        console.warn(
            `Ignorando merge entre leads de owners diferentes (${primaryLead.id}:${primaryOwnerUserId} vs ${duplicateLead.id}:${duplicateOwnerUserId})`
        );
        return;
    }

    const mergedTags = Array.from(
        new Set([
            ...parseLeadTagsForMerge(primaryLead.tags),
            ...parseLeadTagsForMerge(duplicateLead.tags)
        ])
    );
    const mergedCustomFields = mergeLeadCustomFields(primaryLead.custom_fields, duplicateLead.custom_fields);
    const preferredName = resolvePreferredLeadName(primaryLead, duplicateLead);
    const mergedLastMessageAt = resolveMostRecentTimestamp(primaryLead.last_message_at, duplicateLead.last_message_at);

    const updates = {};
    if (preferredName && preferredName !== String(primaryLead.name || '').trim()) {
        updates.name = preferredName;
    }
    if (!String(primaryLead.email || '').trim() && String(duplicateLead.email || '').trim()) {
        updates.email = String(duplicateLead.email || '').trim();
    }
    if (!String(primaryLead.vehicle || '').trim() && String(duplicateLead.vehicle || '').trim()) {
        updates.vehicle = String(duplicateLead.vehicle || '').trim();
    }
    if (!String(primaryLead.plate || '').trim() && String(duplicateLead.plate || '').trim()) {
        updates.plate = String(duplicateLead.plate || '').trim();
    }
    if (!primaryLead.assigned_to && duplicateLead.assigned_to) {
        updates.assigned_to = duplicateLead.assigned_to;
    }
    if (Number(primaryLead.is_blocked) === 1 && Number(duplicateLead.is_blocked) === 0) {
        updates.is_blocked = 0;
    }
    if (mergedLastMessageAt && mergedLastMessageAt !== primaryLead.last_message_at) {
        updates.last_message_at = mergedLastMessageAt;
    }
    updates.tags = mergedTags;
    updates.custom_fields = mergedCustomFields;

    if (Object.keys(updates).length > 0) {
        await Lead.update(primaryLead.id, updates);
    }


    // Mesclar conversas e mensagens

    await mergeConversationsForLeads(primaryLead.id, duplicateLead.id);

    await run('UPDATE messages SET lead_id = ? WHERE lead_id = ?', [primaryLead.id, duplicateLead.id]);

    await run('UPDATE conversations SET lead_id = ? WHERE lead_id = ?', [primaryLead.id, duplicateLead.id]);
    await run('UPDATE message_queue SET lead_id = ? WHERE lead_id = ?', [primaryLead.id, duplicateLead.id]);
    await run('UPDATE flow_executions SET lead_id = ? WHERE lead_id = ?', [primaryLead.id, duplicateLead.id]);



    // Remover lead duplicado

    await Lead.delete(duplicateLead.id);

}



async function updateLeadIdentity(lead, jid, phone) {
    if (!lead || !jid) return lead;

    const cleanedPhone = phone ? String(phone).replace(/\D/g, '') : '';
    if (!cleanedPhone) return lead;

    const hasChanges = lead.jid !== jid || String(lead.phone || '') !== cleanedPhone;
    if (!hasChanges) return lead;

    const oldPhone = String(lead.phone || '').replace(/\D/g, '');
    const currentSafeName = sanitizeAutoName(lead.name) || resolveManualNameSnapshotFromLead(lead);
    const nameDigits = String(currentSafeName || '').replace(/\D/g, '');
    const nextName = nameDigits && nameDigits === oldPhone && nameDigits !== cleanedPhone
        ? cleanedPhone
        : (currentSafeName || cleanedPhone);

    try {
        await run(
            "UPDATE leads SET jid = ?, phone = ?, phone_formatted = ?, name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            [jid, cleanedPhone, cleanedPhone, nextName, lead.id]
        );
        return await Lead.findById(lead.id) || lead;
    } catch (error) {
        console.warn('Falha ao atualizar identidade do lead:', error.message);
        return lead;
    }
}
async function cleanupDuplicateMessages() {

    try {

        // Remover duplicados com message_id igual (seguranÃ§a extra)

        await run(`

            DELETE FROM messages

            WHERE message_id IS NOT NULL

            AND id NOT IN (

                SELECT MIN(id) FROM messages

                WHERE message_id IS NOT NULL

                GROUP BY message_id

            )

        `);



        // Remover duplicados sem message_id (mesmo conteÃºdo no mesmo segundo)

        await run(`

            DELETE FROM messages

            WHERE message_id IS NULL

            AND id NOT IN (

                SELECT MIN(id) FROM messages

                WHERE message_id IS NULL

                GROUP BY conversation_id, lead_id, sender_type, content, media_type, is_from_me, created_at

            )

        `);

    } catch (error) {

        console.warn('?? Falha ao limpar mensagens duplicadas:', error.message);

    }

}





async function cleanupLidLeads() {

    try {

        const lidLeads = await query(

            "SELECT id FROM leads WHERE jid LIKE '%@lid%' OR phone LIKE '%@lid%'"

        );

        if (!lidLeads || lidLeads.length === 0) return;



        for (const lead of lidLeads) {
            await Lead.delete(lead.id);
        }

        console.log(`Removidos ${lidLeads.length} leads com @lid`);

    } catch (error) {

        console.warn('Falha ao limpar leads @lid:', error.message);

    }

}



async function cleanupInvalidPhones() {

    try {

        const candidates = await query(

            "SELECT id, jid, phone, owner_user_id FROM leads WHERE jid LIKE '%@s.whatsapp.net%'"

        );

        if (!candidates || candidates.length === 0) return;



        for (const lead of candidates) {

            const normalized = normalizePhoneFromJid(lead.jid);

            if (!normalized) continue;

            if (normalized === String(lead.phone || '')) continue;


            const leadOwnerUserId = Number(lead?.owner_user_id || 0);
            const existing = (Number.isInteger(leadOwnerUserId) && leadOwnerUserId > 0)
                ? await Lead.findByPhone(normalized, { owner_user_id: leadOwnerUserId })
                : null;

            if (existing && existing.id !== lead.id) {

                await mergeLeads(existing, lead);

            } else {

                await updateLeadIdentity(lead, lead.jid, normalized);

            }

        }

    } catch (error) {

        console.warn('Falha ao corrigir telefones invalidos:', error.message);

    }

}



async function cleanupEmptyWhatsappLeads() {

    try {

        const emptyLeads = await query(`

            SELECT l.id

            FROM leads l

            LEFT JOIN messages m ON m.lead_id = l.id

            WHERE l.source = 'whatsapp' AND m.id IS NULL

        `);

        if (!emptyLeads || emptyLeads.length === 0) return;



        for (const lead of emptyLeads) {
            await Lead.delete(lead.id);
        }

        console.log(`Removidos ${emptyLeads.length} leads WhatsApp sem mensagens`);

    } catch (error) {

        console.warn('Falha ao limpar leads WhatsApp sem mensagens:', error.message);

    }

}





async function cleanupDuplicatePhoneSuffixLeads() {

    try {

        const leads = await query("SELECT id, phone, jid, name, source, custom_fields, last_message_at, owner_user_id FROM leads WHERE phone IS NOT NULL");

        if (!leads || leads.length === 0) return;



        const groups = new Map();

        for (const lead of leads) {

            const digits = String(lead.phone || '').replace(/\D/g, '');

            if (digits.length < 11) continue;

            const ownerUserId = Number(lead?.owner_user_id || 0);
            const ownerScopeKey = Number.isInteger(ownerUserId) && ownerUserId > 0
                ? `owner:${ownerUserId}`
                : `legacy:${lead.id}`;
            const key = `${ownerScopeKey}:${digits.slice(-11)}`;

            if (!groups.has(key)) groups.set(key, []);

            groups.get(key).push(lead);

        }



        for (const group of groups.values()) {

            if (group.length < 2) continue;



            group.sort((a, b) => {
                const aScore = getLeadMergeScore(a);
                const bScore = getLeadMergeScore(b);

                if (aScore != bScore) return bScore - aScore;



                const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;

                const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;

                return bTime - aTime;

            });



            const primary = await Lead.findById(group[0].id);

            if (!primary) continue;

            for (const dup of group.slice(1)) {

                const duplicate = await Lead.findById(dup.id);

                if (duplicate && duplicate.id != primary.id) {

                    await mergeLeads(primary, duplicate);

                }

            }

        }

    } catch (error) {

        console.warn('Falha ao mesclar leads duplicados por telefone:', error.message);

    }

}



async function cleanupBrokenLeadNames() {
    try {
        const leads = await query("SELECT id, name, phone, source, custom_fields FROM leads WHERE name IS NOT NULL");
        if (!leads || leads.length === 0) return;

        for (const lead of leads) {
            const source = normalizeLeadSource(lead?.source);
            if (isLeadNameManuallyLocked(lead)) {
                const manualSnapshot = resolveManualNameSnapshotFromLead(lead);
                if (manualSnapshot && manualSnapshot !== String(lead.name || '').trim()) {
                    await run(
                        "UPDATE leads SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                        [manualSnapshot, lead.id]
                    );
                }
                continue;
            }
            if (source && source !== 'whatsapp') continue;

            const fixed = normalizeText(lead.name || '');
            const nameDigits = String(lead.name || '').replace(/\D/g, '');
            const phoneDigits = String(lead.phone || '').replace(/\D/g, '');
            let nextName = lead.name;

            if (fixed && fixed !== lead.name) {
                nextName = fixed;
            }

            if (phoneDigits && String(lead.name || '').match(/^\d+$/) && nameDigits !== phoneDigits) {
                nextName = phoneDigits;
            }

            if (nextName && nextName !== lead.name) {
                await run("UPDATE leads SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [nextName, lead.id]);
            }
        }
    } catch (error) {
        console.warn('Falha ao corrigir nomes de leads:', error.message);
    }
}

async function cleanupMissingLeadNames() {
    try {
        const leads = await query(`
            SELECT id, name, phone, custom_fields
            FROM leads
            WHERE name IS NULL
               OR TRIM(name) = ''
               OR LOWER(TRIM(name)) IN ('sem nome', 'unknown', 'undefined', 'null')
        `);
        if (!leads || leads.length === 0) return;

        let repaired = 0;
        for (const lead of leads) {
            const snapshotName = resolveManualNameSnapshotFromLead(lead);
            const safeCurrentName = sanitizeAutoName(lead?.name);
            const safePhone = String(lead?.phone || '').replace(/\D/g, '');
            const nextName = snapshotName || safeCurrentName || safePhone;
            if (!nextName) continue;

            if (String(lead?.name || '').trim() === nextName) continue;

            await run(
                'UPDATE leads SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [nextName, lead.id]
            );
            repaired += 1;
        }

        if (repaired > 0) {
            console.log(`Recuperados ${repaired} leads com nome ausente`);
        }
    } catch (error) {
        console.warn('Falha ao recuperar nomes ausentes de leads:', error.message);
    }
}
async function persistWhatsappSession(sessionId, status, options = {}) {
    if (isServerShuttingDown) return;

    try {
        const normalizedSessionId = sanitizeSessionId(sessionId);
        if (!normalizedSessionId) return;

        const normalizedStatus = String(status || '').trim().toLowerCase();
        if (!['disconnected', 'connecting', 'connected', 'qr_pending'].includes(normalizedStatus)) {
            return;
        }

        const runtimeSession = sessions.get(normalizedSessionId);
        if (runtimeSession?.isConnected && normalizedStatus !== 'connected') {
            console.log(
                `[${normalizedSessionId}] Ignorando persistencia de status "${normalizedStatus}" porque o runtime esta conectado`
            );
            return;
        }

        const eventTimestampRaw = options.eventTimestamp || options.eventAt || options.occurredAt;
        const parsedEventTimestamp = Date.parse(String(eventTimestampRaw || ''));
        const eventTimestamp = Number.isFinite(parsedEventTimestamp)
            ? new Date(parsedEventTimestamp).toISOString()
            : new Date().toISOString();

        const hasExplicitQr = Object.prototype.hasOwnProperty.call(options, 'qr_code');
        const qr_code = hasExplicitQr ? (options.qr_code || null) : null;

        const hasExplicitLastConnectedAt = Object.prototype.hasOwnProperty.call(options, 'last_connected_at');
        const resolvedLastConnectedAt = hasExplicitLastConnectedAt
            ? (options.last_connected_at || null)
            : null;
        const last_connected_at = normalizedStatus === 'connected'
            ? (resolvedLastConnectedAt || eventTimestamp)
            : resolvedLastConnectedAt;
        const requestedOwnerUserId = Number(options.ownerUserId);
        const ownerUserId = Number.isInteger(requestedOwnerUserId) && requestedOwnerUserId > 0
            ? requestedOwnerUserId
            : null;
        if (ownerUserId && normalizedStatus === 'connecting') {
            const existingStoredSession = await queryOne(
                'SELECT session_id FROM whatsapp_sessions WHERE session_id = ? LIMIT 1',
                [normalizedSessionId]
            );
            if (!existingStoredSession?.session_id) {
                await planLimitsService.assertOwnerCanCreateWhatsAppSession(ownerUserId, 1);
            }
        }

        await run(`

            INSERT INTO whatsapp_sessions (session_id, status, qr_code, last_connected_at, created_by, updated_at)

            VALUES (?, ?, ?, ?, ?, ?)

            ON CONFLICT(session_id) DO UPDATE SET

                status = CASE
                    WHEN EXCLUDED.updated_at >= COALESCE(whatsapp_sessions.updated_at, to_timestamp(0))
                        THEN EXCLUDED.status
                    ELSE whatsapp_sessions.status
                END,

                qr_code = CASE
                    WHEN EXCLUDED.updated_at >= COALESCE(whatsapp_sessions.updated_at, to_timestamp(0))
                        THEN EXCLUDED.qr_code
                    ELSE whatsapp_sessions.qr_code
                END,

                last_connected_at = CASE
                    WHEN EXCLUDED.updated_at >= COALESCE(whatsapp_sessions.updated_at, to_timestamp(0))
                        THEN COALESCE(EXCLUDED.last_connected_at, whatsapp_sessions.last_connected_at)
                    ELSE whatsapp_sessions.last_connected_at
                END,

                created_by = COALESCE(whatsapp_sessions.created_by, excluded.created_by),

                updated_at = GREATEST(COALESCE(whatsapp_sessions.updated_at, to_timestamp(0)), EXCLUDED.updated_at)

        `, [normalizedSessionId, normalizedStatus, qr_code, last_connected_at, ownerUserId, eventTimestamp]);

    } catch (error) {

        console.error(`[${sessionId}] Erro ao persistir sessÃ£o:`, error.message);

    }

}



async function rehydrateSessions(ioInstance) {

    try {

        const stored = await query(`SELECT session_id, created_by FROM whatsapp_sessions`);

        for (const row of stored) {

            const sessionId = row.session_id;
            const ownerUserId = Number(row?.created_by || 0);
            const hasLocalSession = sessionExists(sessionId);
            const hasDbAuthState = !hasLocalSession && WHATSAPP_AUTH_STATE_DRIVER !== 'multi_file'
                ? await hasPersistedBaileysAuthState(sessionId)
                : false;

            if (hasLocalSession || hasDbAuthState) {

                console.log(`[${sessionId}] Reidratando sessÃ£o armazenada...`);

                await createSession(sessionId, null, 0, {
                    ownerUserId: Number.isInteger(ownerUserId) && ownerUserId > 0 ? ownerUserId : undefined
                });

            } else {

                console.log(`[${sessionId}] SessÃ£o no banco sem auth state local/DB, ignorando.`);

            }

        }

    } catch (error) {

        console.error('? Erro ao reidratar sessÃµes:', error.message);

    }

}



/**

 * Criptografar mensagem

 */

function encryptMessage(text) {

    if (!text) return null;

    return encrypt(text);

}



/**

 * Descriptografar mensagem

 */

function decryptMessage(encrypted) {

    if (!encrypted) return null;

    return decrypt(encrypted);

}



const formatJid = whatsappService.formatJid;

const extractNumber = whatsappService.extractNumber;



/**

 * FunÃ§Ã£o de envio de mensagem (usada pelos serviÃ§os)

 */

async function sendMessageToWhatsApp(options) {

    const { to, jid, content, mediaType, mediaUrl, sessionId } = options;

    const sid = resolveSessionIdOrDefault(sessionId);

    const session = whatsappService.getSession(sid);

    

    const dispatchState = getSessionDispatchState(sid);
    if (!session || !dispatchState.available) {
        if (session && !session.isConnected && !session.reconnecting) {
            scheduleRuntimeSessionReconnect(sid, session);
        }
        throw buildSessionUnavailableError(dispatchState, 'WhatsApp nao esta conectado');
    }
    enforceSessionSendRateLimit(sid, session);

    

    const targetJid = jid || formatJid(to);

    let result;

    

    try {
        if (mediaType === 'image' && mediaUrl) {

            result = await session.socket.sendMessage(targetJid, {

                image: { url: mediaUrl },

                caption: content || ''

            });

        } else if (mediaType === 'video' && mediaUrl) {

            result = await session.socket.sendMessage(targetJid, {

                video: { url: mediaUrl },

                caption: content || ''

            });

        } else if (mediaType === 'document' && mediaUrl) {

            result = await session.socket.sendMessage(targetJid, {

                document: { url: mediaUrl },

                mimetype: options.mimetype || 'application/pdf',

                fileName: options.fileName || 'documento'

            });

        } else if (mediaType === 'audio' && mediaUrl) {

            try {

                const audioOptions = await audioFixer.prepareAudioForSend(mediaUrl, {

                    mimetype: options.mimetype || 'audio/ogg; codecs=opus',

                    ptt: options.ptt !== undefined ? options.ptt : true,

                    duration: options.duration || null

                });

                result = await session.socket.sendMessage(targetJid, {

                    audio: { url: audioOptions.path || mediaUrl },

                    ...audioOptions.options

                });

            } catch (error) {

                console.error('[SendMessage] Erro ao preparar Ã¡udio, usando mÃ©todo padrÃ£o:', error.message);

                result = await session.socket.sendMessage(targetJid, {

                    audio: { url: mediaUrl },

                    mimetype: options.mimetype || 'audio/ogg; codecs=opus',

                    ptt: options.ptt !== undefined ? options.ptt : true

                });

            }

        } else {

            result = await session.socket.sendMessage(targetJid, { text: content });

        }
    } catch (sendError) {
        if (isDisconnectedSessionRuntimeError(sendError)) {
            session.isConnected = false;
            session.reconnecting = true;
            const blockedUntilMs = setRuntimeSessionDispatchBackoff(session);
            scheduleRuntimeSessionReconnect(sid, session);
            const connectionError = buildSessionUnavailableError({
                status: 'disconnected',
                retryAfterMs: blockedUntilMs > Date.now() ? Math.max(1000, blockedUntilMs - Date.now()) : null,
                reason: 'WhatsApp nao esta conectado'
            });
            throw connectionError;
        }
        throw sendError;
    }

    

    return result;

}



/**

 * Criar sessÃ£o WhatsApp

 */

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizePairingPhoneNumber(value) {
    const digitsOnly = String(value || '').replace(/\D/g, '');
    if (!digitsOnly) return null;

    let normalized = digitsOnly;

    // Compatibilidade para uso local (DDD + numero) sem DDI.
    if ((normalized.length === 10 || normalized.length === 11) && !normalized.startsWith('55')) {
        normalized = `55${normalized}`;
    }

    if (normalized.length < 12 || normalized.length > 15) {
        return null;
    }

    return normalized;
}

async function requestSessionPairingCode(sessionId, clientSocket, phoneNumber, options = {}) {
    const socketRef = clientSocket || { emit: () => {} };
    const normalizedPhone = normalizePairingPhoneNumber(phoneNumber);
    if (!normalizedPhone) {
        socketRef.emit('error', {
            message: 'Numero invalido para pareamento. Use DDI + DDD + numero.',
            code: 'PAIRING_PHONE_INVALID'
        });
        return null;
    }

    const maxAttempts = Number.isFinite(options.maxAttempts) ? options.maxAttempts : 45;
    const waitMs = Number.isFinite(options.waitMs) ? options.waitMs : 350;
    const reuseWindowMs = Number.isFinite(options.reuseWindowMs) ? options.reuseWindowMs : 120000;
    let lastError = null;

    const isTransientPairingError = (error) => {
        const message = String(error?.message || '').toLowerCase();
        if (!message) return false;

        return (
            message.includes('connection closed') ||
            message.includes('not connected') ||
            message.includes('timed out') ||
            message.includes('connection lost') ||
            message.includes('stream errored') ||
            message.includes('socket closed')
        );
    };

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const session = sessions.get(sessionId);
        if (!session) {
            await sleep(waitMs);
            continue;
        }

        session.clientSocket = clientSocket || session.clientSocket;

        if (session.isConnected) {
            socketRef.emit('error', {
                message: 'WhatsApp ja esta conectado. Desconecte antes de gerar um codigo.',
                code: 'PAIRING_ALREADY_CONNECTED'
            });
            return null;
        }

        const pairingAgeMs = Number(session.pairingRequestedAt || 0) ? Date.now() - Number(session.pairingRequestedAt) : Infinity;
        if (
            session.pairingMode &&
            session.pairingCode &&
            session.pairingPhone === normalizedPhone &&
            pairingAgeMs <= reuseWindowMs
        ) {
            const cachedCode = String(session.pairingCode).trim();
            if (cachedCode) {
                socketRef.emit('pairing-code', {
                    sessionId,
                    phoneNumber: normalizedPhone,
                    code: cachedCode,
                    reused: true
                });
                return cachedCode;
            }
        }

        if (session.reconnecting || !session.socket) {
            await sleep(waitMs);
            continue;
        }

        const sock = session.socket;
        if (sock && typeof sock.requestPairingCode !== 'function') {
            socketRef.emit('error', {
                message: 'Biblioteca atual nao suporta codigo de pareamento.',
                code: 'PAIRING_UNSUPPORTED'
            });
            return null;
        }
        if (sock && typeof sock.requestPairingCode === 'function') {
            try {
                const pairingCode = String(await sock.requestPairingCode(normalizedPhone) || '').trim();
                if (!pairingCode) {
                    throw new Error('codigo vazio retornado pelo WhatsApp');
                }

                session.pairingMode = true;
                session.pairingCode = pairingCode;
                session.pairingPhone = normalizedPhone;
                session.pairingRequestedAt = Date.now();

                socketRef.emit('pairing-code', {
                    sessionId,
                    phoneNumber: normalizedPhone,
                    code: pairingCode
                });
                await emitToSessionOwnerScope(sessionId, 'whatsapp-pairing-code', {
                    sessionId,
                    phoneNumber: normalizedPhone
                }, {
                    ownerUserId: Number(session?.ownerUserId || 0) || null
                });

                console.log(`[${sessionId}] Codigo de pareamento gerado para ${normalizedPhone}`);
                return pairingCode;
            } catch (error) {
                lastError = error;
                if (isTransientPairingError(error)) {
                    await sleep(waitMs);
                    continue;
                }
                break;
            }
        }

        await sleep(waitMs);
    }

    const message = lastError
        ? `Nao foi possivel gerar codigo de pareamento: ${lastError.message}`
        : 'Sessao ainda inicializando. Tente novamente em alguns segundos.';
    socketRef.emit('error', { message, code: 'PAIRING_CODE_ERROR' });
    return null;
}

async function createSession(sessionId, socket, attempt = 0, options = {}) {
    if (isServerShuttingDown) return null;

    const clientSocket = socket || { emit: () => {} };
    const pairingPhone = normalizePairingPhoneNumber(options.pairingPhone || options.phoneNumber);
    const shouldRequestPairingCode = Boolean(options.requestPairingCode && pairingPhone);
    const requestedOwnerUserId = Number(options.ownerUserId);
    const ownerUserId = Number.isInteger(requestedOwnerUserId) && requestedOwnerUserId > 0
        ? requestedOwnerUserId
        : null;

    if (sessionInitLocks.has(sessionId)) {
        const lockStartedAt = Number(sessionInitLockTimestamps.get(sessionId) || 0);
        const lockAgeMs = lockStartedAt > 0 ? (Date.now() - lockStartedAt) : 0;
        if (lockAgeMs > 120000) {
            console.warn(`[${sessionId}] Detectado lock de inicializacao stale (${lockAgeMs}ms). Limpando lock...`);
            sessionInitLocks.delete(sessionId);
            sessionInitLockTimestamps.delete(sessionId);
        }
    }

    if (sessionInitLocks.has(sessionId)) {
        const existingSession = sessions.get(sessionId);
        if (existingSession && socket) {
            existingSession.clientSocket = socket;
            if (!existingSession.ownerUserId && ownerUserId) {
                existingSession.ownerUserId = ownerUserId;
            }
        }

        clientSocket.emit('session-status', {
            status: existingSession?.isConnected ? 'connected' : 'reconnecting',
            sessionId,
            user: existingSession?.user || null
        });
        if (shouldRequestPairingCode) {
            await requestSessionPairingCode(sessionId, clientSocket, pairingPhone);
        }
        return existingSession?.socket || null;
    }

    sessionInitLocks.add(sessionId);
    sessionInitLockTimestamps.set(sessionId, Date.now());
    let lockReleased = false;
    const releaseSessionLock = () => {
        if (!lockReleased) {
            sessionInitLocks.delete(sessionId);
            sessionInitLockTimestamps.delete(sessionId);
            lockReleased = true;
        }
    };

    const sessionPath = path.join(SESSIONS_DIR, sessionId);

    const previousSession = sessions.get(sessionId);
    clearRuntimeSessionReconnectTimer(previousSession);
    clearSessionReconnectCatchupTimer(sessionId);
    if (previousSession?.socket) {
        stopSessionHealthMonitor(previousSession);
        try {
            if (typeof previousSession.socket.ev?.removeAllListeners === 'function') {
                previousSession.socket.ev.removeAllListeners();
            }
        } catch (error) {
            // ignore stale listener cleanup failures
        }
        try {
            if (typeof previousSession.socket.end === 'function') {
                await previousSession.socket.end(new Error('session_replaced'));
            }
        } catch (error) {
            // ignore stale socket shutdown failures
        }
    }

    if (qrTimeouts.has(sessionId)) {

        clearTimeout(qrTimeouts.get(sessionId));

        qrTimeouts.delete(sessionId);

    }

    try {
        clearSessionStartupError(sessionId);

        const baileys = await baileysLoader.getBaileys();
        const {
            default: makeWASocket,
            DisconnectReason,
            fetchLatestBaileysVersion,
            makeCacheableSignalKeyStore,
            delay
        } = baileys;

        console.log(`[${sessionId}] Criando sessÃ£o... (Tentativa ${attempt + 1}/${MAX_RECONNECT_ATTEMPTS})`);

        await persistWhatsappSession(sessionId, 'connecting', {
            eventTimestamp: new Date().toISOString(),
            ownerUserId
        });

        

        // Validar e corrigir sessÃƒÂ£o local somente quando o auth state principal for por arquivos.
        if (WHATSAPP_AUTH_STATE_DRIVER === 'multi_file') {

            const sessionValidation = await connectionFixer.validateSession(sessionPath);

            if (!sessionValidation.valid && attempt === 0) {

                console.log(`[${sessionId}] Problemas na sessÃ£o detectados, corrigindo...`);

                await connectionFixer.fixSession(sessionPath);

            }
        }

        

        const { state, saveCreds, driver: authStateDriver } = await createBaileysAuthState({
            sessionId,
            sessionPath,
            baileys,
            preferredDriver: WHATSAPP_AUTH_STATE_DRIVER,
            fallbackToMultiFile: WHATSAPP_AUTH_STATE_DB_FALLBACK_MULTI_FILE,
            logPrefix: `[${sessionId}]`
        });
        console.log(`[${sessionId}] Auth state driver: ${authStateDriver}`);

        const socketVersion = await resolveBaileysSocketVersion(fetchLatestBaileysVersion, sessionId);

        if (socketVersion) {
            console.log(`[${sessionId}] Usando Baileys versao (${cachedBaileysSocketVersionSource || 'custom'}): ${socketVersion.join('.')}`);
        } else {
            console.log(`[${sessionId}] Usando versao interna do pacote Baileys (sem latest no boot)`);
        }

        const syncFullHistory = WHATSAPP_SYNC_FULL_HISTORY;
        const browserName = await resolveWhatsAppBrowserName({
            sessionId,
            ownerUserId
        });

        const store = createRuntimeStore();



        const sock = makeWASocket({

            ...(Array.isArray(socketVersion) ? { version: socketVersion } : {}),

            logger,

// printQRInTerminal: true, // Depreciado no Baileys

            auth: {

                creds: state.creds,

                keys: makeCacheableSignalKeyStore(state.keys, logger)

            },

            browser: [browserName, 'Chrome', WHATSAPP_BROWSER_VERSION],

            generateHighQualityLinkPreview: true,

            syncFullHistory,

            connectTimeoutMs: WHATSAPP_CONNECT_TIMEOUT_MS,

            keepAliveIntervalMs: WHATSAPP_KEEPALIVE_INTERVAL_MS,

            defaultQueryTimeoutMs: WHATSAPP_DEFAULT_QUERY_TIMEOUT_MS,

            retryRequestDelayMs: WHATSAPP_RETRY_REQUEST_DELAY_MS,

            markOnlineOnConnect: true,

            getMessage: async (key) => {

                const msg = await Message.findByMessageId(key.id);

                if (msg) {

                    const content = msg.content_encrypted 

                        ? decryptMessage(msg.content_encrypted) 

                        : msg.content;

                    return { conversation: content };

                }

                return { conversation: '' };

            }

        });



        bindRuntimeStoreToSocket(sessionId, store, sock);

        

        sessions.set(sessionId, {

            socket: sock,

            store,

            clientSocket,

            isConnected: false,

            user: null,

            reconnecting: false,

            qrGenerated: false,

            pairingMode: false,

            pairingCode: null,

            pairingPhone: null,

            pairingRequestedAt: null,
            ownerUserId,
            sendReadyAtMs: 0,
            dispatchBlockedUntilMs: 0,
            dispatchBlockReason: null,
            lastDisconnectReason: null,
            lastDisconnectAt: null,
            reconnectScheduleTimer: null

        });

        

        reconnectAttempts.set(sessionId, 0);

        

        // Eventos de conexÃ£o

        sock.ev.on('connection.update', async (update) => {

            const { connection, lastDisconnect, qr } = update;

            const session = sessions.get(sessionId);
            if (!session || session.socket !== sock) {
                return;
            }
            const eventTimestamp = new Date().toISOString();
            const activeClientSocket = session.clientSocket || clientSocket;

            

            if (qr) {

                try {

                    const qrDataUrl = await qrcode.toDataURL(qr, {

                        width: 300,

                        margin: 2,

                        color: { dark: '#000000', light: '#ffffff' }

                    });

                    

                    if (session) session.qrGenerated = true;

                    

                    activeClientSocket.emit('qr', { qr: qrDataUrl, sessionId, expiresIn: 30 });

                    await emitToSessionOwnerScope(sessionId, 'whatsapp-qr', { qr: qrDataUrl, sessionId }, {
                        ownerUserId: Number(session?.ownerUserId || ownerUserId || 0) || null
                    });

                    

                    // Webhook

                    webhookService.trigger('whatsapp.qr_generated', { sessionId }, {
                        ownerUserId: Number(session?.ownerUserId || ownerUserId || 0) || undefined
                    });

                    await persistWhatsappSession(sessionId, 'qr_pending', {
                        eventTimestamp,
                        qr_code: qrDataUrl,
                        ownerUserId: Number(session?.ownerUserId || ownerUserId || 0) || null
                    });
                    clearSessionStartupError(sessionId);

                    

                    console.log(`[${sessionId}] ? QR Code gerado`);

                    

                    const timeout = setTimeout(() => {

                        const currentSession = sessions.get(sessionId);

                        if (currentSession && !currentSession.isConnected) {

                            activeClientSocket.emit('qr-expired', { sessionId });

                        }

                    }, QR_TIMEOUT);

                    

                    qrTimeouts.set(sessionId, timeout);

                    

                } catch (qrError) {

                    console.error(`[${sessionId}] ? Erro ao gerar QR:`, qrError.message);

                    activeClientSocket.emit('error', { message: 'Erro ao gerar QR Code' });

                }

            }

            

            if (connection === 'close') {
                clearSessionReconnectCatchupTimer(sessionId);

                if (qrTimeouts.has(sessionId)) {

                    clearTimeout(qrTimeouts.get(sessionId));

                    qrTimeouts.delete(sessionId);

                }

                

                const statusCode = lastDisconnect?.error?.output?.statusCode;
                if (Number(statusCode) === 405) {
                    if (!forceLatestBaileysVersionByRuntime) {
                        console.warn(`[${sessionId}] Detectado status 405 na conexao WhatsApp. Ativando fallback para versao latest do Baileys.`);
                    }
                    forceLatestBaileysVersionByRuntime = true;
                    cachedBaileysSocketVersion = null;
                    cachedBaileysSocketVersionSource = null;
                }

                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                session.isConnected = false;
                session.sendReadyAtMs = 0;
                clearRuntimeSessionReconnectTimer(session);
                stopSessionHealthMonitor(session);

                if (isServerShuttingDown) {
                    session.reconnecting = false;
                    return;
                }

                

                console.log(`[${sessionId}] ConexÃ£o fechada. Status: ${statusCode}`);

                await persistWhatsappSession(sessionId, 'disconnected', {
                    eventTimestamp,
                    ownerUserId: Number(session?.ownerUserId || ownerUserId || 0) || null
                });

                

                // Detectar tipo de erro e aplicar correÃ§Ã£o

                const errorInfo = connectionFixer.detectDisconnectReason(lastDisconnect?.error);
                session.lastDisconnectAt = Date.now();
                session.lastDisconnectReason = {
                    statusCode: Number.isFinite(Number(statusCode)) ? Number(statusCode) : null,
                    errorType: errorInfo.type || 'unknown',
                    message: String(lastDisconnect?.error?.message || '').slice(0, 300) || null,
                    at: new Date().toISOString()
                };
                setSessionStartupError(sessionId, {
                    message: session.lastDisconnectReason?.message || `Conexao fechada (status ${Number(statusCode) || 'n/a'})`,
                    statusCode: session.lastDisconnectReason?.statusCode,
                    errorType: session.lastDisconnectReason?.errorType || 'connection_close',
                    at: session.lastDisconnectReason?.at
                });
                setRuntimeSessionDispatchBackoff(session);

                console.log(`[${sessionId}] Tipo de erro: ${errorInfo.type}, AÃ§Ã£o: ${errorInfo.action}`);

                

                // Aplicar correÃ§Ã£o se necessÃ¡rio

                if (errorInfo.action === 'clean_session' || errorInfo.action === 'regenerate_keys') {

                    await connectionFixer.applyFixAction(sessionPath, errorInfo.action);

                }

                

                // Webhook

                webhookService.trigger('whatsapp.disconnected', { sessionId, statusCode, errorType: errorInfo.type }, {
                    ownerUserId: Number(session?.ownerUserId || ownerUserId || 0) || undefined
                });

                

                if (reconnectInFlight.has(sessionId)) {
                    console.log(`[${sessionId}] Reconexao ja em andamento, ignorando evento de fechamento duplicado.`);
                    return;
                }

                reconnectInFlight.add(sessionId);
                try {
                    if (shouldReconnect) {

                        const currentAttempt = reconnectAttempts.get(sessionId) || 0;

                        if (currentAttempt < MAX_RECONNECT_ATTEMPTS) {

                            reconnectAttempts.set(sessionId, currentAttempt + 1);

                            session.reconnecting = true;
                            if (!session.pairingMode) {
                                session.pairingCode = null;
                                session.pairingPhone = null;
                                session.pairingRequestedAt = null;
                            }

                            activeClientSocket.emit('reconnecting', { sessionId, attempt: currentAttempt + 1 });
                            await emitToSessionOwnerScope(sessionId, 'whatsapp-status', { sessionId, status: 'reconnecting' }, {
                                ownerUserId: Number(session?.ownerUserId || ownerUserId || 0) || null
                            });

                            await delay(RECONNECT_DELAY);
                            if (isServerShuttingDown) return;

                            const reconnectOptions = session?.pairingMode
                                ? { ...options, requestPairingCode: false }
                                : options;
                            await createSession(sessionId, activeClientSocket, currentAttempt + 1, reconnectOptions);

                        } else {

                            sessions.delete(sessionId);
                            reconnectAttempts.delete(sessionId);
                            activeClientSocket.emit('reconnect-failed', { sessionId });

                        }

                    } else {

                        sessions.delete(sessionId);
                        reconnectAttempts.delete(sessionId);
                        activeClientSocket.emit('disconnected', { sessionId, reason: 'logged_out' });
                        await persistWhatsappSession(sessionId, 'disconnected', {
                            eventTimestamp,
                            ownerUserId: Number(session?.ownerUserId || ownerUserId || 0) || null
                        });

                        if (fs.existsSync(sessionPath)) {
                            fs.rmSync(sessionPath, { recursive: true, force: true });
                        }
                        await clearPersistedBaileysAuthState(sessionId);
                    }
                } finally {
                    reconnectInFlight.delete(sessionId);
                }

            }

            

            if (connection === 'connecting') {
                if (session) {
                    session.reconnecting = true;
                }

                activeClientSocket.emit('connecting', { sessionId });

                await emitToSessionOwnerScope(sessionId, 'whatsapp-status', { sessionId, status: 'connecting' }, {
                    ownerUserId: Number(session?.ownerUserId || ownerUserId || 0) || null
                });

            }

            

            if (connection === 'open') {

                if (qrTimeouts.has(sessionId)) {

                    clearTimeout(qrTimeouts.get(sessionId));

                    qrTimeouts.delete(sessionId);

                }

                

                if (session) {

                    session.isConnected = true;

                    session.reconnecting = false;
                    session.lastDisconnectReason = null;

                    session.pairingMode = false;

                    session.pairingCode = null;

                    session.pairingPhone = null;

                    session.pairingRequestedAt = null;

                    session.user = {

                        id: sock.user?.id,

                        name: sock.user?.name || 'UsuÃ¡rio',

                        pushName: sock.user?.verifiedName || sock.user?.name,

                        phone: extractNumber(sock.user?.id)

                    };

                    

                    reconnectAttempts.set(sessionId, 0);
                    clearRuntimeSessionDispatchBackoff(session);
                    session.sendReadyAtMs = Date.now() + WHATSAPP_SESSION_SEND_WARMUP_MS;
                    if (WHATSAPP_SESSION_SEND_WARMUP_MS > 0) {
                        setRuntimeSessionDispatchBackoff(session, WHATSAPP_SESSION_SEND_WARMUP_MS, 'warming_up');
                    }

                    

                    activeClientSocket.emit('connected', { sessionId, user: session.user });

                    await emitToSessionOwnerScope(sessionId, 'whatsapp-status', { sessionId, status: 'connected', user: session.user }, {
                        ownerUserId: Number(session?.ownerUserId || ownerUserId || 0) || null
                    });

                    await persistWhatsappSession(sessionId, 'connected', {
                        eventTimestamp,
                        last_connected_at: eventTimestamp,
                        ownerUserId: Number(session?.ownerUserId || ownerUserId || 0) || null
                    });
                    clearSessionStartupError(sessionId);

                    

                    // Webhook

                    webhookService.trigger('whatsapp.connected', { sessionId, user: session.user }, {
                        ownerUserId: Number(session?.ownerUserId || ownerUserId || 0) || undefined
                    });

                    

                    console.log(`[${sessionId}] ? WhatsApp conectado: ${session.user.name}`);
                    if (WHATSAPP_SESSION_SEND_WARMUP_MS > 0) {
                        console.log(`[${sessionId}] Aguardando ${WHATSAPP_SESSION_SEND_WARMUP_MS}ms de aquecimento antes de liberar disparos`);
                    }



                    // ForÃ§ar sincronizaÃ§Ã£o inicial de chats

                    setTimeout(() => {

                        triggerChatSync(sessionId, sock, store);

                    }, 1500);
                    scheduleSessionReconnectCatchup(sessionId, {
                        trigger: attempt > 0 ? 'reconnect-open' : 'initial-open',
                        expectedSocket: sock
                    });

                    

                    // Criar monitor de saÃºde da conexÃ£o

                    stopSessionHealthMonitor(session);
                    const healthMonitor = connectionFixer.createHealthMonitor(sock, sessionId);
                    session.healthMonitor = healthMonitor;

                }

            }

        });

        

        sock.ev.on('creds.update', saveCreds);

        

        // Receber mensagens

        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (!isActiveSessionSocket(sessionId, sock)) {
                return;
            }

            if (type === 'notify' || type === 'append') {

                for (const msg of messages) {

                    if (isGroupMessage(msg)) continue;
                    const hasMessagePayload = Boolean(msg?.message);
                    const hasCiphertextStub = Number(msg?.messageStubType || 0) === BAILEYS_CIPHERTEXT_STUB_TYPE;
                    if (hasCiphertextStub) {
                        scheduleCiphertextRecovery(sessionId, msg);
                        continue;
                    }

                    try {
                        await processIncomingMessage(sessionId, msg);
                    } catch (error) {
                        console.error(`[${sessionId}] Erro ao processar messages.upsert (${msg?.key?.id || 'sem-id'}):`, error.message);
                        if (!hasMessagePayload) {
                            scheduleCiphertextRecovery(sessionId, msg);
                        }
                    }

                }

            }

        });

        

        // Status de mensagens

        sock.ev.on('messages.update', async (updates) => {
            if (!isActiveSessionSocket(sessionId, sock)) {
                return;
            }

            for (const update of updates) {
                const patchedMessage = update?.update?.message;
                const hasPatchedPayload = patchedMessage && typeof patchedMessage === 'object';
                const isPatchedInbound = hasPatchedPayload && !Boolean(update?.key?.fromMe);
                if (isPatchedInbound && update?.key?.id) {
                    const syntheticMsg = {
                        key: update.key,
                        message: patchedMessage,
                        messageTimestamp: update?.update?.messageTimestamp || Math.floor(Date.now() / 1000),
                        pushName: ''
                    };

                    try {
                        await processIncomingMessage(sessionId, syntheticMsg);
                    } catch (error) {
                        console.error(`[${sessionId}] Erro ao processar patch de messages.update (${update?.key?.id || 'sem-id'}):`, error.message);
                    }
                }

                const updateCiphertextStub = Number(update?.update?.messageStubType || 0) === BAILEYS_CIPHERTEXT_STUB_TYPE;
                if (updateCiphertextStub && !Boolean(update?.key?.fromMe)) {
                    scheduleCiphertextRecovery(sessionId, {
                        key: update?.key || {},
                        messageStubType: BAILEYS_CIPHERTEXT_STUB_TYPE
                    });
                }

                if (update.update.status) {

                    const statusMap = { 1: 'pending', 2: 'sent', 3: 'delivered', 4: 'read' };

                    const status = statusMap[update.update.status] || 'pending';

                    

                    // Atualizar no banco

                    await Message.updateStatus(update.key.id, status, new Date().toISOString());

                    const trackedMessage = await Message.findByMessageId(update.key.id);
                    if (trackedMessage?.campaign_id) {
                        await Campaign.refreshMetrics(trackedMessage.campaign_id);
                    }

                    

                    await emitToSessionOwnerScope(sessionId, 'message-status', {

                        sessionId,

                        messageId: update.key.id,

                        remoteJid: update.key.remoteJid,

                        status

                    }, {
                        ownerUserId: Number(sessions.get(sessionId)?.ownerUserId || 0) || null
                    });

                    

                    // Webhook

                    if (status === 'delivered') {

                        webhookService.trigger('message.delivered', { messageId: update.key.id, status }, {
                            ownerUserId: Number(sessions.get(sessionId)?.ownerUserId || 0) || undefined
                        });

                    } else if (status === 'read') {

                        webhookService.trigger('message.read', { messageId: update.key.id, status }, {
                            ownerUserId: Number(sessions.get(sessionId)?.ownerUserId || 0) || undefined
                        });

                    }

                }

            }

        });

        sock.ev.on('messaging-history.set', (payload) => {
            if (!isActiveSessionSocket(sessionId, sock)) {
                return;
            }

            enqueueSessionHistorySync(sessionId, async () => {
                const runtimeSession = sessions.get(sessionId);
                if (!runtimeSession || runtimeSession.socket !== sock) {
                    return;
                }

                await processMessagingHistorySet(sessionId, sock, payload || {});
            });
        });



        sock.ev.on('contacts.set', async (payload) => {
            if (!isActiveSessionSocket(sessionId, sock)) {
                return;
            }

            const contacts = payload?.contacts || [];
            const sessionPhone = getSessionPhone(sessionId);

            for (const contact of contacts) {

                await registerContactAlias(contact, sessionId, sessionPhone);

            }

        });



        sock.ev.on('contacts.upsert', async (contacts) => {
            if (!isActiveSessionSocket(sessionId, sock)) {
                return;
            }

            const list = Array.isArray(contacts) ? contacts : [contacts];
            const sessionPhone = getSessionPhone(sessionId);

            for (const contact of list) {

                await registerContactAlias(contact, sessionId, sessionPhone);

            }

        });

        sock.ev.on('chats.phoneNumberShare', async (payload) => {
            if (!isActiveSessionSocket(sessionId, sock)) {
                return;
            }
            try {
                const mappedUserJid = registerJidAlias(
                    payload?.lid,
                    payload?.jid,
                    normalizePhoneDigits(getSessionPhone(sessionId))
                );
                if (!mappedUserJid) return;

                const normalizedLid = normalizeLidJid(payload?.lid);
                if (!normalizedLid) return;

                const resolvedPhone = extractNumber(mappedUserJid);
                const sessionOwnerUserId = await resolveSessionOwnerUserId(sessionId);
                const primary = await Lead.findByJid(mappedUserJid, { owner_user_id: sessionOwnerUserId || undefined })
                    || await Lead.findByPhone(resolvedPhone, { owner_user_id: sessionOwnerUserId || undefined });
                const duplicate = await Lead.findByJid(normalizedLid, { owner_user_id: sessionOwnerUserId || undefined });

                if (primary && duplicate && primary.id !== duplicate.id) {
                    await mergeLeads(primary, duplicate);
                } else if (!primary && duplicate) {
                    await updateLeadIdentity(duplicate, mappedUserJid, resolvedPhone);
                } else if (primary && primary.jid !== mappedUserJid) {
                    await updateLeadIdentity(primary, mappedUserJid, resolvedPhone);
                }
            } catch (error) {
                console.warn(`[${sessionId}] Falha ao processar chats.phoneNumberShare:`, error.message);
            }
        });



        // Sincronizar lista de chats/contatos

        sock.ev.on('chats.set', async (payload) => {
            if (!isActiveSessionSocket(sessionId, sock)) {
                return;
            }

            try {

                await syncChatsToDatabase(sessionId, payload);

            } catch (error) {

                console.error(`[${sessionId}] ? Erro ao sincronizar chats:`, error.message);

            }

        });



        sock.ev.on('chats.upsert', async (payload) => {
            if (!isActiveSessionSocket(sessionId, sock)) {
                return;
            }

            try {

                await syncChatsToDatabase(sessionId, payload);

            } catch (error) {

                console.error(`[${sessionId}] ? Erro ao sincronizar chats:`, error.message);

            }

        });



        sock.ev.on('chats.update', async (payload) => {
            if (!isActiveSessionSocket(sessionId, sock)) {
                return;
            }

            try {

                await syncChatsToDatabase(sessionId, payload);

            } catch (error) {

                console.error(`[${sessionId}] ? Erro ao sincronizar chats:`, error.message);

            }

        });

        

        // PresenÃ§a (digitando)

        sock.ev.on('presence.update', (presence) => {
            if (!isActiveSessionSocket(sessionId, sock)) {
                return;
            }

            const jid = presence.id;

            const isTyping = presence.presences?.[jid]?.lastKnownPresence === 'composing';

            

            typingStatus.set(jid, isTyping);

            

            emitToOwnerScope(Number(sessions.get(sessionId)?.ownerUserId || 0) || null, 'typing-status', {

                sessionId,

                jid,

                isTyping,

                name: presence.presences?.[jid]?.name

            });

        });

        

        sock.ev.on('error', (error) => {
            if (!isActiveSessionSocket(sessionId, sock)) {
                return;
            }

            console.error(`[${sessionId}] ? Erro:`, error.message);

            const activeSession = sessions.get(sessionId);
            const activeClientSocket = activeSession?.clientSocket || clientSocket;
            activeClientSocket.emit('error', { message: error.message });

        });

        if (shouldRequestPairingCode) {
            await requestSessionPairingCode(sessionId, clientSocket, pairingPhone);
        }

        

        return sock;

        

    } catch (error) {

        console.error(`[${sessionId}] ? Erro ao criar sessÃ£o:`, error.message);

        const startupErrorMessage = String(error?.message || 'Erro ao criar sessao WhatsApp').slice(0, 300);

        const currentAttempt = reconnectAttempts.get(sessionId) || 0;
        setSessionStartupError(sessionId, {
            message: startupErrorMessage,
            errorType: 'startup_exception',
            attempt: currentAttempt + 1
        });

        if (currentAttempt < MAX_RECONNECT_ATTEMPTS) {

            reconnectAttempts.set(sessionId, currentAttempt + 1);

            await new Promise((resolve) => setTimeout(resolve, RECONNECT_DELAY));
            releaseSessionLock();
            return await createSession(sessionId, clientSocket, currentAttempt + 1, options);

        } else {

            clientSocket?.emit('error', {
                message: `Erro ao criar sessao WhatsApp: ${startupErrorMessage}`,
                code: 'CREATE_SESSION_ERROR'
            });

            return null;

        }

    } finally {
        releaseSessionLock();
    }

}



function normalizeAutomationText(value = '') {

    return String(value)

        .toLowerCase()

        .normalize('NFD')

        .replace(/[\u0300-\u036f]/g, '')

        .trim();

}



function extractAutomationKeywords(value = '') {

    return String(value)

        .split(/[,\n;]+/)

        .map((keyword) => normalizeAutomationText(keyword))

        .filter(Boolean);

}



function escapeAutomationRegex(value = '') {

    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

}



function matchesAutomationKeyword(normalizedText = '', keyword = '') {

    const text = String(normalizedText || '').trim();
    const normalizedKeyword = normalizeAutomationText(keyword);
    if (!text || !normalizedKeyword) return false;

    const keywordPattern = escapeAutomationRegex(normalizedKeyword).replace(/\s+/g, '\\s+');
    const regex = new RegExp(`(?:^|[^a-z0-9])${keywordPattern}(?:$|[^a-z0-9])`, 'i');
    return regex.test(text);

}



function buildAutomationVariables(lead, messageText = '') {

    return {

        nome: lead?.name || 'Cliente',

        telefone: lead?.phone || '',

        veiculo: lead?.vehicle || '',

        placa: lead?.plate || '',

        mensagem: messageText || ''

    };

}



function normalizeTemplateVariableKey(value = '') {

    return String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9_]+/g, '_')
        .replace(/^_+|_+$/g, '');

}

function buildLeadTemplateVariables(lead, extra = {}) {

    const customFields = parseLeadCustomFields(lead?.custom_fields);
    const variables = {
        nome: lead?.name || 'Cliente',
        name: lead?.name || 'Cliente',
        telefone: lead?.phone || '',
        phone: lead?.phone || '',
        email: lead?.email || '',
        veiculo: lead?.vehicle || '',
        vehicle: lead?.vehicle || '',
        placa: lead?.plate || '',
        plate: lead?.plate || ''
    };

    for (const [rawKey, rawValue] of Object.entries(customFields || {})) {
        if (rawKey === '__system') continue;

        const normalizedKey = normalizeTemplateVariableKey(rawKey);
        const value = rawValue === null || rawValue === undefined ? '' : String(rawValue);

        if (normalizedKey) {
            variables[normalizedKey] = value;
        }

        const directKey = String(rawKey || '').trim();
        if (directKey) {
            variables[directKey] = value;
        }
    }

    for (const [rawKey, rawValue] of Object.entries(extra || {})) {
        const normalizedKey = normalizeTemplateVariableKey(rawKey);
        const value = rawValue === null || rawValue === undefined ? '' : String(rawValue);

        if (normalizedKey) {
            variables[normalizedKey] = value;
        }

        const directKey = String(rawKey || '').trim();
        if (directKey) {
            variables[directKey] = value;
        }
    }

    return variables;

}

function applyLeadTemplate(template = '', lead, extraVariables = {}) {

    const variables = buildLeadTemplateVariables(lead, extraVariables);

    return String(template).replace(/\{\{\s*([\w-]+)\s*\}\}/gi, (match, key) => {

        const normalizedKey = normalizeTemplateVariableKey(key);

        if (normalizedKey && Object.prototype.hasOwnProperty.call(variables, normalizedKey)) {

            return variables[normalizedKey] ?? '';

        }

        if (Object.prototype.hasOwnProperty.call(variables, key)) {

            return variables[key] ?? '';

        }

        return '';

    });

}

function applyAutomationTemplate(template = '', variables = {}) {

    return String(template).replace(/\{\{\s*([\w-]+)\s*\}\}/gi, (match, key) => {

        const normalizedKey = String(key).toLowerCase();

        if (Object.prototype.hasOwnProperty.call(variables, normalizedKey)) {

            return variables[normalizedKey] ?? '';

        }

        if (Object.prototype.hasOwnProperty.call(variables, key)) {

            return variables[key] ?? '';

        }

        return '';

    });

}



const SUPPORTED_AUTOMATION_TRIGGER_TYPES = new Set([
    'new_lead',
    'status_change',
    'message_received',
    'keyword',
    'schedule',
    'inactivity'
]);
const AUTOMATION_EVENT_TYPES = {
    MESSAGE_RECEIVED: 'message_received',
    STATUS_CHANGE: 'status_change',
    SCHEDULE: 'schedule',
    INACTIVITY: 'inactivity'
};
const DEFAULT_AUTOMATION_SESSION_ID = DEFAULT_WHATSAPP_SESSION_ID;
const AUTOMATION_SCHEDULE_POLL_MS = 30000;
const LEGACY_CAMPAIGN_TRIGGER_MODE = 'legacy_campaign_trigger';

const inactivityAutomationTimers = new Map();
const scheduleAutomationSlots = new Map();
let scheduleAutomationIntervalId = null;
let scheduleAutomationsTickRunning = false;
let tenantIntegrityAuditIntervalId = null;
let tenantIntegrityAuditTickRunning = false;
let tenantIntegrityAuditLastRunAt = null;
let tenantIntegrityAuditLastError = null;
let tenantIntegrityAuditLastResultCompact = null;
let tenantIntegrityAuditLastFingerprint = null;
let tenantIntegrityAuditLastRunRecordId = null;
let tenantIntegrityAuditLastPersistError = null;

function isSupportedAutomationTriggerType(triggerType = '') {
    const normalized = String(triggerType || '').trim().toLowerCase();
    return SUPPORTED_AUTOMATION_TRIGGER_TYPES.has(normalized);
}

function normalizeAutomationStatus(value) {
    return normalizeLeadStatus(value, null);
}

function parseAutomationJsonValue(rawValue = '', fallback = {}) {
    if (!rawValue) return fallback;
    if (typeof rawValue === 'object') return rawValue;
    const raw = String(rawValue || '').trim();
    if (!raw) return fallback;
    try {
        return JSON.parse(raw);
    } catch {
        return fallback;
    }
}

function parseStatusChangeTriggerValue(triggerValue = '') {
    const parsed = parseAutomationJsonValue(triggerValue, {});
    return {
        from: normalizeAutomationStatus(parsed?.from),
        to: normalizeAutomationStatus(parsed?.to)
    };
}

function parseScheduleTriggerValue(triggerValue = '') {
    const parsed = parseAutomationJsonValue(triggerValue, null);
    if (!parsed || typeof parsed !== 'object') return null;

    const match = String(parsed.time || '').trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;

    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

    const days = Array.from(new Set(
        (Array.isArray(parsed.days) ? parsed.days : [])
            .map((value) => Number(value))
            .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
    ));

    return {
        time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
        days
    };
}

function parseInactivitySeconds(triggerValue = '') {
    const seconds = Number(triggerValue);
    if (!Number.isFinite(seconds) || seconds <= 0) return null;
    return Math.floor(seconds);
}

function parseAutomationTimestampMs(value) {
    if (!value) return null;
    const parsed = Date.parse(String(value));
    return Number.isFinite(parsed) ? parsed : null;
}

function parseMessageReceivedTriggerConfig(triggerValue = '') {
    const parsed = parseAutomationJsonValue(triggerValue, null);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

    const hasConfigFields = (
        Object.prototype.hasOwnProperty.call(parsed, 'mode') ||
        Object.prototype.hasOwnProperty.call(parsed, 'segment') ||
        Object.prototype.hasOwnProperty.call(parsed, 'tag_filter') ||
        Object.prototype.hasOwnProperty.call(parsed, 'tag_filters') ||
        Object.prototype.hasOwnProperty.call(parsed, 'start_at') ||
        Object.prototype.hasOwnProperty.call(parsed, 'once_per_lead') ||
        Object.prototype.hasOwnProperty.call(parsed, 'delay_min_ms') ||
        Object.prototype.hasOwnProperty.call(parsed, 'delay_max_ms') ||
        Object.prototype.hasOwnProperty.call(parsed, 'source_campaign_id')
    );
    if (!hasConfigFields) return null;

    const mode = String(parsed.mode || '').trim().toLowerCase();
    const segment = String(parsed.segment || 'all').trim() || 'all';
    const tagFilters = parseCampaignTagFilters(
        Object.prototype.hasOwnProperty.call(parsed, 'tag_filters')
            ? parsed.tag_filters
            : parsed.tag_filter
    );
    const startAtMs = parseAutomationTimestampMs(parsed.start_at);
    const oncePerLead = parsed.once_per_lead === true || String(parsed.once_per_lead || '').trim().toLowerCase() === 'true';
    const sourceCampaignIdRaw = Number(parsed.source_campaign_id);
    const sourceCampaignId = Number.isFinite(sourceCampaignIdRaw) && sourceCampaignIdRaw > 0
        ? Math.trunc(sourceCampaignIdRaw)
        : null;

    let delayMinMs = Number(parsed.delay_min_ms);
    let delayMaxMs = Number(parsed.delay_max_ms);
    delayMinMs = Number.isFinite(delayMinMs) && delayMinMs >= 0 ? Math.floor(delayMinMs) : null;
    delayMaxMs = Number.isFinite(delayMaxMs) && delayMaxMs >= 0 ? Math.floor(delayMaxMs) : null;
    if (delayMinMs === null && delayMaxMs !== null) delayMinMs = delayMaxMs;
    if (delayMaxMs === null && delayMinMs !== null) delayMaxMs = delayMinMs;
    if (delayMinMs !== null && delayMaxMs !== null && delayMaxMs < delayMinMs) {
        const swap = delayMinMs;
        delayMinMs = delayMaxMs;
        delayMaxMs = swap;
    }

    return {
        mode,
        segment,
        tagFilter: tagFilters[0] || null,
        tagFilters,
        startAtMs,
        oncePerLead,
        delayMinMs,
        delayMaxMs,
        sourceCampaignId
    };
}

function leadMatchesSegmentStatus(lead, segment = 'all') {
    const normalizedSegment = String(segment || 'all').trim().toLowerCase();
    const leadStatus = Number(lead?.status || 0);

    if (!normalizedSegment || normalizedSegment === 'all') return true;

    const segmentStatus = resolveCampaignSegmentStatus(normalizedSegment);
    if (segmentStatus === null) return true;
    return leadStatus === segmentStatus;
}

function matchesMessageReceivedTriggerConfig(config, context) {
    if (!config) return true;

    if (config.startAtMs !== null && Date.now() < config.startAtMs) {
        return false;
    }

    const lead = context?.lead;
    if (!lead?.id) return false;
    if (!leadMatchesSegmentStatus(lead, config.segment)) return false;
    if (!leadMatchesCampaignTag(lead, config.tagFilters || config.tagFilter || '')) return false;

    return true;
}

function resolveAutomationDelayMs(automation, context) {
    const delaySeconds = Number(automation?.delay || 0);
    let minDelayMs = Number.isFinite(delaySeconds) && delaySeconds > 0 ? delaySeconds * 1000 : 0;
    let maxDelayMs = minDelayMs;

    const triggerType = String(automation?.trigger_type || '').trim().toLowerCase();
    if (triggerType === 'message_received') {
        const config = parseMessageReceivedTriggerConfig(automation?.trigger_value || '');
        if (config?.delayMinMs !== null && config?.delayMaxMs !== null) {
            minDelayMs = config.delayMinMs;
            maxDelayMs = config.delayMaxMs;
        }
    }

    const safeMin = Math.max(0, Math.floor(minDelayMs || 0));
    const safeMax = Math.max(safeMin, Math.floor(maxDelayMs || 0));
    return randomIntBetween(safeMin, safeMax);
}

function shouldTrackAutomationOncePerLead(automation) {
    const triggerType = String(automation?.trigger_type || '').trim().toLowerCase();
    if (triggerType !== 'message_received') return false;
    const config = parseMessageReceivedTriggerConfig(automation?.trigger_value || '');
    return !!config?.oncePerLead;
}

async function reserveAutomationLeadRun(automationId, leadId) {
    const result = await run(`
        INSERT INTO automation_lead_runs (automation_id, lead_id)
        VALUES (?, ?)
        ON CONFLICT (automation_id, lead_id) DO NOTHING
    `, [automationId, leadId]);
    return Number(result?.changes || 0) > 0;
}

async function releaseAutomationLeadRun(automationId, leadId) {
    await run(`
        DELETE FROM automation_lead_runs
        WHERE automation_id = ?
          AND lead_id = ?
    `, [automationId, leadId]);
}

function formatAutomationSlot(date = new Date()) {
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function matchesScheduleSlot(date, scheduleConfig) {
    if (!scheduleConfig?.time) return false;

    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    if (`${hour}:${minute}` !== scheduleConfig.time) return false;

    if (Array.isArray(scheduleConfig.days) && scheduleConfig.days.length > 0) {
        return scheduleConfig.days.includes(date.getDay());
    }

    return true;
}

function buildInactivityAutomationKey(automationId, leadId) {
    return `${automationId}:${leadId}`;
}

async function fetchLastInboundLeadMessageTimestampMs(leadId) {
    const rows = await query(`
        SELECT COALESCE(sent_at, created_at) AS timestamp
        FROM messages
        WHERE lead_id = ?
          AND is_from_me = 0
        ORDER BY COALESCE(sent_at, created_at) DESC, id DESC
        LIMIT 1
    `, [leadId]);

    const rawTimestamp = rows?.[0]?.timestamp;
    if (!rawTimestamp) return null;

    const parsed = Date.parse(String(rawTimestamp));
    return Number.isFinite(parsed) ? parsed : null;
}

function normalizeAutomationContext(context = {}) {
    const event = String(context.event || AUTOMATION_EVENT_TYPES.MESSAGE_RECEIVED).trim().toLowerCase();
    const sessionId = String(context.sessionId || DEFAULT_AUTOMATION_SESSION_ID).trim() || DEFAULT_AUTOMATION_SESSION_ID;

    return {
        ...context,
        event,
        sessionId
    };
}

async function resolveAutomationOwnerScopeUserId(context = {}) {
    const normalizedContext = normalizeAutomationContext(context);

    const leadOwnerUserId = normalizeOwnerUserId(normalizedContext?.lead?.owner_user_id);
    if (leadOwnerUserId) {
        return leadOwnerUserId;
    }

    const assigneeOwnerUserId = await resolveOwnerScopeUserIdFromAssignees(
        normalizedContext?.conversation?.assigned_to,
        normalizedContext?.lead?.assigned_to
    );
    if (assigneeOwnerUserId) {
        return assigneeOwnerUserId;
    }

    const rawSessionId = String(context?.sessionId || context?.session_id || '').trim();
    if (rawSessionId) {
        const sessionOwnerUserId = await resolveSessionOwnerUserId(normalizedContext.sessionId);
        if (sessionOwnerUserId) return sessionOwnerUserId;
    }

    return null;
}

function parseAutomationSessionScope(value) {
    if (value === undefined || value === null || value === '') return [];

    let parsed = value;
    if (typeof parsed === 'string') {
        const trimmed = parsed.trim();
        if (!trimmed) return [];
        try {
            parsed = JSON.parse(trimmed);
        } catch (_) {
            parsed = trimmed.split(',').map((item) => String(item || '').trim()).filter(Boolean);
        }
    }

    if (!Array.isArray(parsed)) return [];

    const seen = new Set();
    const normalized = [];
    for (const item of parsed) {
        const sessionId = sanitizeSessionId(item);
        if (!sessionId || seen.has(sessionId)) continue;
        seen.add(sessionId);
        normalized.push(sessionId);
    }
    return normalized;
}

function normalizeAutomationTagLabel(value) {
    return normalizeUnifiedTagLabel(value);
}

function normalizeAutomationTagKey(value) {
    return normalizeUnifiedTagKey(value);
}

function parseAutomationTagFilters(value) {
    return uniqueUnifiedTagLabels(parseUnifiedTagList(value));
}

function normalizeAutomationTagFilterInput(value) {
    return normalizeUnifiedTagFilterInput(value);
}

function normalizeAutomationSessionScopeInput(value) {
    if (value === undefined) return undefined;
    const sessionIds = parseAutomationSessionScope(value);
    if (!sessionIds.length) return null;
    return JSON.stringify(sessionIds);
}

function enrichAutomationForResponse(automation) {
    if (!automation) return automation;
    return {
        ...automation,
        session_ids: parseAutomationSessionScope(automation.session_scope),
        tag_filters: parseAutomationTagFilters(automation.tag_filter)
    };
}

function shouldAutomationRunForSession(automation, sessionId) {
    const scopedSessionIds = parseAutomationSessionScope(automation?.session_scope);
    if (!scopedSessionIds.length) return true;

    const normalizedSessionId = sanitizeSessionId(sessionId);
    if (!normalizedSessionId) return false;
    return scopedSessionIds.includes(normalizedSessionId);
}

function shouldAutomationRunForLeadTags(automation, lead) {
    if (!lead) return false;
    return leadMatchesUnifiedTagFilter(lead?.tags, automation?.tag_filter);
}

async function resolveAutomationConversation(lead, baseConversation = null, sessionId = DEFAULT_AUTOMATION_SESSION_ID) {
    const normalizedSessionId = sanitizeSessionId(sessionId);
    if (
        baseConversation
        && Number(baseConversation.lead_id) === Number(lead?.id)
        && (!normalizedSessionId || sanitizeSessionId(baseConversation.session_id) === normalizedSessionId)
    ) {
        return baseConversation;
    }

    const existingConversation = await Conversation.findByLeadId(lead.id, normalizedSessionId || null);
    if (existingConversation) return existingConversation;

    const result = await Conversation.findOrCreate({
        lead_id: lead.id,
        session_id: sessionId
    });

    return result?.conversation || null;
}

async function resolveAutomationDispatchSession(automation, context = {}) {
    const normalizedContext = normalizeAutomationContext(context);
    const leadId = Number(normalizedContext?.lead?.id || 0);
    const ownerScopeUserId = await resolveAutomationOwnerScopeUserId(normalizedContext);
    const scopedSessionIds = parseAutomationSessionScope(automation?.session_scope);
    const scopedSessionIdSet = scopedSessionIds.length ? new Set(scopedSessionIds) : null;
    const candidateSessionIds = [];

    const pushCandidateSessionId = (value) => {
        const normalizedSessionId = sanitizeSessionId(value);
        if (!normalizedSessionId) return;
        if (scopedSessionIdSet && !scopedSessionIdSet.has(normalizedSessionId)) return;
        if (candidateSessionIds.includes(normalizedSessionId)) return;
        candidateSessionIds.push(normalizedSessionId);
    };

    pushCandidateSessionId(normalizedContext.sessionId);
    pushCandidateSessionId(normalizedContext?.conversation?.session_id);

    if (leadId > 0) {
        const latestConversation = await Conversation.findByLeadId(leadId, null);
        pushCandidateSessionId(latestConversation?.session_id);
    }

    for (const scopedSessionId of scopedSessionIds) {
        pushCandidateSessionId(scopedSessionId);
    }

    if (ownerScopeUserId) {
        const ownerSessions = await WhatsAppSession.list({
            owner_user_id: ownerScopeUserId,
            includeDisabled: true
        });
        for (const ownerSession of ownerSessions || []) {
            pushCandidateSessionId(ownerSession?.session_id);
        }
    }

    if (!candidateSessionIds.length) {
        pushCandidateSessionId(resolveFirstConnectedSessionId(normalizedContext.sessionId));
        pushCandidateSessionId(resolveDefaultSessionId(normalizedContext.sessionId));
    }

    const ownerValidationCache = new Map();
    let firstCandidateSessionId = '';

    for (const candidateSessionId of candidateSessionIds) {
        if (ownerScopeUserId) {
            let sessionOwnerScopeUserId = ownerValidationCache.get(candidateSessionId);
            if (sessionOwnerScopeUserId === undefined) {
                sessionOwnerScopeUserId = await resolveSessionOwnerUserId(candidateSessionId);
                ownerValidationCache.set(candidateSessionId, sessionOwnerScopeUserId ?? null);
            }
            if (sessionOwnerScopeUserId && Number(sessionOwnerScopeUserId) !== Number(ownerScopeUserId)) {
                continue;
            }
        }

        if (!firstCandidateSessionId) {
            firstCandidateSessionId = candidateSessionId;
        }

        const dispatchState = getSessionDispatchState(candidateSessionId);
        if (dispatchState.available) {
            return {
                sessionId: candidateSessionId,
                dispatchState
            };
        }
    }

    if (firstCandidateSessionId) {
        return {
            sessionId: firstCandidateSessionId,
            dispatchState: getSessionDispatchState(firstCandidateSessionId)
        };
    }

    return {
        sessionId: '',
        dispatchState: getSessionDispatchState('')
    };
}

function runAutomationWithDelay(automation, context) {
    const normalizedContext = normalizeAutomationContext(context);
    if (!shouldAutomationRunForLeadTags(automation, normalizedContext.lead)) return;

    const delayMs = resolveAutomationDelayMs(automation, normalizedContext);

    const execute = () => {
        executeAutomationAction(automation, normalizedContext).catch((error) => {
            console.error(`Erro ao executar automacao ${automation.id}:`, error.message);
        });
    };

    if (delayMs > 0) {
        setTimeout(execute, delayMs);
        return;
    }

    execute();
}

function shouldTriggerAutomation(automation, context, normalizedText) {
    const triggerType = String(automation?.trigger_type || '').trim().toLowerCase();
    if (!isSupportedAutomationTriggerType(triggerType)) return false;

    const normalizedContext = normalizeAutomationContext(context);
    if (!shouldAutomationRunForSession(automation, normalizedContext.sessionId)) return false;
    if (!shouldAutomationRunForLeadTags(automation, normalizedContext.lead)) return false;
    const eventType = normalizedContext.event;

    if (triggerType === 'keyword') {
        if (eventType !== AUTOMATION_EVENT_TYPES.MESSAGE_RECEIVED) return false;
        if (!normalizedText) return false;

        const keywords = extractAutomationKeywords(automation.trigger_value || '');
        if (keywords.length === 0) return false;
        return keywords.some((keyword) => matchesAutomationKeyword(normalizedText, keyword));
    }

    if (triggerType === 'message_received') {
        if (eventType !== AUTOMATION_EVENT_TYPES.MESSAGE_RECEIVED) return false;

        const triggerConfig = parseMessageReceivedTriggerConfig(automation.trigger_value || '');
        if (!triggerConfig) return true;

        return matchesMessageReceivedTriggerConfig(triggerConfig, normalizedContext);
    }

    if (triggerType === 'new_lead') {
        return eventType === AUTOMATION_EVENT_TYPES.MESSAGE_RECEIVED && !!normalizedContext.leadCreated;
    }

    if (triggerType === 'status_change') {
        if (eventType !== AUTOMATION_EVENT_TYPES.STATUS_CHANGE) return false;

        const oldStatus = normalizeAutomationStatus(normalizedContext.oldStatus);
        const newStatus = normalizeAutomationStatus(normalizedContext.newStatus);
        if (oldStatus === null || newStatus === null || oldStatus === newStatus) return false;

        const filters = parseStatusChangeTriggerValue(automation.trigger_value || '');
        if (filters.from !== null && filters.from !== oldStatus) return false;
        if (filters.to !== null && filters.to !== newStatus) return false;
        return true;
    }

    if (triggerType === 'schedule') {
        return eventType === AUTOMATION_EVENT_TYPES.SCHEDULE;
    }

    if (triggerType === 'inactivity') {
        return eventType === AUTOMATION_EVENT_TYPES.INACTIVITY;
    }

    return false;
}

async function armInactivityAutomation(automation, context) {
    const inactivitySeconds = parseInactivitySeconds(automation?.trigger_value);
    const leadId = Number(context?.lead?.id);

    if (!Number.isFinite(leadId) || leadId <= 0 || !inactivitySeconds) {
        return;
    }

    const key = buildInactivityAutomationKey(automation.id, leadId);
    const currentTimer = inactivityAutomationTimers.get(key);
    if (currentTimer) {
        clearTimeout(currentTimer.timeoutId);
    }

    const referenceTimestampMs = Number(context?.messageTimestampMs);
    const safeReferenceTimestampMs = Number.isFinite(referenceTimestampMs) && referenceTimestampMs > 0
        ? referenceTimestampMs
        : Date.now();
    const conversationId = Number(context?.conversation?.id) || null;
    const sessionId = String(context?.sessionId || DEFAULT_AUTOMATION_SESSION_ID);

    const timeoutId = setTimeout(async () => {
        inactivityAutomationTimers.delete(key);

        try {
            const activeAutomation = await Automation.findById(automation.id);
            const isActive = Number(activeAutomation?.is_active || 0) === 1;
            const isStillInactivity = String(activeAutomation?.trigger_type || '').trim().toLowerCase() === 'inactivity';
            if (!activeAutomation || !isActive || !isStillInactivity) return;

            const latestInboundTimestampMs = await fetchLastInboundLeadMessageTimestampMs(leadId);
            if (latestInboundTimestampMs === null) return;
            if (latestInboundTimestampMs > safeReferenceTimestampMs) return;

            const lead = await Lead.findById(leadId);
            if (!lead || Number(lead.is_blocked || 0) === 1) return;

            let conversation = null;
            if (conversationId) {
                conversation = await Conversation.findById(conversationId);
            }
            if (!conversation) {
                conversation = await Conversation.findByLeadId(leadId, sessionId || null);
            }

            const executionContext = normalizeAutomationContext({
                event: AUTOMATION_EVENT_TYPES.INACTIVITY,
                lead,
                conversation,
                sessionId: sessionId || conversation?.session_id || DEFAULT_AUTOMATION_SESSION_ID,
                text: ''
            });

            if (!shouldAutomationRunForSession(activeAutomation, executionContext.sessionId)) return;
            runAutomationWithDelay(activeAutomation, executionContext);
        } catch (error) {
            console.error(`Erro ao disparar automacao de inatividade ${automation.id}:`, error.message);
        }
    }, inactivitySeconds * 1000);

    inactivityAutomationTimers.set(key, {
        timeoutId,
        referenceTimestampMs: safeReferenceTimestampMs
    });
}

async function processScheduledAutomationsTick() {
    if (SCHEDULED_AUTOMATIONS_WORKER_ENABLED && !scheduledAutomationLeaderLock.isHeld()) {
        return;
    }
    if (scheduleAutomationsTickRunning) return;
    scheduleAutomationsTickRunning = true;

    try {
        const automations = await Automation.list({ is_active: 1, trigger_type: 'schedule', limit: 500 });
        if (!automations || automations.length === 0) return;

        const now = new Date();
        const slot = formatAutomationSlot(now);
        const dueAutomations = [];

        for (const automation of automations) {
            const scheduleConfig = parseScheduleTriggerValue(automation.trigger_value || '');
            if (!scheduleConfig) continue;
            if (!matchesScheduleSlot(now, scheduleConfig)) continue;

            if (scheduleAutomationSlots.get(automation.id) === slot) {
                continue;
            }

            scheduleAutomationSlots.set(automation.id, slot);
            dueAutomations.push(automation);
        }

        if (dueAutomations.length === 0) return;

        const leads = await query(`
            SELECT
                l.*,
                COALESCE(owner_scope.owner_user_id, owner_scope.id) AS owner_scope_user_id
            FROM leads
            LEFT JOIN users owner_scope ON owner_scope.id = l.assigned_to
            WHERE COALESCE(l.is_blocked, 0) = 0
            ORDER BY l.updated_at DESC
        `);
        const leadConversations = await query(`
            SELECT c.*
            FROM conversations c
            INNER JOIN leads l ON l.id = c.lead_id
            WHERE COALESCE(l.is_blocked, 0) = 0
            ORDER BY c.lead_id ASC, COALESCE(c.updated_at, c.created_at) DESC, c.id DESC
        `);
        const conversationsByLeadId = new Map();
        for (const conversation of leadConversations) {
            const leadId = Number(conversation?.lead_id || 0);
            if (!Number.isFinite(leadId) || leadId <= 0) continue;
            if (!conversationsByLeadId.has(leadId)) {
                conversationsByLeadId.set(leadId, []);
            }
            conversationsByLeadId.get(leadId).push(conversation);
        }

        for (const automation of dueAutomations) {
            const automationOwnerScopeUserId = await resolveOwnerScopeUserIdFromAssignees(automation?.created_by);
            if (!automationOwnerScopeUserId) {
                continue;
            }
            const scopedSessionIds = parseAutomationSessionScope(automation?.session_scope);
            const scopedSessionIdSet = scopedSessionIds.length ? new Set(scopedSessionIds) : null;

            for (const lead of leads) {
                if (!lead?.id || !lead?.phone) continue;
                const leadOwnerScopeUserId = normalizeOwnerUserId(lead?.owner_scope_user_id);
                if (!leadOwnerScopeUserId || leadOwnerScopeUserId !== automationOwnerScopeUserId) {
                    continue;
                }
                const candidateConversations = conversationsByLeadId.get(Number(lead.id)) || [];
                const leadConversation = scopedSessionIdSet
                    ? (candidateConversations.find((conversation) => (
                        scopedSessionIdSet.has(sanitizeSessionId(conversation?.session_id))
                    )) || null)
                    : (candidateConversations[0] || null);
                if (scopedSessionIdSet && !leadConversation) continue;

                const sessionId = sanitizeSessionId(
                    leadConversation?.session_id,
                    DEFAULT_AUTOMATION_SESSION_ID
                );

                const executionContext = normalizeAutomationContext({
                    event: AUTOMATION_EVENT_TYPES.SCHEDULE,
                    lead,
                    conversation: leadConversation || null,
                    sessionId,
                    text: ''
                });

                if (!shouldAutomationRunForSession(automation, executionContext.sessionId)) continue;
                runAutomationWithDelay(automation, executionContext);
            }
        }
    } catch (error) {
        console.error('Erro ao processar automacoes agendadas:', error.message);
    } finally {
        scheduleAutomationsTickRunning = false;
    }
}

function startScheduledAutomationsWorker() {
    if (scheduleAutomationIntervalId) return;
    if (!SCHEDULED_AUTOMATIONS_WORKER_ENABLED) {
        console.log('[LeaderLock][scheduled-automations] worker desabilitado por configuracao');
        return;
    }

    scheduledAutomationLeaderLock.start().catch((error) => {
        console.error('[LeaderLock][scheduled-automations] falha ao iniciar lock:', error.message);
    });

    scheduleAutomationIntervalId = setInterval(() => {
        processScheduledAutomationsTick().catch((error) => {
            console.error('Falha no worker de automacoes agendadas:', error.message);
        });
    }, AUTOMATION_SCHEDULE_POLL_MS);

    processScheduledAutomationsTick().catch((error) => {
        console.error('Falha no primeiro ciclo de automacoes agendadas:', error.message);
    });
}

function buildTenantIntegrityAuditWorkerState() {
    return {
        enabled: TENANT_INTEGRITY_AUDIT_WORKER_ENABLED,
        intervalMs: TENANT_INTEGRITY_AUDIT_INTERVAL_MS,
        sampleLimit: TENANT_INTEGRITY_AUDIT_SAMPLE_LIMIT,
        leaderLockEnabled: POSTGRES_WORKER_LEADER_LOCK_ENABLED && TENANT_INTEGRITY_AUDIT_WORKER_ENABLED,
        leaderLockHeld: TENANT_INTEGRITY_AUDIT_WORKER_ENABLED ? tenantIntegrityAuditLeaderLock.isHeld() : false,
        running: tenantIntegrityAuditTickRunning,
        lastRunAt: tenantIntegrityAuditLastRunAt,
        lastError: tenantIntegrityAuditLastError,
        lastRunRecordId: tenantIntegrityAuditLastRunRecordId,
        lastPersistError: tenantIntegrityAuditLastPersistError,
        lastResult: tenantIntegrityAuditLastResultCompact
    };
}

function logTenantIntegrityAuditSummary(result, context = {}) {
    const compact = tenantIntegrityAuditService.compactResultForLog(result);
    if (!compact) return;

    const checksWithIssues = (compact.checks || []).filter((check) => Number(check.total || 0) > 0);
    const issueSummary = checksWithIssues
        .map((check) => `${check.code}=${check.total}`)
        .join(', ');

    const prefix = `[TenantIntegrityAudit][${String(context.trigger || 'manual')}]`;
    if (compact.summary?.checksWithIssues > 0) {
        console.warn(
            `${prefix} inconsistencias=${compact.summary.totalIssueRows} checks=${compact.summary.checksWithIssues}/${compact.summary.totalChecks}` +
            (issueSummary ? ` | ${issueSummary}` : '')
        );
    } else {
        console.log(`${prefix} sem inconsistencias (${compact.summary?.totalChecks || 0} checks)`);
    }
}

async function runTenantIntegrityAudit(options = {}) {
    const trigger = String(options.trigger || 'manual').trim() || 'manual';
    const ownerUserId = normalizeOwnerUserId(options.ownerUserId);
    const sampleLimit = parsePositiveIntEnv(options.sampleLimit, TENANT_INTEGRITY_AUDIT_SAMPLE_LIMIT);
    const shouldCacheAsWorkerResult = options.cacheAsWorker === true;
    const shouldPersistHistory = options.persistHistory !== false;

    const result = await tenantIntegrityAuditService.runAudit({
        ownerUserId: ownerUserId || undefined,
        sampleLimit
    });

    if (shouldPersistHistory) {
        try {
            const persistedRun = await tenantIntegrityAuditService.storeAuditRun(result, {
                triggerSource: trigger
            });
            if (persistedRun?.id) {
                tenantIntegrityAuditLastRunRecordId = Number(persistedRun.id);
                result.historyRunId = Number(persistedRun.id);
            }
            tenantIntegrityAuditLastPersistError = null;
        } catch (persistError) {
            tenantIntegrityAuditLastPersistError = String(persistError?.message || persistError || 'Falha ao persistir auditoria');
            console.warn(`[TenantIntegrityAudit][${trigger}] falha ao persistir historico:`, persistError.message);
            result.historyPersistError = tenantIntegrityAuditLastPersistError;
        }
    }

    if (shouldCacheAsWorkerResult) {
        tenantIntegrityAuditLastRunAt = new Date().toISOString();
        tenantIntegrityAuditLastError = null;
        tenantIntegrityAuditLastResultCompact = tenantIntegrityAuditService.compactResultForLog(result);

        const fingerprint = String(result?.fingerprint || '');
        const hasIssues = Number(result?.summary?.checksWithIssues || 0) > 0;
        const fingerprintChanged = fingerprint && fingerprint !== tenantIntegrityAuditLastFingerprint;
        const shouldLog = trigger !== 'interval' || hasIssues || fingerprintChanged || !tenantIntegrityAuditLastFingerprint;

        if (shouldLog) {
            logTenantIntegrityAuditSummary(result, { trigger });
        }

        tenantIntegrityAuditLastFingerprint = fingerprint || tenantIntegrityAuditLastFingerprint;
    }

    return result;
}

async function processTenantIntegrityAuditTick(trigger = 'interval') {
    if (TENANT_INTEGRITY_AUDIT_WORKER_ENABLED && !tenantIntegrityAuditLeaderLock.isHeld()) {
        return null;
    }
    if (tenantIntegrityAuditTickRunning) return null;
    tenantIntegrityAuditTickRunning = true;

    try {
        return await runTenantIntegrityAudit({
            trigger,
            cacheAsWorker: true,
            sampleLimit: TENANT_INTEGRITY_AUDIT_SAMPLE_LIMIT
        });
    } catch (error) {
        tenantIntegrityAuditLastRunAt = new Date().toISOString();
        tenantIntegrityAuditLastError = String(error?.message || error || 'Erro desconhecido');
        console.error(`[TenantIntegrityAudit][${trigger}] falha:`, error.message);
        throw error;
    } finally {
        tenantIntegrityAuditTickRunning = false;
    }
}

function startTenantIntegrityAuditWorker() {
    if (tenantIntegrityAuditIntervalId) return;
    if (!TENANT_INTEGRITY_AUDIT_WORKER_ENABLED) {
        console.log('[LeaderLock][tenant-integrity-audit] worker desabilitado por configuracao');
        return;
    }

    tenantIntegrityAuditLeaderLock.start().catch((error) => {
        console.error('[LeaderLock][tenant-integrity-audit] falha ao iniciar lock:', error.message);
    });

    tenantIntegrityAuditIntervalId = setInterval(() => {
        processTenantIntegrityAuditTick('interval').catch((error) => {
            console.error('[TenantIntegrityAudit] falha no ciclo periodico:', error.message);
        });
    }, TENANT_INTEGRITY_AUDIT_INTERVAL_MS);

    processTenantIntegrityAuditTick('startup').catch((error) => {
        console.error('[TenantIntegrityAudit] falha no primeiro ciclo:', error.message);
    });
}

async function executeAutomationAction(automation, context) {
    const normalizedContext = normalizeAutomationContext(context);
    const { lead, conversation, sessionId, text } = normalizedContext;

    if (!automation || !lead) return;
    if (!shouldAutomationRunForLeadTags(automation, lead)) return;

    const variables = buildAutomationVariables(lead, text);
    const actionType = automation.action_type;
    const actionValue = automation.action_value || '';

    switch (actionType) {
        case 'send_message': {
            const content = applyAutomationTemplate(actionValue, variables).trim();
            if (!content) return;
            const shouldTrackOnce = shouldTrackAutomationOncePerLead(automation);
            const automationId = Number(automation.id);
            const leadId = Number(lead.id);

            if (shouldTrackOnce && (!Number.isFinite(automationId) || automationId <= 0 || !Number.isFinite(leadId) || leadId <= 0)) {
                return;
            }

            let reservationCreated = false;
            if (shouldTrackOnce) {
                reservationCreated = await reserveAutomationLeadRun(automationId, leadId);
                if (!reservationCreated) return;
            }

            try {
                const dispatchTarget = await resolveAutomationDispatchSession(automation, normalizedContext);
                const dispatchSessionId = sanitizeSessionId(dispatchTarget?.sessionId);
                const dispatchState = dispatchTarget?.dispatchState || getSessionDispatchState(dispatchSessionId || '');
                if (!dispatchSessionId || !dispatchState.available) {
                    throw buildSessionUnavailableError(
                        dispatchState,
                        dispatchSessionId
                            ? `Sessao ${dispatchSessionId} indisponivel para envio de automacao`
                            : 'Nenhuma sessao disponivel para envio de automacao'
                    );
                }

                const sendOptions = {};
                const conversationId = Number(conversation?.id || 0);
                if (
                    conversationId > 0
                    && sanitizeSessionId(conversation?.session_id) === dispatchSessionId
                ) {
                    sendOptions.conversationId = conversationId;
                }

                await sendMessage(dispatchSessionId, lead.phone, content, 'text', sendOptions);
            } catch (error) {
                if (shouldTrackOnce && reservationCreated) {
                    await releaseAutomationLeadRun(automationId, leadId);
                }
                throw error;
            }
            break;
        }

        case 'change_status': {
            const nextStatus = normalizeAutomationStatus(actionValue);
            const oldStatus = normalizeAutomationStatus(lead.status);
            if (nextStatus === null || oldStatus === null || nextStatus === oldStatus) return;

            await Lead.update(lead.id, { status: nextStatus });
            const updatedLead = await Lead.findById(lead.id);
            if (!updatedLead) return;

            const statusConversation = await resolveAutomationConversation(updatedLead, conversation, sessionId);
            await scheduleAutomations({
                event: AUTOMATION_EVENT_TYPES.STATUS_CHANGE,
                sessionId: statusConversation?.session_id || sessionId,
                lead: updatedLead,
                conversation: statusConversation,
                oldStatus,
                newStatus: nextStatus,
                text: ''
            });
            break;
        }

        case 'add_tag': {
            const tag = String(actionValue || '').trim();
            if (!tag) return;

            let tags = [];
            try {
                tags = Array.isArray(lead.tags) ? lead.tags : JSON.parse(lead.tags || '[]');
            } catch {
                tags = [];
            }

            if (!tags.includes(tag)) {
                tags.push(tag);
                await Lead.update(lead.id, { tags });
            }
            break;
        }

        case 'start_flow': {
            const flowId = parseInt(actionValue, 10);
            if (!Number.isFinite(flowId)) return;

            const flow = await Flow.findById(flowId);
            if (!flow) return;

            const targetConversation = await resolveAutomationConversation(lead, conversation, sessionId);
            if (targetConversation && Number(targetConversation.is_bot_active || 0) === 1) {
                await flowService.startFlow(flow, lead, targetConversation, { text });
            }
            break;
        }

        case 'notify': {
            const message = applyAutomationTemplate(actionValue, variables).trim();
            webhookService.trigger('automation.notify', {
                automationId: automation.id,
                message,
                lead: { id: lead.id, name: lead.name, phone: lead.phone }
            }, {
                ownerUserId: Number(lead?.owner_user_id || 0) || undefined
            });
            break;
        }

        default:
            return;
    }

    await run(
        `UPDATE automations SET executions = executions + 1, last_execution = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [new Date().toISOString(), automation.id]
    );
}

async function scheduleAutomations(context) {
    const normalizedContext = normalizeAutomationContext(context);
    const ownerScopeUserId = await resolveAutomationOwnerScopeUserId(normalizedContext);
    if (!ownerScopeUserId) {
        if (normalizedContext.event === AUTOMATION_EVENT_TYPES.MESSAGE_RECEIVED) {
            console.warn(`[Automation] Ignorando automacoes sem owner resolvido para sessao ${normalizedContext.sessionId || 'n/a'}`);
        }
        return;
    }

    const automations = await Automation.list({
        is_active: 1,
        owner_user_id: ownerScopeUserId
    });
    if (!automations || automations.length === 0) return;

    const normalizedText = normalizeAutomationText(normalizedContext?.text || '');

    if (normalizedContext.event === AUTOMATION_EVENT_TYPES.MESSAGE_RECEIVED && normalizedContext?.lead?.id) {
        for (const automation of automations) {
            if (String(automation?.trigger_type || '').trim().toLowerCase() !== 'inactivity') continue;
            if (!shouldAutomationRunForSession(automation, normalizedContext.sessionId)) continue;
            armInactivityAutomation(automation, normalizedContext).catch((error) => {
                console.error(`Erro ao armar automacao de inatividade ${automation.id}:`, error.message);
            });
        }
    }

    for (const automation of automations) {
        if (!shouldTriggerAutomation(automation, normalizedContext, normalizedText)) continue;
        runAutomationWithDelay(automation, normalizedContext);
    }
}

function normalizeChatPayload(payload) {

    if (!payload) return [];

    if (Array.isArray(payload)) return payload;

    if (Array.isArray(payload.chats)) return payload.chats;

    return [];

}



function getChatDisplayName(chat, fallback) {

    return chat?.name || chat?.notify || chat?.subject || chat?.pushName || fallback;

}



function extractLastMessageFromChat(chat) {

    const msg = chat?.lastMessage?.message || chat?.lastMessage?.messageStubParameters || null;

    if (!msg) return null;

    if (typeof msg === 'string') return msg;

    return (

        msg.conversation ||

        msg.extendedTextMessage?.text ||

        msg.imageMessage?.caption ||

        msg.videoMessage?.caption ||

        msg.documentMessage?.caption ||

        null

    );

}



async function syncChatsToDatabase(sessionId, payload) {

    const chats = normalizeChatPayload(payload);

    if (chats.length === 0) return;



    const sessionDisplayName = getSessionDisplayName(sessionId);

    const sessionPhone = getSessionPhone(sessionId);
    const sessionOwnerUserId = await resolveSessionOwnerUserId(sessionId);



    for (const chat of chats) {

        const rawJid = chat?.id || chat?.jid || chat?.lid || chat?.lidJid;
        registerJidAlias(chat?.lidJid || chat?.lid, chat?.jid || chat?.id, normalizePhoneDigits(sessionPhone));

        const jid = normalizeUserJidCandidate(chat?.jid)
            || normalizeUserJidCandidate(rawJid)
            || normalizeJid(rawJid);

        if (!jid || !isUserJid(jid)) continue;

        const unreadCount = Number(chat?.unreadCount || 0);
        const hasUnread = Number.isFinite(unreadCount) && unreadCount > 0;
        if (!chat?.lastMessage && !hasUnread) continue;



        const phone = extractNumber(jid);

        if (!phone) continue;



        let displayName = getChatDisplayName(chat, phone);
        const phoneDigits = normalizePhoneDigits(phone);
        const sessionDigits = normalizePhoneDigits(sessionPhone);
        const isSelfChat = isSelfPhone(phoneDigits, sessionDigits);
        if (isSelfChat) {
            const safeSessionName = normalizeText(sessionDisplayName || '');
            displayName = safeSessionName ? `${safeSessionName} (VocÃª)` : 'VocÃª';
        }



        let lead = await Lead.findByJid(jid, { owner_user_id: sessionOwnerUserId || undefined })
            || await Lead.findByPhone(phone, { owner_user_id: sessionOwnerUserId || undefined });

        const rawPhoneDigits = normalizePhoneDigits(extractNumber(rawJid));
        const isRawSelfChat = isSelfPhone(rawPhoneDigits, sessionDigits);

        if (rawJid && rawJid !== jid && !isSelfChat && !isRawSelfChat) {

            const aliasLead = await Lead.findByJid(rawJid, { owner_user_id: sessionOwnerUserId || undefined })
                || await Lead.findByPhone(extractNumber(rawJid), { owner_user_id: sessionOwnerUserId || undefined });

            if (aliasLead && lead && aliasLead.id !== lead.id) {

                await mergeLeads(lead, aliasLead);

            } else if (aliasLead && !lead) {

                lead = await updateLeadIdentity(aliasLead, jid, phone);

            } else if (aliasLead && lead && aliasLead.id === lead.id) {

                lead = await updateLeadIdentity(lead, jid, phone);

            }

        }

        if (lead && lead.jid !== jid) {

            lead = await updateLeadIdentity(lead, jid, phone);

        }

        if (!lead) {
            try {
                const leadResult = await Lead.findOrCreate({

                    phone,

                    jid,

                    name: displayName,

                    source: 'whatsapp',
                    assigned_to: sessionOwnerUserId || undefined,
                    owner_user_id: sessionOwnerUserId || undefined

                });
                lead = leadResult.lead;
            } catch (error) {
                if (planLimitsService.isPlanLimitError(error)) {
                    console.warn(`[${sessionId}] ${error.message}`);
                    continue;
                }
                throw error;
            }

        } else if (displayName) {
            const sanitizedDisplayName = sanitizeAutoName(displayName);

            if (sanitizedDisplayName && shouldAutoUpdateLeadName(lead, lead.phone || phone, sessionDisplayName)) {
                await Lead.update(lead.id, { name: sanitizedDisplayName });
                lead = await Lead.findById(lead.id);
            }
        }



        const convResult = await Conversation.findOrCreate({

            lead_id: lead.id,

            session_id: sessionId,
            assigned_to: sessionOwnerUserId || undefined

        });

        const conversation = convResult.conversation;



        const updates = {};

        if (Number.isFinite(unreadCount)) {
            updates.unread_count = Math.max(0, unreadCount);

        }



        const lastMessage = extractLastMessageFromChat(chat);

        if (lastMessage) {

            let metadata = {};

            try {

                metadata = conversation?.metadata ? JSON.parse(conversation.metadata) : {};

            } catch (e) {

                metadata = {};

            }

            metadata.last_message = lastMessage;

            if (chat?.conversationTimestamp) {

                metadata.last_message_at = new Date(Number(chat.conversationTimestamp) * 1000).toISOString();

            }

            updates.metadata = metadata;

        }



        if (Object.keys(updates).length > 0) {

            await Conversation.update(conversation.id, updates);

        }

    }

}



function createFallbackRuntimeStore() {
    const chatsByJid = new Map();
    const messagesByJid = new Map();

    function resolveMessageJid(value) {
        return normalizeJid(
            value?.key?.remoteJid ||
            value?.remoteJid ||
            value?.jid ||
            ''
        );
    }

    function resolveMessageId(value) {
        return normalizeText(value?.key?.id || value?.id || '');
    }

    function ensureMessageBucket(jid) {
        const normalizedJid = normalizeJid(jid);
        if (!normalizedJid) return null;
        if (!messagesByJid.has(normalizedJid)) {
            messagesByJid.set(normalizedJid, new Map());
        }
        return messagesByJid.get(normalizedJid);
    }

    function upsertChat(chat) {
        const jid = normalizeJid(chat?.id || chat?.jid || '');
        if (!jid) return;

        const current = chatsByJid.get(jid) || {};
        chatsByJid.set(jid, {
            ...current,
            ...chat,
            id: jid
        });
    }

    function upsertMessage(message) {
        const jid = resolveMessageJid(message);
        const id = resolveMessageId(message);
        if (!jid || !id) return;

        const bucket = ensureMessageBucket(jid);
        if (!bucket) return;

        const current = bucket.get(id) || {};
        bucket.set(id, {
            ...current,
            ...message,
            key: {
                ...(current?.key || {}),
                ...(message?.key || {}),
                remoteJid: jid
            }
        });
    }

    function patchMessage(update) {
        const key = update?.key || {};
        const jid = resolveMessageJid({ key });
        const id = resolveMessageId({ key });
        if (!jid || !id) return;

        const bucket = ensureMessageBucket(jid);
        if (!bucket) return;

        const current = bucket.get(id);
        const updatePayload = (update && typeof update.update === 'object') ? update.update : {};

        if (!current && !updatePayload?.message) return;

        bucket.set(id, {
            ...(current || {}),
            ...updatePayload,
            key: {
                ...(current?.key || {}),
                ...key,
                remoteJid: jid
            }
        });
    }

    function deleteMessageByKey(key) {
        const jid = resolveMessageJid({ key });
        const id = resolveMessageId({ key });
        if (!jid || !id) return;

        const bucket = messagesByJid.get(jid);
        if (!bucket) return;

        bucket.delete(id);
        if (bucket.size === 0) {
            messagesByJid.delete(jid);
        }
    }

    function clearMessagesByJid(jid) {
        const normalizedJid = normalizeJid(jid);
        if (!normalizedJid) return;
        messagesByJid.delete(normalizedJid);
    }

    return {
        __kind: 'fallback-runtime-store',
        chats: {
            all: () => Array.from(chatsByJid.values()),
            toJSON: () => Array.from(chatsByJid.values()),
            values: () => chatsByJid.values()
        },
        bind: (ev) => {
            if (!ev || typeof ev.on !== 'function') return;

            ev.on('messaging-history.set', (payload = {}) => {
                const chats = normalizeChatPayload(payload);
                const messages = Array.isArray(payload?.messages) ? payload.messages : [];
                for (const chat of chats) upsertChat(chat);
                for (const message of messages) upsertMessage(message);
            });

            ev.on('chats.set', (payload) => {
                for (const chat of normalizeChatPayload(payload)) upsertChat(chat);
            });

            ev.on('chats.upsert', (payload) => {
                for (const chat of normalizeChatPayload(payload)) upsertChat(chat);
            });

            ev.on('chats.update', (payload) => {
                for (const chat of normalizeChatPayload(payload)) upsertChat(chat);
            });

            ev.on('chats.delete', (payload) => {
                const chatIds = Array.isArray(payload) ? payload : [];
                for (const chatId of chatIds) {
                    const jid = normalizeJid(chatId);
                    if (!jid) continue;
                    chatsByJid.delete(jid);
                    clearMessagesByJid(jid);
                }
            });

            ev.on('messages.upsert', (eventPayload = {}) => {
                const messages = Array.isArray(eventPayload?.messages) ? eventPayload.messages : [];
                for (const message of messages) upsertMessage(message);
            });

            ev.on('messages.update', (payload) => {
                const updates = Array.isArray(payload) ? payload : [];
                for (const update of updates) patchMessage(update);
            });

            ev.on('messages.delete', (payload = {}) => {
                const keys = Array.isArray(payload?.keys) ? payload.keys : [];
                if (keys.length > 0) {
                    for (const key of keys) deleteMessageByKey(key);
                    return;
                }
                if (payload?.all && payload?.jid) {
                    clearMessagesByJid(payload.jid);
                }
            });
        },
        loadMessages: async (jid, limit = 40) => {
            const normalizedJid = normalizeJid(jid);
            if (!normalizedJid) return [];

            const bucket = messagesByJid.get(normalizedJid);
            if (!bucket || bucket.size === 0) return [];

            const safeLimit = Math.max(1, Number(limit) || 40);
            const allMessages = Array.from(bucket.values());
            allMessages.sort((a, b) => {
                const bTs = parseMessageTimestampMs(b?.messageTimestamp);
                const aTs = parseMessageTimestampMs(a?.messageTimestamp);
                if (aTs === bTs) {
                    const aId = String(a?.key?.id || '');
                    const bId = String(b?.key?.id || '');
                    return bId.localeCompare(aId);
                }
                return bTs - aTs;
            });
            return allMessages.slice(0, safeLimit);
        }
    };
}

function createRuntimeStore() {
    return createFallbackRuntimeStore();
}

function bindRuntimeStoreToSocket(sessionId, store, sock) {
    if (!store || typeof store.bind !== 'function') return;
    const emitter = sock?.ev;
    if (!emitter) return;

    try {
        if (!store.__zapVenderBoundEmitters) {
            Object.defineProperty(store, '__zapVenderBoundEmitters', {
                value: new WeakSet(),
                enumerable: false
            });
        }

        const boundEmitters = store.__zapVenderBoundEmitters;
        if (boundEmitters && typeof boundEmitters.has === 'function' && boundEmitters.has(emitter)) {
            return;
        }

        store.bind(emitter);

        if (boundEmitters && typeof boundEmitters.add === 'function') {
            boundEmitters.add(emitter);
        }
    } catch (error) {
        console.warn(`[${sanitizeSessionId(sessionId, 'runtime')}] Falha ao vincular store local:`, error.message);
    }
}

function ensureRuntimeSessionStore(sessionId, runtimeSession, options = {}) {
    if (!runtimeSession) return null;

    if (runtimeSession.store && typeof runtimeSession.store.loadMessages === 'function') {
        return runtimeSession.store;
    }

    const store = createRuntimeStore();

    runtimeSession.store = store;
    bindRuntimeStoreToSocket(sessionId, store, options.socket || runtimeSession.socket);
    return runtimeSession.store;
}

function resolveRuntimeSessionStore(sessionId, runtimeSession, options = {}) {
    const store = ensureRuntimeSessionStore(sessionId, runtimeSession, options);
    if (store && typeof store.loadMessages === 'function') {
        return store;
    }
    return null;
}

function extractStoreChats(store) {

    if (!store) return [];

    if (typeof store.chats?.all === 'function') {

        return store.chats.all();

    }

    if (typeof store.chats?.toJSON === 'function') {

        return store.chats.toJSON();

    }

    if (store.chats && typeof store.chats.values === 'function') {

        return Array.from(store.chats.values());

    }

    return [];

}



async function triggerChatSync(sessionId, sock, store, attempt = 1) {

    let synced = false;



    try {

        if (typeof sock?.fetchChats === 'function') {

            const chats = await sock.fetchChats();

            if (chats?.length) {

                await syncChatsToDatabase(sessionId, chats);

                synced = true;

            }

        } else if (typeof sock?.getChats === 'function') {

            const chats = await sock.getChats();

            if (chats?.length) {

                await syncChatsToDatabase(sessionId, chats);

                synced = true;

            }

        }

    } catch (error) {

        console.warn(`[${sessionId}] ?? NÃ£o foi possÃ­vel buscar chats por API:`, error.message);

    }



    if (!synced) {

        const chats = extractStoreChats(store);

        if (chats.length > 0) {

            await syncChatsToDatabase(sessionId, chats);

            synced = true;

        }

    }



    if (!synced && attempt < 3) {

        const delayMs = attempt === 1 ? 4000 : 8000;

        setTimeout(() => {

            triggerChatSync(sessionId, sock, store, attempt + 1);

        }, delayMs);

    }

}

function resolveConversationJidForBackfill({ lead = null, contactJid = '' } = {}) {
    const normalizedContactJid = normalizeJid(contactJid);
    const contactPhoneDigits = normalizePhoneDigits(contactJid);
    const normalizedLeadPhone = normalizePhoneDigits(lead?.phone);
    const candidates = [
        normalizedContactJid,
        contactPhoneDigits ? `${contactPhoneDigits}@s.whatsapp.net` : null,
        lead?.jid,
        normalizedLeadPhone ? `${normalizedLeadPhone}@s.whatsapp.net` : null
    ];

    for (const candidate of candidates) {
        const normalized = normalizeJid(candidate);
        if (normalized && isUserJid(normalized)) {
            return normalized;
        }
    }

    return '';
}

function createStoreBackfillResult(inserted = 0, hydratedMedia = 0) {
    return {
        inserted: Number(inserted) || 0,
        hydratedMedia: Number(hydratedMedia) || 0
    };
}

async function backfillConversationMessagesFromStore(options = {}) {
    const sessionId = sanitizeSessionId(options.sessionId || options.conversation?.session_id);
    const conversation = options.conversation || null;
    const lead = options.lead || null;
    const contactJid = sanitizeSessionId(options.contactJid);
    const limit = Math.max(1, Number(options.limit) || 40);

    if (!sessionId || !conversation?.id) return createStoreBackfillResult();

    const session = sessions.get(sessionId);
    const store = resolveRuntimeSessionStore(sessionId, session);
    if (!store || typeof store.loadMessages !== 'function') {
        return createStoreBackfillResult();
    }

    const targetJid = resolveConversationJidForBackfill({ lead, contactJid });
    if (!targetJid) return createStoreBackfillResult();

    let storeMessages = [];
    try {
        const loaded = await store.loadMessages(targetJid, limit, undefined);
        storeMessages = Array.isArray(loaded) ? loaded : [];
    } catch (error) {
        console.warn(`[${sessionId}] Falha ao carregar mensagens do store para backfill (${targetJid}):`, error.message);
        return createStoreBackfillResult();
    }

    if (!storeMessages.length) return createStoreBackfillResult();

    const orderedMessages = [...storeMessages].sort((a, b) => {
        const aTs = parseMessageTimestampMs(a?.messageTimestamp);
        const bTs = parseMessageTimestampMs(b?.messageTimestamp);
        return aTs - bTs;
    });

    let inserted = 0;
    let hydratedMedia = 0;
    let latestSavedMessageId = null;
    let latestSentAt = '';
    let latestMessageTimestampMs = 0;
    let latestMessageFromMe = false;
    let unreadFromLead = 0;

    for (const waMsg of orderedMessages) {
        if (!waMsg?.message || isGroupMessage(waMsg)) continue;

        const messageId = normalizeText(waMsg?.key?.id || '');
        if (!messageId) continue;

        const content = unwrapMessageContent(waMsg.message);
        let text = extractTextFromMessageContent(content);
        const mediaType = detectMediaTypeFromMessageContent(content);
        const existingMessage = await Message.findByMessageId(messageId);

        if (existingMessage) {
            const hasMediaType = String(mediaType || '').trim().toLowerCase() !== 'text';
            const mediaMissingInDb = !String(existingMessage.media_url || '').trim();
            if (hasMediaType && mediaMissingInDb) {
                const persistedMedia = await persistIncomingMedia({
                    sessionId,
                    messageId,
                    content,
                    mediaType,
                    sourceMessage: waMsg
                });
                if (persistedMedia?.url) {
                    await run(`
                        UPDATE messages
                        SET media_url = ?, media_mime_type = ?, media_filename = ?
                        WHERE message_id = ?
                    `, [
                        persistedMedia.url,
                        persistedMedia.mimetype || null,
                        persistedMedia.filename || null,
                        messageId
                    ]);
                    hydratedMedia += 1;
                }
            }
            continue;
        }

        const persistedMedia = await persistIncomingMedia({
            sessionId,
            messageId,
            content,
            mediaType,
            sourceMessage: waMsg
        });

        if (!text && mediaType !== 'text') {
            text = previewForMedia(mediaType);
        }

        text = normalizeText(text);
        if (!text) continue;

        const isFromMe = Boolean(waMsg?.key?.fromMe);
        const messageTimestampMs = parseMessageTimestampMs(waMsg?.messageTimestamp);
        const effectiveMessageTimestampMs = messageTimestampMs > 0 ? messageTimestampMs : Date.now();
        const sentAtIso = new Date(effectiveMessageTimestampMs).toISOString();
        const normalizedStatus = isFromMe ? 'sent' : 'delivered';

        const savedMessage = await Message.create({
            message_id: messageId,
            conversation_id: conversation.id,
            lead_id: lead?.id || conversation.lead_id,
            sender_type: isFromMe ? 'agent' : 'lead',
            content: text,
            content_encrypted: encryptMessage(text),
            media_type: mediaType,
            media_url: persistedMedia?.url || null,
            media_mime_type: persistedMedia?.mimetype || null,
            media_filename: persistedMedia?.filename || null,
            status: normalizedStatus,
            is_from_me: isFromMe,
            sent_at: sentAtIso,
            metadata: { source: 'store_backfill' }
        });

        inserted += 1;
        if (!latestMessageTimestampMs || effectiveMessageTimestampMs >= latestMessageTimestampMs) {
            latestMessageTimestampMs = effectiveMessageTimestampMs;
            latestSavedMessageId = savedMessage?.id || latestSavedMessageId;
            latestSentAt = sentAtIso || latestSentAt;
            latestMessageFromMe = isFromMe;
        }
        if (!isFromMe) unreadFromLead += 1;
    }

    if (!inserted && !hydratedMedia) return createStoreBackfillResult();

    if (inserted > 0) {
        if (latestMessageFromMe) {
            await Conversation.touchAndMarkAsRead(conversation.id, latestSavedMessageId, latestSentAt || null);
        } else {
            await Conversation.touch(conversation.id, latestSavedMessageId, latestSentAt || null);
        }
    }

    if (inserted > 0 && lead?.id && latestSentAt) {
        await Lead.update(lead.id, { last_message_at: latestSentAt });
        await Campaign.refreshMetricsByLead(lead.id);
    }

    if (inserted > 0 && unreadFromLead > 0) {
        const currentUnread = Math.max(0, Number(conversation.unread_count || 0));
        if (currentUnread <= 0) {
            await Conversation.update(conversation.id, { unread_count: unreadFromLead });
        }
    }

    console.log(`[${sessionId}] Backfill local recuperou ${inserted} mensagem(ns) e atualizou ${hydratedMedia} mÃ­dia(s) na conversa ${conversation.id}`);
    return createStoreBackfillResult(inserted, hydratedMedia);
}

function clearSessionReconnectCatchupTimer(sessionId) {
    const normalizedSessionId = sanitizeSessionId(sessionId);
    if (!normalizedSessionId) return;

    const scheduled = sessionReconnectCatchupTimers.get(normalizedSessionId);
    if (scheduled?.timer) {
        clearTimeout(scheduled.timer);
    }
    sessionReconnectCatchupTimers.delete(normalizedSessionId);
}

async function listRecentConversationsForSessionCatchup(
    sessionId,
    limit = WHATSAPP_RECONNECT_CATCHUP_MAX_CONVERSATIONS,
    options = {}
) {
    const normalizedSessionId = sanitizeSessionId(sessionId);
    if (!normalizedSessionId) return [];

    const safeLimit = Math.max(
        1,
        Math.min(
            Number(limit) || WHATSAPP_RECONNECT_CATCHUP_MAX_CONVERSATIONS,
            WHATSAPP_RECONNECT_CATCHUP_MAX_CONVERSATIONS_HARD_LIMIT
        )
    );
    const unreadOnly = options?.unreadOnly === true;
    const unreadFilterSql = unreadOnly ? 'AND COALESCE(c.unread_count, 0) > 0' : '';

    return await query(`
        SELECT
            c.id AS conversation_id,
            c.lead_id AS conversation_lead_id,
            c.session_id AS conversation_session_id,
            c.unread_count AS conversation_unread_count,
            c.metadata AS conversation_metadata,
            c.assigned_to AS conversation_assigned_to,
            c.created_at AS conversation_created_at,
            c.updated_at AS conversation_updated_at,
            l.id AS lead_id,
            l.phone AS lead_phone,
            l.jid AS lead_jid,
            l.name AS lead_name,
            l.owner_user_id AS lead_owner_user_id
        FROM conversations c
        INNER JOIN leads l ON l.id = c.lead_id
        WHERE c.session_id = ?
          ${unreadFilterSql}
        ORDER BY
            CASE WHEN COALESCE(c.unread_count, 0) > 0 THEN 0 ELSE 1 END ASC,
            COALESCE(c.updated_at, c.created_at) DESC,
            c.id DESC
        LIMIT ${safeLimit}
    `, [normalizedSessionId]);
}

function mapCatchupConversationRow(row) {
    if (!row) return { conversation: null, lead: null };

    return {
        conversation: {
            id: Number(row.conversation_id || 0) || null,
            lead_id: Number(row.conversation_lead_id || 0) || null,
            session_id: row.conversation_session_id || null,
            unread_count: Number(row.conversation_unread_count || 0) || 0,
            metadata: row.conversation_metadata || null,
            assigned_to: row.conversation_assigned_to || null,
            created_at: row.conversation_created_at || null,
            updated_at: row.conversation_updated_at || null
        },
        lead: {
            id: Number(row.lead_id || 0) || null,
            phone: row.lead_phone || null,
            jid: row.lead_jid || null,
            name: row.lead_name || null,
            owner_user_id: Number(row.lead_owner_user_id || 0) || null
        }
    };
}

async function runSessionReconnectCatchup(sessionId, options = {}) {
    const normalizedSessionId = sanitizeSessionId(sessionId);
    const trigger = String(options.trigger || 'reconnect-open').trim() || 'reconnect-open';
    const expectedSocket = options.expectedSocket || null;
    const maxConversations = parsePositiveIntInRange(
        options.maxConversations,
        WHATSAPP_RECONNECT_CATCHUP_MAX_CONVERSATIONS,
        1,
        WHATSAPP_RECONNECT_CATCHUP_MAX_CONVERSATIONS_HARD_LIMIT
    );
    const messagesPerConversation = parsePositiveIntInRange(
        options.messagesPerConversation,
        WHATSAPP_RECONNECT_CATCHUP_MESSAGES_PER_CONVERSATION,
        10,
        WHATSAPP_RECONNECT_CATCHUP_MESSAGES_PER_CONVERSATION_HARD_LIMIT
    );
    const maxRuntimeMs = parsePositiveIntInRange(
        options.maxRuntimeMs,
        WHATSAPP_RECONNECT_CATCHUP_MAX_RUNTIME_MS,
        3000,
        WHATSAPP_RECONNECT_CATCHUP_MAX_RUNTIME_HARD_LIMIT_MS
    );
    const unreadOnly = options?.unreadOnly === true;

    if (!WHATSAPP_RECONNECT_CATCHUP_ENABLED) return { skipped: 'disabled' };
    if (!normalizedSessionId) return { skipped: 'invalid_session' };
    if (sessionReconnectCatchupInFlight.has(normalizedSessionId)) return { skipped: 'in_flight' };

    sessionReconnectCatchupInFlight.add(normalizedSessionId);
    const startedAtMs = Date.now();
    const summary = {
        sessionId: normalizedSessionId,
        trigger,
        conversationsScanned: 0,
        conversationsUpdated: 0,
        messagesInserted: 0,
        mediaHydrated: 0,
        skipped: null,
        elapsedMs: 0,
        maxConversations,
        messagesPerConversation,
        maxRuntimeMs,
        unreadOnly
    };

    try {
        const runtimeSession = sessions.get(normalizedSessionId);
        if (!runtimeSession) {
            summary.skipped = 'session_not_found';
            return summary;
        }
        if (expectedSocket && runtimeSession.socket !== expectedSocket) {
            summary.skipped = 'stale_socket';
            return summary;
        }
        if (!runtimeSession.isConnected) {
            summary.skipped = 'session_not_connected';
            return summary;
        }
        const runtimeStore = resolveRuntimeSessionStore(normalizedSessionId, runtimeSession);
        if (!runtimeStore || typeof runtimeStore.loadMessages !== 'function') {
            summary.skipped = 'store_unavailable';
            return summary;
        }

        try {
            await triggerChatSync(normalizedSessionId, runtimeSession.socket, runtimeStore, 0);
        } catch (syncError) {
            console.warn(`[${normalizedSessionId}] Falha no sync preliminar do catch-up:`, syncError.message);
        }

        const rows = await listRecentConversationsForSessionCatchup(
            normalizedSessionId,
            maxConversations,
            { unreadOnly }
        );
        if (!Array.isArray(rows) || rows.length === 0) {
            summary.skipped = 'no_conversations';
            return summary;
        }

        for (const row of rows) {
            summary.conversationsScanned += 1;

            if ((Date.now() - startedAtMs) > maxRuntimeMs) {
                summary.skipped = 'runtime_limit_reached';
                break;
            }

            const latestRuntimeSession = sessions.get(normalizedSessionId);
            if (!latestRuntimeSession || !latestRuntimeSession.isConnected) {
                summary.skipped = 'session_disconnected';
                break;
            }
            if (expectedSocket && latestRuntimeSession.socket !== expectedSocket) {
                summary.skipped = 'stale_socket';
                break;
            }

            const { conversation, lead } = mapCatchupConversationRow(row);
            if (!conversation?.id || !lead?.id) continue;

            const backfillResult = await backfillConversationMessagesFromStore({
                sessionId: normalizedSessionId,
                conversation,
                lead,
                contactJid: lead.jid || '',
                limit: messagesPerConversation
            });

            const inserted = Number(backfillResult?.inserted || 0);
            const hydratedMedia = Number(backfillResult?.hydratedMedia || 0);
            if (inserted > 0 || hydratedMedia > 0) {
                summary.conversationsUpdated += 1;
                summary.messagesInserted += Math.max(0, inserted);
                summary.mediaHydrated += Math.max(0, hydratedMedia);
            }
        }

        summary.elapsedMs = Math.max(0, Date.now() - startedAtMs);
        console.log(
            `[${normalizedSessionId}] Catch-up pos-reconexao (${trigger}) ` +
            `conversas=${summary.conversationsScanned}/${maxConversations}, ` +
            `atualizadas=${summary.conversationsUpdated}, mensagens=${summary.messagesInserted}, ` +
            `midias=${summary.mediaHydrated}, unreadOnly=${unreadOnly ? 'yes' : 'no'}, ` +
            `skipped=${summary.skipped || 'none'}, ${summary.elapsedMs}ms`
        );
        return summary;
    } catch (error) {
        summary.elapsedMs = Math.max(0, Date.now() - startedAtMs);
        console.error(`[${normalizedSessionId}] Falha no catch-up pos-reconexao:`, error.message);
        throw error;
    } finally {
        sessionReconnectCatchupInFlight.delete(normalizedSessionId);
    }
}

function scheduleSessionReconnectCatchup(sessionId, options = {}) {
    if (!WHATSAPP_RECONNECT_CATCHUP_ENABLED) return;

    const normalizedSessionId = sanitizeSessionId(sessionId);
    if (!normalizedSessionId) return;

    clearSessionReconnectCatchupTimer(normalizedSessionId);

    const delayMs = Math.max(
        300,
        Number(options.delayMs || WHATSAPP_RECONNECT_CATCHUP_DELAY_MS) || WHATSAPP_RECONNECT_CATCHUP_DELAY_MS
    );
    const expectedSocket = options.expectedSocket || null;
    const trigger = String(options.trigger || 'reconnect-open').trim() || 'reconnect-open';

    const timer = setTimeout(() => {
        sessionReconnectCatchupTimers.delete(normalizedSessionId);
        runSessionReconnectCatchup(normalizedSessionId, {
            trigger,
            expectedSocket
        }).catch((error) => {
            console.error(`[${normalizedSessionId}] Falha no catch-up agendado pos-reconexao:`, error.message);
        });
    }, delayMs);

    sessionReconnectCatchupTimers.set(normalizedSessionId, {
        timer,
        scheduledAtMs: Date.now(),
        trigger,
        expectedSocket
    });
}

async function runInboxReconciliationCycle(options = {}) {
    const trigger = String(options.trigger || 'inbox-reconciliation-worker').trim() || 'inbox-reconciliation-worker';
    const force = options.force === true;

    if (!INBOX_RECONCILIATION_WORKER_ENABLED && !force) {
        return { skipped: 'disabled', trigger };
    }
    if (inboxReconciliationIsRunning) {
        return { skipped: 'in_flight', trigger };
    }

    inboxReconciliationIsRunning = true;
    const startedAtMs = Date.now();
    const summary = {
        trigger,
        sessionsScanned: 0,
        sessionsUpdated: 0,
        messagesInserted: 0,
        mediaHydrated: 0,
        skippedByReason: {},
        elapsedMs: 0
    };

    try {
        const maxConversations = parsePositiveIntInRange(
            options.maxConversations,
            INBOX_RECONCILIATION_MAX_CONVERSATIONS,
            1,
            WHATSAPP_RECONNECT_CATCHUP_MAX_CONVERSATIONS_HARD_LIMIT
        );
        const messagesPerConversation = parsePositiveIntInRange(
            options.messagesPerConversation,
            INBOX_RECONCILIATION_MESSAGES_PER_CONVERSATION,
            10,
            WHATSAPP_RECONNECT_CATCHUP_MESSAGES_PER_CONVERSATION_HARD_LIMIT
        );
        const maxRuntimeMs = parsePositiveIntInRange(
            options.maxRuntimeMs,
            INBOX_RECONCILIATION_MAX_RUNTIME_MS,
            3000,
            WHATSAPP_RECONNECT_CATCHUP_MAX_RUNTIME_HARD_LIMIT_MS
        );

        const connectedSessions = Array.from(sessions.entries())
            .filter(([, runtimeSession]) => runtimeSession?.socket && runtimeSession?.isConnected === true);

        if (connectedSessions.length === 0) {
            summary.skippedByReason.no_connected_sessions = 1;
            return summary;
        }

        for (const [sessionId, runtimeSession] of connectedSessions) {
            summary.sessionsScanned += 1;

            try {
                const catchupSummary = await runSessionReconnectCatchup(sessionId, {
                    trigger,
                    expectedSocket: runtimeSession.socket,
                    maxConversations,
                    messagesPerConversation,
                    maxRuntimeMs,
                    unreadOnly: false
                });

                const inserted = Math.max(0, Number(catchupSummary?.messagesInserted || 0));
                const hydratedMedia = Math.max(0, Number(catchupSummary?.mediaHydrated || 0));

                if (inserted > 0 || hydratedMedia > 0) {
                    summary.sessionsUpdated += 1;
                    summary.messagesInserted += inserted;
                    summary.mediaHydrated += hydratedMedia;
                }

                const skippedReason = String(catchupSummary?.skipped || '').trim();
                if (skippedReason) {
                    summary.skippedByReason[skippedReason] = Number(summary.skippedByReason[skippedReason] || 0) + 1;
                }
            } catch (sessionError) {
                summary.skippedByReason.error = Number(summary.skippedByReason.error || 0) + 1;
                console.warn(`[${sessionId}] Falha na reconciliacao periodica do inbox:`, sessionError.message);
            }
        }

        return summary;
    } finally {
        summary.elapsedMs = Math.max(0, Date.now() - startedAtMs);
        inboxReconciliationLastSummary = {
            ...summary,
            completedAt: new Date().toISOString()
        };
        inboxReconciliationIsRunning = false;
    }
}

function startInboxReconciliationWorker() {
    if (inboxReconciliationIntervalId) return;

    if (!INBOX_RECONCILIATION_WORKER_ENABLED) {
        console.log('[InboxReconciliation] worker desabilitado por configuracao');
        return;
    }

    const runCycle = () => {
        runInboxReconciliationCycle({
            trigger: 'inbox-reconciliation-worker'
        }).catch((error) => {
            console.error('[InboxReconciliation] Falha no ciclo periodico:', error.message);
        });
    };

    inboxReconciliationIntervalId = setInterval(runCycle, INBOX_RECONCILIATION_INTERVAL_MS);

    const bootstrapDelayMs = Math.max(
        5000,
        Math.min(30000, Math.floor(INBOX_RECONCILIATION_INTERVAL_MS / 2))
    );
    inboxReconciliationBootstrapTimeoutId = setTimeout(() => {
        inboxReconciliationBootstrapTimeoutId = null;
        runCycle();
    }, bootstrapDelayMs);
    console.log(`[InboxReconciliation] worker ativo (intervalo=${INBOX_RECONCILIATION_INTERVAL_MS}ms)`);
}

function stopInboxReconciliationWorker() {
    if (inboxReconciliationBootstrapTimeoutId) {
        clearTimeout(inboxReconciliationBootstrapTimeoutId);
        inboxReconciliationBootstrapTimeoutId = null;
    }
    if (inboxReconciliationIntervalId) {
        clearInterval(inboxReconciliationIntervalId);
        inboxReconciliationIntervalId = null;
    }
}

function isFlowNodeAwaitingInput(flow, nodeId) {
    const normalizedNodeId = String(nodeId || '').trim();
    if (!normalizedNodeId) return false;
    if (!flow || !Array.isArray(flow.nodes)) return false;

    const currentNode = flow.nodes.find((node) => String(node?.id || '').trim() === normalizedNodeId);
    if (!currentNode) return false;

    const nodeType = String(currentNode?.type || '').trim().toLowerCase();
    const nodeSubtype = String(currentNode?.subtype || '').trim().toLowerCase();

    if (nodeType === 'intent' || nodeType === 'wait' || nodeType === 'condition') {
        return true;
    }

    if (nodeType === 'trigger' && (nodeSubtype === 'keyword' || nodeSubtype === 'intent')) {
        return true;
    }

    return false;
}

function resolveStoredMessageTextForFlow(messageRow = {}) {
    let text = messageRow?.content_encrypted
        ? decryptMessage(messageRow.content_encrypted)
        : messageRow?.content;

    if ((!text || !String(text).trim()) && messageRow?.media_type && messageRow.media_type !== 'text') {
        text = previewForMedia(messageRow.media_type);
    }

    return normalizeText(text);
}

async function isExecutionStillAwaitingInput(executionId, expectedCurrentNode = '') {
    const normalizedExecutionId = Number(executionId);
    if (!Number.isFinite(normalizedExecutionId) || normalizedExecutionId <= 0) {
        return true;
    }

    const rows = await query(`
        SELECT status, current_node
        FROM flow_executions
        WHERE id = ?
        LIMIT 1
    `, [normalizedExecutionId]);
    const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    if (!row) return false;

    const normalizedStatus = String(row.status || '').trim().toLowerCase();
    if (normalizedStatus !== 'running') return false;

    const normalizedExpectedNode = String(expectedCurrentNode || '').trim();
    if (normalizedExpectedNode) {
        const currentNode = String(row.current_node || '').trim();
        if (currentNode !== normalizedExpectedNode) {
            return false;
        }
    }

    return true;
}

async function processRecoveredStoreBackfillMessages(options = {}) {
    const sessionId = sanitizeSessionId(options.sessionId);
    const conversation = options.conversation || null;
    const lead = options.lead || null;
    const expectedExecutionId = Number(options.expectedExecutionId);
    const expectedCurrentNode = String(options.expectedCurrentNode || '').trim();
    const requireStoreBackfillSource = options.requireStoreBackfillSource !== false;
    const maxToProcess = Math.max(1, Number(options.maxToProcess) || 1);
    const sinceMessageId = Math.max(0, Number(options.sinceMessageId) || 0);
    const logSource = String(options.logSource || 'flow-recovery').trim() || 'flow-recovery';
    const scanLimit = Math.max(8, Math.min(80, maxToProcess * 6));

    if (!sessionId || !conversation?.id || !lead?.id) {
        return { scanned: 0, processed: 0 };
    }

    const candidates = await query(`
        SELECT id, message_id, content, content_encrypted, media_type, metadata, sent_at, created_at
        FROM messages
        WHERE conversation_id = ?
          AND is_from_me = 0
          AND id > ?
        ORDER BY id ASC
        LIMIT ?
    `, [conversation.id, sinceMessageId, scanLimit]);

    if (!Array.isArray(candidates) || candidates.length === 0) {
        return { scanned: 0, processed: 0 };
    }

    const now = Date.now();
    let scanned = 0;
    let processed = 0;

    for (const candidate of candidates) {
        scanned += 1;

        const messageId = String(candidate?.message_id || '').trim();
        if (!messageId || hasRecoveredFlowMessage(messageId)) continue;

        if (requireStoreBackfillSource) {
            const metadata = parseJsonSafe(candidate?.metadata, {});
            if (String(metadata?.source || '').trim() !== 'store_backfill') continue;
        }

        const rawTimestamp = candidate?.sent_at || candidate?.created_at;
        const sentAtMs = Date.parse(String(rawTimestamp || ''));
        if (!Number.isFinite(sentAtMs) || (now - sentAtMs) > FLOW_RECOVERY_WINDOW_MS) continue;

        if (Number.isFinite(expectedExecutionId) && expectedExecutionId > 0) {
            const stillAwaiting = await isExecutionStillAwaitingInput(expectedExecutionId, expectedCurrentNode);
            if (!stillAwaiting) {
                break;
            }
        }

        const text = resolveStoredMessageTextForFlow(candidate);
        if (!text) continue;

        const refreshedConversation = await Conversation.findById(conversation.id) || conversation;
        await flowService.processIncomingMessage(
            { text, mediaType: candidate.media_type || 'text' },
            lead,
            refreshedConversation
        );
        rememberRecoveredFlowMessage(messageId);
        processed += 1;
        console.log(`[${sessionId}] ${logSource} processou mensagem recuperada (${messageId}) para continuar fluxo`);

        if (processed >= maxToProcess) break;
    }

    return { scanned, processed };
}

async function recoverAwaitingInputFlowExecution(executionRow = {}, flowCache = new Map()) {
    const executionId = Number(executionRow?.execution_id || 0);
    const flowId = Number(executionRow?.flow_id || 0);
    const conversationId = Number(executionRow?.conversation_id || 0);
    const rowLeadId = Number(executionRow?.lead_id || 0);
    const currentNode = String(executionRow?.current_node || '').trim();
    const sessionId = sanitizeSessionId(executionRow?.session_id);

    if (!Number.isFinite(executionId) || executionId <= 0) return { skipped: 'invalid_execution' };
    if (!Number.isFinite(flowId) || flowId <= 0) return { skipped: 'invalid_flow' };
    if (!Number.isFinite(conversationId) || conversationId <= 0) return { skipped: 'invalid_conversation' };
    if (!sessionId) return { skipped: 'invalid_session' };
    if (!currentNode) return { skipped: 'invalid_node' };

    const runtimeSession = sessions.get(sessionId);
    const runtimeStore = resolveRuntimeSessionStore(sessionId, runtimeSession);
    if (!runtimeStore || typeof runtimeStore.loadMessages !== 'function') {
        return { skipped: 'runtime_store_unavailable' };
    }

    let flow = flowCache.get(flowId);
    if (flow === undefined) {
        flow = await Flow.findById(flowId);
        flowCache.set(flowId, flow || null);
    }
    if (!flow) return { skipped: 'flow_not_found' };
    if (!isFlowNodeAwaitingInput(flow, currentNode)) return { skipped: 'node_not_waiting' };

    let conversation = await Conversation.findById(conversationId);
    if (!conversation?.id) return { skipped: 'conversation_not_found' };
    if (!conversation.is_bot_active) return { skipped: 'bot_inactive' };

    const resolvedLeadId = Number.isFinite(rowLeadId) && rowLeadId > 0
        ? rowLeadId
        : Number(conversation?.lead_id || 0);
    if (!Number.isFinite(resolvedLeadId) || resolvedLeadId <= 0) {
        return { skipped: 'invalid_lead' };
    }

    const lead = await Lead.findById(resolvedLeadId);
    if (!lead?.id) return { skipped: 'lead_not_found' };

    const baselineMessageId = Math.max(
        0,
        Number(executionRow?.last_message_id || conversation?.last_message_id || 0) || 0
    );

    const backfillResult = await backfillConversationMessagesFromStore({
        sessionId,
        conversation,
        lead,
        contactJid: lead?.jid || lead?.phone || '',
        limit: FLOW_AWAITING_INPUT_RECOVERY_BACKFILL_LIMIT
    });

    if ((backfillResult?.inserted || 0) <= 0) {
        return { skipped: 'no_backfill' };
    }

    conversation = await Conversation.findById(conversationId) || conversation;
    const processedResult = await processRecoveredStoreBackfillMessages({
        sessionId,
        conversation,
        lead,
        sinceMessageId: baselineMessageId,
        maxToProcess: FLOW_AWAITING_INPUT_RECOVERY_MAX_MESSAGES_PER_EXECUTION,
        expectedExecutionId: executionId,
        expectedCurrentNode: currentNode,
        requireStoreBackfillSource: true,
        logSource: 'flow-awaiting-input-recovery'
    });

    if ((processedResult?.processed || 0) <= 0) {
        return { skipped: 'no_message_processed' };
    }

    return {
        recovered: Math.max(0, Number(processedResult.processed || 0)),
        backfillInserted: Math.max(0, Number(backfillResult.inserted || 0))
    };
}

async function failStaleRunningFlowExecutions(options = {}) {
    const timeoutHours = parsePositiveIntInRange(
        options.timeoutHours,
        FLOW_EXECUTION_RUNNING_TIMEOUT_HOURS,
        1,
        720
    );
    const timeoutMs = timeoutHours * 60 * 60 * 1000;
    const cutoff = new Date(Date.now() - timeoutMs).toISOString();

    const result = await run(`
        UPDATE flow_executions
        SET status = 'failed',
            completed_at = CURRENT_TIMESTAMP,
            error_message = ?
        WHERE status = 'running'
          AND started_at IS NOT NULL
          AND started_at <= ?
    `, ['timeout recovery', cutoff]);

    return {
        timeoutHours,
        cutoff,
        changes: Number(result?.changes || 0)
    };
}

async function runFlowAwaitingInputRecoveryCycle(options = {}) {
    const trigger = String(options.trigger || 'flow-awaiting-input-worker').trim() || 'flow-awaiting-input-worker';
    const force = options.force === true;

    if (!FLOW_AWAITING_INPUT_RECOVERY_ENABLED && !force) {
        return { skipped: 'disabled', trigger };
    }
    if (flowAwaitingInputRecoveryIsRunning) {
        return { skipped: 'in_flight', trigger };
    }

    flowAwaitingInputRecoveryIsRunning = true;
    const startedAtMs = Date.now();
    const summary = {
        trigger,
        executionsScanned: 0,
        executionsRecovered: 0,
        messagesRecovered: 0,
        backfillInserted: 0,
        timedOutExecutions: 0,
        skippedByReason: {},
        elapsedMs: 0
    };

    try {
        const timeoutResult = await failStaleRunningFlowExecutions({
            timeoutHours: FLOW_EXECUTION_RUNNING_TIMEOUT_HOURS
        });
        summary.timedOutExecutions = Math.max(0, Number(timeoutResult?.changes || 0));

        const maxExecutions = parsePositiveIntInRange(
            options.maxExecutions,
            FLOW_AWAITING_INPUT_RECOVERY_MAX_EXECUTIONS,
            1,
            500
        );

        const runningExecutions = await query(`
            SELECT
                fe.id AS execution_id,
                fe.flow_id,
                fe.current_node,
                fe.conversation_id,
                fe.lead_id,
                c.session_id,
                c.last_message_id
            FROM flow_executions fe
            JOIN conversations c ON c.id = fe.conversation_id
            WHERE fe.status = 'running'
            ORDER BY fe.id DESC
            LIMIT ?
        `, [maxExecutions]);

        if (!Array.isArray(runningExecutions) || runningExecutions.length === 0) {
            summary.skippedByReason.no_running_executions = 1;
            return summary;
        }

        summary.executionsScanned = runningExecutions.length;
        const flowCache = new Map();

        for (const executionRow of runningExecutions) {
            try {
                const recoveryResult = await recoverAwaitingInputFlowExecution(executionRow, flowCache);
                const recovered = Math.max(0, Number(recoveryResult?.recovered || 0));
                if (recovered > 0) {
                    summary.executionsRecovered += 1;
                    summary.messagesRecovered += recovered;
                    summary.backfillInserted += Math.max(0, Number(recoveryResult?.backfillInserted || 0));
                } else {
                    const skippedReason = String(recoveryResult?.skipped || '').trim() || 'not_recovered';
                    summary.skippedByReason[skippedReason] = Number(summary.skippedByReason[skippedReason] || 0) + 1;
                }
            } catch (executionError) {
                summary.skippedByReason.error = Number(summary.skippedByReason.error || 0) + 1;
                console.warn(
                    `[FlowAwaitingRecovery] Falha ao recuperar execucao ${Number(executionRow?.execution_id || 0) || 'n/a'}:`,
                    executionError.message
                );
            }
        }

        return summary;
    } finally {
        summary.elapsedMs = Math.max(0, Date.now() - startedAtMs);
        flowAwaitingInputRecoveryLastSummary = {
            ...summary,
            completedAt: new Date().toISOString()
        };
        flowAwaitingInputRecoveryIsRunning = false;
    }
}

function startFlowAwaitingInputRecoveryWorker() {
    if (flowAwaitingInputRecoveryIntervalId) return;

    if (!FLOW_AWAITING_INPUT_RECOVERY_ENABLED) {
        console.log('[FlowAwaitingRecovery] worker desabilitado por configuracao');
        return;
    }

    const runCycle = () => {
        runFlowAwaitingInputRecoveryCycle({
            trigger: 'flow-awaiting-input-worker'
        }).catch((error) => {
            console.error('[FlowAwaitingRecovery] Falha no ciclo periodico:', error.message);
        });
    };

    flowAwaitingInputRecoveryIntervalId = setInterval(runCycle, FLOW_AWAITING_INPUT_RECOVERY_INTERVAL_MS);

    const bootstrapDelayMs = Math.max(
        4000,
        Math.min(15000, Math.floor(FLOW_AWAITING_INPUT_RECOVERY_INTERVAL_MS / 2))
    );
    flowAwaitingInputRecoveryBootstrapTimeoutId = setTimeout(() => {
        flowAwaitingInputRecoveryBootstrapTimeoutId = null;
        runCycle();
    }, bootstrapDelayMs);

    console.log(`[FlowAwaitingRecovery] worker ativo (intervalo=${FLOW_AWAITING_INPUT_RECOVERY_INTERVAL_MS}ms)`);
}

function stopFlowAwaitingInputRecoveryWorker() {
    if (flowAwaitingInputRecoveryBootstrapTimeoutId) {
        clearTimeout(flowAwaitingInputRecoveryBootstrapTimeoutId);
        flowAwaitingInputRecoveryBootstrapTimeoutId = null;
    }
    if (flowAwaitingInputRecoveryIntervalId) {
        clearInterval(flowAwaitingInputRecoveryIntervalId);
        flowAwaitingInputRecoveryIntervalId = null;
    }
}

function normalizeHistorySyncMessageBatch(messages, limit = WHATSAPP_HISTORY_SYNC_MESSAGES_LIMIT) {
    if (!Array.isArray(messages) || messages.length === 0) return [];

    const ordered = messages
        .filter((message) => message && typeof message === 'object')
        .sort((a, b) => {
            const aTs = parseMessageTimestampMs(a?.messageTimestamp);
            const bTs = parseMessageTimestampMs(b?.messageTimestamp);
            if (aTs === bTs) {
                const aId = String(a?.key?.id || '');
                const bId = String(b?.key?.id || '');
                return aId.localeCompare(bId);
            }
            return aTs - bTs;
        });

    const safeLimit = Math.max(1, Number(limit) || WHATSAPP_HISTORY_SYNC_MESSAGES_LIMIT);
    if (ordered.length <= safeLimit) return ordered;
    return ordered.slice(-safeLimit);
}

function enqueueSessionHistorySync(sessionId, worker) {
    const normalizedSessionId = sanitizeSessionId(sessionId);
    if (!normalizedSessionId || typeof worker !== 'function') return;

    const currentQueue = sessionHistorySyncQueues.get(normalizedSessionId) || Promise.resolve();
    const queued = currentQueue
        .catch(() => null)
        .then(() => worker())
        .catch((error) => {
            console.error(`[${normalizedSessionId}] Falha no processamento de historico:`, error.message);
        })
        .finally(() => {
            if (sessionHistorySyncQueues.get(normalizedSessionId) === queued) {
                sessionHistorySyncQueues.delete(normalizedSessionId);
            }
        });

    sessionHistorySyncQueues.set(normalizedSessionId, queued);
}

async function processMessagingHistorySet(sessionId, sock, payload = {}) {
    const normalizedSessionId = sanitizeSessionId(sessionId);
    if (!WHATSAPP_HISTORY_SYNC_ENABLED) return { skipped: 'disabled' };
    if (!normalizedSessionId) return { skipped: 'invalid_session' };
    if (!isActiveSessionSocket(normalizedSessionId, sock)) return { skipped: 'stale_socket' };

    const syncType = Number(payload?.syncType || 0) || 0;
    const isLatest = payload?.isLatest === true;
    const chats = normalizeChatPayload(payload?.chats);
    const contacts = Array.isArray(payload?.contacts) ? payload.contacts : [];
    const historyMessages = normalizeHistorySyncMessageBatch(payload?.messages);
    const sessionPhone = getSessionPhone(normalizedSessionId);

    if (chats.length > 0) {
        try {
            await syncChatsToDatabase(normalizedSessionId, chats);
        } catch (error) {
            console.warn(`[${normalizedSessionId}] Falha ao sincronizar chats do historico:`, error.message);
        }
    }

    if (contacts.length > 0) {
        for (const contact of contacts) {
            try {
                await registerContactAlias(contact, normalizedSessionId, sessionPhone);
            } catch (error) {
                console.warn(`[${normalizedSessionId}] Falha ao registrar contato do historico:`, error.message);
            }
        }
    }

    let scannedMessages = 0;
    let processedMessages = 0;
    let failedMessages = 0;
    let ciphertextQueued = 0;

    for (const waMessage of historyMessages) {
        scannedMessages += 1;

        if (isGroupMessage(waMessage)) continue;

        const hasPayload = Boolean(waMessage?.message);
        const hasCiphertextStub = Number(waMessage?.messageStubType || 0) === BAILEYS_CIPHERTEXT_STUB_TYPE;
        if (hasCiphertextStub) {
            scheduleCiphertextRecovery(normalizedSessionId, waMessage);
            ciphertextQueued += 1;
            continue;
        }
        if (!hasPayload) continue;

        try {
            await processIncomingMessage(normalizedSessionId, waMessage, {
                source: 'history_sync',
                preserveUnreadCount: true,
                skipInboundAutomation: true,
                skipWebhook: true
            });
            processedMessages += 1;
        } catch (error) {
            failedMessages += 1;
            console.warn(
                `[${normalizedSessionId}] Falha ao processar mensagem do historico (${waMessage?.key?.id || 'sem-id'}):`,
                error.message
            );
        }
    }

    if ((processedMessages > 0 || ciphertextQueued > 0) && isActiveSessionSocket(normalizedSessionId, sock)) {
        scheduleSessionReconnectCatchup(normalizedSessionId, {
            trigger: 'history-sync',
            expectedSocket: sock,
            delayMs: 1500
        });
    }

    console.log(
        `[${normalizedSessionId}] History sync recebido (type=${syncType}, latest=${isLatest ? 'yes' : 'no'}) ` +
        `chats=${chats.length}, contatos=${contacts.length}, mensagens=${processedMessages}/${scannedMessages}, ` +
        `ciphertext=${ciphertextQueued}, falhas=${failedMessages}`
    );

    return {
        chats: chats.length,
        contacts: contacts.length,
        scannedMessages,
        processedMessages,
        failedMessages,
        ciphertextQueued
    };
}

function parseJsonSafe(value, fallback = null) {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(String(value));
    } catch (_) {
        return fallback;
    }
}

function hasRecoveredFlowMessage(messageId) {
    const key = String(messageId || '').trim();
    if (!key) return false;
    return recoveredFlowMessageIds.has(key);
}

function rememberRecoveredFlowMessage(messageId) {
    const key = String(messageId || '').trim();
    if (!key) return;
    recoveredFlowMessageIds.set(key, Date.now());

    if (recoveredFlowMessageIds.size > FLOW_RECOVERY_TRACKER_LIMIT) {
        const now = Date.now();
        for (const [itemKey, itemTimestamp] of recoveredFlowMessageIds.entries()) {
            if ((now - Number(itemTimestamp || 0)) > FLOW_RECOVERY_WINDOW_MS) {
                recoveredFlowMessageIds.delete(itemKey);
            }
        }
    }
}

function resolveUserJidFromRawMessage(rawMessage = {}) {
    const key = rawMessage?.key || {};
    const candidates = [
        key?.remoteJid,
        key?.senderPn,
        key?.participantPn,
        key?.participant
    ];

    for (const candidate of candidates) {
        const normalized = normalizeUserJidCandidate(candidate) || normalizeJid(candidate);
        if (normalized && isUserJid(normalized)) {
            return normalized;
        }
    }

    return '';
}

function getCiphertextRecoveryDelayMs(attempt = 1) {
    const normalizedAttempt = Math.max(1, Number(attempt) || 1);
    const delay = FLOW_RECOVERY_DELAY_MS * Math.pow(2, normalizedAttempt - 1);
    return Math.min(Math.max(200, Math.trunc(delay)), FLOW_RECOVERY_MAX_DELAY_MS);
}

function getLidResolutionRecoveryDelayMs(attempt = 1) {
    const normalizedAttempt = Math.max(1, Number(attempt) || 1);
    const delay = LID_RESOLUTION_RECOVERY_BASE_DELAY_MS * Math.pow(2, normalizedAttempt - 1);
    return Math.min(Math.max(250, Math.trunc(delay)), LID_RESOLUTION_RECOVERY_MAX_DELAY_MS);
}

function scheduleLidResolutionRecovery(sessionId, rawMessage = {}, attempt = 1) {
    const normalizedSessionId = sanitizeSessionId(sessionId);
    const messageId = String(rawMessage?.key?.id || '').trim();
    const remoteLid = normalizeLidJid(rawMessage?.key?.remoteJid);

    if (!normalizedSessionId || !messageId || !remoteLid) {
        return;
    }

    const recoveryKey = `${normalizedSessionId}:${messageId}`;
    const currentEntry = pendingLidResolutionRecoveries.get(recoveryKey);
    if (currentEntry && Number(currentEntry?.attempt || 0) >= Number(attempt || 0)) {
        return;
    }
    if (currentEntry?.timer) {
        clearTimeout(currentEntry.timer);
    }

    const safeAttempt = Math.max(1, Number(attempt) || 1);
    const delayMs = getLidResolutionRecoveryDelayMs(safeAttempt);
    const timer = setTimeout(async () => {
        try {
            const recovered = await runLidResolutionRecovery(normalizedSessionId, rawMessage, safeAttempt);
            if (recovered) {
                pendingLidResolutionRecoveries.delete(recoveryKey);
                return;
            }

            if (safeAttempt < LID_RESOLUTION_RECOVERY_MAX_ATTEMPTS) {
                scheduleLidResolutionRecovery(normalizedSessionId, rawMessage, safeAttempt + 1);
                return;
            }

            pendingLidResolutionRecoveries.delete(recoveryKey);
            console.warn(`[${normalizedSessionId}] Falha ao resolver JID @lid apos ${safeAttempt} tentativa(s) (${messageId})`);
        } catch (error) {
            console.warn(`[${normalizedSessionId}] Erro na recuperacao de JID @lid (${messageId}):`, error.message);
            pendingLidResolutionRecoveries.delete(recoveryKey);
        }
    }, delayMs);

    pendingLidResolutionRecoveries.set(recoveryKey, {
        timer,
        attempt: safeAttempt,
        messageId,
        remoteLid
    });
    console.log(`[${normalizedSessionId}] Agendada resolucao de JID @lid (${messageId}) tentativa ${safeAttempt}/${LID_RESOLUTION_RECOVERY_MAX_ATTEMPTS} em ${delayMs}ms`);
}

async function runLidResolutionRecovery(sessionId, rawMessage = {}, attempt = 1) {
    const normalizedSessionId = sanitizeSessionId(sessionId);
    const messageId = String(rawMessage?.key?.id || '').trim();
    const remoteLid = normalizeLidJid(rawMessage?.key?.remoteJid);
    if (!normalizedSessionId || !messageId || !remoteLid) return false;

    const existing = await Message.findByMessageId(messageId);
    if (existing) return true;

    const runtimeSession = sessions.get(normalizedSessionId);
    if (runtimeSession?.socket) {
        await triggerChatSync(normalizedSessionId, runtimeSession.socket, runtimeSession.store, 0);
    }

    const sessionPhone = getSessionPhone(normalizedSessionId);
    registerMessageJidAliases(rawMessage, sessionPhone);
    const resolvedJid = resolveMessageJid(rawMessage, sessionPhone);
    if (!resolvedJid || !isUserJid(resolvedJid)) {
        return false;
    }

    console.log(`[${normalizedSessionId}] JID @lid resolvido na tentativa ${attempt}: ${remoteLid} -> ${resolvedJid}`);
    await processIncomingMessage(normalizedSessionId, rawMessage);
    return true;
}

function scheduleCiphertextRecovery(sessionId, rawMessage = {}, attempt = 1) {
    const normalizedSessionId = sanitizeSessionId(sessionId);
    const messageId = String(rawMessage?.key?.id || '').trim();
    const remoteJid = resolveUserJidFromRawMessage(rawMessage);

    if (!normalizedSessionId || !messageId || !remoteJid || !isUserJid(remoteJid)) {
        return;
    }

    const recoveryKey = `${normalizedSessionId}:${messageId}`;
    const currentEntry = pendingCiphertextRecoveries.get(recoveryKey);
    if (currentEntry && Number(currentEntry?.attempt || 0) >= Number(attempt || 0)) {
        return;
    }
    if (currentEntry?.timer) {
        clearTimeout(currentEntry.timer);
    }

    const safeAttempt = Math.max(1, Number(attempt) || 1);
    const delayMs = getCiphertextRecoveryDelayMs(safeAttempt);

    const timer = setTimeout(async () => {
        try {
            const recovered = await runCiphertextRecovery(normalizedSessionId, rawMessage, safeAttempt);
            if (recovered) {
                pendingCiphertextRecoveries.delete(recoveryKey);
                return;
            }

            if (safeAttempt < FLOW_RECOVERY_MAX_ATTEMPTS) {
                scheduleCiphertextRecovery(normalizedSessionId, rawMessage, safeAttempt + 1);
                return;
            }

            pendingCiphertextRecoveries.delete(recoveryKey);
            console.warn(`[${normalizedSessionId}] Recuperacao de mensagem cifrada atingiu limite de tentativas (${messageId})`);
        } catch (error) {
            console.warn(`[${normalizedSessionId}] Falha na recuperacao de mensagem cifrada (${messageId}):`, error.message);
            pendingCiphertextRecoveries.delete(recoveryKey);
        }
    }, delayMs);

    pendingCiphertextRecoveries.set(recoveryKey, {
        timer,
        attempt: safeAttempt,
        remoteJid,
        messageId
    });
    console.log(`[${normalizedSessionId}] Agendada recuperacao de mensagem cifrada (${messageId}) tentativa ${safeAttempt}/${FLOW_RECOVERY_MAX_ATTEMPTS} em ${delayMs}ms`);
}

async function runCiphertextRecovery(sessionId, rawMessage = {}, attempt = 1) {
    const remoteJid = resolveUserJidFromRawMessage(rawMessage);
    if (!remoteJid || !isUserJid(remoteJid)) return false;

    if (attempt > 1) {
        const runtimeSession = sessions.get(sessionId);
        if (runtimeSession?.socket) {
            triggerChatSync(sessionId, runtimeSession.socket, runtimeSession.store, 0);
        }
    }

    const remotePhone = extractNumber(remoteJid);
    const sessionOwnerUserId = await resolveSessionOwnerUserId(sessionId);
    let lead = await Lead.findByJid(remoteJid, { owner_user_id: sessionOwnerUserId || undefined });
    if (!lead && remotePhone) {
        lead = await Lead.findByPhone(remotePhone, { owner_user_id: sessionOwnerUserId || undefined });
    }
    if (!lead?.id) return false;

    let conversation = await Conversation.findByLeadId(lead.id, sessionId);
    if (!conversation?.id) return false;
    const baselineMessageId = Math.max(0, Number(conversation?.last_message_id || 0) || 0);

    const backfillResult = await backfillConversationMessagesFromStore({
        sessionId,
        conversation,
        lead,
        contactJid: remoteJid,
        limit: 40
    });

    if ((backfillResult?.inserted || 0) <= 0) return false;
    const recoveredMessages = await processRecoveredStoreBackfillMessages({
        sessionId,
        conversation,
        lead,
        sinceMessageId: baselineMessageId,
        maxToProcess: 1,
        requireStoreBackfillSource: true,
        logSource: 'ciphertext-recovery'
    });

    return (recoveredMessages?.processed || 0) > 0;
}



const businessHoursSettingsCacheByOwner = new Map();
const outsideHoursAutoReplyTracker = new Map();

function normalizeBusinessHoursTime(value, fallback) {
    const raw = String(value || '').trim();
    if (!raw) return fallback;
    const match = raw.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return fallback;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (!Number.isInteger(hour) || !Number.isInteger(minute)) return fallback;
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return fallback;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function parseBusinessHoursMinutes(time, fallbackMinutes) {
    const match = String(time || '').match(/^(\d{2}):(\d{2})$/);
    if (!match) return fallbackMinutes;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (!Number.isInteger(hour) || !Number.isInteger(minute)) return fallbackMinutes;
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return fallbackMinutes;
    return (hour * 60) + minute;
}

function parseBusinessHoursBoolean(value, fallback = false) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value > 0;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
        if (['false', '0', 'no', 'off'].includes(normalized)) return false;
    }
    return fallback;
}

function normalizeBusinessHoursSettings(raw = {}) {
    const start = normalizeBusinessHoursTime(raw.start, '08:00');
    const end = normalizeBusinessHoursTime(raw.end, '18:00');

    return {
        enabled: parseBusinessHoursBoolean(raw.enabled, false),
        start,
        end,
        startMinutes: parseBusinessHoursMinutes(start, 8 * 60),
        endMinutes: parseBusinessHoursMinutes(end, 18 * 60),
        autoReplyMessage: String(raw.autoReplyMessage || DEFAULT_BUSINESS_HOURS_AUTO_REPLY).trim() || DEFAULT_BUSINESS_HOURS_AUTO_REPLY
    };
}

function parseBusinessHoursBySession(raw = {}) {
    let parsed = raw;
    if (typeof parsed === 'string') {
        const rawValue = parsed.trim();
        if (!rawValue) return {};
        try {
            parsed = JSON.parse(rawValue);
        } catch {
            return {};
        }
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {};
    }

    const result = {};
    for (const [rawSessionId, rawSettings] of Object.entries(parsed)) {
        const sessionId = sanitizeSessionId(rawSessionId);
        if (!sessionId || !rawSettings || typeof rawSettings !== 'object' || Array.isArray(rawSettings)) {
            continue;
        }

        const normalized = normalizeBusinessHoursSettings(rawSettings);
        result[sessionId] = {
            enabled: normalized.enabled,
            start: normalized.start,
            end: normalized.end,
            autoReplyMessage: normalized.autoReplyMessage
        };
    }

    return result;
}

function isWithinBusinessHours(settings, date = new Date()) {
    if (!settings?.enabled) return true;
    const nowMinutes = (date.getHours() * 60) + date.getMinutes();
    const start = Number(settings.startMinutes);
    const end = Number(settings.endMinutes);

    if (!Number.isFinite(start) || !Number.isFinite(end)) return true;
    if (start === end) return true;

    if (start < end) {
        return nowMinutes >= start && nowMinutes < end;
    }

    return nowMinutes >= start || nowMinutes < end;
}

function shouldSendOutsideHoursAutoReply(conversationId) {
    const key = String(conversationId || '');
    if (!key) return true;
    const now = Date.now();
    const lastSentAt = Number(outsideHoursAutoReplyTracker.get(key) || 0);
    if (lastSentAt && (now - lastSentAt) < OUTSIDE_HOURS_AUTO_REPLY_COOLDOWN_MS) {
        return false;
    }
    return true;
}

function markOutsideHoursAutoReplySent(conversationId) {
    const key = String(conversationId || '');
    if (!key) return;

    const now = Date.now();
    outsideHoursAutoReplyTracker.set(key, now);

    if (outsideHoursAutoReplyTracker.size > 5000) {
        for (const [entryKey, entryTime] of outsideHoursAutoReplyTracker.entries()) {
            if ((now - Number(entryTime || 0)) > (OUTSIDE_HOURS_AUTO_REPLY_COOLDOWN_MS * 4)) {
                outsideHoursAutoReplyTracker.delete(entryKey);
            }
        }
    }
}

function buildBusinessHoursCacheKey(ownerUserId = null, sessionId = '') {
    const normalizedOwnerUserId = normalizeOwnerUserId(ownerUserId);
    const normalizedSessionId = sanitizeSessionId(sessionId);
    const ownerKey = normalizedOwnerUserId ? `owner:${normalizedOwnerUserId}` : 'global';
    return normalizedSessionId ? `${ownerKey}:session:${normalizedSessionId}` : ownerKey;
}

function invalidateBusinessHoursSettingsCache(ownerUserId = null) {
    const normalizedOwnerUserId = normalizeOwnerUserId(ownerUserId);
    if (normalizedOwnerUserId) {
        const ownerKeyPrefix = `owner:${normalizedOwnerUserId}`;
        for (const cacheKey of businessHoursSettingsCacheByOwner.keys()) {
            if (cacheKey === ownerKeyPrefix || cacheKey.startsWith(`${ownerKeyPrefix}:session:`)) {
                businessHoursSettingsCacheByOwner.delete(cacheKey);
            }
        }
        return;
    }

    businessHoursSettingsCacheByOwner.clear();
}

async function getBusinessHoursSettings(ownerUserId = null, forceRefresh = false, sessionId = '') {
    // Compatibilidade: chamadas antigas getBusinessHoursSettings(true)
    if (typeof ownerUserId === 'boolean' && forceRefresh === false) {
        forceRefresh = ownerUserId;
        ownerUserId = null;
    }

    const normalizedOwnerUserId = normalizeOwnerUserId(ownerUserId);
    const normalizedSessionId = sanitizeSessionId(sessionId);
    const cacheKey = buildBusinessHoursCacheKey(normalizedOwnerUserId, normalizedSessionId);
    const now = Date.now();
    const cached = businessHoursSettingsCacheByOwner.get(cacheKey);
    if (!forceRefresh && cached && (now - Number(cached.cachedAt || 0)) < BUSINESS_HOURS_CACHE_TTL_MS) {
        return cached.value;
    }

    const [scopedEnabledValue, scopedStartValue, scopedEndValue, scopedAutoReplyMessageValue, scopedBySessionValue, legacyEnabledValue, legacyStartValue, legacyEndValue, legacyAutoReplyMessageValue, legacyBySessionValue] = await Promise.all([
        Settings.get(buildScopedSettingsKey('business_hours_enabled', normalizedOwnerUserId || null)),
        Settings.get(buildScopedSettingsKey('business_hours_start', normalizedOwnerUserId || null)),
        Settings.get(buildScopedSettingsKey('business_hours_end', normalizedOwnerUserId || null)),
        Settings.get(buildScopedSettingsKey('business_hours_auto_reply_message', normalizedOwnerUserId || null)),
        Settings.get(buildScopedSettingsKey('business_hours_by_session', normalizedOwnerUserId || null)),
        normalizedOwnerUserId ? Promise.resolve(null) : Settings.get('business_hours_enabled'),
        normalizedOwnerUserId ? Promise.resolve(null) : Settings.get('business_hours_start'),
        normalizedOwnerUserId ? Promise.resolve(null) : Settings.get('business_hours_end'),
        normalizedOwnerUserId ? Promise.resolve(null) : Settings.get('business_hours_auto_reply_message'),
        normalizedOwnerUserId ? Promise.resolve(null) : Settings.get('business_hours_by_session')
    ]);

    const businessHoursBySession = parseBusinessHoursBySession(
        scopedBySessionValue ?? legacyBySessionValue ?? {}
    );
    const sessionOverride = normalizedSessionId ? businessHoursBySession[normalizedSessionId] : null;

    const normalized = normalizeBusinessHoursSettings({
        enabled: sessionOverride?.enabled ?? scopedEnabledValue ?? legacyEnabledValue,
        start: sessionOverride?.start ?? scopedStartValue ?? legacyStartValue,
        end: sessionOverride?.end ?? scopedEndValue ?? legacyEndValue,
        autoReplyMessage: sessionOverride?.autoReplyMessage ?? scopedAutoReplyMessageValue ?? legacyAutoReplyMessageValue
    });

    businessHoursSettingsCacheByOwner.set(cacheKey, {
        value: normalized,
        cachedAt: now
    });

    return normalized;
}



/**

 * Processar mensagem recebida

 */

async function processIncomingMessage(sessionId, msg, options = {}) {

    if (isGroupMessage(msg)) return;
    if (!msg?.message) return;
    const messageSource = String(options?.source || 'live').trim().toLowerCase();
    const preserveUnreadCount = options?.preserveUnreadCount === true;
    const skipInboundAutomation = options?.skipInboundAutomation === true;
    const skipWebhook = options?.skipWebhook === true;
    const skipRealtimeEmit = options?.skipRealtimeEmit === true;
    const sessionDisplayName = getSessionDisplayName(sessionId);
    const sessionPhone = getSessionPhone(sessionId);
    const sessionOwnerUserId = await resolveSessionOwnerUserId(sessionId);
    registerMessageJidAliases(msg, sessionPhone);

    const fromRaw = msg.key.remoteJid;
    const fromRawNormalized = normalizeUserJidCandidate(fromRaw) || fromRaw;
    const sessionDigits = normalizePhoneDigits(sessionPhone);

    let from = resolveMessageJid(msg, sessionPhone);
    const contentForRouting = unwrapMessageContent(msg.message);
    let isFromMe = Boolean(msg?.key?.fromMe);

    // Alguns eventos podem chegar com fromMe=false mesmo sendo envio proprio
    // (sincronizacao entre dispositivos). Usa pistas de sender/participant para corrigir.
    if (!isFromMe && sessionDigits) {
        const selfHintCandidates = [
            msg?.key?.senderPn,
            msg?.key?.participantPn,
            msg?.key?.participant,
            msg?.participant,
            msg?.message?.extendedTextMessage?.contextInfo?.participant,
            contentForRouting?.extendedTextMessage?.contextInfo?.participant
        ].filter(Boolean);

        const hintedSelf = selfHintCandidates
            .map((candidate) => normalizeUserJidCandidate(candidate) || normalizeJid(candidate))
            .find((candidate) => {
                const candidateDigits = normalizePhoneDigits(extractNumber(candidate));
                return Boolean(candidateDigits) && isSelfPhone(candidateDigits, sessionDigits);
            });

        if (hintedSelf) {
            isFromMe = true;
        }
    }

    const fromRawDigits = normalizePhoneDigits(extractNumber(fromRawNormalized));
    const isFromRawUser = isUserJid(fromRawNormalized);
    const isFromRawSelf = isSelfPhone(fromRawDigits, sessionDigits);

    // Em mensagens recebidas, quando o remoteJid jÃƒÂ¡ vem como usuÃƒÂ¡rio vÃƒÂ¡lido
    // (e nÃƒÂ£o ÃƒÂ© self), ele ÃƒÂ© a melhor fonte para evitar roteamento incorreto.
    if (!isFromMe && isFromRawUser && !isFromRawSelf) {
        from = fromRawNormalized;
    }

    // Em mensagens enviadas pelo proprio celular, prioriza o destino explicito.
    if (isFromMe) {
        const outgoingCandidates = [
            msg?.message?.deviceSentMessage?.destinationJid,
            msg?.key?.senderPn,
            msg?.key?.participantPn,
            msg?.key?.remoteJid,
            msg?.key?.participant,
            msg?.participant,
            msg?.message?.extendedTextMessage?.contextInfo?.participant,
            contentForRouting?.extendedTextMessage?.contextInfo?.participant
        ].filter(Boolean);

        const outgoingTarget = outgoingCandidates
            .map((candidate) => normalizeUserJidCandidate(candidate) || normalizeJid(candidate))
            .find((candidate) => {
            if (!candidate || !isUserJid(candidate)) return false;
            const candidateDigits = normalizePhoneDigits(extractNumber(candidate));
            return !isSelfPhone(candidateDigits, sessionDigits);
        });

        if (outgoingTarget) {
            from = outgoingTarget;
        }
    }

    from = normalizeUserJidCandidate(from) || normalizeJid(from) || from;
    if ((!from || !isUserJid(from)) && !isFromMe) {
        const hintedJid = normalizeUserJidCandidate(msg?.key?.senderPn)
            || normalizeUserJidCandidate(msg?.key?.participantPn);
        if (hintedJid) {
            from = hintedJid;
        }
    }

    if (!from || !isUserJid(from)) {
        const unresolvedLid = normalizeLidJid(fromRaw);
        if (!isFromMe && unresolvedLid) {
            scheduleLidResolutionRecovery(sessionId, msg, 1);
            console.warn(
                `[${sessionId}] Mensagem aguardando resolucao de JID @lid: `
                + `remoteJid=${fromRaw || 'n/a'} senderPn=${msg?.key?.senderPn || 'n/a'} participantPn=${msg?.key?.participantPn || 'n/a'}`
            );
            return;
        }

        console.warn(
            `[${sessionId}] Ignorando mensagem sem JID de usuario resolvido: `
            + `remoteJid=${fromRaw || 'n/a'} senderPn=${msg?.key?.senderPn || 'n/a'} participantPn=${msg?.key?.participantPn || 'n/a'}`
        );
        return;
    }

    let resolvedDigits = normalizePhoneDigits(extractNumber(from));
    let isFromResolvedSelf = isSelfPhone(resolvedDigits, sessionDigits);

    if (isFromResolvedSelf) {
        const fallbackCandidates = [
            msg?.message?.deviceSentMessage?.destinationJid,
            msg?.key?.senderPn,
            msg?.key?.participantPn,
            msg?.key?.remoteJid,
            msg?.key?.participant,
            msg?.participant,
            msg?.message?.extendedTextMessage?.contextInfo?.participant,
            contentForRouting?.extendedTextMessage?.contextInfo?.participant
        ].filter(Boolean);

        const fallbackJid = fallbackCandidates
            .map((candidate) => normalizeUserJidCandidate(candidate) || normalizeJid(candidate))
            .find((candidate) => {
            if (!candidate || !isUserJid(candidate)) return false;
            const candidateDigits = normalizePhoneDigits(extractNumber(candidate));
            return !isSelfPhone(candidateDigits, sessionDigits);
        });

        if (fallbackJid) {
            from = fallbackJid;
            resolvedDigits = normalizePhoneDigits(extractNumber(from));
            isFromResolvedSelf = isSelfPhone(resolvedDigits, sessionDigits);
        } else if (!isFromMe) {
            console.warn(`[${sessionId}] Ignorando inbound ambiguo roteado para self: ${fromRaw || 'sem-remoteJid'}`);
            return;
        }
    }

    const content = contentForRouting;
    const interactiveSelection = extractInteractiveSelectionFromMessageContent(content);
    let text = extractTextFromMessageContent(content);
    let mediaType = detectMediaTypeFromMessageContent(content);
    let persistedMedia = null;

    // Em respostas interativas, alguns clientes preenchem somente id/descricao.
    if (!text && mediaType === 'text') {
        const fallbackSelectionText = normalizeText(
            interactiveSelection?.text
            || interactiveSelection?.id
            || interactiveSelection?.description
            || ''
        );
        if (fallbackSelectionText) {
            text = fallbackSelectionText;
        }
    }

    // Ignora upserts de controle/protocolo sem conteudo renderizavel.
    if (!text && mediaType === 'text') return;

    if (!text && mediaType !== 'text') {
        text = previewForMedia(mediaType);
    }
    text = normalizeText(text);
    const pushName = normalizeText(msg.pushName || '');

    

    if (fromRaw && from && fromRaw !== from && !isFromRawSelf && !isFromResolvedSelf) {

        const resolvedPhone = isUserJid(from) ? extractNumber(from) : null;

        const primary = await Lead.findByJid(from, { owner_user_id: sessionOwnerUserId || undefined })
            || (resolvedPhone ? await Lead.findByPhone(resolvedPhone, { owner_user_id: sessionOwnerUserId || undefined }) : null);

        const duplicate = await Lead.findByJid(fromRaw, { owner_user_id: sessionOwnerUserId || undefined })
            || await Lead.findByPhone(extractNumber(fromRaw), { owner_user_id: sessionOwnerUserId || undefined });

        if (primary && duplicate && primary.id !== duplicate.id) {

            await mergeLeads(primary, duplicate);

        } else if (!primary && duplicate && resolvedPhone) {

            await updateLeadIdentity(duplicate, from, resolvedPhone);

        } else if (primary && !duplicate && resolvedPhone) {

            await updateLeadIdentity(primary, from, resolvedPhone);

        }

    }



    const phone = extractNumber(from);

    if (!phone) {

        console.warn(`[${sessionId}] Ignorando mensagem com JID invalido: ${from}`);

        return;

    }

    const phoneDigits = normalizePhoneDigits(phone);

    const isSelfChat = isSelfPhone(phoneDigits, sessionDigits);

    const safeSessionName = normalizeText(sessionDisplayName || '');

    const selfName = safeSessionName ? `${safeSessionName} (VocÃª)` : 'VocÃª';

    

    // Buscar ou criar lead

    let leadResult;
    try {
        leadResult = await Lead.findOrCreate({

            phone,

            jid: from,

            name: isSelfChat ? selfName : (!isFromMe ? (pushName || phone) : undefined),

            source: 'whatsapp',
            assigned_to: sessionOwnerUserId || undefined,
            owner_user_id: sessionOwnerUserId || undefined

        });
    } catch (error) {
        if (planLimitsService.isPlanLimitError(error)) {
            console.warn(`[${sessionId}] ${error.message}`);
            return;
        }
        throw error;
    }
    let lead = leadResult.lead;
    const leadCreated = leadResult.created;

    if (!isSelfChat) {
        const leadDigits = normalizePhoneDigits(lead?.phone);
        const shouldSyncIdentity =
            !!lead &&
            (lead.jid !== from || !leadDigits || leadDigits !== phoneDigits);

        if (shouldSyncIdentity) {
            lead = await updateLeadIdentity(lead, from, phone);
        }
    }

    if (!sanitizeAutoName(lead?.name)) {
        const manualSnapshotName = resolveManualNameSnapshotFromLead(lead);
        if (manualSnapshotName) {
            await Lead.update(lead.id, { name: manualSnapshotName });
            lead.name = manualSnapshotName;
        }
    }



    if (isSelfChat) {

        if (!isLeadNameManuallyLocked(lead) && (!lead.name || lead.name !== selfName)) {

            await Lead.update(lead.id, { name: selfName });

        }

    } else if (!isFromMe && pushName) {
        if (shouldAutoUpdateLeadName(lead, lead.phone || phone, sessionDisplayName)) {
            await Lead.update(lead.id, { name: pushName });
        }
    }

    if (!isSelfChat && lead?.id) {
        syncLeadAvatarFromWhatsApp({
            sessionId,
            lead,
            jid: from
        }).catch((error) => {
            console.warn(`[${sessionId}] Falha ao sincronizar avatar do lead ${lead.id}:`, error.message);
        });
    }

    

    // Buscar ou criar conversa

    const { conversation, created: convCreated } = await Conversation.findOrCreate({

        lead_id: lead.id,

        session_id: sessionId,
        assigned_to: sessionOwnerUserId || undefined

    });



    const existingMessage = await Message.findByMessageId(msg.key.id);

    if (existingMessage) {

        return;

    }

    persistedMedia = await persistIncomingMedia({
        sessionId,
        messageId: msg?.key?.id,
        content,
        mediaType,
        sourceMessage: msg
    });

    

    // Salvar mensagem

    const normalizedStatus = isFromMe ? 'sent' : 'delivered';

    const messageData = {

        message_id: msg.key.id,

        conversation_id: conversation.id,

        lead_id: lead.id,

        sender_type: isFromMe ? 'agent' : 'lead',

        content: text,

        content_encrypted: encryptMessage(text),

        media_type: mediaType,
        media_url: persistedMedia?.url || null,
        media_mime_type: persistedMedia?.mimetype || null,
        media_filename: persistedMedia?.filename || null,

        status: normalizedStatus,

        is_from_me: isFromMe,

        sent_at: msg.messageTimestamp ? new Date(Number(msg.messageTimestamp) * 1000).toISOString() : new Date().toISOString(),
        metadata: messageSource !== 'live'
            ? { source: messageSource }
            : undefined

    };

    

    const savedMessage = await Message.create(messageData);

    const messageTimestampIso = messageData.sent_at || new Date().toISOString();

    // Atualizar conversa

    if (!isFromMe) {

        if (!preserveUnreadCount) {
            await Conversation.incrementUnread(conversation.id);
        }

        await Conversation.touch(conversation.id, savedMessage.id, messageTimestampIso);

        await Lead.update(lead.id, { last_message_at: messageTimestampIso });

        await Campaign.refreshMetricsByLead(lead.id);

    } else {

        await Conversation.touchAndMarkAsRead(conversation.id, savedMessage.id, messageTimestampIso);

    }

    

    // Emitir para clientes

    const messageForClient = {

        id: savedMessage.id,

        messageId: msg.key.id,

        sessionId,

        from,

        fromNumber: phone,

        text,

        isFromMe,

        mediaType,
        mediaUrl: persistedMedia?.url || null,
        mediaMimeType: persistedMedia?.mimetype || null,
        mediaFilename: persistedMedia?.filename || null,

        timestamp: msg.messageTimestamp ? Number(msg.messageTimestamp) * 1000 : Date.now(),

        pushName: msg.pushName || '',

        status: normalizedStatus,

        leadId: lead.id,

        leadName: lead.name,

        conversationId: conversation.id

    };

    

    const session = sessions.get(sessionId);

    if (!skipRealtimeEmit && session?.clientSocket) {
        session.clientSocket.emit('message', messageForClient);
    }

    if (!skipRealtimeEmit) {
        emitToOwnerScope(sessionOwnerUserId || null, 'new-message', messageForClient);
    }

    // Webhook e automacoes de entrada
    if (!isFromMe) {
        if (!skipWebhook) {
            webhookService.trigger('message.received', {
                message: messageForClient,
                lead: { id: lead.id, name: lead.name, phone: lead.phone }
            }, {
                ownerUserId: Number(sessionOwnerUserId || lead?.owner_user_id || 0) || undefined
            });
        }

        if (!skipInboundAutomation) {
            console.log(`[${sessionId}] ?? Mensagem de ${lead.name || phone}: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);

            const businessHoursSettings = await getBusinessHoursSettings(sessionOwnerUserId || null, false, sessionId);
            const isOutsideBusinessHours = businessHoursSettings.enabled && !isWithinBusinessHours(businessHoursSettings);

            if (isOutsideBusinessHours && !isSelfChat) {
                const autoReplyText = String(businessHoursSettings.autoReplyMessage || '').trim();

                if (autoReplyText && shouldSendOutsideHoursAutoReply(conversation.id)) {
                    try {
                        await sendMessage(sessionId, phone, autoReplyText, 'text', {
                            conversationId: conversation.id
                        });
                        markOutsideHoursAutoReplySent(conversation.id);
                    } catch (autoReplyError) {
                        console.error(`[${sessionId}] Erro ao enviar resposta fora do horario:`, autoReplyError.message);
                    }
                }

                return;
            }

            // Processar fluxo de automacao
            if (conversation.is_bot_active) {
                conversation.created = convCreated;

                await flowService.processIncomingMessage(
                    {
                        text,
                        mediaType,
                        selectionId: interactiveSelection?.id || '',
                        selectionText: interactiveSelection?.text || ''
                    },
                    lead,
                    conversation
                );
            }

            await scheduleAutomations({
                event: AUTOMATION_EVENT_TYPES.MESSAGE_RECEIVED,
                sessionId,
                text,
                mediaType,
                lead,
                conversation,
                messageTimestampMs: Date.parse(messageTimestampIso) || Date.now(),
                leadCreated,
                conversationCreated: convCreated
            });
        }
    }

}



/**

 * Normalizar seções de menu/lista para envio WhatsApp
 */
function normalizeListSectionsForSend(rawSections, lead, messageText = '') {
    const sourceSections = Array.isArray(rawSections) ? rawSections : [];
    if (sourceSections.length === 0) return [];

    const normalizedSections = [];
    let totalRows = 0;

    for (const section of sourceSections) {
        if (totalRows >= 10) break;

        const rawRows = Array.isArray(section?.rows) ? section.rows : [];
        const rows = [];

        for (const row of rawRows) {
            if (totalRows >= 10) break;

            const rowId = normalizeText(row?.rowId || row?.id || '');
            const rawTitle = String(row?.title || row?.text || '').trim();
            if (!rawTitle) continue;

            const title = normalizeText(applyLeadTemplate(rawTitle, lead, { mensagem: messageText || rawTitle }));
            if (!title) continue;

            const rawDescription = String(row?.description || '').trim();
            const description = rawDescription
                ? normalizeText(applyLeadTemplate(rawDescription, lead, { mensagem: rawDescription }))
                : '';

            rows.push({
                rowId: rowId || `option-${totalRows + 1}`,
                title,
                description: description || undefined
            });
            totalRows += 1;
        }

        if (rows.length === 0) continue;

        const rawSectionTitle = String(section?.title || '').trim();
        const sectionTitle = rawSectionTitle
            ? normalizeText(applyLeadTemplate(rawSectionTitle, lead, { mensagem: messageText || rawSectionTitle }))
            : '';

        normalizedSections.push({
            title: sectionTitle || `Opcoes ${normalizedSections.length + 1}`,
            rows
        });
    }

    return normalizedSections;
}

function normalizeButtonUrlForSend(value) {
    const raw = normalizeText(String(value || '').trim());
    if (!raw) return '';

    const normalized = /^https?:\/\//i.test(raw)
        ? raw
        : `https://${raw}`;

    try {
        const parsed = new URL(normalized);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return '';
        }
        return parsed.toString();
    } catch (_) {
        return '';
    }
}

function isTruthyEnvFlag(value, fallback = false) {
    if (value === undefined || value === null || value === '') return fallback;
    const normalized = String(value).trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'on' || normalized === 'yes';
}

function buildInlineListFallbackText(description = '', sections = []) {
    const prompt = String(description || '').trim() || 'Escolha uma opcao no menu abaixo:';
    const lines = [prompt, ''];
    let index = 1;

    for (const section of (Array.isArray(sections) ? sections : [])) {
        const rows = Array.isArray(section?.rows) ? section.rows : [];
        for (const row of rows) {
            const title = String(row?.title || '').trim();
            if (!title) continue;
            lines.push(`${index}. ${title}`);
            index += 1;
        }
    }

    if (index > 1) {
        lines.push('');
        lines.push('Responda com o numero da opcao.');
    }

    return lines.join('\n').trim();
}

async function sendListMessageWithNativeRelay(session, jid, {
    description = '',
    title = '',
    footer = '',
    buttonText = 'Ver Menu',
    sections = []
} = {}) {
    const baileys = await baileysLoader.getBaileys();
    const listTypeSingleSelect = baileys?.proto?.Message?.ListMessage?.ListType?.SINGLE_SELECT || 1;

    const normalizedSections = (Array.isArray(sections) ? sections : [])
        .map((section, sectionIndex) => {
            const rows = (Array.isArray(section?.rows) ? section.rows : [])
                .map((row, rowIndex) => {
                    const rowTitle = String(row?.title || '').trim();
                    if (!rowTitle) return null;

                    const rowId = String(row?.rowId || row?.id || '').trim() || `option-${sectionIndex + 1}-${rowIndex + 1}`;
                    const rowDescription = String(row?.description || '').trim();

                    return {
                        title: rowTitle,
                        rowId,
                        description: rowDescription || undefined
                    };
                })
                .filter(Boolean);

            if (rows.length === 0) return null;

            return {
                title: String(section?.title || '').trim() || `Opcoes ${sectionIndex + 1}`,
                rows
            };
        })
        .filter(Boolean);

    if (normalizedSections.length === 0) {
        throw new Error('Mensagem de menu sem opcoes validas');
    }

    const outboundMessage = baileys.generateWAMessageFromContent(jid, {
        listMessage: {
            title: title || undefined,
            description: description || 'Selecione uma opcao:',
            buttonText: buttonText || 'Ver Menu',
            footerText: footer || undefined,
            listType: listTypeSingleSelect,
            sections: normalizedSections
        }
    }, {
        userJid: session?.socket?.user?.id || undefined
    });

    await session.socket.relayMessage(jid, outboundMessage.message, {
        messageId: outboundMessage.key.id
    });

    return outboundMessage;
}

/**

 * Enviar mensagem

 */

async function sendMessage(sessionId, to, message, type = 'text', options = {}) {

    const session = sessions.get(sessionId);

    

    const dispatchState = getSessionDispatchState(sessionId);
    if (!session || !dispatchState.available) {
        if (session && !session.isConnected && !session.reconnecting) {
            scheduleRuntimeSessionReconnect(sessionId, session);
        }
        throw buildSessionUnavailableError(dispatchState, 'Sessao nao esta conectada');
    }
    enforceSessionSendRateLimit(sessionId, session);

    

    const jid = formatJid(to);

    const normalizedPhone = extractNumber(jid);
    const requestedAssignee = Number(options?.assigned_to);
    const sessionOwnerUserId = await resolveSessionOwnerUserId(sessionId);
    const assignedTo = Number.isInteger(requestedAssignee) && requestedAssignee > 0
        ? requestedAssignee
        : (sessionOwnerUserId || null);

    

    // Buscar ou criar lead

    const { lead } = await Lead.findOrCreate({

        phone: normalizedPhone,

        jid,

        source: 'manual',
        assigned_to: assignedTo,
        owner_user_id: sessionOwnerUserId || undefined

    });

    

    // Buscar ou criar conversa
    let conversation = null;

    const requestedConversationId = Number(options?.conversationId);
    if (Number.isInteger(requestedConversationId) && requestedConversationId > 0) {
        const existingConversation = await Conversation.findById(requestedConversationId);
        if (!existingConversation) {
            throw new Error('Conversa informada nao encontrada');
        }

        if (Number(existingConversation.lead_id) !== Number(lead.id)) {
            throw new Error('Conversa informada nao corresponde ao contato de destino');
        }

        const existingConversationSessionId = sanitizeSessionId(existingConversation.session_id);
        if (existingConversationSessionId && existingConversationSessionId !== sessionId) {
            throw new Error('Conversa informada pertence a outra conta WhatsApp');
        }

        if (sessionOwnerUserId && lead?.owner_user_id && Number(lead.owner_user_id) !== Number(sessionOwnerUserId)) {
            throw new Error('Lead nao pertence ao mesmo owner da sessao informada');
        }

        if (assignedTo && existingConversation.assigned_to && Number(existingConversation.assigned_to) !== assignedTo) {
            throw new Error('Sem permissao para enviar nesta conversa');
        }

        conversation = existingConversation;
    }

    if (!conversation) {
        const conversationResult = await Conversation.findOrCreate({
            lead_id: lead.id,
            session_id: sessionId,
            assigned_to: assignedTo
        });
        conversation = conversationResult.conversation;
    }

    if (conversation && assignedTo && !conversation.assigned_to) {
        await Conversation.update(conversation.id, { assigned_to: assignedTo });
        conversation = await Conversation.findById(conversation.id);
    }

    const normalizedType = String(type || 'text').trim().toLowerCase() || 'text';
    const persistedMediaType = (normalizedType === 'list' || normalizedType === 'button_url') ? 'text' : normalizedType;
    const isTextLikeMessage = normalizedType === 'text' || normalizedType === 'list' || normalizedType === 'button_url';
    const isMediaWithUrl = normalizedType === 'image'
        || normalizedType === 'video'
        || normalizedType === 'document'
        || normalizedType === 'audio';

    const renderedTextMessage = isTextLikeMessage
        ? applyLeadTemplate(message, lead, { mensagem: message || '' })
        : message;
    const renderedCaption = !isTextLikeMessage && String(options.caption || '').trim()
        ? applyLeadTemplate(options.caption || '', lead, { mensagem: options.caption || '' })
        : (options.caption || '');

    

    let result;

    try {
        if (normalizedType === 'text') {

            result = await session.socket.sendMessage(jid, { text: renderedTextMessage });

        } else if (normalizedType === 'list') {
            const sectionsInput = options.listSections || options.sections || [];
            const sections = normalizeListSectionsForSend(sectionsInput, lead, renderedTextMessage);
            if (sections.length === 0) {
                throw new Error('Mensagem de menu sem opcoes validas');
            }

            const listButtonTextRaw = String(options.listButtonText || options.buttonText || '').trim();
            const listButtonText = listButtonTextRaw
                ? applyLeadTemplate(listButtonTextRaw, lead, { mensagem: listButtonTextRaw })
                : 'Ver Menu';
            const listTitleRaw = String(options.listTitle || options.title || '').trim();
            const listFooterRaw = String(options.listFooter || options.footer || '').trim();
            const listTitle = listTitleRaw
                ? applyLeadTemplate(listTitleRaw, lead, { mensagem: renderedTextMessage || listTitleRaw })
                : '';
            const listFooter = listFooterRaw
                ? applyLeadTemplate(listFooterRaw, lead, { mensagem: renderedTextMessage || listFooterRaw })
                : '';
            const fallbackText = buildInlineListFallbackText(
                renderedTextMessage || 'Selecione uma opcao:',
                sections
            );
            const interactiveListEnabled = isTruthyEnvFlag(
                process.env.WHATSAPP_INTERACTIVE_LIST_ENABLED,
                false
            );

            if (!interactiveListEnabled) {
                result = await session.socket.sendMessage(jid, {
                    text: fallbackText
                });
            } else {
                try {
                    result = await sendListMessageWithNativeRelay(session, jid, {
                        description: renderedTextMessage || 'Selecione uma opcao:',
                        title: listTitle,
                        footer: listFooter,
                        buttonText: listButtonText,
                        sections
                    });
                } catch (nativeListError) {
                    console.warn(
                        `[${sessionId}] Falha no envio de lista nativa (${nativeListError.message}). `
                        + 'Aplicando fallback de texto com opcoes.'
                    );
                    result = await session.socket.sendMessage(jid, {
                        text: fallbackText
                    });
                }
            }

        } else if (normalizedType === 'button_url') {
            const buttonTextRaw = String(options.buttonText || options.listButtonText || '').trim();
            const buttonText = buttonTextRaw
                ? applyLeadTemplate(buttonTextRaw, lead, { mensagem: buttonTextRaw })
                : 'Acessar site';
            const buttonUrlRaw = String(options.buttonUrl || options.url || '').trim();
            const buttonUrl = normalizeButtonUrlForSend(
                buttonUrlRaw
                    ? applyLeadTemplate(buttonUrlRaw, lead, { mensagem: renderedTextMessage || buttonUrlRaw })
                    : ''
            );
            if (!buttonUrl) {
                throw new Error('Mensagem com botao de link sem URL valida');
            }

            const buttonTitleRaw = String(options.buttonTitle || options.title || '').trim();
            const buttonFooterRaw = String(options.buttonFooter || options.footer || '').trim();
            const buttonTitle = buttonTitleRaw
                ? applyLeadTemplate(buttonTitleRaw, lead, { mensagem: renderedTextMessage || buttonTitleRaw })
                : '';
            const buttonFooter = buttonFooterRaw
                ? applyLeadTemplate(buttonFooterRaw, lead, { mensagem: renderedTextMessage || buttonFooterRaw })
                : '';

            const baileys = await baileysLoader.getBaileys();
            const hydratedTemplate = {
                hydratedContentText: renderedTextMessage || buttonText,
                hydratedButtons: [
                    {
                        index: 1,
                        urlButton: {
                            displayText: buttonText,
                            url: buttonUrl
                        }
                    }
                ]
            };

            if (buttonTitle) {
                hydratedTemplate.hydratedTitleText = buttonTitle;
            }
            if (buttonFooter) {
                hydratedTemplate.hydratedFooterText = buttonFooter;
            }

            const outboundMessage = baileys.generateWAMessageFromContent(jid, {
                templateMessage: {
                    hydratedTemplate
                }
            }, {
                userJid: session.socket?.user?.id || undefined
            });

            await session.socket.relayMessage(jid, outboundMessage.message, {
                messageId: outboundMessage.key.id
            });
            result = outboundMessage;

        } else if (normalizedType === 'image') {

            result = await session.socket.sendMessage(jid, {

                image: { url: options.url || message },

                caption: renderedCaption || ''

            });

        } else if (normalizedType === 'video') {

            result = await session.socket.sendMessage(jid, {

                video: { url: options.url || message },

                caption: renderedCaption || ''

            });

        } else if (normalizedType === 'document') {

            result = await session.socket.sendMessage(jid, {

                document: { url: options.url || message },

                mimetype: options.mimetype || 'application/pdf',

                fileName: options.fileName || 'documento'

            });

        } else if (normalizedType === 'audio') {

            result = await session.socket.sendMessage(jid, {

                audio: { url: options.url || message },

                mimetype: options.mimetype || 'audio/ogg; codecs=opus',

                ptt: options.ptt === true

            });

        } else {
            throw new Error(`Tipo de mensagem nao suportado: ${normalizedType}`);
        }
    } catch (sendError) {
        if (isDisconnectedSessionRuntimeError(sendError)) {
            session.isConnected = false;
            session.reconnecting = true;
            const blockedUntilMs = setRuntimeSessionDispatchBackoff(session);
            scheduleRuntimeSessionReconnect(sessionId, session);
            const connectionError = new Error('Sessao nao esta conectada');
            connectionError.code = 'SESSION_DISCONNECTED';
            if (blockedUntilMs > Date.now()) {
                connectionError.retryAfterMs = Math.max(1000, blockedUntilMs - Date.now());
            }
            throw connectionError;
        }
        throw sendError;
    }

    

    const messageId = result?.key?.id;

    if (!messageId) {

        console.warn(`[${sessionId}] ?? Mensagem enviada sem id retornado.`);

        return { ...result, lead, conversation };

    }



    const existingMessage = await Message.findByMessageId(messageId);

    if (existingMessage) {

        return { ...result, savedMessage: existingMessage, lead, conversation, deduped: true };

    }



    const providerMessageTimestampMs = parseMessageTimestampMs(
        result?.messageTimestamp || result?.message?.messageTimestamp
    );
    const sentAtIso = providerMessageTimestampMs > 0
        ? new Date(providerMessageTimestampMs).toISOString()
        : new Date().toISOString();

    // Salvar mensagem

    let savedMessage;

    try {

        savedMessage = await Message.create({

            message_id: messageId,

            conversation_id: conversation.id,

            lead_id: lead.id,

            sender_type: 'agent',

            content: isTextLikeMessage ? renderedTextMessage : (renderedCaption || ''),

            content_encrypted: encryptMessage(isTextLikeMessage ? renderedTextMessage : (renderedCaption || '')),

            media_type: persistedMediaType,

            media_url: isMediaWithUrl ? (options.url || message) : null,

            media_mime_type: isMediaWithUrl ? (options.mimetype || null) : null,

            media_filename: isMediaWithUrl ? (options.fileName || null) : null,

            status: 'sent',

            is_from_me: true,

            sent_at: sentAtIso,
            campaign_id: options.campaignId || null

        });

    } catch (error) {

        if (String(error.message || '').includes('UNIQUE')) {

            savedMessage = await Message.findByMessageId(messageId);

        } else {

            throw error;

        }

    }

    

    await Conversation.touchAndMarkAsRead(conversation.id, savedMessage?.id || null, sentAtIso);
    if (options.campaignId) {
        await Campaign.refreshMetrics(options.campaignId);
    }

    // Webhook

    webhookService.trigger('message.sent', {

        messageId,

        to,

        content: isTextLikeMessage ? renderedTextMessage : (renderedCaption || ''),

        type: normalizedType

    }, {
        ownerUserId: Number(sessionOwnerUserId || lead?.owner_user_id || 0) || undefined
    });

    

    console.log(`[${sessionId}] ? Mensagem enviada para ${to}`);

    

    return { ...result, savedMessage, lead, conversation, sentAt: sentAtIso };

}



/**

 * Verificar se sessÃ£o existe

 */

function sessionExists(sessionId) {

    return whatsappService.hasSession(sessionId, SESSIONS_DIR);

}



// ============================================

// INICIALIZAR SERVIÃ‡OS

// ============================================



// Inicializar serviÃ§o de fila

(async () => {
    await bootstrapPromise;

    await webhookQueueService.init(async (options = {}) => {
        return await webhookService.send(
            options.webhook,
            options.event,
            options?.payload?.data,
            { payload: options.payload }
        );
    }, {
        workerEnabled: WEBHOOK_QUEUE_WORKER_ENABLED,
        leaderLock: webhookQueueWorkerLeaderLock
    });

    await queueService.init(async (options) => {
        const sid = resolveSessionIdOrDefault(options.sessionId);
        const to = options.to || extractNumber(options.jid || '');

        if (!to) {
            throw new Error('Destino invalido para envio em fila');
        }

        return await sendMessage(
            sid,
            to,
            options.content,
            options.mediaType || 'text',
            {
                url: options.mediaUrl,
                mimetype: options.mimetype,
                fileName: options.fileName,
                ptt: options.ptt,
                duration: options.duration,
                campaignId: options.campaignId || null,
                conversationId: options.conversationId || null
            }
        );
    }, {
        workerEnabled: QUEUE_WORKER_ENABLED,
        leaderLock: queueWorkerLeaderLock,
        resolveSessionForMessage: async ({ message, lead }) => {
            const leadOwnerUserId =
                normalizeOwnerUserId(lead?.owner_user_id)
                || await resolveOwnerScopeUserIdFromAssignees(lead?.assigned_to);
            const allocation = await senderAllocatorService.allocateForSingleLead({
                leadId: lead?.id,
                campaignId: message?.campaign_id || null,
                sessionId: message?.session_id || null,
                strategy: 'round_robin',
                ownerUserId: leadOwnerUserId || undefined
            });
            return {
                sessionId: allocation?.sessionId || null,
                assignmentMeta: allocation?.assignmentMeta || null
            };
        },
        getSessionDispatchState
    });

    flowService.init(async (options = {}) => {
        const requestedSessionId = sanitizeSessionId(options?.sessionId || options?.session_id);
        const resolvedSessionId = resolveSessionIdOrDefault(requestedSessionId);
        const destination = String(options?.to || extractNumber(options?.jid || '') || '').trim();
        if (!destination) {
            throw new Error('Destino invalido para envio no fluxo');
        }

        const normalizedConversationId = Number(options?.conversationId || options?.conversation_id || 0);
        let normalizedLeadId = Number(options?.leadId || options?.lead_id || 0);
        if ((!Number.isInteger(normalizedLeadId) || normalizedLeadId <= 0) && Number.isInteger(normalizedConversationId) && normalizedConversationId > 0) {
            const conversationRow = await queryOne(
                'SELECT lead_id FROM conversations WHERE id = ?',
                [normalizedConversationId]
            );
            normalizedLeadId = Number(conversationRow?.lead_id || 0);
        }

        const mediaType = String(options?.mediaType || options?.media_type || 'text').trim().toLowerCase() || 'text';
        const content = String(options?.content || '');
        const mediaUrl = options?.mediaUrl || options?.url || null;
        const listSections = Array.isArray(options?.listSections)
            ? options.listSections
            : (Array.isArray(options?.sections) ? options.sections : []);
        const listButtonText = String(options?.listButtonText || options?.buttonText || '').trim();
        const listTitle = String(options?.listTitle || options?.title || '').trim();
        const listFooter = String(options?.listFooter || options?.footer || '').trim();
        const buttonUrl = String(options?.buttonUrl || options?.url || '').trim();
        const buttonTitle = String(options?.buttonTitle || options?.title || '').trim();
        const buttonFooter = String(options?.buttonFooter || options?.footer || '').trim();
        const isInteractiveDirectMessage = mediaType === 'list' || mediaType === 'button_url';

        if (
            FLOW_MESSAGE_QUEUE_ENABLED
            && QUEUE_WORKER_ENABLED
            && Number.isInteger(normalizedLeadId)
            && normalizedLeadId > 0
            && !isInteractiveDirectMessage
        ) {
            let queuedSessionId = requestedSessionId || resolvedSessionId;
            if (queuedSessionId) {
                try {
                    const sessionDispatch = await getSessionDispatchState(queuedSessionId);
                    if (sessionDispatch?.available === false) {
                        queuedSessionId = '';
                    }
                } catch (_) {
                    // fallback para manter a sessao solicitada caso nao seja possivel ler o estado de runtime
                }
            }

            const assignmentMeta = {
                source: 'flow',
                flow_id: Number(options?.flowId || options?.flow_id || 0) || null,
                node_id: String(options?.nodeId || options?.node_id || '').trim() || null
            };

            const queueResult = await queueService.add({
                leadId: normalizedLeadId,
                conversationId: Number.isInteger(normalizedConversationId) && normalizedConversationId > 0
                    ? normalizedConversationId
                    : null,
                content,
                mediaType,
                mediaUrl,
                priority: FLOW_MESSAGE_QUEUE_PRIORITY,
                sessionId: queuedSessionId || null,
                isFirstContact: false,
                assignmentMeta
            });

            return {
                queued: true,
                queueId: queueResult?.id || null,
                sessionId: queuedSessionId || null
            };
        }

        let directSessionId = resolvedSessionId;
        try {
            const directSessionDispatchState = await getSessionDispatchState(directSessionId);
            if (directSessionDispatchState?.available === false) {
                const connectedFallbackSessionId = resolveFirstConnectedSessionId(requestedSessionId);
                if (connectedFallbackSessionId) {
                    directSessionId = connectedFallbackSessionId;
                }
            }
        } catch (_) {
            // fallback para manter sessao resolvida originalmente
        }

        const finalDirectDispatchState = await getSessionDispatchState(directSessionId);
        if (finalDirectDispatchState?.available === false) {
            throw new Error('Nenhuma sessao WhatsApp conectada para envio de fluxo.');
        }

        return await sendMessage(
            directSessionId,
            destination,
            content,
            mediaType,
            {
                url: mediaUrl,
                mimetype: options?.mimetype,
                fileName: options?.fileName,
                ptt: options?.ptt,
                duration: options?.duration,
                listSections,
                listButtonText,
                listTitle,
                listFooter,
                buttonText: listButtonText,
                buttonUrl,
                buttonTitle,
                buttonFooter,
                conversationId: Number.isInteger(normalizedConversationId) && normalizedConversationId > 0
                    ? normalizedConversationId
                    : null
            }
        );
    });

    await rehydrateSessions(io);
    startScheduledAutomationsWorker();
    startTenantIntegrityAuditWorker();
    startInboxReconciliationWorker();
    startFlowAwaitingInputRecoveryWorker();
    if (BACKUP_AUTO_ENABLED) {
        try {
            scheduleBackup(BACKUP_INTERVAL_HOURS);
            console.log(`[Backup] Rotina automatica ativada (intervalo=${BACKUP_INTERVAL_HOURS}h)`);
        } catch (backupScheduleError) {
            console.error('[Backup] Falha ao iniciar rotina automatica:', backupScheduleError.message);
        }
    } else {
        console.log('[Backup] Rotina automatica desabilitada (BACKUP_AUTO_ENABLED=false)');
    }
})().catch((error) => {
    console.error('Erro ao inicializar servicos apos migracao:', error.message);
});



// ============================================

// SOCKET.IO EVENTOS

// ============================================



const WHATSAPP_ACTIVE_PLAN_STATUSES = new Set(['active', 'trialing']);

async function resolveOwnerPlanStatus(ownerScopeUserId) {
    const normalizedOwnerUserId = normalizeOwnerUserId(ownerScopeUserId);
    if (!normalizedOwnerUserId) return 'active';
    const rawStatus = await Settings.get(buildScopedSettingsKey('plan_status', normalizedOwnerUserId));
    const normalizedStatus = String(rawStatus || '').trim().toLowerCase();
    return normalizedStatus || 'active';
}

async function hasOwnerActiveWhatsAppPlan(ownerScopeUserId) {
    const status = await resolveOwnerPlanStatus(ownerScopeUserId);
    return WHATSAPP_ACTIVE_PLAN_STATUSES.has(status);
}

async function requireActiveWhatsAppPlan(req, res, next) {
    try {
        const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
        const hasActivePlan = await hasOwnerActiveWhatsAppPlan(ownerScopeUserId);
        if (!hasActivePlan) {
            return res.status(402).json({
                success: false,
                error: 'Sua assinatura nÃ£o estÃ¡ ativa. Reative para poder usar a aplicaÃ§Ã£o.',
                code: 'PLAN_INACTIVE'
            });
        }
        req.ownerScopeUserId = ownerScopeUserId;
        next();
    } catch (error) {
        res.status(500).json({ success: false, error: 'Erro ao validar assinatura do WhatsApp' });
    }
}

async function ensureSocketActiveWhatsAppPlan(socket, sessionId = null) {
    try {
        const ownerScopeUserId = await ensureSocketOwnerScopeRoom(socket);
        const hasActivePlan = await hasOwnerActiveWhatsAppPlan(ownerScopeUserId);
        if (!hasActivePlan) {
            const normalizedSessionId = sanitizeSessionId(sessionId);
            socket.emit('error', {
                message: 'Sua assinatura nÃ£o estÃ¡ ativa. Reative para poder usar a aplicaÃ§Ã£o.',
                code: 'PLAN_INACTIVE'
            });
            socket.emit('session-status', {
                status: 'disconnected',
                sessionId: normalizedSessionId || null
            });
            return { allowed: false, ownerScopeUserId };
        }
        return { allowed: true, ownerScopeUserId };
    } catch (error) {
        const normalizedSessionId = sanitizeSessionId(sessionId);
        socket.emit('error', {
            message: 'Nao foi possivel validar o plano WhatsApp. Tente novamente.',
            code: 'PLAN_VALIDATION_ERROR'
        });
        socket.emit('session-status', {
            status: 'disconnected',
            sessionId: normalizedSessionId || null
        });
        return { allowed: false, ownerScopeUserId: null };
    }
}

io.on('connection', (socket) => {

    const transportName = String(socket?.conn?.transport?.name || '').trim() || 'unknown';
    const clientIp = getSocketClientIp(socket) || 'n/a';
    const origin = String(socket?.handshake?.headers?.origin || '').trim() || 'n/a';
    console.log(`[socket.io] client_connected id=${socket.id} transport=${transportName} origin=${origin} ip=${clientIp}`);
    ensureSocketOwnerScopeRoom(socket).catch((error) => {
        console.warn(`[socket:${socket.id}] Falha ao resolver escopo inicial:`, error.message);
    });

    

    socket.on('check-session', async ({ sessionId }) => {
        try {
            const normalizedSessionId = sanitizeSessionId(sessionId);
            if (!normalizedSessionId) {
                socket.emit('session-status', { status: 'disconnected', sessionId: null });
                return;
            }

            const planAccess = await ensureSocketActiveWhatsAppPlan(socket, normalizedSessionId);
            if (!planAccess.allowed) return;
            const ownerScopeUserId = planAccess.ownerScopeUserId;
            if (ownerScopeUserId) {
                const socketReq = buildSocketRequestLike(socket);
                const hasAccess = await canAccessSessionRecordInOwnerScope(socketReq, normalizedSessionId, ownerScopeUserId);
                if (!hasAccess) {
                    socket.emit('session-status', { status: 'disconnected', sessionId: normalizedSessionId });
                    return;
                }
            }

            const session = sessions.get(normalizedSessionId);

            if (session) {
                session.clientSocket = socket;
                socket.emit('session-status', {
                    status: session.isConnected ? 'connected' : 'reconnecting',
                    sessionId: normalizedSessionId,
                    user: session.user
                });
                return;
            }

            const hasLocalSession = sessionExists(normalizedSessionId);
            const hasDbAuthState = !hasLocalSession && WHATSAPP_AUTH_STATE_DRIVER !== 'multi_file'
                ? await hasPersistedBaileysAuthState(normalizedSessionId)
                : false;

            if (hasLocalSession || hasDbAuthState) {
                socket.emit('session-status', { status: 'reconnecting', sessionId: normalizedSessionId });
                await createSession(normalizedSessionId, socket, 0, {
                    ownerUserId: ownerScopeUserId || undefined
                });
                return;
            }

            socket.emit('session-status', { status: 'disconnected', sessionId: normalizedSessionId });
        } catch (error) {
            socket.emit('error', {
                message: 'Falha ao verificar sessao WhatsApp',
                code: 'CHECK_SESSION_ERROR'
            });
        }
    });

    

    socket.on('start-session', async (payload = {}) => {
        try {
            const sessionId = sanitizeSessionId(payload.sessionId);
            const pairingPhone = normalizePairingPhoneNumber(payload.phoneNumber);
            const shouldRequestPairingCode = Boolean(payload.requestPairingCode && pairingPhone);
            const forceFreshQrRequested = parseBooleanInput(payload.forceNewQr, false);
            console.log(
                `[start-session] socket=${socket.id} requested_session=${sessionId || 'n/a'} ` +
                `force_new_qr=${forceFreshQrRequested ? 'yes' : 'no'} pairing=${shouldRequestPairingCode ? 'yes' : 'no'}`
            );
            if (!sessionId) {
                socket.emit('error', { message: 'sessionId e obrigatorio', code: 'SESSION_ID_REQUIRED' });
                return;
            }

            const planAccess = await ensureSocketActiveWhatsAppPlan(socket, sessionId);
            if (!planAccess.allowed) return;
            const ownerScopeUserId = planAccess.ownerScopeUserId;
            const storedSession = await WhatsAppSession.findBySessionId(sessionId);
            if (ownerScopeUserId && storedSession) {
                const ownedSession = await WhatsAppSession.findBySessionId(sessionId, {
                    owner_user_id: ownerScopeUserId
                });
                if (!ownedSession) {
                    console.warn(`[start-session] acesso negado para session=${sessionId} owner_scope_user=${ownerScopeUserId}`);
                    socket.emit('error', { message: 'Sem permissao para acessar esta conta', code: 'SESSION_FORBIDDEN' });
                    return;
                }
            }
            const storedOwnerUserId = Number(storedSession?.created_by || 0);
            const resolvedOwnerUserId = ownerScopeUserId || (storedOwnerUserId > 0 ? storedOwnerUserId : null);

            if (forceFreshQrRequested) {
                await resetSessionRuntimeAndAuth(sessionId, {
                    ownerUserId: resolvedOwnerUserId || undefined
                });
            }

            const existingSession = sessions.get(sessionId);

            if (existingSession) {
                existingSession.clientSocket = socket;
                socket.emit('session-status', {
                    status: existingSession.isConnected ? 'connected' : 'reconnecting',
                    sessionId,
                    user: existingSession.user
                });
                let pairingHandledByCreate = false;
                if (!existingSession.isConnected && !sessionInitLocks.has(sessionId)) {
                    await createSession(sessionId, socket, 0, {
                        requestPairingCode: shouldRequestPairingCode,
                        pairingPhone,
                        ownerUserId: resolvedOwnerUserId || undefined
                    });
                    pairingHandledByCreate = shouldRequestPairingCode;
                }
                if (shouldRequestPairingCode && !pairingHandledByCreate) {
                    await requestSessionPairingCode(sessionId, socket, pairingPhone);
                }
                return;
            }

            if (!storedSession && !existingSession && resolvedOwnerUserId) {
                await planLimitsService.assertOwnerCanCreateWhatsAppSession(resolvedOwnerUserId, 1);
            }

            await createSession(sessionId, socket, 0, {
                requestPairingCode: shouldRequestPairingCode,
                pairingPhone,
                ownerUserId: resolvedOwnerUserId || undefined
            });
        } catch (error) {
            const detail = String(error?.message || '').trim().slice(0, 250);
            socket.emit('error', {
                message: detail
                    ? (error?.code ? detail : `Falha ao iniciar sessao WhatsApp: ${detail}`)
                    : 'Falha ao iniciar sessao WhatsApp',
                code: String(error?.code || '').trim() || 'START_SESSION_ERROR'
            });
        }
    });

    socket.on('request-pairing-code', async (payload = {}) => {
        try {
            const sessionId = sanitizeSessionId(payload.sessionId);
            const pairingPhone = normalizePairingPhoneNumber(payload.phoneNumber);
            if (!sessionId) {
                socket.emit('error', { message: 'sessionId e obrigatorio', code: 'SESSION_ID_REQUIRED' });
                return;
            }
            if (!pairingPhone) {
                socket.emit('error', {
                    message: 'Numero invalido para pareamento. Use DDI + DDD + numero.',
                    code: 'PAIRING_PHONE_INVALID'
                });
                return;
            }

            const planAccess = await ensureSocketActiveWhatsAppPlan(socket, sessionId);
            if (!planAccess.allowed) return;
            const ownerScopeUserId = planAccess.ownerScopeUserId;
            const storedSession = await WhatsAppSession.findBySessionId(sessionId);
            if (ownerScopeUserId && storedSession) {
                const ownedSession = await WhatsAppSession.findBySessionId(sessionId, {
                    owner_user_id: ownerScopeUserId
                });
                if (!ownedSession) {
                    socket.emit('error', { message: 'Sem permissao para acessar esta conta', code: 'SESSION_FORBIDDEN' });
                    return;
                }
            }
            const storedOwnerUserId = Number(storedSession?.created_by || 0);
            const resolvedOwnerUserId = ownerScopeUserId || (storedOwnerUserId > 0 ? storedOwnerUserId : null);

            const existingSession = sessions.get(sessionId);
            if (existingSession) {
                existingSession.clientSocket = socket;
                let pairingHandledByCreate = false;
                if (!existingSession.isConnected && !sessionInitLocks.has(sessionId)) {
                    await createSession(sessionId, socket, 0, {
                        requestPairingCode: true,
                        pairingPhone,
                        ownerUserId: resolvedOwnerUserId || undefined
                    });
                    pairingHandledByCreate = true;
                }
                if (!pairingHandledByCreate) {
                    await requestSessionPairingCode(sessionId, socket, pairingPhone);
                }
                return;
            }

            if (!storedSession && resolvedOwnerUserId) {
                await planLimitsService.assertOwnerCanCreateWhatsAppSession(resolvedOwnerUserId, 1);
            }

            await createSession(sessionId, socket, 0, {
                requestPairingCode: true,
                pairingPhone,
                ownerUserId: resolvedOwnerUserId || undefined
            });
        } catch (error) {
            socket.emit('error', {
                message: String(error?.message || '').trim() || 'Falha ao gerar codigo de pareamento',
                code: String(error?.code || '').trim() || 'PAIRING_REQUEST_ERROR'
            });
        }
    });

    socket.on('refresh-qr', async (payload = {}) => {
        try {
            const sessionId = sanitizeSessionId(payload.sessionId);
            const forceFreshQrRequested = parseBooleanInput(payload.forceNewQr, false);
            console.log(
                `[refresh-qr] socket=${socket.id} requested_session=${sessionId || 'n/a'} ` +
                `force_new_qr=${forceFreshQrRequested ? 'yes' : 'no'}`
            );
            if (!sessionId) {
                socket.emit('error', { message: 'sessionId e obrigatorio', code: 'SESSION_ID_REQUIRED' });
                return;
            }

            const planAccess = await ensureSocketActiveWhatsAppPlan(socket, sessionId);
            if (!planAccess.allowed) return;
            const ownerScopeUserId = planAccess.ownerScopeUserId;

            const storedSession = await WhatsAppSession.findBySessionId(sessionId);
            if (ownerScopeUserId && storedSession) {
                const ownedSession = await WhatsAppSession.findBySessionId(sessionId, {
                    owner_user_id: ownerScopeUserId
                });
                if (!ownedSession) {
                    socket.emit('error', { message: 'Sem permissao para acessar esta conta', code: 'SESSION_FORBIDDEN' });
                    return;
                }
            }

            const storedOwnerUserId = Number(storedSession?.created_by || 0);
            const resolvedOwnerUserId = ownerScopeUserId || (storedOwnerUserId > 0 ? storedOwnerUserId : null);

            if (forceFreshQrRequested) {
                await resetSessionRuntimeAndAuth(sessionId, {
                    ownerUserId: resolvedOwnerUserId || undefined
                });
            }

            const existingSession = sessions.get(sessionId);

            if (existingSession?.isConnected) {
                socket.emit('session-status', {
                    status: 'connected',
                    sessionId,
                    user: existingSession.user || null
                });
                return;
            }

            if (existingSession) {
                existingSession.clientSocket = socket;
            }

            if (!sessionInitLocks.has(sessionId)) {
                if (!storedSession && !existingSession && resolvedOwnerUserId) {
                    await planLimitsService.assertOwnerCanCreateWhatsAppSession(resolvedOwnerUserId, 1);
                }
                await createSession(sessionId, socket, 0, {
                    ownerUserId: resolvedOwnerUserId || undefined
                });
            }
        } catch (error) {
            socket.emit('error', {
                message: String(error?.message || '').trim() || 'Falha ao atualizar QR Code',
                code: String(error?.code || '').trim() || 'REFRESH_QR_ERROR'
            });
        }
    });

    

    socket.on('send-message', async ({ sessionId, to, message, type, options }) => {

        try {
            const normalizedSessionId = sanitizeSessionId(sessionId);
            if (!normalizedSessionId) {
                socket.emit('error', { message: 'sessionId e obrigatorio', code: 'SESSION_ID_REQUIRED' });
                return;
            }

            const ownerScopeUserId = await ensureSocketOwnerScopeRoom(socket);
            const socketReq = buildSocketRequestLike(socket);
            if (ownerScopeUserId) {
                const canAccessSession = await canAccessSessionRecordInOwnerScope(socketReq, normalizedSessionId, ownerScopeUserId);
                if (!canAccessSession) {
                    socket.emit('error', { message: 'Sem permissao para usar esta conta WhatsApp', code: 'SESSION_FORBIDDEN' });
                    return;
                }
            }

            const safeOptions = options && typeof options === 'object' ? { ...options } : {};
            const normalizedConversationId = Number(safeOptions.conversationId);
            if (Number.isInteger(normalizedConversationId) && normalizedConversationId > 0) {
                const conversation = await Conversation.findById(normalizedConversationId);
                const hasConversationAccess = conversation
                    ? await canAccessConversationInOwnerScope(socketReq, conversation, ownerScopeUserId)
                    : false;
                if (!conversation || !hasConversationAccess) {
                    socket.emit('error', { message: 'Sem permissao para enviar nesta conversa', code: 'CONVERSATION_FORBIDDEN' });
                    return;
                }
            }

            const result = await sendMessage(normalizedSessionId, to, message, type, safeOptions);

            socket.emit('message-sent', {

                sessionId: normalizedSessionId,

                to,

                message,

                messageId: result.key.id,

                timestamp: Date.now()

            });

        } catch (error) {

            socket.emit('error', { message: error.message, code: 'SEND_ERROR' });

        }

    });

    

    socket.on('get-messages', async ({ sessionId, contactJid, leadId, conversationId }) => {
        let messages = [];
        const socketReq = buildSocketRequestLike(socket);
        const ownerScopeUserId = await ensureSocketOwnerScopeRoom(socket);
        const normalizedSessionId = sanitizeSessionId(sessionId);
        const normalizedContactJid = normalizeJid(contactJid);
        const normalizedConversationId = Number(conversationId);
        const hasConversationId = Number.isFinite(normalizedConversationId) && normalizedConversationId > 0;
        let resolvedConversation = null;
        let resolvedLead = null;

        if (ownerScopeUserId && normalizedSessionId) {
            const canAccessSession = await canAccessSessionRecordInOwnerScope(socketReq, normalizedSessionId, ownerScopeUserId);
            if (!canAccessSession) {
                socket.emit('error', { message: 'Sem permissao para acessar esta conta', code: 'SESSION_FORBIDDEN' });
                return;
            }
        }

        if (hasConversationId) {
            const conversation = await Conversation.findById(normalizedConversationId);
            const conversationSessionId = sanitizeSessionId(conversation?.session_id);
            if (conversation && (!normalizedSessionId || conversationSessionId === normalizedSessionId)) {
                resolvedConversation = conversation;
            }
            if (resolvedConversation) {
                resolvedLead = await Lead.findById(resolvedConversation.lead_id);
                messages = await Message.listByConversation(resolvedConversation.id, { limit: 100 });
            }
        }

        if (!resolvedConversation && leadId) {
            const normalizedLeadId = Number(leadId);
            if (Number.isFinite(normalizedLeadId) && normalizedLeadId > 0) {
                resolvedLead = await Lead.findById(normalizedLeadId);
                const conversation = await Conversation.findByLeadId(normalizedLeadId, normalizedSessionId || null);
                if (conversation) {
                    resolvedConversation = conversation;
                    messages = await Message.listByConversation(conversation.id, { limit: 100 });
                }
            }
        } else if (!resolvedConversation && normalizedContactJid) {
            const sessionOwnerUserId = await resolveSessionOwnerUserId(normalizedSessionId);
            const lead = await Lead.findByJid(normalizedContactJid, { owner_user_id: sessionOwnerUserId || undefined });
            if (lead) {
                resolvedLead = lead;
                const conversation = await Conversation.findByLeadId(lead.id, normalizedSessionId || null);
                if (conversation) {
                    resolvedConversation = conversation;
                    messages = await Message.listByConversation(conversation.id, { limit: 100 });
                }
            }
        }

        const backfillSessionId = sanitizeSessionId(
            normalizedSessionId || resolvedConversation?.session_id
        );
        const hasConversationAccess = resolvedConversation
            ? await canAccessConversationInOwnerScope(socketReq, resolvedConversation, ownerScopeUserId)
            : false;

        if (resolvedLead && !hasConversationAccess) {
            const hasLeadAccess = await canAccessLeadRecordInOwnerScope(socketReq, resolvedLead, ownerScopeUserId);
            if (!hasLeadAccess) {
                socket.emit('error', { message: 'Sem permissao para acessar esta conversa', code: 'CONVERSATION_FORBIDDEN' });
                return;
            }
        }

        if (!resolvedLead && resolvedConversation && !hasConversationAccess) {
            socket.emit('error', { message: 'Sem permissao para acessar esta conversa', code: 'CONVERSATION_FORBIDDEN' });
            return;
        }

        const hasMissingMedia = messages.some((item) => {
            const mediaType = String(item?.media_type || '').trim().toLowerCase();
            if (!mediaType || mediaType === 'text') return false;
            return !String(item?.media_url || '').trim();
        });
        if ((messages.length === 0 || hasMissingMedia) && resolvedConversation && backfillSessionId) {
            const backfillResult = await backfillConversationMessagesFromStore({
                sessionId: backfillSessionId,
                conversation: resolvedConversation,
                lead: resolvedLead,
                contactJid,
                limit: Math.max(100, messages.length || 0, 50)
            });
            if ((backfillResult.inserted || 0) > 0 || (backfillResult.hydratedMedia || 0) > 0) {
                messages = await Message.listByConversation(resolvedConversation.id, { limit: 100 });
            }
        }

        // Descriptografar mensagens
        messages = messages.map(m => {
            const raw = m.content_encrypted ? decryptMessage(m.content_encrypted) : m.content;
            let text = raw;
            if ((!text || !String(text).trim()) && m.media_type && m.media_type !== 'text') {
                text = previewForMedia(m.media_type);
            }
            text = normalizeText(text);
            return {
                ...m,
                text,
                content: text
            };
        });

        socket.emit('messages-list', {
            sessionId: normalizedSessionId || sessionId,
            contactJid: normalizedContactJid || contactJid,
            leadId,
            conversationId,
            messages
        });
    });

    

    socket.on('get-contacts', async ({ sessionId }) => {
        const socketReq = buildSocketRequestLike(socket);
        const scopedUserId = getScopedUserId(socketReq);
        const ownerScopeUserId = await ensureSocketOwnerScopeRoom(socket);
        const normalizedSessionId = sanitizeSessionId(sessionId);
        if (ownerScopeUserId && normalizedSessionId) {
            const canAccessSession = await canAccessSessionRecordInOwnerScope(socketReq, normalizedSessionId, ownerScopeUserId);
            if (!canAccessSession) {
                socket.emit('error', { message: 'Sem permissao para acessar esta conta', code: 'SESSION_FORBIDDEN' });
                return;
            }
        }
        const leads = await Lead.list({
            limit: 200,
            session_id: normalizedSessionId || undefined,
            assigned_to: scopedUserId || undefined,
            owner_user_id: ownerScopeUserId || undefined
        });
        const sessionPhone = getSessionPhone(normalizedSessionId);
        const sessionDisplayName = normalizeText(getSessionDisplayName(normalizedSessionId) || 'UsuÃ¡rio');

        const contacts = (await Promise.all(leads.map(async (lead) => {
            const conversation = await Conversation.findByLeadId(lead.id, normalizedSessionId || null);
            if (!conversation?.id) return null;

            const lastMsg = await Message.getLastMessage(conversation.id);
            if (!lastMsg) return null;

                const preview = normalizeText(lastMsg.content
                    ? lastMsg.content.substring(0, 50)
                    : (lastMsg.media_type ? previewForMedia(lastMsg.media_type) : 'Sem mensagens'));

                let displayName = normalizeText(lead.name);
                const phoneDigits = normalizePhoneDigits(lead.phone);
                const sessionDigits = normalizePhoneDigits(sessionPhone);
                if (isSelfPhone(phoneDigits, sessionDigits)) {
                    const safeSessionName = normalizeText(sessionDisplayName || '');
                    displayName = safeSessionName ? `${safeSessionName} (VocÃª)` : 'VocÃª';
                }

            return {
                jid: lead.jid,
                number: lead.phone,
                name: displayName,
                vehicle: lead.vehicle,
                plate: lead.plate,
                status: lead.status,
                lastMessage: preview,
                lastMessageTime: lastMsg?.created_at ? new Date(lastMsg.created_at).getTime() : new Date(lead.created_at).getTime(),
                unreadCount: 0
            };
        })))
            .filter(Boolean)
            .sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));

        socket.emit('contacts-list', { sessionId: normalizedSessionId || sessionId, contacts });
    });

    

    socket.on('get-leads', async (options = {}) => {
        const socketReq = buildSocketRequestLike(socket);
        const scopedUserId = getScopedUserId(socketReq);
        const ownerScopeUserId = await ensureSocketOwnerScopeRoom(socket);
        const normalizedOptions = options && typeof options === 'object' ? options : {};
        const requestedAssignedTo = Number(normalizedOptions.assigned_to ?? normalizedOptions.assignedTo);
        const resolvedAssignedTo = scopedUserId || (Number.isInteger(requestedAssignedTo) && requestedAssignedTo > 0 ? requestedAssignedTo : undefined);
        const normalizedSessionId = sanitizeSessionId(normalizedOptions.session_id || normalizedOptions.sessionId);
        const queryOptions = {
            ...normalizedOptions,
            assigned_to: resolvedAssignedTo,
            owner_user_id: ownerScopeUserId || undefined,
            session_id: normalizedSessionId || undefined
        };

        const leads = await Lead.list(queryOptions);

        const total = await Lead.count(queryOptions);

        socket.emit('leads-list', { leads, total });

    });

    

    socket.on('mark-read', async ({ sessionId, contactJid, conversationId }) => {
        const socketReq = buildSocketRequestLike(socket);
        const ownerScopeUserId = await ensureSocketOwnerScopeRoom(socket);
        const normalizedSessionId = sanitizeSessionId(sessionId);
        const normalizedContactJid = normalizeJid(contactJid);

        if (ownerScopeUserId && normalizedSessionId) {
            const canAccessSession = await canAccessSessionRecordInOwnerScope(socketReq, normalizedSessionId, ownerScopeUserId);
            if (!canAccessSession) {
                socket.emit('error', { message: 'Sem permissao para acessar esta conta', code: 'SESSION_FORBIDDEN' });
                return;
            }
        }

        if (conversationId) {
            const normalizedConversationId = Number(conversationId);
            const conversation = await Conversation.findById(normalizedConversationId);
            const hasAccess = conversation
                ? await canAccessConversationInOwnerScope(socketReq, conversation, ownerScopeUserId)
                : false;
            if (!conversation || !hasAccess) {
                socket.emit('error', { message: 'Sem permissao para acessar esta conversa', code: 'CONVERSATION_FORBIDDEN' });
                return;
            }

            await Conversation.markAsRead(normalizedConversationId);

        } else if (normalizedContactJid && normalizedSessionId) {

            const sessionOwnerUserId = await resolveSessionOwnerUserId(normalizedSessionId);
            const lead = await Lead.findByJid(normalizedContactJid, { owner_user_id: sessionOwnerUserId || undefined });

            if (lead) {

                const conv = await Conversation.findByLeadId(lead.id, normalizedSessionId);

                if (conv) await Conversation.markAsRead(conv.id);

            }

        }

    });

    

    socket.on('get-templates', async () => {
        const socketReq = buildSocketRequestLike(socket);
        const ownerScopeUserId = await ensureSocketOwnerScopeRoom(socket);
        const scopedUserId = getScopedUserId(socketReq);
        const templates = await Template.list({
            owner_user_id: ownerScopeUserId || undefined,
            created_by: scopedUserId || undefined
        });

        socket.emit('templates-list', { templates });

    });

    

    socket.on('get-flows', async () => {

        const ownerScopeUserId = await ensureSocketOwnerScopeRoom(socket);
        const flows = ownerScopeUserId
            ? await Flow.list({ owner_user_id: ownerScopeUserId })
            : [];

        socket.emit('flows-list', { flows });

    });

    

    socket.on('toggle-bot', async ({ conversationId, active }) => {
        const socketReq = buildSocketRequestLike(socket);
        const ownerScopeUserId = await ensureSocketOwnerScopeRoom(socket);
        const normalizedConversationId = Number(conversationId);
        const conversation = await Conversation.findById(normalizedConversationId);
        const hasAccess = conversation
            ? await canAccessConversationInOwnerScope(socketReq, conversation, ownerScopeUserId)
            : false;
        if (!conversation || !hasAccess) {
            socket.emit('error', { message: 'Sem permissao para atualizar esta conversa', code: 'CONVERSATION_FORBIDDEN' });
            return;
        }

        await Conversation.update(normalizedConversationId, { is_bot_active: active ? 1 : 0 });

        socket.emit('bot-toggled', { conversationId: normalizedConversationId, active });

    });

    

    socket.on('assign-conversation', async ({ conversationId, userId }) => {
        const socketReq = buildSocketRequestLike(socket);
        const ownerScopeUserId = await ensureSocketOwnerScopeRoom(socket);
        const normalizedConversationId = Number(conversationId);
        const conversation = await Conversation.findById(normalizedConversationId);
        const hasConversationAccess = conversation
            ? await canAccessConversationInOwnerScope(socketReq, conversation, ownerScopeUserId)
            : false;
        if (!conversation || !hasConversationAccess) {
            socket.emit('error', { message: 'Sem permissao para atualizar esta conversa', code: 'CONVERSATION_FORBIDDEN' });
            return;
        }

        const normalizedUserId = Number(userId);
        const nextAssignedUserId = Number.isInteger(normalizedUserId) && normalizedUserId > 0
            ? normalizedUserId
            : null;
        if (nextAssignedUserId) {
            const canAssignToUser = await canAccessAssignedRecordInOwnerScope(socketReq, nextAssignedUserId, ownerScopeUserId);
            if (!canAssignToUser) {
                socket.emit('error', { message: 'Sem permissao para atribuir para este usuario', code: 'ASSIGNEE_FORBIDDEN' });
                return;
            }
        }

        await Conversation.update(normalizedConversationId, { assigned_to: nextAssignedUserId });

        socket.emit('conversation-assigned', { conversationId: normalizedConversationId, userId: nextAssignedUserId });

        

        webhookService.trigger('conversation.assigned', { conversationId: normalizedConversationId, userId: nextAssignedUserId }, {
            ownerUserId: Number(ownerScopeUserId || 0) || undefined
        });

    });

    

    socket.on('logout', async ({ sessionId }) => {
        try {
            const normalizedSessionId = sanitizeSessionId(sessionId);
            if (!normalizedSessionId) {
                socket.emit('error', { message: 'sessionId e obrigatorio', code: 'SESSION_ID_REQUIRED' });
                return;
            }

            const planAccess = await ensureSocketActiveWhatsAppPlan(socket, normalizedSessionId);
            if (!planAccess.allowed) return;
            const ownerScopeUserId = planAccess.ownerScopeUserId;
            const socketReq = buildSocketRequestLike(socket);
            if (ownerScopeUserId) {
                const canAccessSession = await canAccessSessionRecordInOwnerScope(socketReq, normalizedSessionId, ownerScopeUserId);
                if (!canAccessSession) {
                    socket.emit('error', { message: 'Sem permissao para desconectar esta conta', code: 'SESSION_FORBIDDEN' });
                    return;
                }
            }

            await disconnectSessionPreservingRecord(normalizedSessionId, {
                ownerUserId: ownerScopeUserId || undefined,
                logoutSocket: true
            });

            socket.emit('disconnected', { sessionId: normalizedSessionId });
        } catch (error) {
            socket.emit('error', {
                message: error?.message || 'Nao foi possivel desconectar a conta',
                code: 'SESSION_DISCONNECT_FAILED'
            });
        }
    });

    

    socket.on('disconnect', (reason) => {
        const transportName = String(socket?.conn?.transport?.name || '').trim() || 'unknown';
        console.log(`[socket.io] client_disconnected id=${socket.id} reason=${String(reason || 'unknown')} transport=${transportName}`);
    });

    socket.on('error', (error) => {
        console.warn(
            `[socket.io] client_error id=${socket.id} message=${String(error?.message || error || '').trim() || 'n/a'}`
        );
    });

});



// ============================================

async function syncStripePlanFromRegistration(registration, overrides = {}) {
    const normalizedRegistration = registration && typeof registration === 'object' ? registration : null;
    if (!normalizedRegistration) return null;

    const ownerUserId = normalizeOwnerUserId(
        overrides.ownerUserId
        || normalizedRegistration.owner_user_id
    );
    if (!ownerUserId) return null;

    const metadata = normalizedRegistration.metadata && typeof normalizedRegistration.metadata === 'object'
        ? normalizedRegistration.metadata
        : {};
    const planName = String(
        overrides.planName
        || normalizedRegistration.stripe_plan_name
        || metadata.planName
        || 'Plano'
    ).trim() || 'Plano';
    const planCode = String(
        overrides.planCode
        || normalizedRegistration.stripe_plan_code
        || normalizedRegistration.stripe_plan_key
        || metadata.planCode
        || ''
    ).trim();
    const planStatus = stripeCheckoutService.normalizePlanStatus(
        overrides.subscriptionStatus
        || overrides.status
        || resolveStripePlanStatusFromRegistration(normalizedRegistration, 'active')
    );
    const renewalDate = overrides.renewalDate || metadata.renewalDate || null;
    const externalReference = String(
        overrides.subscriptionId
        || normalizedRegistration.stripe_subscription_id
        || overrides.sessionId
        || normalizedRegistration.stripe_checkout_session_id
        || ''
    ).trim();

    await applyStripePlanSettingsToOwner(ownerUserId, {
        name: planName,
        code: planCode,
        status: planStatus,
        renewalDate,
        externalReference,
        subscriptionId: String(overrides.subscriptionId || normalizedRegistration.stripe_subscription_id || '').trim(),
        checkoutSessionId: String(overrides.sessionId || normalizedRegistration.stripe_checkout_session_id || '').trim()
    });

    return {
        ownerUserId,
        planName,
        planCode,
        planStatus,
        renewalDate,
        externalReference
    };
}

async function syncStripePlanStatusByIdentifiers(payload = {}) {
    const subscriptionId = String(payload?.subscriptionId || '').trim();
    const customerId = String(payload?.customerId || '').trim();
    let registration = subscriptionId
        ? await CheckoutRegistration.findByStripeSubscriptionId(subscriptionId)
        : null;

    if (!registration && customerId) {
        registration = await CheckoutRegistration.findByStripeCustomerId(customerId);
    }
    if (!registration) return null;

    const metadata = {
        ...(registration?.metadata && typeof registration.metadata === 'object' ? registration.metadata : {}),
        ...(payload?.metadata && typeof payload.metadata === 'object' ? payload.metadata : {}),
        renewalDate: payload?.renewalDate || registration?.metadata?.renewalDate || null,
        subscriptionStatus: stripeCheckoutService.normalizePlanStatus(
            payload?.subscriptionStatus
            || payload?.status
            || registration?.metadata?.subscriptionStatus
            || 'active'
        )
    };
    const updatedRegistration = await CheckoutRegistration.update(registration.id, {
        stripe_customer_id: customerId || registration.stripe_customer_id,
        stripe_subscription_id: subscriptionId || registration.stripe_subscription_id,
        stripe_price_id: String(payload?.priceId || registration.stripe_price_id || '').trim() || null,
        stripe_plan_key: String(payload?.planKey || registration.stripe_plan_key || '').trim() || null,
        stripe_plan_code: String(payload?.planCode || registration.stripe_plan_code || '').trim() || null,
        stripe_plan_name: String(payload?.planName || registration.stripe_plan_name || '').trim() || null,
        metadata
    });

    if (normalizeOwnerUserId(updatedRegistration?.owner_user_id)) {
        await syncStripePlanFromRegistration(updatedRegistration, {
            subscriptionId: subscriptionId || updatedRegistration?.stripe_subscription_id || '',
            sessionId: payload?.sessionId || updatedRegistration?.stripe_checkout_session_id || '',
            subscriptionStatus: metadata.subscriptionStatus,
            renewalDate: metadata.renewalDate || null,
            planName: payload?.planName || updatedRegistration?.stripe_plan_name || '',
            planCode: payload?.planCode || updatedRegistration?.stripe_plan_code || ''
        });
    }

    return updatedRegistration;
}

async function handleStripeWebhookEvent(req, event) {
    const eventType = String(event?.type || '').trim();
    if (!eventType) return;

    if (eventType === 'checkout.session.completed') {
        const payload = await stripeCheckoutService.resolveCheckoutSessionPayload(event?.data?.object || null);
        await upsertCheckoutRegistrationFromStripePayload(req, payload);
        console.log('[stripe/webhook] checkout.session.completed sincronizado', JSON.stringify({
            sessionId: payload.sessionId,
            email: payload.customerEmail,
            planCode: payload.planCode,
            subscriptionId: payload.subscriptionId || null
        }));
        return;
    }

    if (
        eventType === 'customer.subscription.created'
        || eventType === 'customer.subscription.updated'
        || eventType === 'customer.subscription.deleted'
    ) {
        const subscription = event?.data?.object || {};
        const priceId = String(subscription?.items?.data?.[0]?.price?.id || '').trim();
        const existingRegistration = await CheckoutRegistration.findByStripeSubscriptionId(subscription?.id)
            || await CheckoutRegistration.findByStripeCustomerId(subscription?.customer);
        const inferredPlan = stripeCheckoutService.inferPlanByPriceId(priceId);

        await syncStripePlanStatusByIdentifiers({
            subscriptionId: String(subscription?.id || '').trim(),
            customerId: String(subscription?.customer || '').trim(),
            priceId,
            planKey: existingRegistration?.stripe_plan_key || inferredPlan?.key || '',
            planCode: existingRegistration?.stripe_plan_code || inferredPlan?.code || '',
            planName: existingRegistration?.stripe_plan_name || inferredPlan?.name || '',
            subscriptionStatus: stripeCheckoutService.normalizePlanStatus(subscription?.status),
            renewalDate: Number(subscription?.current_period_end || 0) > 0
                ? new Date(Number(subscription.current_period_end) * 1000).toISOString()
                : null
        });
        return;
    }

    if (eventType === 'invoice.paid' || eventType === 'invoice.payment_failed') {
        const invoice = event?.data?.object || {};
        const priceId = String(invoice?.lines?.data?.[0]?.price?.id || '').trim();
        const existingRegistration = await CheckoutRegistration.findByStripeSubscriptionId(invoice?.subscription)
            || await CheckoutRegistration.findByStripeCustomerId(invoice?.customer);
        const inferredPlan = stripeCheckoutService.inferPlanByPriceId(priceId);
        const periodEnd = Number(invoice?.lines?.data?.[0]?.period?.end || 0);

        await syncStripePlanStatusByIdentifiers({
            subscriptionId: String(invoice?.subscription || '').trim(),
            customerId: String(invoice?.customer || '').trim(),
            priceId,
            planKey: existingRegistration?.stripe_plan_key || inferredPlan?.key || '',
            planCode: existingRegistration?.stripe_plan_code || inferredPlan?.code || '',
            planName: existingRegistration?.stripe_plan_name || inferredPlan?.name || '',
            subscriptionStatus: eventType === 'invoice.payment_failed'
                ? 'past_due'
                : 'active',
            renewalDate: periodEnd > 0 ? new Date(periodEnd * 1000).toISOString() : null
        });
    }
}

async function syncPagarmePlanFromRegistration(registration, overrides = {}) {
    const normalizedRegistration = registration && typeof registration === 'object' ? registration : null;
    if (!normalizedRegistration) return null;

    const ownerUserId = normalizeOwnerUserId(
        overrides.ownerUserId
        || normalizedRegistration.owner_user_id
    );
    if (!ownerUserId) return null;

    const metadata = normalizedRegistration.metadata && typeof normalizedRegistration.metadata === 'object'
        ? normalizedRegistration.metadata
        : {};
    const planName = String(
        overrides.planName
        || normalizedRegistration.stripe_plan_name
        || metadata.planName
        || 'Plano'
    ).trim() || 'Plano';
    const planCode = String(
        overrides.planCode
        || normalizedRegistration.stripe_plan_code
        || normalizedRegistration.stripe_plan_key
        || metadata.planCode
        || ''
    ).trim();
    const planStatus = pagarmeCheckoutService.normalizePlanStatus(
        overrides.subscriptionStatus
        || overrides.status
        || resolvePagarmePlanStatusFromRegistration(normalizedRegistration, 'active')
    );
    const renewalDate = overrides.renewalDate || metadata.renewalDate || null;
    const externalReference = String(
        overrides.subscriptionId
        || normalizedRegistration.stripe_subscription_id
        || overrides.sessionId
        || normalizedRegistration.stripe_checkout_session_id
        || ''
    ).trim();

    await applyPagarmePlanSettingsToOwner(ownerUserId, {
        name: planName,
        code: planCode,
        status: planStatus,
        renewalDate,
        externalReference,
        subscriptionId: String(overrides.subscriptionId || normalizedRegistration.stripe_subscription_id || '').trim(),
        checkoutSessionId: String(overrides.sessionId || normalizedRegistration.stripe_checkout_session_id || '').trim()
    });

    return {
        ownerUserId,
        planName,
        planCode,
        planStatus,
        renewalDate,
        externalReference
    };
}

async function syncPagarmePlanStatusByIdentifiers(payload = {}) {
    const subscriptionId = String(payload?.subscriptionId || '').trim();
    const customerId = String(payload?.customerId || '').trim();
    const customerEmail = String(payload?.customerEmail || '').trim().toLowerCase();
    let registration = subscriptionId
        ? await CheckoutRegistration.findByStripeSubscriptionId(subscriptionId)
        : null;

    if (!registration && customerId) {
        registration = await CheckoutRegistration.findByStripeCustomerId(customerId);
    }
    if (!registration && customerEmail) {
        registration = await CheckoutRegistration.findLatestByEmail(customerEmail);
    }
    if (!registration) return null;

    const metadata = {
        ...(registration?.metadata && typeof registration.metadata === 'object' ? registration.metadata : {}),
        ...(payload?.metadata && typeof payload.metadata === 'object' ? payload.metadata : {}),
        provider: 'pagarme',
        renewalDate: payload?.renewalDate || registration?.metadata?.renewalDate || null,
        subscriptionStatus: pagarmeCheckoutService.normalizePlanStatus(
            payload?.subscriptionStatus
            || payload?.status
            || registration?.metadata?.subscriptionStatus
            || 'active'
        ),
        pagarmeSubscriptionStatus: String(
            payload?.metadata?.pagarmeSubscriptionStatus
            || payload?.subscriptionStatus
            || registration?.metadata?.pagarmeSubscriptionStatus
            || ''
        ).trim() || null
    };
    const updatedRegistration = await CheckoutRegistration.update(registration.id, {
        stripe_customer_id: customerId || registration.stripe_customer_id,
        stripe_subscription_id: subscriptionId || registration.stripe_subscription_id,
        stripe_price_id: String(payload?.priceId || registration.stripe_price_id || '').trim() || null,
        stripe_plan_key: String(payload?.planKey || registration.stripe_plan_key || '').trim() || null,
        stripe_plan_code: String(payload?.planCode || registration.stripe_plan_code || '').trim() || null,
        stripe_plan_name: String(payload?.planName || registration.stripe_plan_name || '').trim() || null,
        metadata
    });

    if (normalizeOwnerUserId(updatedRegistration?.owner_user_id)) {
        await syncPagarmePlanFromRegistration(updatedRegistration, {
            subscriptionId: subscriptionId || updatedRegistration?.stripe_subscription_id || '',
            sessionId: payload?.sessionId || updatedRegistration?.stripe_checkout_session_id || '',
            subscriptionStatus: metadata.subscriptionStatus,
            renewalDate: metadata.renewalDate || null,
            planName: payload?.planName || updatedRegistration?.stripe_plan_name || '',
            planCode: payload?.planCode || updatedRegistration?.stripe_plan_code || ''
        });
    }

    return updatedRegistration;
}

function extractPagarmeWebhookType(event = {}) {
    return String(event?.type || event?.event || event?.name || '').trim();
}

function extractPagarmeWebhookObject(event = {}) {
    if (event?.data?.object && typeof event.data.object === 'object') {
        return event.data.object;
    }
    if (event?.data && typeof event.data === 'object') {
        return event.data;
    }
    return {};
}

function extractPagarmeWebhookCustomerEmail(payload = {}) {
    return String(
        payload?.customer?.email
        || payload?.order?.customer?.email
        || payload?.charge?.customer?.email
        || payload?.charges?.[0]?.customer?.email
        || ''
    ).trim().toLowerCase();
}

function extractPagarmeWebhookCustomerId(payload = {}) {
    return String(
        payload?.customer?.id
        || payload?.order?.customer?.id
        || payload?.charge?.customer?.id
        || payload?.charges?.[0]?.customer?.id
        || ''
    ).trim();
}

function extractPagarmeWebhookSubscriptionId(payload = {}) {
    return String(
        payload?.subscription?.id
        || payload?.subscription_id
        || payload?.charge?.last_transaction?.subscription_id
        || payload?.charges?.[0]?.last_transaction?.subscription_id
        || payload?.charges?.[0]?.subscription_id
        || payload?.invoice?.subscription_id
        || ''
    ).trim();
}

function extractPagarmeWebhookPlanId(payload = {}) {
    return String(
        payload?.plan?.id
        || payload?.subscription?.plan?.id
        || payload?.metadata?.plan_id
        || ''
    ).trim();
}

async function handlePagarmeWebhookEvent(req, event) {
    const eventType = extractPagarmeWebhookType(event);
    if (!eventType) return;

    const payloadObject = extractPagarmeWebhookObject(event);

    if (
        eventType === 'subscription.created'
        || eventType === 'subscription.updated'
        || eventType === 'subscription.canceled'
    ) {
        const resolvedPayload = await pagarmeCheckoutService.resolveSubscriptionPayload(payloadObject);
        const latestByEmail = resolvedPayload.customerEmail
            ? await CheckoutRegistration.findLatestByEmail(resolvedPayload.customerEmail)
            : null;
        const normalizedPayload = {
            ...resolvedPayload,
            sessionId: String(
                resolvedPayload?.sessionId
                || latestByEmail?.stripe_checkout_session_id
                || ''
            ).trim(),
            metadata: {
                ...(resolvedPayload?.metadata && typeof resolvedPayload.metadata === 'object' ? resolvedPayload.metadata : {}),
                provider: 'pagarme',
                planStatus: resolvedPayload.subscriptionStatus
            }
        };

        await upsertCheckoutRegistrationFromPagarmePayload(req, normalizedPayload, {
            sendEmail: eventType !== 'subscription.canceled'
        });
        await syncPagarmePlanStatusByIdentifiers(normalizedPayload);
        console.log('[pagarme/webhook] assinatura sincronizada', JSON.stringify({
            type: eventType,
            subscriptionId: normalizedPayload.subscriptionId,
            email: normalizedPayload.customerEmail || null,
            planCode: normalizedPayload.planCode || null
        }));
        return;
    }

    if (
        eventType === 'invoice.paid'
        || eventType === 'invoice.payment_failed'
        || eventType === 'order.paid'
        || eventType === 'order.payment_failed'
    ) {
        const customerEmail = extractPagarmeWebhookCustomerEmail(payloadObject);
        const customerId = extractPagarmeWebhookCustomerId(payloadObject);
        const subscriptionId = extractPagarmeWebhookSubscriptionId(payloadObject);
        const existingRegistration = subscriptionId
            ? await CheckoutRegistration.findByStripeSubscriptionId(subscriptionId)
            : (customerId
                ? await CheckoutRegistration.findByStripeCustomerId(customerId)
                : (customerEmail ? await CheckoutRegistration.findLatestByEmail(customerEmail) : null));

        let resolvedSubscriptionPayload = null;
        if (subscriptionId && eventType !== 'order.paid') {
            try {
                resolvedSubscriptionPayload = await pagarmeCheckoutService.resolveSubscriptionPayload(subscriptionId);
            } catch (error) {
                console.warn('[pagarme/webhook] Falha ao hidratar assinatura a partir de evento financeiro:', error.message);
            }
        }

        const normalizedStatus = eventType.endsWith('payment_failed') ? 'past_due' : 'active';
        const planId = extractPagarmeWebhookPlanId(payloadObject);
        const inferredPlan = pagarmeCheckoutService.inferPlanByPriceId(planId);
        const normalizedPayload = {
            provider: 'pagarme',
            providerLabel: 'Pagar.me',
            sessionId: String(existingRegistration?.stripe_checkout_session_id || '').trim(),
            customerId: String(resolvedSubscriptionPayload?.customerId || customerId || '').trim(),
            customerEmail: String(resolvedSubscriptionPayload?.customerEmail || customerEmail || '').trim().toLowerCase(),
            subscriptionId: String(resolvedSubscriptionPayload?.subscriptionId || subscriptionId || '').trim(),
            subscriptionStatus: normalizedStatus,
            priceId: String(resolvedSubscriptionPayload?.priceId || planId || existingRegistration?.stripe_price_id || '').trim(),
            planKey: String(
                resolvedSubscriptionPayload?.planKey
                || existingRegistration?.stripe_plan_key
                || inferredPlan?.key
                || ''
            ).trim(),
            planCode: String(
                resolvedSubscriptionPayload?.planCode
                || existingRegistration?.stripe_plan_code
                || inferredPlan?.code
                || ''
            ).trim(),
            planName: String(
                resolvedSubscriptionPayload?.planName
                || existingRegistration?.stripe_plan_name
                || inferredPlan?.name
                || 'Plano'
            ).trim(),
            renewalDate: resolvedSubscriptionPayload?.renewalDate || existingRegistration?.metadata?.renewalDate || null,
            metadata: {
                provider: 'pagarme',
                planStatus: normalizedStatus
            }
        };

        if (eventType === 'order.paid' && normalizedPayload.customerEmail) {
            await upsertCheckoutRegistrationFromPagarmePayload(req, normalizedPayload);
        }

        await syncPagarmePlanStatusByIdentifiers(normalizedPayload);
    }
}

// ============================================

// ROTAS API REST

// ============================================

const PRE_CHECKOUT_PRIMARY_OBJECTIVE_OPTIONS = new Set([
    'organizar_leads',
    'automatizar_atendimento',
    'aumentar_vendas',
    'melhorar_whatsapp',
    'outro'
]);

function normalizePreCheckoutText(value, maxLength = 160) {
    const normalized = String(value || '').trim();
    if (!normalized) return '';
    return normalized.slice(0, maxLength);
}

function normalizePreCheckoutEmail(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return '';
    return normalized;
}

function normalizePreCheckoutPhone(value) {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) return '';
    return digits.slice(0, 18);
}

function normalizePreCheckoutObjective(value) {
    const normalized = normalizePreCheckoutText(value, 80).toLowerCase();
    if (!normalized) return '';
    return PRE_CHECKOUT_PRIMARY_OBJECTIVE_OPTIONS.has(normalized)
        ? normalized
        : 'outro';
}

function normalizeCheckoutDocumentType(value) {
    const normalized = normalizePreCheckoutText(value, 10).toLowerCase();
    return normalized === 'cnpj' ? 'cnpj' : 'cpf';
}

function normalizeCheckoutDocumentNumber(value, documentType = 'cpf') {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) return '';
    return normalizeCheckoutDocumentType(documentType) === 'cnpj'
        ? digits.slice(0, 14)
        : digits.slice(0, 11);
}

function isValidCheckoutDocument(documentNumber, documentType = 'cpf') {
    const normalized = normalizeCheckoutDocumentNumber(documentNumber, documentType);
    if (!normalized) return false;
    if (normalizeCheckoutDocumentType(documentType) === 'cnpj') {
        return normalized.length === 14;
    }
    return normalized.length === 11;
}

function buildCustomCheckoutRouteUrl(planKey, params = null) {
    const normalizedPlanKey = normalizePreCheckoutText(planKey, 40).toLowerCase() || 'premium';
    const queryString = params instanceof URLSearchParams ? params.toString() : '';
    return `/#/checkout/${encodeURIComponent(normalizedPlanKey)}${queryString ? `?${queryString}` : ''}`;
}

function buildBillingSuccessRouteUrl(sessionId, planKey, extraParams = {}) {
    const params = new URLSearchParams();
    params.set('session_id', String(sessionId || '').trim());
    params.set('plan', normalizePreCheckoutText(planKey, 40).toLowerCase() || 'premium');
    for (const [key, value] of Object.entries(extraParams)) {
        const normalizedValue = String(value || '').trim();
        if (!normalizedValue) continue;
        params.set(key, normalizedValue);
    }
    return `/#/checkout/sucesso?${params.toString()}`;
}

function buildCheckoutSubscriptionIdempotencyKey({ planKey, email, leadCaptureId, documentNumber }) {
    const seed = [
        normalizePreCheckoutText(planKey, 40).toLowerCase(),
        normalizePreCheckoutEmail(email),
        String(parsePositiveIntInRange(leadCaptureId, 0, 0, 2147483647) || 0),
        normalizeCheckoutDocumentNumber(documentNumber),
        new Date().toISOString().slice(0, 10)
    ].join('|');
    return crypto.createHash('sha256').update(seed, 'utf8').digest('hex').slice(0, 64);
}

function parsePreCheckoutUtmPayload(body = {}, req = null) {
    const sourceBody = body && typeof body === 'object' ? body : {};
    const sourceUtm = sourceBody?.utm && typeof sourceBody.utm === 'object' ? sourceBody.utm : {};
    const query = req?.query && typeof req.query === 'object' ? req.query : {};

    return {
        utm_source: normalizePreCheckoutText(sourceUtm.utm_source || sourceUtm.source || sourceBody.utm_source || query.utm_source || '', 120),
        utm_medium: normalizePreCheckoutText(sourceUtm.utm_medium || sourceUtm.medium || sourceBody.utm_medium || query.utm_medium || '', 120),
        utm_campaign: normalizePreCheckoutText(sourceUtm.utm_campaign || sourceUtm.campaign || sourceBody.utm_campaign || query.utm_campaign || '', 160),
        utm_term: normalizePreCheckoutText(sourceUtm.utm_term || sourceUtm.term || sourceBody.utm_term || query.utm_term || '', 160),
        utm_content: normalizePreCheckoutText(sourceUtm.utm_content || sourceUtm.content || sourceBody.utm_content || query.utm_content || '', 160)
    };
}

app.post('/api/pre-checkout/capture', async (req, res) => {
    try {
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const requestedPlanKey = normalizePreCheckoutText(
            body.planKey || body.plan_key || body.plan || 'premium',
            40
        ).toLowerCase() || 'premium';
        const plan = pagarmeCheckoutService.getPlanConfig(requestedPlanKey);
        if (!plan) {
            return res.status(400).json({ success: false, error: 'Plano invalido para pre-checkout' });
        }

        const fullName = normalizePreCheckoutText(body.fullName || body.full_name || body.name, 120);
        const email = normalizePreCheckoutEmail(body.email);
        const whatsapp = normalizePreCheckoutPhone(body.whatsapp || body.phone);
        const companyName = normalizePreCheckoutText(body.companyName || body.company_name, 120);
        const primaryObjective = normalizePreCheckoutObjective(
            body.primaryObjective || body.primary_objective || body.objective
        );

        if (!fullName) {
            return res.status(400).json({ success: false, error: 'Nome completo e obrigatorio' });
        }
        if (!isValidEmailAddress(email)) {
            return res.status(400).json({ success: false, error: 'E-mail invalido' });
        }
        if (whatsapp.length < 10) {
            return res.status(400).json({ success: false, error: 'WhatsApp invalido' });
        }
        if (!companyName) {
            return res.status(400).json({ success: false, error: 'Nome da empresa e obrigatorio' });
        }
        if (!primaryObjective) {
            return res.status(400).json({ success: false, error: 'Objetivo principal e obrigatorio' });
        }

        const utmPayload = parsePreCheckoutUtmPayload(body, req);
        const sourceUrl = normalizePreCheckoutText(
            body.sourceUrl || body.source_url || req.get('referer') || '',
            500
        );
        const preCheckoutLead = await PreCheckoutLead.create({
            full_name: fullName,
            email,
            whatsapp,
            company_name: companyName,
            primary_objective: primaryObjective,
            plan_key: plan.code,
            source_url: sourceUrl || null,
            ...utmPayload,
            metadata: {
                source: 'pre_checkout_page',
                captured_from_path: normalizePreCheckoutText(body.path || body.captured_from_path || '', 200) || null,
                referrer: normalizePreCheckoutText(req.get('referer') || '', 300) || null,
                user_agent: normalizePreCheckoutText(req.get('user-agent') || '', 300) || null
            }
        });

        const redirectParams = new URLSearchParams();
        redirectParams.set('lead_capture_id', String(preCheckoutLead.id));
        redirectParams.set('prefill_name', fullName);
        redirectParams.set('prefill_email', email);
        redirectParams.set('prefill_whatsapp', whatsapp);
        redirectParams.set('prefill_company_name', companyName);
        redirectParams.set('prefill_objective', primaryObjective);
        const redirectUrl = `/billing/checkout/${encodeURIComponent(plan.code)}?${redirectParams.toString()}`;

        return res.status(201).json({
            success: true,
            plan: plan.code,
            lead_capture_id: preCheckoutLead.id,
            redirect_url: redirectUrl
        });
    } catch (error) {
        console.error('[pre-checkout] Falha ao capturar lead:', error.message);
        return res.status(500).json({
            success: false,
            error: 'Nao foi possivel registrar o pre-checkout agora'
        });
    }
});


app.get('/billing/checkout/:planKey', async (req, res) => {
    try {
        const plan = pagarmeCheckoutService.getPlanConfig(req.params.planKey);
        if (!plan) {
            return res.status(404).send('Plano de checkout nao encontrado');
        }

        const prefillName = normalizePreCheckoutText(req.query?.prefill_name || req.query?.name, 120);
        const prefillEmail = normalizePreCheckoutEmail(req.query?.prefill_email || req.query?.email);
        const prefillWhatsApp = normalizePreCheckoutPhone(req.query?.prefill_whatsapp || req.query?.whatsapp || req.query?.phone);
        const prefillCompanyName = normalizePreCheckoutText(req.query?.prefill_company_name || req.query?.company_name, 120);
        const prefillObjective = normalizePreCheckoutObjective(req.query?.prefill_objective || req.query?.objective);
        const leadCaptureId = parsePositiveIntInRange(
            req.query?.lead_capture_id || req.query?.leadCaptureId,
            0,
            1,
            2147483647
        );

        const redirectParams = new URLSearchParams();
        if (leadCaptureId > 0) redirectParams.set('lead_capture_id', String(leadCaptureId));
        if (prefillName) redirectParams.set('prefill_name', prefillName);
        if (prefillEmail) redirectParams.set('prefill_email', prefillEmail);
        if (prefillWhatsApp) redirectParams.set('prefill_whatsapp', prefillWhatsApp);
        if (prefillCompanyName) redirectParams.set('prefill_company_name', prefillCompanyName);
        if (prefillObjective) redirectParams.set('prefill_objective', prefillObjective);

        return res.redirect(303, buildCustomCheckoutRouteUrl(plan.code, redirectParams));
    } catch (error) {
        console.error('[billing/checkout] Falha ao iniciar checkout:', error.message);
        return res.status(500).send('Nao foi possivel iniciar o checkout agora');
    }
});

app.get('/api/public/billing/checkout/:planKey/config', async (req, res) => {
    try {
        const plan = pagarmeCheckoutService.getPlanConfig(req.params.planKey);
        if (!plan) {
            return res.status(404).json({ success: false, error: 'Plano nao encontrado' });
        }

        const publicKey = pagarmeCheckoutService.getPagarmePublicKey();
        return res.json({
            success: true,
            plan: {
                key: plan.key,
                code: plan.code,
                name: plan.name,
                amount_cents: Number(plan.amountCents || 0),
                trial_days: Number(plan.trialDays || 0)
            },
            pagarme: {
                public_key_configured: Boolean(publicKey),
                public_key: publicKey || ''
            }
        });
    } catch (error) {
        console.error('[billing/checkout/config] Falha ao carregar configuracao:', error.message);
        return res.status(500).json({ success: false, error: 'Nao foi possivel carregar o checkout agora' });
    }
});

app.post('/api/public/billing/checkout/:planKey/subscribe', async (req, res) => {
    try {
        const plan = pagarmeCheckoutService.getPlanConfig(req.params.planKey);
        if (!plan) {
            return res.status(404).json({ success: false, error: 'Plano nao encontrado' });
        }

        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const fullName = normalizePreCheckoutText(body.fullName || body.full_name || body.name, 120);
        const email = normalizePreCheckoutEmail(body.email);
        const whatsapp = normalizePreCheckoutPhone(body.whatsapp || body.phone);
        const companyName = normalizePreCheckoutText(body.companyName || body.company_name, 120);
        const primaryObjective = normalizePreCheckoutObjective(
            body.primaryObjective || body.primary_objective || body.objective
        );
        const documentType = normalizeCheckoutDocumentType(body.documentType || body.document_type);
        const documentNumber = normalizeCheckoutDocumentNumber(body.documentNumber || body.document_number || body.document, documentType);
        const cardToken = normalizePreCheckoutText(body.cardToken || body.card_token, 200);
        const cardHolderName = normalizePreCheckoutText(body.cardHolderName || body.card_holder_name, 120);
        const cardNumber = String(body.cardNumber || body.card_number || '').replace(/\D+/g, '').slice(0, 19);
        const cardExpiryMonth = String(body.cardExpMonth || body.card_exp_month || '').replace(/\D+/g, '').slice(0, 2);
        const cardExpiryYear = String(body.cardExpYear || body.card_exp_year || '').replace(/\D+/g, '').slice(-4);
        const cardCvv = String(body.cardCvv || body.card_cvv || '').replace(/\D+/g, '').slice(0, 4);
        const leadCaptureId = parsePositiveIntInRange(
            body.leadCaptureId || body.lead_capture_id,
            0,
            0,
            2147483647
        );

        if (!fullName) {
            return res.status(400).json({ success: false, error: 'Nome completo e obrigatorio' });
        }
        if (!isValidEmailAddress(email)) {
            return res.status(400).json({ success: false, error: 'E-mail invalido' });
        }
        if (whatsapp.length < 10) {
            return res.status(400).json({ success: false, error: 'WhatsApp invalido' });
        }
        if (!isValidCheckoutDocument(documentNumber, documentType)) {
            return res.status(400).json({ success: false, error: 'Documento invalido' });
        }
        if (!cardToken) {
            if (!cardHolderName || cardHolderName.length < 3) {
                return res.status(400).json({ success: false, error: 'Nome do cartao invalido' });
            }
            if (cardNumber.length < 13) {
                return res.status(400).json({ success: false, error: 'Numero do cartao invalido' });
            }
            const expiryMonth = Number(cardExpiryMonth);
            const expiryYear = Number(cardExpiryYear);
            if (
                !Number.isInteger(expiryMonth)
                || expiryMonth < 1
                || expiryMonth > 12
                || !Number.isInteger(expiryYear)
                || cardExpiryYear.length !== 4
            ) {
                return res.status(400).json({ success: false, error: 'Validade do cartao invalida' });
            }
            if (cardCvv.length < 3) {
                return res.status(400).json({ success: false, error: 'CVV invalido' });
            }
        }

        const checkoutMetadata = {
            pre_checkout_name: fullName || '',
            pre_checkout_whatsapp: whatsapp || '',
            pre_checkout_company: companyName || '',
            pre_checkout_objective: primaryObjective || '',
            pre_checkout_lead_id: leadCaptureId > 0 ? String(leadCaptureId) : '',
            custom_checkout: '1'
        };

        const idempotencyKey = buildCheckoutSubscriptionIdempotencyKey({
            planKey: plan.key,
            email,
            leadCaptureId,
            documentNumber
        });

        const subscription = await pagarmeCheckoutService.createPlanSubscription({
            plan,
            customer: {
                email,
                name: fullName,
                phone: whatsapp,
                companyName,
                objective: primaryObjective,
                documentType,
                documentNumber,
                ...(cardToken ? {} : {
                    card: {
                        holder_name: cardHolderName,
                        number: cardNumber,
                        exp_month: cardExpiryMonth,
                        exp_year: cardExpiryYear,
                        cvv: cardCvv
                    }
                })
            },
            cardToken,
            metadata: checkoutMetadata,
            idempotencyKey
        });

        const subscriptionPayload = subscription?.payload || null;
        if (!subscriptionPayload?.subscriptionId) {
            throw new Error('Assinatura criada sem identificador retornado pelo Pagar.me');
        }

        const registration = await upsertCheckoutRegistrationFromPagarmePayload(req, subscriptionPayload, {
            sendEmail: true
        });

        if (leadCaptureId > 0) {
            try {
                await PreCheckoutLead.markCheckoutStarted(leadCaptureId, {
                    stripe_checkout_session_id: registration?.stripe_checkout_session_id || subscriptionPayload.sessionId || subscriptionPayload.subscriptionId,
                    metadata: {
                        checkout_provider: 'pagarme_custom',
                        subscription_id: subscriptionPayload.subscriptionId,
                        checkout_completed_at: new Date().toISOString()
                    }
                });
            } catch (leadUpdateError) {
                console.warn('[billing/checkout/subscribe] Falha ao atualizar pre-checkout lead:', leadUpdateError.message);
            }
        }

        return res.status(201).json({
            success: true,
            session_id: registration?.stripe_checkout_session_id || subscriptionPayload.sessionId || subscriptionPayload.subscriptionId,
            subscription_id: subscriptionPayload.subscriptionId,
            redirect_url: buildBillingSuccessRouteUrl(
                registration?.stripe_checkout_session_id || subscriptionPayload.sessionId || subscriptionPayload.subscriptionId,
                plan.key,
                {
                    status: registration?.status || ''
                }
            )
        });
    } catch (error) {
        console.error('[billing/checkout/subscribe] Falha ao criar assinatura:', error.message);
        return res.status(Number(error?.statusCode) || 500).json({
            success: false,
            error: error.message || 'Nao foi possivel iniciar a assinatura agora'
        });
    }
});


// Status do WhatsApp (para ConfiguraÃ§Ãµes > ConexÃ£o)

app.get('/api/whatsapp/status', authenticate, async (req, res) => {

    const sessionId = resolveSessionIdOrDefault(req.query?.sessionId);
    const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
    if (ownerScopeUserId) {
        const storedSession = await WhatsAppSession.findBySessionId(sessionId);
        if (storedSession) {
            const ownedSession = await WhatsAppSession.findBySessionId(sessionId, {
                owner_user_id: ownerScopeUserId
            });
            if (!ownedSession) {
                return res.status(404).json({ error: 'Conta nao encontrada' });
            }
        } else {
            const runtimeOwnerUserId = normalizeOwnerUserId(sessions.get(sessionId)?.ownerUserId);
            if (!runtimeOwnerUserId || runtimeOwnerUserId !== ownerScopeUserId) {
                return res.status(404).json({ error: 'Conta nao encontrada' });
            }
        }
    }

    const session = sessions.get(sessionId);
    const lastStartupError = sessionStartupErrors.get(sessionId) || null;
    const initLockStartedAt = Number(sessionInitLockTimestamps.get(sessionId) || 0);
    const initLockAgeMs = sessionInitLocks.has(sessionId) && initLockStartedAt > 0
        ? Math.max(0, Date.now() - initLockStartedAt)
        : null;

    const connected = !!(session && session.isConnected);
    const dispatchState = getSessionDispatchState(sessionId);

    let phone = null;

    if (session && session.user && session.user.id) {

        const jid = String(session.user.id);

        phone = '+' + jid.replace(/@s\.whatsapp\.net|@c\.us/g, '').trim();

    }

    res.json({
        connected,
        phone,
        status: dispatchState.status || (connected ? 'connected' : 'disconnected'),
        reconnecting: Boolean(session?.reconnecting),
        sendReadyAt: Number(session?.sendReadyAtMs || 0) > 0 ? new Date(Number(session.sendReadyAtMs)).toISOString() : null,
        dispatchBlockedUntil: Number(session?.dispatchBlockedUntilMs || 0) > Date.now()
            ? new Date(Number(session.dispatchBlockedUntilMs)).toISOString()
            : null,
        lastDisconnectReason: session?.lastDisconnectReason || null,
        lastStartupError,
        initLock: {
            active: sessionInitLocks.has(sessionId),
            ageMs: initLockAgeMs
        }
    });

});

app.get('/api/whatsapp/sessions', authenticate, requireActiveWhatsAppPlan, async (req, res) => {
    try {
        const includeDisabled = String(req.query?.includeDisabled ?? 'true').toLowerCase() !== 'false';
        const ownerScopeUserId = req.ownerScopeUserId || await resolveRequesterOwnerUserId(req);
        const sessionsList = await senderAllocatorService.listDispatchSessions({
            includeDisabled,
            ownerUserId: ownerScopeUserId || undefined
        });
        res.json({ success: true, sessions: sessionsList });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/whatsapp/sessions/:sessionId/history/resync', authenticate, requireActiveWhatsAppPlan, async (req, res) => {
    try {
        const sessionId = sanitizeSessionId(req.params.sessionId);
        if (!sessionId) {
            return res.status(400).json({ success: false, error: 'sessionId invalido' });
        }

        const ownerScopeUserId = req.ownerScopeUserId || await resolveRequesterOwnerUserId(req);
        if (ownerScopeUserId) {
            const existingSession = await WhatsAppSession.findBySessionId(sessionId);
            if (existingSession) {
                const ownedSession = await WhatsAppSession.findBySessionId(sessionId, {
                    owner_user_id: ownerScopeUserId
                });
                if (!ownedSession) {
                    return res.status(403).json({ success: false, error: 'Sem permissao para ressincronizar esta conta' });
                }
            } else {
                const runtimeSessionOwnerUserId = normalizeOwnerUserId(sessions.get(sessionId)?.ownerUserId);
                if (!runtimeSessionOwnerUserId || runtimeSessionOwnerUserId !== ownerScopeUserId) {
                    return res.status(404).json({ success: false, error: 'Conta nao encontrada' });
                }
            }
        }

        const runtimeSession = sessions.get(sessionId);
        if (!runtimeSession?.socket) {
            return res.status(409).json({
                success: false,
                error: 'Sessao nao esta ativa no runtime. Conecte o WhatsApp para ressincronizar.'
            });
        }
        if (!runtimeSession.isConnected) {
            return res.status(409).json({
                success: false,
                error: 'Sessao desconectada no momento. Aguarde reconexao para ressincronizar.'
            });
        }
        const runtimeStore = resolveRuntimeSessionStore(sessionId, runtimeSession);
        if (!runtimeStore || typeof runtimeStore.loadMessages !== 'function') {
            return res.status(409).json({
                success: false,
                error: 'Store local indisponivel para reidratacao. Tente novamente em instantes.'
            });
        }

        const payload = req.body && typeof req.body === 'object' ? req.body : {};
        const trigger = String(payload.trigger || 'manual-api').trim() || 'manual-api';
        const isManualResync = /manual|resync/i.test(trigger);
        const scopeRaw = String(payload.scope || 'all').trim().toLowerCase();
        const unreadOnly = ['unread', 'pending', 'nao_lidas', 'nao-lidas', 'naolidas'].includes(scopeRaw);

        const defaultMaxConversations = isManualResync
            ? WHATSAPP_MANUAL_RECONNECT_CATCHUP_MAX_CONVERSATIONS
            : WHATSAPP_RECONNECT_CATCHUP_MAX_CONVERSATIONS;
        const defaultMessagesPerConversation = isManualResync
            ? WHATSAPP_MANUAL_RECONNECT_CATCHUP_MESSAGES_PER_CONVERSATION
            : WHATSAPP_RECONNECT_CATCHUP_MESSAGES_PER_CONVERSATION;
        const defaultMaxRuntimeMs = isManualResync
            ? WHATSAPP_MANUAL_RECONNECT_CATCHUP_MAX_RUNTIME_MS
            : WHATSAPP_RECONNECT_CATCHUP_MAX_RUNTIME_MS;

        const maxConversations = parsePositiveIntInRange(
            payload.maxConversations ?? payload.max_conversations,
            defaultMaxConversations,
            1,
            WHATSAPP_RECONNECT_CATCHUP_MAX_CONVERSATIONS_HARD_LIMIT
        );
        const messagesPerConversation = parsePositiveIntInRange(
            payload.messagesPerConversation ??
            payload.messages_per_conversation ??
            payload.limitPerConversation ??
            payload.limit_per_conversation,
            defaultMessagesPerConversation,
            10,
            WHATSAPP_RECONNECT_CATCHUP_MESSAGES_PER_CONVERSATION_HARD_LIMIT
        );
        const maxRuntimeMs = parsePositiveIntInRange(
            payload.maxRuntimeMs ?? payload.max_runtime_ms,
            defaultMaxRuntimeMs,
            3000,
            WHATSAPP_RECONNECT_CATCHUP_MAX_RUNTIME_HARD_LIMIT_MS
        );

        const summary = await runSessionReconnectCatchup(sessionId, {
            trigger,
            expectedSocket: runtimeSession.socket,
            maxConversations,
            messagesPerConversation,
            maxRuntimeMs,
            unreadOnly
        });

        res.json({
            success: true,
            sessionId,
            trigger,
            options: {
                scope: unreadOnly ? 'unread' : 'all',
                maxConversations,
                messagesPerConversation,
                maxRuntimeMs
            },
            summary
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/whatsapp/sessions/:sessionId', authenticate, requireActiveWhatsAppPlan, async (req, res) => {
    try {
        const sessionId = sanitizeSessionId(req.params.sessionId);
        if (!sessionId) {
            return res.status(400).json({ error: 'sessionId invalido' });
        }

        const ownerScopeUserId = req.ownerScopeUserId || await resolveRequesterOwnerUserId(req);
        if (ownerScopeUserId) {
            const existingSession = await WhatsAppSession.findBySessionId(sessionId);
            if (existingSession) {
                const ownedSession = await WhatsAppSession.findBySessionId(sessionId, {
                    owner_user_id: ownerScopeUserId
                });
                if (!ownedSession) {
                    return res.status(403).json({ error: 'Sem permissao para editar esta conta' });
                }
            }
            if (!existingSession) {
                await planLimitsService.assertOwnerCanCreateWhatsAppSession(ownerScopeUserId, 1);
            }
        }

        const updated = await WhatsAppSession.upsertDispatchConfig(sessionId, {
            name: req.body?.name,
            campaign_enabled: req.body?.campaign_enabled,
            daily_limit: req.body?.daily_limit,
            dispatch_weight: req.body?.dispatch_weight,
            hourly_limit: req.body?.hourly_limit,
            cooldown_until: req.body?.cooldown_until,
            owner_user_id: ownerScopeUserId || undefined,
            created_by: ownerScopeUserId || undefined
        });

        res.json({ success: true, session: updated });
    } catch (error) {
        res.status(Number(error?.statusCode || 400) || 400).json({
            error: error.message,
            ...(error?.code ? { code: error.code } : {})
        });
    }
});

app.delete('/api/whatsapp/sessions/:sessionId', authenticate, requireActiveWhatsAppPlan, async (req, res) => {
    try {
        const sessionId = sanitizeSessionId(req.params.sessionId);
        if (!sessionId) {
            return res.status(400).json({ error: 'sessionId invalido' });
        }

        const ownerScopeUserId = req.ownerScopeUserId || await resolveRequesterOwnerUserId(req);
        if (ownerScopeUserId) {
            const existingSession = await WhatsAppSession.findBySessionId(sessionId, {
                owner_user_id: ownerScopeUserId
            });
            if (!existingSession) {
                return res.status(404).json({ error: 'Conta nao encontrada' });
            }
        }

        await removeSessionCompletely(sessionId, {
            ownerUserId: ownerScopeUserId || undefined,
            createdBy: ownerScopeUserId || undefined
        });
        res.json({ success: true, session_id: sessionId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



app.post('/api/whatsapp/disconnect', authenticate, requireActiveWhatsAppPlan, async (req, res) => {

    try {

        const sessionId = resolveSessionIdOrDefault(req.body?.sessionId || req.query?.sessionId);
        const ownerScopeUserId = req.ownerScopeUserId || await resolveRequesterOwnerUserId(req);
        if (ownerScopeUserId) {
            const existingSession = await WhatsAppSession.findBySessionId(sessionId, {
                owner_user_id: ownerScopeUserId
            });
            if (!existingSession) {
                return res.status(404).json({ error: 'Conta nao encontrada' });
            }
        }

        await disconnectSessionPreservingRecord(sessionId, {
            ownerUserId: ownerScopeUserId || undefined,
            logoutSocket: true
        });

        res.json({ success: true, session_id: sessionId });

    } catch (error) {

        res.status(500).json({ error: error.message });

    }

});



// Status do servidor

app.get('/api/status', authenticate, async (req, res) => {
    const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
    let scopedConnectedSessions = 0;

    for (const [sessionId, session] of sessions.entries()) {
        const runtimeOwnerUserId = normalizeOwnerUserId(session?.ownerUserId);
        const sessionOwnerUserId = runtimeOwnerUserId || await resolveSessionOwnerUserId(sessionId);
        if (ownerScopeUserId && sessionOwnerUserId && Number(sessionOwnerUserId) !== Number(ownerScopeUserId)) {
            continue;
        }
        if (session?.isConnected) {
            scopedConnectedSessions += 1;
        }
    }

    res.json({
        status: 'online',
        version: '4.1.0',
        connected_sessions: scopedConnectedSessions,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});



// ============================================

// API DE AUTENTICAÃ‡ÃƒO

// ============================================



app.post('/api/auth/login', async (req, res) => {

    try {

        const { email, password } = req.body;

        

        if (!email || !password) {

            return res.status(400).json({ error: 'Email e senha sÃ£o obrigatÃ³rios' });

        }

        

        const { User } = require('./database/models');

        const { verifyPassword, generateToken, generateRefreshToken } = require('./middleware/auth');



        const normalizedEmail = String(email || '').trim().toLowerCase();

        let user = await User.findByEmail(normalizedEmail);

        if (!user || !verifyPassword(password, user.password_hash)) {

            return res.status(401).json({ error: 'Credenciais invÃ¡lidas' });

        }

        

        if (!user.is_active) {

            return res.status(401).json({ error: 'UsuÃ¡rio desativado' });

        }

        if (!isEmailConfirmed(user)) {

            return res.status(403).json({
                error: 'Confirme seu email antes de entrar',
                code: 'EMAIL_NOT_CONFIRMED'
            });

        }

        // Recupera ambientes legados: se nao houver admin ativo, promove
        // automaticamente o usuario autenticado para admin.
        const allUsers = await User.listAll();
        const hasActiveAdmin = (allUsers || []).some((item) =>
            Number(item?.is_active) > 0
            && String(item?.role || '').trim().toLowerCase() === 'admin'
        );
        if (!hasActiveAdmin && String(user.role || '').trim().toLowerCase() !== 'admin') {
            await User.update(user.id, { role: 'admin', is_active: 1 });
            const refreshed = await User.findByIdWithPassword(user.id);
            if (refreshed) {
                user = refreshed;
            }
        }

        const ownerUserId = Number(user?.owner_user_id || 0);
        const hasOwnerAssigned = Number.isInteger(ownerUserId) && ownerUserId > 0;
        if (!hasOwnerAssigned) {
            await User.update(user.id, { owner_user_id: user.id, role: 'admin', is_active: 1 });
            const refreshed = await User.findByIdWithPassword(user.id);
            if (refreshed) {
                user = refreshed;
            } else {
                user.owner_user_id = user.id;
                user.role = 'admin';
            }
        }

        

        await User.updateLastLogin(user.id);
        markUserPresenceOnline(user.id);

        

        const token = generateToken(user);
        const refreshToken = generateRefreshToken(user);
        const isApplicationAdmin = isApplicationAdminUser(user);

        

        res.json({

            success: true,

            token,

            refreshToken,

            user: {

                id: user.id,

                uuid: user.uuid,

                name: user.name,

                email: user.email,

                role: user.role,
                owner_user_id: user.owner_user_id,
                is_application_admin: isApplicationAdmin

            }

        });

    } catch (error) {

        res.status(500).json({ error: error.message });

    }

});



app.post('/api/auth/register', async (req, res) => {

    try {

        const { name, companyName, email, password } = req.body;



        if (!name || !companyName || !email || !password) {

            return res.status(400).json({ error: 'Nome, nome da empresa, email e senha sao obrigatorios' });

        }



        if (String(password).length < 6) {

            return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres' });

        }



        const { hashPassword } = require('./middleware/auth');

        const normalizedName = String(name || '').trim();
        const normalizedCompanyName = String(companyName || '').trim();
        const normalizedEmail = String(email || '').trim().toLowerCase();
        const existing = await User.findActiveByEmail(normalizedEmail);
        const registrationPasswordHash = hashPassword(String(password));
        const confirmationTokenPayload = createEmailConfirmationTokenPayload();

        let user = null;
        let createdNewUser = false;
        let resentForPendingUser = false;

        if (existing && isEmailConfirmed(existing)) {

            return res.status(409).json({ error: 'Email ja cadastrado' });

        }

        if (existing && !isEmailConfirmed(existing)) {
            resentForPendingUser = true;

            await User.update(existing.id, {
                name: normalizedName,
                email: normalizedEmail,
                email_confirmed: 0,
                email_confirmed_at: null,
                email_confirmation_token_hash: confirmationTokenPayload.tokenHash,
                email_confirmation_expires_at: confirmationTokenPayload.expiresAt
            });
            await User.updatePassword(existing.id, registrationPasswordHash);

            const existingOwnerUserId = Number(existing?.owner_user_id || 0);
            if (!Number.isInteger(existingOwnerUserId) || existingOwnerUserId <= 0) {
                await User.update(existing.id, { owner_user_id: existing.id });
            }

            user = await User.findByIdWithPassword(existing.id);
        } else {
            createdNewUser = true;

            const created = await User.create({

                name: normalizedName,

                email: normalizedEmail,

                password_hash: registrationPasswordHash,
                email_confirmed: 0,
                email_confirmed_at: null,
                email_confirmation_token_hash: confirmationTokenPayload.tokenHash,
                email_confirmation_expires_at: confirmationTokenPayload.expiresAt,

                role: 'admin'

            });



            if (Number(created?.id) > 0) {
                await User.update(Number(created.id), { owner_user_id: Number(created.id) });
            }

            user = await User.findByIdWithPassword(Number(created?.id || 0));
        }

        if (!user) {

            return res.status(500).json({ error: 'Falha ao preparar cadastro do usuario' });

        }

        const ownerUserId = normalizeOwnerUserId(user?.owner_user_id) || Number(user?.id || 0);
        if (ownerUserId > 0) {
            await Settings.set(
                buildScopedSettingsKey('company_name', ownerUserId),
                normalizedCompanyName || normalizedName || 'ZapVender',
                'string'
            );
        }

        try {
            const emailSettings = await getRegistrationEmailRuntimeConfig();
            await sendRegistrationConfirmationEmail(req, user, confirmationTokenPayload, {
                emailSettings
            });
        } catch (error) {
            if (error instanceof MailMktIntegrationError) {
                return res.status(error.statusCode || 502).json({
                    error: createdNewUser
                        ? 'Conta criada, mas nao foi possivel enviar o email de confirmacao agora'
                        : 'Nao foi possivel reenviar o email de confirmacao agora',
                    code: 'EMAIL_CONFIRMATION_SEND_FAILED',
                    retryable: error.retryable !== false,
                    requiresEmailConfirmation: true,
                    accountCreated: createdNewUser
                });
            }
            throw error;
        }

        return res.status(createdNewUser ? 201 : 200).json({
            success: true,
            requiresEmailConfirmation: true,
            message: resentForPendingUser
                ? 'Sua conta ainda nao foi confirmada. Enviamos um novo link de confirmacao para o seu email.'
                : 'Conta criada com sucesso. Verifique seu email para confirmar o cadastro antes de entrar.',
            email: user.email,
            expiresInText: confirmationTokenPayload.expiresInText
        });

    } catch (error) {

        res.status(500).json({ error: error.message });

    }

});



app.post('/api/auth/resend-confirmation', async (req, res) => {

    try {

        const email = String(req.body?.email || '').trim().toLowerCase();
        const sessionId = String(req.body?.sessionId || req.body?.session_id || '').trim();

        if (!email && !sessionId) {
            return res.status(400).json({
                error: 'Email ou sessionId e obrigatorio',
                code: 'EMAIL_REQUIRED'
            });
        }

        const user = email ? await User.findActiveByEmail(email) : null;
        let checkoutRegistration = sessionId
            ? await CheckoutRegistration.findBySessionId(sessionId)
            : null;

        if (!checkoutRegistration && sessionId) {
            try {
                const checkoutPayload = await pagarmeCheckoutService.resolveCheckoutSessionPayload(sessionId);
                checkoutRegistration = await upsertCheckoutRegistrationFromPagarmePayload(req, checkoutPayload, {
                    sendEmail: false
                });
            } catch (error) {
                console.warn('[auth/resend-confirmation] Nao foi possivel hidratar checkout Pagar.me por sessionId', JSON.stringify({
                    sessionId,
                    message: String(error?.message || 'erro_desconhecido')
                }));
            }
        }

        if (!checkoutRegistration && sessionId) {
            try {
                const checkoutPayload = await stripeCheckoutService.resolveCheckoutSessionPayload(sessionId);
                checkoutRegistration = await upsertCheckoutRegistrationFromStripePayload(req, checkoutPayload, {
                    sendEmail: false
                });
            } catch (error) {
                console.warn('[auth/resend-confirmation] Nao foi possivel hidratar checkout Stripe por sessionId', JSON.stringify({
                    sessionId,
                    message: String(error?.message || 'erro_desconhecido')
                }));
            }
        }

        if (!checkoutRegistration && email) {
            checkoutRegistration = await CheckoutRegistration.findLatestByEmail(email, { onlyIncomplete: true });
        }

        if (checkoutRegistration) {
            const registrationStatus = normalizeCheckoutRegistrationStatusValue(checkoutRegistration.status);
            if (
                Number(checkoutRegistration?.linked_user_id) > 0
                || checkoutRegistration?.completed_at
                || registrationStatus === 'linked_existing_account'
            ) {
                return res.json({
                    success: true,
                    requiresEmailConfirmation: false,
                    sent: false,
                    alreadyConfirmed: true,
                    message: 'Este checkout ja foi vinculado a uma conta. Entre normalmente no ZapVender.'
                });
            }

            if (Number(checkoutRegistration?.email_confirmed) > 0) {
                return res.json({
                    success: true,
                    requiresEmailConfirmation: false,
                    sent: false,
                    alreadyConfirmed: true,
                    message: 'Este email ja foi confirmado. Use o link recebido para concluir o cadastro.'
                });
            }

            try {
                const resendResult = await resendCheckoutRegistrationConfirmation(req, checkoutRegistration);
                const updatedRegistration = resendResult?.registration || checkoutRegistration;
                return res.json({
                    success: true,
                    requiresEmailConfirmation: true,
                    sent: true,
                    message: 'Enviamos um novo link de confirmacao para o email informado no checkout.',
                    email: updatedRegistration.email,
                    expiresInText: resendResult?.expiresInText || (process.env.EMAIL_CONFIRMATION_EXPIRES_TEXT || '24 horas')
                });
            } catch (error) {
                if (error instanceof MailMktIntegrationError) {
                    return res.status(error.statusCode || 502).json({
                        error: 'Nao foi possivel reenviar o email de confirmacao agora',
                        code: 'EMAIL_CONFIRMATION_SEND_FAILED',
                        retryable: error.retryable !== false,
                        requiresEmailConfirmation: true,
                        sent: false
                    });
                }
                throw error;
            }
        }

        if (!user) {
            return res.json({
                success: true,
                requiresEmailConfirmation: true,
                sent: false,
                message: 'Se existir uma conta pendente para este email, um novo link de confirmacao sera enviado.'
            });
        }

        if (isEmailConfirmed(user)) {
            return res.json({
                success: true,
                requiresEmailConfirmation: false,
                sent: false,
                alreadyConfirmed: true,
                message: 'Este email ja esta confirmado. Voce pode entrar normalmente.'
            });
        }

        const confirmationTokenPayload = createEmailConfirmationTokenPayload();
        await User.update(user.id, {
            email_confirmed: 0,
            email_confirmed_at: null,
            email_confirmation_token_hash: confirmationTokenPayload.tokenHash,
            email_confirmation_expires_at: confirmationTokenPayload.expiresAt
        });

        const refreshedUser = await User.findByIdWithPassword(user.id);
        const targetUser = refreshedUser || user;

        try {
            const emailSettings = await getRegistrationEmailRuntimeConfig();
            await sendRegistrationConfirmationEmail(req, targetUser, confirmationTokenPayload, {
                emailSettings
            });
        } catch (error) {
            if (error instanceof MailMktIntegrationError) {
                return res.status(error.statusCode || 502).json({
                    error: 'Nao foi possivel reenviar o email de confirmacao agora',
                    code: 'EMAIL_CONFIRMATION_SEND_FAILED',
                    retryable: error.retryable !== false,
                    requiresEmailConfirmation: true,
                    sent: false
                });
            }
            throw error;
        }

        return res.json({
            success: true,
            requiresEmailConfirmation: true,
            sent: true,
            message: 'Enviamos um novo link de confirmacao para o seu email.',
            email: targetUser.email,
            expiresInText: confirmationTokenPayload.expiresInText
        });

    } catch (error) {

        return res.status(500).json({ error: error.message });

    }

});



app.get('/api/auth/confirm-email', async (req, res) => {

    try {

        const rawToken = String(req.query?.token || '').trim();

        if (!rawToken) {
            return res.status(400).json({
                error: 'Token de confirmacao e obrigatorio',
                code: 'EMAIL_CONFIRMATION_TOKEN_REQUIRED'
            });
        }

        const confirmationTokenHash = hashEmailConfirmationToken(rawToken);
        const confirmationTokenFingerprint = tokenFingerprint(rawToken);
        const checkoutRegistration = await CheckoutRegistration.findByEmailConfirmationTokenHash(confirmationTokenHash);

        if (checkoutRegistration) {
            const registrationStatus = normalizeCheckoutRegistrationStatusValue(checkoutRegistration.status);
            const registrationPlanStatus = resolveCheckoutRegistrationPlanStatus(checkoutRegistration, 'active');

            if (
                Number(checkoutRegistration?.linked_user_id) > 0
                || checkoutRegistration?.completed_at
                || registrationStatus === 'linked_existing_account'
            ) {
                return res.json({
                    success: true,
                    flow: 'login',
                    message: 'Email confirmado e cadastro ja concluido. Voce pode entrar no ZapVender.',
                    registration: {
                        email: checkoutRegistration.email,
                        plan: {
                            code: checkoutRegistration.stripe_plan_code || checkoutRegistration.stripe_plan_key || '',
                            name: checkoutRegistration.stripe_plan_name || 'Plano',
                            status: registrationPlanStatus
                        }
                    }
                });
            }

            if (!Number(checkoutRegistration?.email_confirmed) && isCheckoutRegistrationExpired(checkoutRegistration)) {
                await CheckoutRegistration.update(checkoutRegistration.id, {
                    status: 'expired',
                    email_confirmation_token_hash: null,
                    email_confirmation_expires_at: null
                });
                console.warn('[auth/confirm-email] Token expirado para checkout', JSON.stringify({
                    checkoutRegistrationId: Number(checkoutRegistration?.id || 0) || null,
                    tokenFingerprint: confirmationTokenFingerprint
                }));
                return res.status(400).json({
                    error: 'Link de confirmacao expirado. Solicite o reenvio para concluir seu cadastro.',
                    code: 'EMAIL_CONFIRMATION_EXPIRED'
                });
            }

            const confirmedRegistration = Number(checkoutRegistration?.email_confirmed) > 0
                ? checkoutRegistration
                : await CheckoutRegistration.markEmailConfirmed(checkoutRegistration.id);

            console.log('[auth/confirm-email] Email confirmado para checkout', JSON.stringify({
                checkoutRegistrationId: Number(confirmedRegistration?.id || 0) || null,
                email: confirmedRegistration?.email || null,
                sessionId: confirmedRegistration?.stripe_checkout_session_id || null
            }));

            return res.json({
                success: true,
                flow: 'complete_registration',
                message: 'Email confirmado com sucesso. Agora finalize seu cadastro.',
                registration: {
                    email: confirmedRegistration.email,
                    plan: {
                        code: confirmedRegistration.stripe_plan_code || confirmedRegistration.stripe_plan_key || '',
                        name: confirmedRegistration.stripe_plan_name || 'Plano',
                        status: resolveCheckoutRegistrationPlanStatus(confirmedRegistration, 'active')
                    }
                }
            });
        }

        const user = await User.findByEmailConfirmationTokenHash(confirmationTokenHash);

        if (!user) {
            console.warn('[auth/confirm-email] Token invalido', JSON.stringify({
                tokenFingerprint: confirmationTokenFingerprint
            }));
            return res.status(400).json({
                error: 'Link de confirmacao invalido ou ja utilizado',
                code: 'EMAIL_CONFIRMATION_INVALID'
            });
        }

        if (isEmailConfirmed(user)) {
            await User.update(user.id, {
                email_confirmation_token_hash: null,
                email_confirmation_expires_at: null
            });
            console.warn('[auth/confirm-email] Token reutilizado para email ja confirmado', JSON.stringify({
                userId: Number(user?.id || 0) || null,
                tokenFingerprint: confirmationTokenFingerprint
            }));
            return res.status(400).json({
                error: 'Link de confirmacao invalido ou ja utilizado',
                code: 'EMAIL_CONFIRMATION_INVALID'
            });
        }

        if (isEmailConfirmationExpired(user)) {
            await User.update(user.id, {
                email_confirmation_token_hash: null,
                email_confirmation_expires_at: null
            });
            console.warn('[auth/confirm-email] Token expirado', JSON.stringify({
                userId: Number(user?.id || 0) || null,
                tokenFingerprint: confirmationTokenFingerprint
            }));
            return res.status(400).json({
                error: 'Link de confirmacao expirado. Faca um novo cadastro para reenviar o email.',
                code: 'EMAIL_CONFIRMATION_EXPIRED'
            });
        }

        const confirmedUser = await User.consumeEmailConfirmationToken(confirmationTokenHash);

        if (!confirmedUser) {
            console.warn('[auth/confirm-email] Token invalido apos validacao (concorrencia/reuso)', JSON.stringify({
                userId: Number(user?.id || 0) || null,
                tokenFingerprint: confirmationTokenFingerprint
            }));
            return res.status(400).json({
                error: 'Link de confirmacao invalido ou ja utilizado',
                code: 'EMAIL_CONFIRMATION_INVALID'
            });
        }

        console.log('[auth/confirm-email] Email confirmado com sucesso', JSON.stringify({
            userId: Number(confirmedUser?.id || 0) || null,
            email: confirmedUser?.email || null
        }));

        return res.json({
            success: true,
            flow: 'login',
            message: 'Email confirmado com sucesso. Voce ja pode entrar no ZapVender.',
            user: {
                id: confirmedUser.id,
                email: confirmedUser.email,
                name: confirmedUser.name
            }
        });

    } catch (error) {

        res.status(500).json({ error: error.message });

    }

});



app.post('/api/auth/complete-registration', async (req, res) => {

    try {

        const rawToken = String(req.body?.token || '').trim();
        const name = String(req.body?.name || '').trim();
        const companyName = String(req.body?.companyName || req.body?.company_name || '').trim();
        const password = String(req.body?.password || '');

        if (!rawToken) {
            return res.status(400).json({
                error: 'Token de confirmacao e obrigatorio',
                code: 'EMAIL_CONFIRMATION_TOKEN_REQUIRED'
            });
        }

        if (!name || !companyName || !password) {
            return res.status(400).json({
                error: 'Nome, nome da empresa e senha sao obrigatorios',
                code: 'COMPLETE_REGISTRATION_REQUIRED_FIELDS'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                error: 'Senha deve ter pelo menos 6 caracteres',
                code: 'PASSWORD_TOO_SHORT'
            });
        }

        const confirmationTokenHash = hashEmailConfirmationToken(rawToken);
        let checkoutRegistration = await CheckoutRegistration.findByEmailConfirmationTokenHash(confirmationTokenHash);
        if (!checkoutRegistration) {
            return res.status(400).json({
                error: 'Link de confirmacao invalido ou ja utilizado',
                code: 'EMAIL_CONFIRMATION_INVALID'
            });
        }

        const registrationStatus = normalizeCheckoutRegistrationStatusValue(checkoutRegistration.status);
        if (
            Number(checkoutRegistration?.linked_user_id) > 0
            || checkoutRegistration?.completed_at
            || registrationStatus === 'linked_existing_account'
        ) {
            return res.status(409).json({
                error: 'Este cadastro ja foi concluido. Entre normalmente no ZapVender.',
                code: 'REGISTRATION_ALREADY_COMPLETED'
            });
        }

        if (!Number(checkoutRegistration?.email_confirmed) && isCheckoutRegistrationExpired(checkoutRegistration)) {
            await CheckoutRegistration.update(checkoutRegistration.id, {
                status: 'expired',
                email_confirmation_token_hash: null,
                email_confirmation_expires_at: null
            });
            return res.status(400).json({
                error: 'Link de confirmacao expirado. Solicite o reenvio para concluir seu cadastro.',
                code: 'EMAIL_CONFIRMATION_EXPIRED'
            });
        }

        if (!Number(checkoutRegistration?.email_confirmed)) {
            checkoutRegistration = await CheckoutRegistration.markEmailConfirmed(checkoutRegistration.id);
        }

        const { hashPassword } = require('./middleware/auth');
        const passwordHash = hashPassword(password);
        const normalizedEmail = String(checkoutRegistration.email || '').trim().toLowerCase();
        const normalizedName = String(name || '').trim();
        const normalizedCompanyName = String(companyName || '').trim();
        const existingUser = await User.findActiveByEmail(normalizedEmail);
        const nowIso = new Date().toISOString();

        let user = null;
        if (existingUser && isEmailConfirmed(existingUser)) {
            return res.status(409).json({
                error: 'Email ja cadastrado',
                code: 'EMAIL_ALREADY_REGISTERED'
            });
        }

        if (existingUser && !isEmailConfirmed(existingUser)) {
            await User.update(existingUser.id, {
                name: normalizedName,
                email: normalizedEmail,
                role: 'admin',
                is_active: 1,
                email_confirmed: 1,
                email_confirmed_at: nowIso,
                email_confirmation_token_hash: null,
                email_confirmation_expires_at: null
            });
            await User.updatePassword(existingUser.id, passwordHash);

            const existingOwnerUserId = normalizeOwnerUserId(existingUser?.owner_user_id) || Number(existingUser.id || 0);
            if (existingOwnerUserId > 0 && Number(existingUser?.owner_user_id || 0) !== existingOwnerUserId) {
                await User.update(existingUser.id, { owner_user_id: existingOwnerUserId });
            }

            user = await User.findByIdWithPassword(existingUser.id);
        } else {
            const created = await User.create({
                name: normalizedName,
                email: normalizedEmail,
                password_hash: passwordHash,
                email_confirmed: 1,
                email_confirmed_at: nowIso,
                email_confirmation_token_hash: null,
                email_confirmation_expires_at: null,
                role: 'admin'
            });

            if (Number(created?.id || 0) > 0) {
                await User.update(Number(created.id), { owner_user_id: Number(created.id) });
            }
            user = await User.findByIdWithPassword(Number(created?.id || 0));
        }

        if (!user) {
            return res.status(500).json({
                error: 'Falha ao concluir cadastro do usuario'
            });
        }

        const ownerUserId = normalizeOwnerUserId(user?.owner_user_id) || Number(user?.id || 0) || null;
        if (ownerUserId) {
            await Settings.set(
                buildScopedSettingsKey('company_name', ownerUserId),
                normalizedCompanyName || normalizedName || 'ZapVender',
                'string'
            );

            const applyPlanSettings = getCheckoutRegistrationProvider(checkoutRegistration) === 'pagarme'
                ? applyPagarmePlanSettingsToOwner
                : applyStripePlanSettingsToOwner;
            await applyPlanSettings(ownerUserId, {
                name: checkoutRegistration.stripe_plan_name || 'Plano',
                code: checkoutRegistration.stripe_plan_code || checkoutRegistration.stripe_plan_key || '',
                status: resolveCheckoutRegistrationPlanStatus(checkoutRegistration, 'active'),
                renewalDate: checkoutRegistration?.metadata?.renewalDate || null,
                externalReference: checkoutRegistration.stripe_subscription_id || checkoutRegistration.stripe_checkout_session_id || '',
                subscriptionId: checkoutRegistration.stripe_subscription_id || '',
                checkoutSessionId: checkoutRegistration.stripe_checkout_session_id || ''
            });
        }

        await CheckoutRegistration.update(checkoutRegistration.id, {
            status: 'completed',
            email_confirmed: 1,
            email_confirmed_at: checkoutRegistration.email_confirmed_at || nowIso,
            email_confirmation_token_hash: null,
            email_confirmation_expires_at: null,
            linked_user_id: user.id,
            owner_user_id: ownerUserId,
            completed_at: nowIso,
            metadata: {
                ...(checkoutRegistration?.metadata && typeof checkoutRegistration.metadata === 'object' ? checkoutRegistration.metadata : {}),
                companyName: normalizedCompanyName,
                completedAt: nowIso
            }
        });

        return res.json({
            success: true,
            message: 'Cadastro concluido com sucesso. Agora voce ja pode entrar no ZapVender.',
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            }
        });

    } catch (error) {

        return res.status(500).json({ error: error.message });

    }

});



app.post('/api/auth/refresh', async (req, res) => {

    try {

        const { refreshToken } = req.body;

        if (!refreshToken) {

            return res.status(400).json({ error: 'Refresh token Ã© obrigatÃ³rio' });

        }

        

        const { verifyToken, generateToken } = require('./middleware/auth');

        const { User } = require('./database/models');

        

        const decoded = verifyToken(refreshToken);

        if (!decoded || decoded.type !== 'refresh') {

            return res.status(401).json({ error: 'Refresh token invÃ¡lido' });

        }

        

        const user = await User.findById(decoded.id);

        if (!user || !user.is_active) {

            return res.status(401).json({ error: 'UsuÃ¡rio nÃ£o encontrado ou inativo' });

        }
        markUserPresenceOnline(user.id);

        

        const token = generateToken(user);

        

        res.json({ success: true, token });

    } catch (error) {

        res.status(500).json({ error: error.message });

    }

});



app.post('/api/auth/presence', authenticate, async (req, res) => {

    try {
        const userId = normalizePresenceUserId(req.user?.id);
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Usuario nao autenticado' });
        }

        markUserPresenceOnline(userId);
        res.json({ success: true, is_online: true, ttl_ms: USER_PRESENCE_TTL_MS });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Erro ao atualizar presenca do usuario' });
    }
});

app.post('/api/auth/logout', authenticate, async (req, res) => {

    try {
        const userId = normalizePresenceUserId(req.user?.id);
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Usuario nao autenticado' });
        }

        markUserPresenceOffline(userId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Erro ao finalizar sessao do usuario' });
    }
});

const ALLOWED_USER_ROLES = new Set(['admin', 'supervisor', 'agent']);

function normalizeUserRoleInput(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'user') return 'agent';
    return ALLOWED_USER_ROLES.has(normalized) ? normalized : 'agent';
}

function isUserAdminRole(value) {
    return String(value || '').trim().toLowerCase() === 'admin';
}

const EMAIL_DELIVERY_SETTINGS_KEY = 'app:email_delivery';

function parseCsvStringSet(value) {
    return new Set(
        String(value || '')
            .split(',')
            .map((item) => String(item || '').trim().toLowerCase())
            .filter(Boolean)
    );
}

function parseCsvIntegerSet(value) {
    const result = new Set();
    String(value || '')
        .split(',')
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && item > 0)
        .forEach((item) => result.add(item));
    return result;
}

const APPLICATION_ADMIN_EMAIL_ALLOWLIST = parseCsvStringSet(
    process.env.APP_ADMIN_EMAILS || process.env.APPLICATION_ADMIN_EMAILS
);
const APPLICATION_ADMIN_USER_ID_ALLOWLIST = parseCsvIntegerSet(
    process.env.APP_ADMIN_USER_IDS || process.env.APPLICATION_ADMIN_USER_IDS
);
const APPLICATION_ADMIN_ALLOW_ALL = parseBooleanEnv(
    process.env.APP_ADMIN_ALLOW_ALL || process.env.APPLICATION_ADMIN_ALLOW_ALL,
    false
);

function isApplicationAdminAllowlistConfigured() {
    return APPLICATION_ADMIN_EMAIL_ALLOWLIST.size > 0 || APPLICATION_ADMIN_USER_ID_ALLOWLIST.size > 0;
}

function isApplicationAdminUser(user) {
    if (!user || !isUserAdminRole(user.role)) {
        return false;
    }

    if (APPLICATION_ADMIN_ALLOW_ALL) {
        return true;
    }

    if (!isApplicationAdminAllowlistConfigured()) {
        return false;
    }

    const userId = Number(user.id || 0);
    if (userId > 0 && APPLICATION_ADMIN_USER_ID_ALLOWLIST.has(userId)) {
        return true;
    }

    const email = String(user.email || '').trim().toLowerCase();
    if (email && APPLICATION_ADMIN_EMAIL_ALLOWLIST.has(email)) {
        return true;
    }

    return false;
}

function ensureApplicationAdmin(req, res) {
    if (isApplicationAdminUser(req?.user)) {
        return true;
    }

    if (!APPLICATION_ADMIN_ALLOW_ALL && !isApplicationAdminAllowlistConfigured()) {
        res.status(403).json({
            success: false,
            error: 'Dashboard admin nao configurado. Defina APP_ADMIN_EMAILS ou APP_ADMIN_USER_IDS.'
        });
        return false;
    }

    res.status(403).json({
        success: false,
        error: 'Sem permissao para acessar o dashboard administrativo da aplicacao'
    });
    return false;
}

function clampEmailRequestTimeoutMs(value, fallback = 10000) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(60000, Math.max(1000, Math.floor(parsed)));
}

function normalizeEmailDeliveryProvider(value, fallback = 'sendgrid') {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'mailgun' || normalized === 'sendgrid' || normalized === 'mailmkt') {
        return normalized;
    }
    return fallback;
}

function maskApiKeyValue(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (raw.length <= 8) return '*'.repeat(Math.max(4, raw.length));
    return `${raw.slice(0, 4)}${'*'.repeat(Math.max(4, raw.length - 8))}${raw.slice(-4)}`;
}

function sanitizeEmailTemplateValue(value, fallback = '') {
    const normalized = String(value || '');
    if (!normalized.trim()) return fallback;
    return normalized;
}

const LEGACY_EMAIL_TEXT_TEMPLATE = [
    'Ola {{name}},',
    '',
    'Para concluir seu cadastro no {{app_name}}, confirme seu email no link abaixo:',
    '{{confirmation_url}}',
    '',
    'Este link expira em {{expires_in_text}}.'
].join('\n');
const LEGACY_EMAIL_HTML_TEMPLATE = [
    '<p>Ola {{name}},</p>',
    '<p>Para concluir seu cadastro no <strong>{{app_name}}</strong>, confirme seu email no link abaixo:</p>',
    '<p><a href="{{confirmation_url}}" target="_blank" rel="noopener noreferrer">Confirmar email</a></p>',
    '<p>Este link expira em {{expires_in_text}}.</p>'
].join('');
const PREVIOUS_EMAIL_TEXT_TEMPLATE = [
    'Ola {{name}},',
    '',
    'Recebemos seu cadastro no {{app_name}}.',
    'Para ativar sua conta, confirme seu e-mail no link abaixo:',
    '{{confirmation_url}}',
    '',
    'Este link expira em {{expires_in_text}}.',
    '',
    '---',
    'ZapVender | Plataforma de atendimento e automacao para WhatsApp',
    'Site: {{company_website}}',
    'Suporte: {{company_email}}'
].join('\n');
const PREVIOUS_EMAIL_HTML_TEMPLATE = [
    '<!doctype html>',
    '<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>',
    '<body style="margin:0;padding:0;background:#f3f5f9;font-family:Arial,Helvetica,sans-serif;color:#142033;">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f5f9;padding:24px 12px;">',
    '<tr><td align="center">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e9f1;">',
    '<tr><td style="background:#0f2e23;padding:20px 24px;" align="left">',
    '<img src="{{logo_url}}" alt="ZapVender" style="display:block;height:36px;width:auto;max-width:180px;">',
    '</td></tr>',
    '<tr><td style="padding:28px 24px;">',
    '<p style="margin:0 0 12px 0;font-size:16px;line-height:1.5;color:#142033;">Ola {{name}},</p>',
    '<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#344054;">Recebemos seu cadastro no <strong>{{app_name}}</strong>. Para ativar sua conta, confirme seu e-mail clicando no botao abaixo.</p>',
    '<p style="margin:0 0 20px 0;"><a href="{{confirmation_url}}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#1dbf73;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:8px;">Confirmar e-mail</a></p>',
    '<p style="margin:0;font-size:13px;line-height:1.6;color:#667085;">Este link expira em {{expires_in_text}}.</p>',
    '</td></tr>',
    '<tr><td style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e4e9f1;">',
    '<p style="margin:0 0 6px 0;font-size:12px;line-height:1.5;color:#667085;"><strong>ZapVender</strong> | Plataforma de atendimento e automacao para WhatsApp.</p>',
    '<p style="margin:0;font-size:12px;line-height:1.5;color:#667085;">Site: <a href="{{company_website}}" target="_blank" rel="noopener noreferrer" style="color:#0f766e;text-decoration:none;">{{company_website}}</a> | Suporte: <a href="mailto:{{company_email}}" style="color:#0f766e;text-decoration:none;">{{company_email}}</a></p>',
    '</td></tr>',
    '</table>',
    '</td></tr>',
    '</table>',
    '</body></html>'
].join('');
const PREVIOUS_EMAIL_HTML_TEMPLATE_V2 = [
    '<!doctype html>',
    '<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>',
    '<body style="margin:0;padding:0;background:#f3f5f9;font-family:Arial,Helvetica,sans-serif;color:#142033;">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f5f9;padding:24px 12px;">',
    '<tr><td align="center">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e9f1;">',
    '<tr><td style="background:#0f2e23;padding:20px 24px;" align="left">',
    '<img src="{{logo_url}}" alt="ZapVender" style="display:block;height:36px;width:auto;max-width:180px;">',
    '</td></tr>',
    '<tr><td style="padding:28px 24px;">',
    '<p style="margin:0 0 12px 0;font-size:16px;line-height:1.5;color:#142033;">OlÃ¡ {{name}},</p>',
    '<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#344054;">Recebemos seu cadastro no <strong>{{app_name}}</strong>. Para ativar sua conta, confirme seu e-mail clicando no botÃ£o abaixo.</p>',
    '<p style="margin:0 0 20px 0;"><a href="{{confirmation_url}}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#1dbf73;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:8px;">Confirmar e-mail</a></p>',
    '<p style="margin:0;font-size:13px;line-height:1.6;color:#667085;">Este link expira em {{expires_in_text}}.</p>',
    '</td></tr>',
    '<tr><td style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e4e9f1;">',
    '<p style="margin:0 0 6px 0;font-size:12px;line-height:1.5;color:#667085;"><strong>ZapVender</strong> | Plataforma de atendimento e automaÃ§Ã£o para WhatsApp.</p>',
    '<p style="margin:0;font-size:12px;line-height:1.5;color:#667085;">Suporte: <a href="mailto:{{company_email}}" style="color:#0f766e;text-decoration:none;">{{company_email}}</a></p>',
    '</td></tr>',
    '</table>',
    '</td></tr>',
    '</table>',
    '</body></html>'
].join('');

function normalizeLegacyEmailTemplateValue(value, currentDefault, legacyDefault) {
    const normalized = String(value || '');
    if (!normalized.trim()) return normalized;
    const candidates = Array.isArray(legacyDefault) ? legacyDefault : [legacyDefault];
    const matchesLegacy = candidates.some((candidate) => (
        normalized.trim() === String(candidate || '').trim()
    ));
    if (matchesLegacy) {
        return currentDefault;
    }
    return normalized;
}

function normalizeLegacyEmailHtmlTemplateLayout(value, currentDefault) {
    const normalized = String(value || '');
    if (!normalized.trim()) return normalized;

    const defaultTrimmed = String(currentDefault || '').trim();
    if (defaultTrimmed && normalized.trim() === defaultTrimmed) {
        return normalized;
    }

    const looksLikeDefaultTemplateFamily = (
        normalized.includes('<tr><td style="padding:28px 24px;">')
        && normalized.includes('{{confirmation_url}}')
        && normalized.includes('{{expires_in_text}}')
        && normalized.includes('Confirmar e-mail')
        && normalized.includes('ZapVender')
    );

    if (!looksLikeDefaultTemplateFamily) {
        return normalized;
    }

    return normalized
        .split('<tr><td style="padding:28px 24px;">').join('<tr><td style="padding:28px 24px;text-align:center;" align="center">')
        .split('font-size:16px;line-height:1.5;color:#142033;">').join('font-size:16px;line-height:1.5;color:#142033;text-align:center;">')
        .split('font-size:15px;line-height:1.6;color:#344054;">').join('font-size:15px;line-height:1.6;color:#344054;text-align:center;">')
        .split('margin:0 0 20px 0;"><a href="{{confirmation_url}}"').join('margin:0 0 20px 0;text-align:center;"><a href="{{confirmation_url}}"')
        .split('font-size:13px;line-height:1.6;color:#667085;">').join('font-size:13px;line-height:1.6;color:#667085;text-align:center;">')
        .split('<tr><td style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e4e9f1;">').join('<tr><td style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e4e9f1;text-align:center;" align="center">')
        .split('font-size:12px;line-height:1.5;color:#667085;">').join('font-size:12px;line-height:1.5;color:#667085;text-align:center;">');
}

function normalizeEmailDeliverySettingsInput(payload = {}, currentSettings = {}) {
    const source = payload && typeof payload === 'object' ? payload : {};
    const current = currentSettings && typeof currentSettings === 'object' ? currentSettings : {};

    const provider = normalizeEmailDeliveryProvider(source.provider ?? current.provider, 'mailgun');
    const sendgridFromEmail = String(source.sendgridFromEmail ?? current.sendgridFromEmail ?? '').trim().toLowerCase();
    const sendgridFromName = String(source.sendgridFromName ?? current.sendgridFromName ?? DEFAULT_APP_NAME).trim() || DEFAULT_APP_NAME;
    const sendgridReplyToEmail = String(source.sendgridReplyToEmail ?? current.sendgridReplyToEmail ?? '').trim().toLowerCase();
    const sendgridReplyToName = String(source.sendgridReplyToName ?? current.sendgridReplyToName ?? '').trim();
    const mailgunDomain = String(source.mailgunDomain ?? current.mailgunDomain ?? '').trim();
    const mailgunBaseUrl = String(source.mailgunBaseUrl ?? current.mailgunBaseUrl ?? '').trim() || 'https://api.mailgun.net';
    const mailgunFromEmail = String(source.mailgunFromEmail ?? current.mailgunFromEmail ?? '').trim().toLowerCase();
    const mailgunFromName = String(source.mailgunFromName ?? current.mailgunFromName ?? DEFAULT_APP_NAME).trim() || DEFAULT_APP_NAME;
    const mailgunReplyToEmail = String(source.mailgunReplyToEmail ?? current.mailgunReplyToEmail ?? '').trim().toLowerCase();
    const mailgunReplyToName = String(source.mailgunReplyToName ?? current.mailgunReplyToName ?? '').trim();
    const requestTimeoutMs = clampEmailRequestTimeoutMs(
        source.requestTimeoutMs ?? current.requestTimeoutMs,
        10000
    );

    const appName = String(source.appName ?? current.appName ?? process.env.APP_NAME ?? DEFAULT_APP_NAME).trim() || DEFAULT_APP_NAME;
    const subjectTemplate = sanitizeEmailTemplateValue(
        source.subjectTemplate ?? current.subjectTemplate,
        DEFAULT_EMAIL_SUBJECT_TEMPLATE
    );
    const htmlTemplate = sanitizeEmailTemplateValue(
        normalizeLegacyEmailHtmlTemplateLayout(
            normalizeLegacyEmailTemplateValue(
                source.htmlTemplate ?? current.htmlTemplate,
                DEFAULT_EMAIL_HTML_TEMPLATE,
                [LEGACY_EMAIL_HTML_TEMPLATE, PREVIOUS_EMAIL_HTML_TEMPLATE, PREVIOUS_EMAIL_HTML_TEMPLATE_V2]
            ),
            DEFAULT_EMAIL_HTML_TEMPLATE
        ),
        DEFAULT_EMAIL_HTML_TEMPLATE
    );
    const textTemplate = sanitizeEmailTemplateValue(
        normalizeLegacyEmailTemplateValue(
            source.textTemplate ?? current.textTemplate,
            DEFAULT_EMAIL_TEXT_TEMPLATE,
            [LEGACY_EMAIL_TEXT_TEMPLATE, PREVIOUS_EMAIL_TEXT_TEMPLATE]
        ),
        DEFAULT_EMAIL_TEXT_TEMPLATE
    );

    const hasSendgridApiKeyInPayload = Object.prototype.hasOwnProperty.call(source, 'sendgridApiKey');
    const sendgridApiKey = hasSendgridApiKeyInPayload
        ? String(source.sendgridApiKey || '').trim()
        : String(current.sendgridApiKey || '').trim();
    const hasMailgunApiKeyInPayload = Object.prototype.hasOwnProperty.call(source, 'mailgunApiKey');
    const mailgunApiKey = hasMailgunApiKeyInPayload
        ? String(source.mailgunApiKey || '').trim()
        : String(current.mailgunApiKey || '').trim();

    return {
        provider,
        appName,
        requestTimeoutMs,
        mailgunApiKey,
        mailgunDomain,
        mailgunBaseUrl,
        mailgunFromEmail,
        mailgunFromName,
        mailgunReplyToEmail,
        mailgunReplyToName,
        sendgridApiKey,
        sendgridFromEmail,
        sendgridFromName,
        sendgridReplyToEmail,
        sendgridReplyToName,
        subjectTemplate,
        htmlTemplate,
        textTemplate
    };
}

async function loadEmailDeliverySettings() {
    const persisted = await Settings.get(EMAIL_DELIVERY_SETTINGS_KEY);
    const raw = persisted && typeof persisted === 'object' ? persisted : {};
    const encryptedSendgridApiKey = String(raw.sendgridApiKeyEncrypted || '').trim();
    const decryptedSendgridApiKey = encryptedSendgridApiKey ? String(decrypt(encryptedSendgridApiKey) || '').trim() : '';
    const encryptedMailgunApiKey = String(raw.mailgunApiKeyEncrypted || '').trim();
    const decryptedMailgunApiKey = encryptedMailgunApiKey ? String(decrypt(encryptedMailgunApiKey) || '').trim() : '';

    return normalizeEmailDeliverySettingsInput(
        {
            provider: raw.provider,
            appName: raw.appName,
            requestTimeoutMs: raw.requestTimeoutMs,
            sendgridApiKey: decryptedSendgridApiKey,
            sendgridFromEmail: raw.sendgridFromEmail,
            sendgridFromName: raw.sendgridFromName,
            sendgridReplyToEmail: raw.sendgridReplyToEmail,
            sendgridReplyToName: raw.sendgridReplyToName,
            mailgunApiKey: decryptedMailgunApiKey,
            mailgunDomain: raw.mailgunDomain,
            mailgunBaseUrl: raw.mailgunBaseUrl,
            mailgunFromEmail: raw.mailgunFromEmail,
            mailgunFromName: raw.mailgunFromName,
            mailgunReplyToEmail: raw.mailgunReplyToEmail,
            mailgunReplyToName: raw.mailgunReplyToName,
            subjectTemplate: raw.subjectTemplate,
            htmlTemplate: raw.htmlTemplate,
            textTemplate: raw.textTemplate
        },
        {
            provider: process.env.EMAIL_DELIVERY_PROVIDER || process.env.EMAIL_PROVIDER || 'mailgun',
            appName: process.env.APP_NAME || DEFAULT_APP_NAME,
            requestTimeoutMs: process.env.EMAIL_REQUEST_TIMEOUT_MS || process.env.MAILGUN_REQUEST_TIMEOUT_MS || process.env.MAILMKT_REQUEST_TIMEOUT_MS || 10000,
            sendgridApiKey: process.env.SENDGRID_API_KEY || '',
            sendgridFromEmail: process.env.SENDGRID_FROM_EMAIL || process.env.EMAIL_FROM || '',
            sendgridFromName: process.env.SENDGRID_FROM_NAME || process.env.APP_NAME || DEFAULT_APP_NAME,
            sendgridReplyToEmail: process.env.SENDGRID_REPLY_TO_EMAIL || '',
            sendgridReplyToName: process.env.SENDGRID_REPLY_TO_NAME || '',
            mailgunApiKey: process.env.MAILGUN_API_KEY || '',
            mailgunDomain: process.env.MAILGUN_DOMAIN || '',
            mailgunBaseUrl: process.env.MAILGUN_BASE_URL || 'https://api.mailgun.net',
            mailgunFromEmail: process.env.MAILGUN_FROM_EMAIL || process.env.EMAIL_FROM || '',
            mailgunFromName: process.env.MAILGUN_FROM_NAME || process.env.APP_NAME || DEFAULT_APP_NAME,
            mailgunReplyToEmail: process.env.MAILGUN_REPLY_TO_EMAIL || '',
            mailgunReplyToName: process.env.MAILGUN_REPLY_TO_NAME || '',
            subjectTemplate: process.env.EMAIL_CONFIRMATION_SUBJECT_TEMPLATE || DEFAULT_EMAIL_SUBJECT_TEMPLATE,
            htmlTemplate: process.env.EMAIL_CONFIRMATION_HTML_TEMPLATE || DEFAULT_EMAIL_HTML_TEMPLATE,
            textTemplate: process.env.EMAIL_CONFIRMATION_TEXT_TEMPLATE || DEFAULT_EMAIL_TEXT_TEMPLATE
        }
    );
}

function serializeEmailDeliverySettingsForStorage(settings = {}) {
    const normalized = normalizeEmailDeliverySettingsInput(settings, settings);
    const encryptedSendgridApiKey = normalized.sendgridApiKey ? encrypt(normalized.sendgridApiKey) : '';
    const encryptedMailgunApiKey = normalized.mailgunApiKey ? encrypt(normalized.mailgunApiKey) : '';

    return {
        provider: normalizeEmailDeliveryProvider(normalized.provider, 'mailgun'),
        appName: normalized.appName,
        requestTimeoutMs: normalized.requestTimeoutMs,
        sendgridApiKeyEncrypted: encryptedSendgridApiKey || null,
        sendgridFromEmail: normalized.sendgridFromEmail,
        sendgridFromName: normalized.sendgridFromName,
        sendgridReplyToEmail: normalized.sendgridReplyToEmail || null,
        sendgridReplyToName: normalized.sendgridReplyToName || null,
        mailgunApiKeyEncrypted: encryptedMailgunApiKey || null,
        mailgunDomain: normalized.mailgunDomain || null,
        mailgunBaseUrl: normalized.mailgunBaseUrl || null,
        mailgunFromEmail: normalized.mailgunFromEmail || null,
        mailgunFromName: normalized.mailgunFromName || null,
        mailgunReplyToEmail: normalized.mailgunReplyToEmail || null,
        mailgunReplyToName: normalized.mailgunReplyToName || null,
        subjectTemplate: normalized.subjectTemplate,
        htmlTemplate: normalized.htmlTemplate,
        textTemplate: normalized.textTemplate
    };
}

function sanitizeEmailDeliverySettingsForResponse(settings = {}) {
    const normalized = normalizeEmailDeliverySettingsInput(settings, settings);
    return {
        provider: normalizeEmailDeliveryProvider(normalized.provider, 'mailgun'),
        appName: normalized.appName,
        requestTimeoutMs: normalized.requestTimeoutMs,
        sendgridFromEmail: normalized.sendgridFromEmail,
        sendgridFromName: normalized.sendgridFromName,
        sendgridReplyToEmail: normalized.sendgridReplyToEmail,
        sendgridReplyToName: normalized.sendgridReplyToName,
        sendgridApiKeyMasked: maskApiKeyValue(normalized.sendgridApiKey),
        hasSendgridApiKey: String(normalized.sendgridApiKey || '').trim().length > 0,
        mailgunFromEmail: normalized.mailgunFromEmail,
        mailgunFromName: normalized.mailgunFromName,
        mailgunDomain: normalized.mailgunDomain,
        mailgunBaseUrl: normalized.mailgunBaseUrl,
        mailgunReplyToEmail: normalized.mailgunReplyToEmail,
        mailgunReplyToName: normalized.mailgunReplyToName,
        mailgunApiKeyMasked: maskApiKeyValue(normalized.mailgunApiKey),
        hasMailgunApiKey: String(normalized.mailgunApiKey || '').trim().length > 0,
        subjectTemplate: normalized.subjectTemplate,
        htmlTemplate: normalized.htmlTemplate,
        textTemplate: normalized.textTemplate
    };
}

async function getRegistrationEmailRuntimeConfig() {
    const settings = await loadEmailDeliverySettings();
    return buildRuntimeEmailDeliveryConfig(settings);
}

function isUserActive(user) {
    return Number(user?.is_active) > 0;
}

function normalizeOwnerUserId(value) {
    const ownerUserId = Number(value || 0);
    return Number.isInteger(ownerUserId) && ownerUserId > 0 ? ownerUserId : 0;
}

function isPrimaryOwnerAdminUser(user, ownerUserId = 0) {
    const userId = Number(user?.id || 0);
    if (!Number.isInteger(userId) || userId <= 0) return false;
    const resolvedOwnerUserId = normalizeOwnerUserId(ownerUserId) || normalizeOwnerUserId(user?.owner_user_id);
    return resolvedOwnerUserId > 0 && userId === resolvedOwnerUserId;
}

function isSameUserOwner(user, ownerUserId) {
    return normalizeOwnerUserId(user?.owner_user_id) === normalizeOwnerUserId(ownerUserId);
}

async function resolveRequesterOwnerUserId(req) {
    const requesterId = Number(req.user?.id || 0);
    let ownerUserId = normalizeOwnerUserId(req.user?.owner_user_id);

    if (!ownerUserId && requesterId > 0) {
        const currentUser = await User.findById(requesterId);
        ownerUserId = normalizeOwnerUserId(currentUser?.owner_user_id);
        if (!ownerUserId) {
            ownerUserId = requesterId;
            await User.update(requesterId, { owner_user_id: ownerUserId });
        }
        if (req.user) {
            req.user.owner_user_id = ownerUserId;
        }
    }

    return ownerUserId;
}

async function countActiveAdminsByOwner(ownerUserId) {
    const ownerId = normalizeOwnerUserId(ownerUserId);
    if (!ownerId) return 0;
    const users = await User.listByOwner(ownerId, { includeInactive: false });
    return (users || []).filter((item) => isUserAdminRole(item.role)).length;
}
function normalizeUserActiveInput(value, fallback = 1) {
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'number') return value > 0 ? 1 : 0;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['1', 'true', 'yes', 'sim', 'on'].includes(normalized)) return 1;
        if (['0', 'false', 'no', 'nao', 'nÃ£o', 'off'].includes(normalized)) return 0;
    }
    return fallback;
}

function sanitizeUserPayload(user, ownerUserId = 0) {
    if (!user) return null;
    const resolvedOwnerUserId = normalizeOwnerUserId(ownerUserId) || normalizeOwnerUserId(user.owner_user_id) || null;
    return {
        id: user.id,
        uuid: user.uuid,
        name: user.name,
        email: user.email,
        role: user.role,
        is_active: Number(user.is_active) > 0 ? 1 : 0,
        email_confirmed: Number(user.email_confirmed) > 0 ? 1 : 0,
        email_confirmed_at: user.email_confirmed_at || null,
        is_online: isUserPresenceOnline(user.id),
        owner_user_id: resolvedOwnerUserId,
        is_primary_admin: isPrimaryOwnerAdminUser(user, resolvedOwnerUserId),
        last_login_at: user.last_login_at,
        created_at: user.created_at
    };
}

app.get('/api/users', authenticate, async (req, res) => {
    try {
        const requesterRole = String(req.user?.role || '').toLowerCase();
        const requesterId = Number(req.user?.id || 0);
        const requesterOwnerUserId = await resolveRequesterOwnerUserId(req);
        const isAdmin = requesterRole === 'admin';

        let users = [];
        if (isAdmin) {
            users = requesterOwnerUserId
                ? await User.listByOwner(requesterOwnerUserId, { includeInactive: false })
                : [];
        } else {
            const me = await User.findById(requesterId);
            users = me && isUserActive(me) ? [me] : [];
        }

        res.json({
            success: true,
            users: (users || [])
                .map((user) => sanitizeUserPayload(user, requesterOwnerUserId))
                .filter(Boolean)
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Erro ao carregar usuÃ¡rios' });
    }
});

app.post('/api/users', authenticate, async (req, res) => {
    try {
        const requesterRole = String(req.user?.role || '').toLowerCase();
        if (requesterRole !== 'admin') {
            return res.status(403).json({ success: false, error: 'Sem permissÃ£o para criar usuÃ¡rios' });
        }

        const requesterOwnerUserId = await resolveRequesterOwnerUserId(req);
        if (!requesterOwnerUserId) {
            return res.status(400).json({ success: false, error: 'Conta administradora invalida' });
        }

        const { hashPassword } = require('./middleware/auth');
        const name = String(req.body?.name || '').trim();
        const email = String(req.body?.email || '').trim().toLowerCase();
        const password = String(req.body?.password || '');
        const role = normalizeUserRoleInput(req.body?.role);

        if (!name || !email || !password) {
            return res.status(400).json({ success: false, error: 'Nome, e-mail e senha sÃ£o obrigatÃ³rios' });
        }

        if (password.length < 6) {
            return res.status(400).json({ success: false, error: 'A senha deve ter pelo menos 6 caracteres' });
        }

        const existing = await User.findActiveByEmail(email);
        if (existing) {
            return res.status(409).json({ success: false, error: 'E-mail jÃ¡ cadastrado' });
        }

        const created = await User.create({
            name,
            email,
            password_hash: hashPassword(password),
            role,
            owner_user_id: requesterOwnerUserId
        });

        const user = await User.findById(created.id);
        res.json({ success: true, user: sanitizeUserPayload(user, requesterOwnerUserId) });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Erro ao criar usuÃ¡rio' });
    }
});

app.put('/api/users/:id', authenticate, async (req, res) => {
    try {
        const targetId = parseInt(req.params.id, 10);
        if (!Number.isInteger(targetId) || targetId <= 0) {
            return res.status(400).json({ success: false, error: 'UsuÃ¡rio invÃ¡lido' });
        }

        const requesterRole = String(req.user?.role || '').toLowerCase();
        const requesterId = Number(req.user?.id || 0);
        const requesterOwnerUserId = await resolveRequesterOwnerUserId(req);
        const isAdmin = requesterRole === 'admin';
        const isSelf = requesterId === targetId;

        if (!isAdmin && !isSelf) {
            return res.status(403).json({ success: false, error: 'Sem permissÃ£o para editar este usuÃ¡rio' });
        }

        const current = await User.findById(targetId);
        if (!current) {
            return res.status(404).json({ success: false, error: 'UsuÃ¡rio nÃ£o encontrado' });
        }

        if (isAdmin && !isSameUserOwner(current, requesterOwnerUserId)) {
            return res.status(403).json({ success: false, error: 'Sem permissao para editar este usuario' });
        }

        const currentIsActiveAdmin = isUserActive(current) && isUserAdminRole(current.role);
        const isPrimaryOwnerAdmin = isPrimaryOwnerAdminUser(current, requesterOwnerUserId);
        const payload = {};

        if (isPrimaryOwnerAdmin && requesterId !== targetId) {
            return res.status(403).json({ success: false, error: 'Somente o admin principal pode editar os proprios dados' });
        }

        if (Object.prototype.hasOwnProperty.call(req.body || {}, 'name')) {
            const name = String(req.body?.name || '').trim();
            if (!name) {
                return res.status(400).json({ success: false, error: 'Nome Ã© obrigatÃ³rio' });
            }
            payload.name = name;
        }

        if (Object.prototype.hasOwnProperty.call(req.body || {}, 'email')) {
            const email = String(req.body?.email || '').trim().toLowerCase();
            const currentEmail = String(current.email || '').trim().toLowerCase();
            if (email && email !== currentEmail) {
                return res.status(400).json({ success: false, error: 'Nao e permitido alterar o e-mail neste cadastro' });
            }
        }

        if (isAdmin && Object.prototype.hasOwnProperty.call(req.body || {}, 'role')) {
            payload.role = normalizeUserRoleInput(req.body?.role);
            if (isPrimaryOwnerAdmin && !isUserAdminRole(payload.role)) {
                return res.status(400).json({ success: false, error: 'Nao e permitido rebaixar o admin principal da conta' });
            }
        }

        if (isAdmin && Object.prototype.hasOwnProperty.call(req.body || {}, 'is_active')) {
            payload.is_active = normalizeUserActiveInput(req.body?.is_active, Number(current.is_active) > 0 ? 1 : 0);
            if (isPrimaryOwnerAdmin && Number(payload.is_active) === 0) {
                return res.status(400).json({ success: false, error: 'Nao e permitido desativar o admin principal da conta' });
            }
            if (Number(current.id) === requesterId && Number(payload.is_active) === 0) {
                return res.status(400).json({ success: false, error: 'NÃ£o Ã© possÃ­vel desativar o prÃ³prio usuÃ¡rio' });
            }
        }

        const nextRole = Object.prototype.hasOwnProperty.call(payload, 'role') ? payload.role : current.role;
        const nextIsActive = Object.prototype.hasOwnProperty.call(payload, 'is_active')
            ? (Number(payload.is_active) > 0 ? 1 : 0)
            : (isUserActive(current) ? 1 : 0);
        const willStopBeingActiveAdmin = currentIsActiveAdmin && (!isUserAdminRole(nextRole) || Number(nextIsActive) === 0);

        if (isPrimaryOwnerAdmin && willStopBeingActiveAdmin) {
            return res.status(400).json({ success: false, error: 'O admin principal da conta deve permanecer ativo como admin' });
        }

        if (willStopBeingActiveAdmin) {
            const activeAdminCount = await countActiveAdminsByOwner(requesterOwnerUserId);
            if (activeAdminCount <= 1) {
                return res.status(400).json({ success: false, error: 'E necessario manter pelo menos um administrador ativo' });
            }
        }
        await User.update(targetId, payload);
        if (Object.prototype.hasOwnProperty.call(payload, 'is_active') && Number(payload.is_active) === 0) {
            markUserPresenceOffline(targetId);
        }
        const updated = await User.findById(targetId);
        res.json({ success: true, user: sanitizeUserPayload(updated, requesterOwnerUserId) });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Erro ao atualizar usuÃ¡rio' });
    }
});

app.delete('/api/users/:id', authenticate, async (req, res) => {
    try {
        const requesterRole = String(req.user?.role || '').toLowerCase();
        const requesterId = Number(req.user?.id || 0);
        const requesterOwnerUserId = await resolveRequesterOwnerUserId(req);
        if (requesterRole !== 'admin') {
            return res.status(403).json({ success: false, error: 'Sem permissao para remover usuarios' });
        }

        const targetId = parseInt(req.params.id, 10);
        if (!Number.isInteger(targetId) || targetId <= 0) {
            return res.status(400).json({ success: false, error: 'Usuario invalido' });
        }

        if (targetId === requesterId) {
            return res.status(400).json({ success: false, error: 'Nao e possivel remover o proprio usuario' });
        }

        const current = await User.findById(targetId);
        if (!current) {
            return res.status(404).json({ success: false, error: 'Usuario nao encontrado' });
        }
        if (!isSameUserOwner(current, requesterOwnerUserId)) {
            return res.status(403).json({ success: false, error: 'Sem permissao para remover este usuario' });
        }
        if (isPrimaryOwnerAdminUser(current, requesterOwnerUserId)) {
            return res.status(400).json({ success: false, error: 'Nao e permitido remover o admin principal da conta' });
        }

        const isTargetActiveAdmin = isUserActive(current) && isUserAdminRole(current.role);
        if (isTargetActiveAdmin) {
            const activeAdminCount = await countActiveAdminsByOwner(requesterOwnerUserId);
            if (activeAdminCount <= 1) {
                return res.status(400).json({ success: false, error: 'E necessario manter pelo menos um administrador ativo' });
            }
        }

        await User.update(targetId, { is_active: 0 });
        markUserPresenceOffline(targetId);
        const updated = await User.findById(targetId);
        res.json({ success: true, user: sanitizeUserPayload(updated, requesterOwnerUserId) });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Erro ao remover usuario' });
    }
});
app.post('/api/auth/change-password', authenticate, async (req, res) => {
    try {
        const userId = Number(req.user?.id || 0);
        if (!userId) {
            return res.status(401).json({ success: false, error: 'UsuÃ¡rio nÃ£o autenticado' });
        }

        const currentPassword = String(req.body?.currentPassword || '');
        const newPassword = String(req.body?.newPassword || '');

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, error: 'Senha atual e nova senha sÃ£o obrigatÃ³rias' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, error: 'A nova senha deve ter pelo menos 6 caracteres' });
        }

        const { verifyPassword, hashPassword } = require('./middleware/auth');
        const user = await User.findByIdWithPassword(userId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'UsuÃ¡rio nÃ£o encontrado' });
        }

        if (!verifyPassword(currentPassword, user.password_hash)) {
            return res.status(400).json({ success: false, error: 'Senha atual invÃ¡lida' });
        }

        await User.updatePassword(userId, hashPassword(newPassword));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Erro ao alterar senha' });
    }
});

// ============================================

function normalizeTagNameInput(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeTagDescriptionInput(value) {
    return String(value || '').trim();
}

function normalizeTagColorInput(value) {
    const raw = String(value || '').trim();
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw)) {
        return raw;
    }
    return '#5a2a6b';
}

const DEFAULT_CONTACT_FIELDS = Object.freeze([
    {
        key: 'nome',
        label: 'Nome',
        source: 'name',
        is_default: true,
        required: true,
        placeholder: 'Nome completo'
    },
    {
        key: 'telefone',
        label: 'Telefone',
        source: 'phone',
        is_default: true,
        required: true,
        placeholder: 'Somente n\u00FAmeros com DDD'
    },
    {
        key: 'email',
        label: 'Email',
        source: 'email',
        is_default: true,
        required: false,
        placeholder: 'email@exemplo.com'
    }
]);

function normalizeContactFieldLabelInput(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 60);
}

function normalizeContactFieldPlaceholderInput(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 120);
}

function normalizeContactFieldKey(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 40);
}

function sanitizeContactFieldDefinition(rawField) {
    if (!rawField || typeof rawField !== 'object' || Array.isArray(rawField)) return null;

    const label = normalizeContactFieldLabelInput(rawField.label || rawField.name || rawField.key);
    const key = normalizeContactFieldKey(rawField.key || label);
    if (!label || !key || key === '__system') return null;
    if (DEFAULT_CONTACT_FIELDS.some((field) => field.key === key)) return null;

    return {
        key,
        label,
        placeholder: normalizeContactFieldPlaceholderInput(rawField.placeholder)
    };
}

function sanitizeStoredContactFields(rawValue) {
    const sourceList = Array.isArray(rawValue)
        ? rawValue
        : (rawValue && typeof rawValue === 'object' && Array.isArray(rawValue.fields) ? rawValue.fields : []);

    const dedupe = new Set();
    const result = [];

    for (const item of sourceList) {
        const sanitized = sanitizeContactFieldDefinition(item);
        if (!sanitized) continue;
        if (dedupe.has(sanitized.key)) continue;
        dedupe.add(sanitized.key);
        result.push(sanitized);
    }

    return result;
}

async function getContactFieldConfig(ownerUserId = null) {
    const settingsKey = buildScopedSettingsKey('contact_data_fields', ownerUserId);
    const raw = await Settings.get(settingsKey);
    const customFields = sanitizeStoredContactFields(raw);
    const defaultFields = DEFAULT_CONTACT_FIELDS.map((field) => ({ ...field }));
    const fields = [
        ...defaultFields,
        ...customFields.map((field) => ({
            ...field,
            source: 'custom',
            is_default: false,
            required: false
        }))
    ];

    return { fields, defaultFields, customFields };
}

app.get('/api/contact-fields', authenticate, async (req, res) => {
    try {
        const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
        const payload = await getContactFieldConfig(ownerScopeUserId);
        res.json({ success: true, ...payload });
    } catch (error) {
        console.error('Falha ao carregar campos de contato:', error);
        res.status(500).json({ success: false, error: 'Erro ao carregar campos de contato' });
    }
});

app.put('/api/contact-fields', authenticate, async (req, res) => {
    try {
        const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
        const settingsKey = buildScopedSettingsKey('contact_data_fields', ownerScopeUserId);
        const incoming = Array.isArray(req.body?.fields) ? req.body.fields : [];
        const customFields = sanitizeStoredContactFields(incoming);
        await Settings.set(settingsKey, customFields, 'json');
        const payload = await getContactFieldConfig(ownerScopeUserId);
        res.json({ success: true, ...payload });
    } catch (error) {
        console.error('Falha ao salvar campos de contato:', error);
        res.status(500).json({ success: false, error: 'Erro ao salvar campos de contato' });
    }
});

// API DE LEADS

// ============================================

const DASHBOARD_PERIOD_METRICS = new Set(['novos_contatos', 'mensagens', 'interacoes']);
const CUSTOM_EVENT_PERIODS = new Map([
    ['this_month', { label: 'Este mes' }],
    ['week', { label: 'Semana' }],
    ['year', { label: 'Ano' }],
    ['last_30_days', { label: 'Ultimos 30 dias' }]
]);
const CUSTOM_EVENT_PERIOD_ALIASES = new Map([
    ['mes', 'this_month'],
    ['month', 'this_month'],
    ['this_month', 'this_month'],
    ['semana', 'week'],
    ['week', 'week'],
    ['ano', 'year'],
    ['year', 'year'],
    ['ultimos_30_dias', 'last_30_days'],
    ['last_30_days', 'last_30_days'],
    ['30d', 'last_30_days']
]);

function normalizePeriodDateInput(value) {
    const normalized = String(value || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
    const parsed = new Date(`${normalized}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) return null;
    return {
        raw: normalized,
        date: parsed
    };
}

function formatUtcDateKey(date) {
    return date.toISOString().slice(0, 10);
}

function formatDateLabelShort(dateKey) {
    const [, month, day] = String(dateKey).split('-');
    if (!month || !day) return dateKey;
    return `${day}/${month}`;
}

function normalizeCustomEventPeriod(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return 'this_month';
    return CUSTOM_EVENT_PERIOD_ALIASES.get(normalized) || 'this_month';
}

function getUtcDayStart(date = new Date()) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function resolveCustomEventPeriodRange(periodInput) {
    const period = normalizeCustomEventPeriod(periodInput);
    const periodMeta = CUSTOM_EVENT_PERIODS.get(period) || CUSTOM_EVENT_PERIODS.get('this_month');
    const todayStart = getUtcDayStart(new Date());
    const endExclusive = new Date(todayStart);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);

    const start = new Date(todayStart);
    if (period === 'week') {
        start.setUTCDate(start.getUTCDate() - 6);
    } else if (period === 'year') {
        start.setUTCMonth(0, 1);
    } else if (period === 'last_30_days') {
        start.setUTCDate(start.getUTCDate() - 29);
    } else {
        start.setUTCDate(1);
    }

    const endInclusive = new Date(endExclusive);
    endInclusive.setUTCDate(endInclusive.getUTCDate() - 1);

    return {
        period,
        label: periodMeta?.label || 'Este mes',
        startDate: start.toISOString().slice(0, 10),
        endDate: endInclusive.toISOString().slice(0, 10),
        startAt: start.toISOString(),
        endAt: endExclusive.toISOString()
    };
}

app.get('/api/dashboard/stats-period', authenticate, async (req, res) => {
    try {
        const metric = String(req.query.metric || 'novos_contatos')
            .trim()
            .toLowerCase();
        const scopedUserId = getScopedUserId(req);
        const ownerScopeUserId = await resolveRequesterOwnerUserId(req);

        if (!DASHBOARD_PERIOD_METRICS.has(metric)) {
            return res.status(400).json({ success: false, error: 'MÃ©trica invÃ¡lida' });
        }

        const startInput = normalizePeriodDateInput(req.query.startDate);
        const endInput = normalizePeriodDateInput(req.query.endDate);

        if (!startInput || !endInput) {
            return res.status(400).json({ success: false, error: 'PerÃ­odo invÃ¡lido' });
        }

        if (startInput.date > endInput.date) {
            return res.status(400).json({ success: false, error: 'Data inicial maior que data final' });
        }

        const maxDaysRange = 370;
        const periodDays = Math.floor((endInput.date.getTime() - startInput.date.getTime()) / 86400000) + 1;
        if (periodDays > maxDaysRange) {
            return res.status(400).json({ success: false, error: `PerÃ­odo mÃ¡ximo Ã© de ${maxDaysRange} dias` });
        }

        const endExclusiveDate = new Date(endInput.date);
        endExclusiveDate.setUTCDate(endExclusiveDate.getUTCDate() + 1);

        const startAt = `${startInput.raw}T00:00:00.000Z`;
        const endExclusiveAt = endExclusiveDate.toISOString();

        let rows = [];
        if (metric === 'novos_contatos') {
            const params = [startAt, endExclusiveAt];
            const ownerFilter = ownerScopeUserId
                ? ' AND EXISTS (SELECT 1 FROM users u WHERE u.id = assigned_to AND (u.owner_user_id = ? OR u.id = ?))'
                : '';
            if (ownerScopeUserId) {
                params.push(ownerScopeUserId, ownerScopeUserId);
            }
            const assignedFilter = scopedUserId ? ' AND assigned_to = ?' : '';
            if (scopedUserId) {
                params.push(scopedUserId);
            }
            rows = await query(
                `
                SELECT
                    TO_CHAR((created_at AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS day,
                    COUNT(*)::int AS total
                FROM leads
                WHERE created_at >= ? AND created_at < ?${ownerFilter}${assignedFilter}
                GROUP BY (created_at AT TIME ZONE 'UTC')::date
                ORDER BY (created_at AT TIME ZONE 'UTC')::date ASC
                `,
                params
            );
        } else if (metric === 'mensagens') {
            const params = [startAt, endExclusiveAt];
            const ownerFilter = ownerScopeUserId
                ? ' AND EXISTS (SELECT 1 FROM users u WHERE u.id = l.assigned_to AND (u.owner_user_id = ? OR u.id = ?))'
                : '';
            if (ownerScopeUserId) {
                params.push(ownerScopeUserId, ownerScopeUserId);
            }
            const assignedFilter = scopedUserId ? ' AND l.assigned_to = ?' : '';
            if (scopedUserId) {
                params.push(scopedUserId);
            }
            rows = await query(
                `
                SELECT
                    TO_CHAR((COALESCE(m.sent_at, m.created_at) AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS day,
                    COUNT(*)::int AS total
                FROM messages m
                LEFT JOIN leads l ON l.id = m.lead_id
                WHERE COALESCE(m.sent_at, m.created_at) >= ? AND COALESCE(m.sent_at, m.created_at) < ?${ownerFilter}${assignedFilter}
                GROUP BY (COALESCE(m.sent_at, m.created_at) AT TIME ZONE 'UTC')::date
                ORDER BY (COALESCE(m.sent_at, m.created_at) AT TIME ZONE 'UTC')::date ASC
                `,
                params
            );
        } else {
            const params = [startAt, endExclusiveAt];
            const ownerFilter = ownerScopeUserId
                ? ' AND EXISTS (SELECT 1 FROM users u WHERE u.id = l.assigned_to AND (u.owner_user_id = ? OR u.id = ?))'
                : '';
            if (ownerScopeUserId) {
                params.push(ownerScopeUserId, ownerScopeUserId);
            }
            const assignedFilter = scopedUserId ? ' AND l.assigned_to = ?' : '';
            if (scopedUserId) {
                params.push(scopedUserId);
            }
            rows = await query(
                `
                SELECT
                    TO_CHAR((COALESCE(m.sent_at, m.created_at) AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS day,
                    COUNT(DISTINCT m.lead_id)::int AS total
                FROM messages m
                LEFT JOIN leads l ON l.id = m.lead_id
                WHERE COALESCE(m.sent_at, m.created_at) >= ? AND COALESCE(m.sent_at, m.created_at) < ?
                  AND m.is_from_me = 0${ownerFilter}${assignedFilter}
                GROUP BY (COALESCE(m.sent_at, m.created_at) AT TIME ZONE 'UTC')::date
                ORDER BY (COALESCE(m.sent_at, m.created_at) AT TIME ZONE 'UTC')::date ASC
                `,
                params
            );
        }

        const totalsByDay = new Map(
            rows.map((row) => [String(row.day), Number(row.total) || 0])
        );

        const labels = [];
        const data = [];
        const points = [];
        const cursor = new Date(startInput.date);

        while (cursor <= endInput.date) {
            const dateKey = formatUtcDateKey(cursor);
            const value = totalsByDay.get(dateKey) || 0;
            const label = formatDateLabelShort(dateKey);
            labels.push(label);
            data.push(value);
            points.push({
                date: dateKey,
                label,
                value
            });
            cursor.setUTCDate(cursor.getUTCDate() + 1);
        }

        res.json({
            success: true,
            metric,
            startDate: startInput.raw,
            endDate: endInput.raw,
            labels,
            data,
            points,
            total: data.reduce((sum, item) => sum + item, 0)
        });
    } catch (error) {
        console.error('Falha ao carregar estatÃ­sticas por perÃ­odo:', error);
        res.status(500).json({ success: false, error: 'Erro ao carregar estatÃ­sticas por perÃ­odo' });
    }
});



function parseBooleanInput(value, fallback = false) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value > 0;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['1', 'true', 'yes', 'sim', 'on'].includes(normalized)) return true;
        if (['0', 'false', 'no', 'nao', 'nÃ£o', 'off'].includes(normalized)) return false;
    }
    return fallback;
}

app.get('/api/custom-events/stats', authenticate, async (req, res) => {
    try {
        const periodRange = resolveCustomEventPeriodRange(req.query.period);
        const onlyActive = parseBooleanInput(
            req.query.active_only ?? req.query.activeOnly ?? req.query.active,
            false
        );
        const ownerScopeUserId = await resolveRequesterOwnerUserId(req);

        const events = await CustomEvent.listWithPeriodTotals(periodRange.startAt, periodRange.endAt, {
            is_active: onlyActive ? 1 : undefined,
            owner_user_id: ownerScopeUserId || undefined
        });

        const totals = events.reduce((acc, event) => {
            const triggers = Number(event.total_period) || 0;
            acc.triggers += triggers;
            if (Number(event.is_active) > 0) acc.activeEvents += 1;
            return acc;
        }, { triggers: 0, activeEvents: 0 });

        res.json({
            success: true,
            period: periodRange.period,
            label: periodRange.label,
            startDate: periodRange.startDate,
            endDate: periodRange.endDate,
            startAt: periodRange.startAt,
            endAt: periodRange.endAt,
            totals: {
                events: events.length,
                activeEvents: totals.activeEvents,
                triggers: totals.triggers
            },
            events
        });
    } catch (error) {
        console.error('Falha ao carregar estatisticas de eventos personalizados:', error);
        res.status(500).json({ success: false, error: 'Erro ao carregar eventos personalizados' });
    }
});

app.get('/api/custom-events', authenticate, async (req, res) => {
    try {
        const hasActiveFilter = Object.prototype.hasOwnProperty.call(req.query, 'active')
            || Object.prototype.hasOwnProperty.call(req.query, 'is_active');
        const activeRaw = req.query.active ?? req.query.is_active;
        const activeFilter = hasActiveFilter ? (parseBooleanInput(activeRaw, true) ? 1 : 0) : undefined;
        const search = String(req.query.search || '').trim();
        const ownerScopeUserId = await resolveRequesterOwnerUserId(req);

        const events = await CustomEvent.list({
            is_active: activeFilter,
            search,
            owner_user_id: ownerScopeUserId || undefined
        });

        res.json({ success: true, events });
    } catch (error) {
        console.error('Falha ao listar eventos personalizados:', error);
        res.status(500).json({ success: false, error: 'Erro ao carregar eventos personalizados' });
    }
});

app.post('/api/custom-events', authenticate, async (req, res) => {
    try {
        const name = String(req.body?.name || '').trim();
        if (!name) {
            return res.status(400).json({ success: false, error: 'Nome do evento e obrigatorio' });
        }
        const ownerScopeUserId = await resolveRequesterOwnerUserId(req);

        const created = await CustomEvent.create({
            name,
            description: req.body?.description,
            event_key: req.body?.event_key ?? req.body?.eventKey ?? req.body?.key,
            is_active: req.body?.is_active ?? req.body?.isActive ?? 1,
            created_by: req.user?.id || null
        });

        const event = await CustomEvent.findById(created.id, {
            owner_user_id: ownerScopeUserId || undefined
        });
        res.status(201).json({ success: true, event });
    } catch (error) {
        const message = String(error?.message || '').trim();
        if (message.includes('Ja existe um evento com esta chave')) {
            return res.status(409).json({ success: false, error: message });
        }
        console.error('Falha ao criar evento personalizado:', error);
        res.status(400).json({ success: false, error: message || 'Erro ao criar evento personalizado' });
    }
});

app.put('/api/custom-events/:id', authenticate, async (req, res) => {
    try {
        const eventId = parseInt(req.params.id, 10);
        if (!Number.isInteger(eventId) || eventId <= 0) {
            return res.status(400).json({ success: false, error: 'ID do evento invalido' });
        }
        const ownerScopeUserId = await resolveRequesterOwnerUserId(req);

        const existing = await CustomEvent.findById(eventId, {
            owner_user_id: ownerScopeUserId || undefined
        });
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Evento nao encontrado' });
        }
        if (!canAccessCreatedRecord(req, existing.created_by)) {
            return res.status(403).json({ success: false, error: 'Sem permissao para editar este evento' });
        }

        const payload = {};
        if (Object.prototype.hasOwnProperty.call(req.body, 'name')) payload.name = req.body.name;
        if (Object.prototype.hasOwnProperty.call(req.body, 'description')) payload.description = req.body.description;
        if (
            Object.prototype.hasOwnProperty.call(req.body, 'event_key')
            || Object.prototype.hasOwnProperty.call(req.body, 'eventKey')
            || Object.prototype.hasOwnProperty.call(req.body, 'key')
        ) {
            payload.event_key = req.body.event_key ?? req.body.eventKey ?? req.body.key;
        }
        if (Object.prototype.hasOwnProperty.call(req.body, 'is_active') || Object.prototype.hasOwnProperty.call(req.body, 'isActive')) {
            payload.is_active = req.body.is_active ?? req.body.isActive;
        }

        await CustomEvent.update(eventId, payload);
        const event = await CustomEvent.findById(eventId, {
            owner_user_id: ownerScopeUserId || undefined
        });
        res.json({ success: true, event });
    } catch (error) {
        const message = String(error?.message || '').trim();
        if (message.includes('Ja existe um evento com esta chave')) {
            return res.status(409).json({ success: false, error: message });
        }
        console.error('Falha ao atualizar evento personalizado:', error);
        res.status(400).json({ success: false, error: message || 'Erro ao atualizar evento personalizado' });
    }
});

app.delete('/api/custom-events/:id', authenticate, async (req, res) => {
    try {
        const eventId = parseInt(req.params.id, 10);
        if (!Number.isInteger(eventId) || eventId <= 0) {
            return res.status(400).json({ success: false, error: 'ID do evento invalido' });
        }
        const ownerScopeUserId = await resolveRequesterOwnerUserId(req);

        const existing = await CustomEvent.findById(eventId, {
            owner_user_id: ownerScopeUserId || undefined
        });
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Evento nao encontrado' });
        }
        if (!canAccessCreatedRecord(req, existing.created_by)) {
            return res.status(403).json({ success: false, error: 'Sem permissao para remover este evento' });
        }

        await CustomEvent.delete(eventId);
        res.json({ success: true });
    } catch (error) {
        console.error('Falha ao remover evento personalizado:', error);
        res.status(500).json({ success: false, error: 'Erro ao remover evento personalizado' });
    }
});

app.get('/api/leads/summary', authenticate, async (req, res) => {
    try {
        const { assigned_to } = req.query;
        const sessionId = sanitizeSessionId(req.query.session_id || req.query.sessionId);
        const scopedUserId = getScopedUserId(req);
        const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
        const requestedAssignedTo = assigned_to ? parseInt(assigned_to, 10) : undefined;
        const resolvedAssignedTo = scopedUserId || requestedAssignedTo;

        const summary = await Lead.summary({
            assigned_to: resolvedAssignedTo,
            owner_user_id: ownerScopeUserId || undefined,
            session_id: sessionId || undefined
        });

        res.json({ success: true, ...summary });
    } catch (error) {
        console.error('Falha ao carregar resumo de leads:', error);
        res.status(500).json({ success: false, error: 'Erro ao carregar resumo de leads' });
    }
});

app.get('/api/leads', authenticate, async (req, res) => {
    try {
        const { status, search, limit, offset, assigned_to } = req.query;
        const sessionId = sanitizeSessionId(req.query.session_id || req.query.sessionId);
        const scopedUserId = getScopedUserId(req);
        const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
        const requestedAssignedTo = assigned_to ? parseInt(assigned_to, 10) : undefined;
        const resolvedAssignedTo = scopedUserId || requestedAssignedTo;

        const leads = await Lead.list({
            status: status ? parseInt(status) : undefined,
            search,
            assigned_to: resolvedAssignedTo,
            owner_user_id: ownerScopeUserId || undefined,
            session_id: sessionId || undefined,
            limit: limit ? parseInt(limit) : 50,
            offset: offset ? parseInt(offset) : 0
        });

        const total = await Lead.count({
            status: status ? parseInt(status) : undefined,
            assigned_to: resolvedAssignedTo,
            owner_user_id: ownerScopeUserId || undefined,
            session_id: sessionId || undefined
        });

        res.json({ success: true, leads, total });
    } catch (error) {
        console.error('Falha ao listar leads:', error);
        res.status(500).json({ success: false, error: 'Erro ao listar leads' });
    }
});

app.get('/api/leads/:id', authenticate, async (req, res) => {

    const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
    const lead = await Lead.findById(req.params.id);

    if (!lead) {

        return res.status(404).json({ error: 'Lead nÃ£o encontrado' });

    }

    if (!await canAccessLeadRecordInOwnerScope(req, lead)) {
        return res.status(404).json({ error: 'Lead nÃ£o encontrado' });
    }

    res.json({ success: true, lead });

});



app.post('/api/leads', authenticate, async (req, res) => {

    try {
        const scopedUserId = getScopedUserId(req);
        const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
        const payload = {
            ...req.body
        };
        if (scopedUserId) {
            payload.assigned_to = scopedUserId;
        }
        if (ownerScopeUserId) {
            payload.owner_user_id = ownerScopeUserId;
        }

        const result = await Lead.create(payload);

        const lead = await Lead.findById(result.id);

        

        webhookService.trigger('lead.created', { lead }, {
            ownerUserId: Number(lead?.owner_user_id || ownerScopeUserId || 0) || undefined
        });

        

        res.json({ success: true, lead });

    } catch (error) {

        res.status(Number(error?.statusCode || 400) || 400).json({
            error: error.message,
            ...(error?.code ? { code: error.code } : {})
        });

    }

});

app.post('/api/leads/bulk', authenticate, async (req, res) => {
    try {
        const leads = Array.isArray(req.body?.leads) ? req.body.leads : [];
        if (leads.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Lista de leads invalida'
            });
        }

        const MAX_BULK_LEADS = 1000;
        if (leads.length > MAX_BULK_LEADS) {
            return res.status(400).json({
                success: false,
                error: `Quantidade maxima por lote: ${MAX_BULK_LEADS}`
            });
        }

        const scopedUserId = getScopedUserId(req);
        const requesterUserId = getRequesterUserId(req);
        const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
        const fallbackAssignedTo = scopedUserId || requesterUserId || null;

        let imported = 0;
        let updated = 0;
        let insertConflicts = 0;
        let skipped = 0;
        let failed = 0;
        const errors = [];
        const normalizedRows = [];

        for (let index = 0; index < leads.length; index += 1) {
            const input = leads[index];
            if (!input || typeof input !== 'object') {
                skipped += 1;
                continue;
            }

            const phone = normalizeImportedLeadPhone(input.phone);
            if (!phone) {
                skipped += 1;
                continue;
            }

            const payload = {
                ...input,
                phone,
                source: input.source || 'import'
            };
            const resolvedName = resolveImportedLeadName(payload);

            const requestedAssignedTo = Number(payload.assigned_to);
            const assignedTo = Number.isInteger(requestedAssignedTo) && requestedAssignedTo > 0
                ? requestedAssignedTo
                : fallbackAssignedTo;

            normalizedRows.push({
                index,
                phone,
                uuid: generateUUID(),
                phone_formatted: String(payload.phone_formatted || payload.phone || phone).trim() || phone,
                jid: String(payload.jid || buildLeadJidFromPhone(phone)).trim() || buildLeadJidFromPhone(phone),
                name: resolvedName,
                email: String(payload.email || '').trim(),
                vehicle: String(payload.vehicle || '').trim(),
                plate: String(payload.plate || '').trim(),
                status: normalizeLeadStatusForImport(payload.status, 1),
                tags: parseLeadTagsForMerge(payload.tags),
                custom_fields: parseLeadCustomFields(payload.custom_fields),
                source: String(payload.source || 'import').trim() || 'import',
                assigned_to: Number.isInteger(assignedTo) && assignedTo > 0 ? assignedTo : null,
                owner_user_id: ownerScopeUserId || null
            });
        }

        if (normalizedRows.length > 0) {
            const uniquePhones = Array.from(new Set(normalizedRows.map((row) => row.phone)));
            const existingRows = ownerScopeUserId
                ? await query(`
                    SELECT id, phone, name, email, tags, custom_fields
                    FROM leads
                    WHERE phone = ANY(?::text[])
                      AND (
                          owner_user_id = ?
                          OR (
                              owner_user_id IS NULL
                              AND EXISTS (
                                  SELECT 1
                                  FROM users owner_scope
                                  WHERE owner_scope.id = leads.assigned_to
                                    AND (owner_scope.owner_user_id = ? OR owner_scope.id = ?)
                              )
                          )
                      )
                `, [uniquePhones, ownerScopeUserId, ownerScopeUserId, ownerScopeUserId])
                : await query(
                    'SELECT id, phone, name, email, tags, custom_fields FROM leads WHERE phone = ANY(?::text[])',
                    [uniquePhones]
                );

            if (ownerScopeUserId) {
                const existingPhones = new Set(
                    (existingRows || [])
                        .map((row) => String(row?.phone || '').trim())
                        .filter(Boolean)
                );
                const requestedNewContacts = uniquePhones.filter((phone) => !existingPhones.has(phone)).length;
                await planLimitsService.assertOwnerCanCreateLead(ownerScopeUserId, requestedNewContacts);
            }

            const stateByPhone = new Map();
            for (const row of existingRows || []) {
                const phone = String(row?.phone || '').trim();
                if (!phone) continue;
                stateByPhone.set(phone, {
                    existsInDb: true,
                    id: Number(row.id),
                    phone,
                    name: String(row.name || ''),
                    email: String(row.email || '').trim(),
                    tags: parseLeadTagsForMerge(row.tags),
                    custom_fields: parseLeadCustomFields(row.custom_fields)
                });
            }

            const stagedInsertsByPhone = new Map();
            const stagedUpdatesByLeadId = new Map();
            const pendingInsertUpdateEventsByPhone = new Map();
            let updatedExistingEvents = 0;

            for (const row of normalizedRows) {
                let state = stateByPhone.get(row.phone);

                if (!state) {
                    state = {
                        ...row,
                        existsInDb: false,
                        name: sanitizeLeadNameForInsert(row.name) || row.phone,
                        tags: parseLeadTagsForMerge(row.tags),
                        custom_fields: parseLeadCustomFields(row.custom_fields)
                    };
                    stateByPhone.set(row.phone, state);
                    stagedInsertsByPhone.set(row.phone, state);
                    continue;
                }

                const updates = {};
                const incomingName = sanitizeAutoName(row.name);
                if (incomingName) {
                    updates.name = incomingName;
                }

                const incomingEmail = String(row.email || '').trim();
                const existingEmail = String(state.email || '').trim();
                if (incomingEmail && (!existingEmail || existingEmail !== incomingEmail)) {
                    updates.email = incomingEmail;
                }

                const incomingTags = parseLeadTagsForMerge(row.tags);
                if (incomingTags.length > 0) {
                    const existingTags = parseLeadTagsForMerge(state.tags);
                    updates.tags = Array.from(new Set([...existingTags, ...incomingTags]));
                }

                const incomingCustomFields = parseLeadCustomFields(row.custom_fields);
                if (Object.keys(incomingCustomFields).length > 0) {
                    updates.custom_fields = mergeLeadCustomFields(state.custom_fields, incomingCustomFields);
                }

                if (Object.keys(updates).length === 0) {
                    skipped += 1;
                    continue;
                }

                if (Object.prototype.hasOwnProperty.call(updates, 'name')) {
                    state.name = updates.name;
                }
                if (Object.prototype.hasOwnProperty.call(updates, 'email')) {
                    state.email = updates.email;
                }
                if (Object.prototype.hasOwnProperty.call(updates, 'tags')) {
                    state.tags = updates.tags;
                }
                if (Object.prototype.hasOwnProperty.call(updates, 'custom_fields')) {
                    state.custom_fields = updates.custom_fields;
                }

                stateByPhone.set(row.phone, state);

                if (state.existsInDb) {
                    updatedExistingEvents += 1;
                    const pending = stagedUpdatesByLeadId.get(state.id) || { id: state.id };

                    if (Object.prototype.hasOwnProperty.call(updates, 'name')) {
                        pending.name = String(state.name || '');
                    }
                    if (Object.prototype.hasOwnProperty.call(updates, 'email')) {
                        pending.email = String(state.email || '').trim();
                    }
                    if (Object.prototype.hasOwnProperty.call(updates, 'tags')) {
                        pending.tags = JSON.stringify(parseLeadTagsForMerge(state.tags));
                    }
                    if (Object.prototype.hasOwnProperty.call(updates, 'custom_fields')) {
                        pending.custom_fields = JSON.stringify(parseLeadCustomFields(state.custom_fields));
                    }

                    stagedUpdatesByLeadId.set(state.id, pending);
                } else {
                    const eventCount = Number(pendingInsertUpdateEventsByPhone.get(state.phone) || 0);
                    pendingInsertUpdateEventsByPhone.set(state.phone, eventCount + 1);
                    stagedInsertsByPhone.set(state.phone, state);
                }
            }

            let appliedPendingInsertUpdates = 0;

            if (stagedInsertsByPhone.size > 0) {
                const insertPayload = Array.from(stagedInsertsByPhone.values()).map((item) => ({
                    uuid: String(item.uuid || '').trim(),
                    phone: String(item.phone || '').trim(),
                    phone_formatted: String(item.phone_formatted || item.phone || '').trim(),
                    jid: String(item.jid || '').trim(),
                    name: String(item.name || '').trim(),
                    email: String(item.email || '').trim(),
                    vehicle: String(item.vehicle || '').trim(),
                    plate: String(item.plate || '').trim(),
                    status: normalizeLeadStatusForImport(item.status, 1),
                    tags: JSON.stringify(parseLeadTagsForMerge(item.tags)),
                    custom_fields: JSON.stringify(parseLeadCustomFields(item.custom_fields)),
                    source: String(item.source || 'import').trim() || 'import',
                    assigned_to: Number.isInteger(Number(item.assigned_to)) && Number(item.assigned_to) > 0
                        ? Number(item.assigned_to)
                        : null,
                    owner_user_id: Number.isInteger(Number(item.owner_user_id)) && Number(item.owner_user_id) > 0
                        ? Number(item.owner_user_id)
                        : null
                }));

                const insertedRows = await query(`
                    INSERT INTO leads (
                        uuid, phone, phone_formatted, jid, name, email, vehicle, plate,
                        status, tags, custom_fields, source, assigned_to, owner_user_id
                    )
                    SELECT
                        data.uuid,
                        data.phone,
                        NULLIF(TRIM(data.phone_formatted), ''),
                        NULLIF(TRIM(data.jid), ''),
                        COALESCE(NULLIF(TRIM(data.name), ''), data.phone),
                        NULLIF(TRIM(data.email), ''),
                        NULLIF(TRIM(data.vehicle), ''),
                        NULLIF(TRIM(data.plate), ''),
                        COALESCE(data.status, 1),
                        data.tags,
                        data.custom_fields,
                        COALESCE(NULLIF(TRIM(data.source), ''), 'import'),
                        data.assigned_to,
                        data.owner_user_id
                    FROM jsonb_to_recordset(?::jsonb) AS data(
                        uuid text,
                        phone text,
                        phone_formatted text,
                        jid text,
                        name text,
                        email text,
                        vehicle text,
                        plate text,
                        status integer,
                        tags text,
                        custom_fields text,
                        source text,
                        assigned_to integer,
                        owner_user_id integer
                    )
                    ON CONFLICT (owner_user_id, phone) WHERE owner_user_id IS NOT NULL DO NOTHING
                    RETURNING phone
                `, [JSON.stringify(insertPayload)]);

                const insertedPhones = new Set(
                    (insertedRows || [])
                        .map((row) => String(row?.phone || '').trim())
                        .filter(Boolean)
                );

                imported += insertedPhones.size;
                const chunkInsertConflicts = Math.max(insertPayload.length - insertedPhones.size, 0);
                if (chunkInsertConflicts > 0) {
                    insertConflicts += chunkInsertConflicts;
                    skipped += chunkInsertConflicts;
                }

                for (const [phone, count] of pendingInsertUpdateEventsByPhone.entries()) {
                    if (!insertedPhones.has(phone)) continue;
                    appliedPendingInsertUpdates += Number(count || 0);
                }
            }

            if (stagedUpdatesByLeadId.size > 0) {
                const updatePayload = Array.from(stagedUpdatesByLeadId.values());
                await run(`
                    WITH incoming AS (
                        SELECT *
                        FROM jsonb_to_recordset(?::jsonb) AS data(
                            id integer,
                            name text,
                            email text,
                            tags text,
                            custom_fields text
                        )
                    )
                    UPDATE leads AS l
                    SET
                        name = COALESCE(NULLIF(TRIM(incoming.name), ''), l.name),
                        email = COALESCE(incoming.email, l.email),
                        tags = COALESCE(incoming.tags, l.tags),
                        custom_fields = COALESCE(incoming.custom_fields, l.custom_fields),
                        updated_at = CURRENT_TIMESTAMP
                    FROM incoming
                    WHERE l.id = incoming.id
                `, [JSON.stringify(updatePayload)]);
            }

            updated += appliedPendingInsertUpdates + updatedExistingEvents;
        }

        res.json({
            success: true,
            total: leads.length,
            imported,
            updated,
            insertConflicts,
            skipped,
            failed,
            errors
        });
    } catch (error) {
        console.error('Falha ao importar leads em lote:', error);
        res.status(Number(error?.statusCode || 500) || 500).json({
            success: false,
            error: error?.message || 'Erro ao importar leads em lote',
            ...(error?.code ? { code: error.code } : {})
        });
    }
});

app.post('/api/leads/bulk-delete', authenticate, async (req, res) => {
    try {
        const rawLeadIds = Array.isArray(req.body?.leadIds) ? req.body.leadIds : [];
        const leadIds = Array.from(
            new Set(
                rawLeadIds
                    .map((value) => parseInt(value, 10))
                    .filter((value) => Number.isInteger(value) && value > 0)
            )
        );

        if (leadIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Lista de IDs invÃ¡lida'
            });
        }

        const MAX_BULK_DELETE_LEADS = 2000;
        if (leadIds.length > MAX_BULK_DELETE_LEADS) {
            return res.status(400).json({
                success: false,
                error: `Quantidade maxima por lote: ${MAX_BULK_DELETE_LEADS}`
            });
        }

        let deleted = 0;
        let skipped = 0;
        let failed = 0;
        const errors = [];
        const ownerScopeUserId = await resolveRequesterOwnerUserId(req);

        const existingLeads = await query(
            'SELECT id, assigned_to, owner_user_id FROM leads WHERE id = ANY(?::int[])',
            [leadIds]
        );
        const leadById = new Map(
            (existingLeads || []).map((lead) => [Number(lead.id), lead])
        );
        const allowedLeadIds = [];

        for (const leadId of leadIds) {
            const lead = leadById.get(leadId);
            if (!lead) {
                skipped += 1;
                continue;
            }

            if (!await canAccessLeadRecordInOwnerScope(req, lead, ownerScopeUserId || null)) {
                skipped += 1;
                continue;
            }

            allowedLeadIds.push(leadId);
        }

        if (allowedLeadIds.length > 0) {
            try {
                const bulkDeleteResult = await Lead.bulkDelete(allowedLeadIds);
                const deletedCount = Number(bulkDeleteResult?.changes || 0);
                const notDeletedCount = Math.max(allowedLeadIds.length - deletedCount, 0);
                deleted += deletedCount;
                skipped += notDeletedCount;
            } catch (error) {
                failed += allowedLeadIds.length;
                if (errors.length < 25) {
                    errors.push({
                        error: String(error?.message || 'Erro ao excluir leads em lote')
                    });
                }
            }
        }

        res.json({
            success: true,
            total: leadIds.length,
            deleted,
            skipped,
            failed,
            errors
        });
    } catch (error) {
        console.error('Falha ao excluir leads em lote:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao excluir leads em lote'
        });
    }
});

app.post('/api/leads/bulk-update', authenticate, async (req, res) => {
    try {
        const rawLeadIds = Array.isArray(req.body?.leadIds) ? req.body.leadIds : [];
        const leadIds = Array.from(
            new Set(
                rawLeadIds
                    .map((value) => parseInt(value, 10))
                    .filter((value) => Number.isInteger(value) && value > 0)
            )
        );

        if (leadIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Lista de IDs invÃ¡lida'
            });
        }

        const MAX_BULK_UPDATE_LEADS = 2000;
        if (leadIds.length > MAX_BULK_UPDATE_LEADS) {
            return res.status(400).json({
                success: false,
                error: `Quantidade maxima por lote: ${MAX_BULK_UPDATE_LEADS}`
            });
        }

        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const hasStatusField = Object.prototype.hasOwnProperty.call(body, 'status');
        const requestedStatus = hasStatusField ? normalizeLeadStatus(body.status, null) : null;

        if (hasStatusField && requestedStatus === null) {
            return res.status(400).json({
                success: false,
                error: `Status invalido. Use ${LEAD_STATUS_VALUES.join(', ')}.`
            });
        }

        const addTagsInput = Object.prototype.hasOwnProperty.call(body, 'addTags')
            ? body.addTags
            : body.tags;
        const removeTagsInput = Object.prototype.hasOwnProperty.call(body, 'removeTags')
            ? body.removeTags
            : body.remove_tags;
        const tagsToAdd = Array.from(new Set(parseLeadTagsForMerge(addTagsInput)));
        const tagsToRemove = Array.from(new Set(parseLeadTagsForMerge(removeTagsInput)));
        const tagsToRemoveKeys = new Set(tagsToRemove.map((tag) => String(tag || '').trim().toLowerCase()).filter(Boolean));

        if (!hasStatusField && tagsToAdd.length === 0 && tagsToRemove.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Nenhuma alteraÃ§Ã£o informada (status, addTags ou removeTags)'
            });
        }

        const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
        const existingLeads = await query(
            'SELECT id, assigned_to, owner_user_id, status, tags FROM leads WHERE id = ANY(?::int[])',
            [leadIds]
        );
        const leadById = new Map(
            (existingLeads || []).map((lead) => [Number(lead.id), lead])
        );

        const canAccessLeadCache = new Map();
        const canAccessLeadScoped = async (leadRecord) => {
            const cacheKey = `${Number(leadRecord?.owner_user_id || 0)}:${Number(leadRecord?.assigned_to || 0)}`;
            if (canAccessLeadCache.has(cacheKey)) {
                return canAccessLeadCache.get(cacheKey) === true;
            }

            const allowed = await canAccessLeadRecordInOwnerScope(req, leadRecord, ownerScopeUserId || null);
            canAccessLeadCache.set(cacheKey, allowed === true);
            return allowed === true;
        };

        let updated = 0;
        let skipped = 0;
        let failed = 0;
        let statusChanged = 0;
        let tagsUpdated = 0;
        let tagsRemoved = 0;
        const errors = [];

        for (const leadId of leadIds) {
            const lead = leadById.get(leadId);
            if (!lead) {
                skipped += 1;
                continue;
            }

            if (!await canAccessLeadScoped(lead)) {
                skipped += 1;
                continue;
            }

            try {
                const updateData = {};
                let tagsWereUpdated = false;
                let tagsWereRemoved = false;

                if (hasStatusField && Number(lead.status) !== Number(requestedStatus)) {
                    updateData.status = requestedStatus;
                }

                if (tagsToAdd.length > 0 || tagsToRemove.length > 0) {
                    const currentTags = parseLeadTagsForMerge(lead.tags);
                    const hadRemovableTags = tagsToRemoveKeys.size > 0
                        && currentTags.some((tag) => tagsToRemoveKeys.has(String(tag || '').trim().toLowerCase()));
                    let mergedTags = Array.from(new Set([...currentTags, ...tagsToAdd]));
                    if (tagsToRemoveKeys.size > 0) {
                        mergedTags = mergedTags.filter(
                            (tag) => !tagsToRemoveKeys.has(String(tag || '').trim().toLowerCase())
                        );
                    }
                    const tagsChanged = mergedTags.length !== currentTags.length
                        || mergedTags.some((tag, index) => tag !== currentTags[index]);

                    if (tagsChanged) {
                        updateData.tags = mergedTags;
                        tagsWereUpdated = true;
                        tagsWereRemoved = hadRemovableTags;
                    }
                }

                if (Object.keys(updateData).length === 0) {
                    skipped += 1;
                    continue;
                }

                const oldStatus = normalizeAutomationStatus(lead.status);
                await Lead.update(leadId, updateData);

                const updatedLead = await Lead.findById(leadId);
                if (!updatedLead) {
                    failed += 1;
                    if (errors.length < 25) {
                        errors.push({ id: leadId, error: 'Lead nÃ£o encontrado apÃ³s atualizaÃ§Ã£o' });
                    }
                    continue;
                }

                updated += 1;
                if (tagsWereUpdated) {
                    tagsUpdated += 1;
                }
                if (tagsWereRemoved) {
                    tagsRemoved += 1;
                }

                webhookService.trigger('lead.updated', { lead: updatedLead }, {
                    ownerUserId: Number(updatedLead?.owner_user_id || ownerScopeUserId || 0) || undefined
                });

                const hasStatusInPayload = Object.prototype.hasOwnProperty.call(updateData, 'status');
                const newStatus = hasStatusInPayload
                    ? normalizeAutomationStatus(updateData.status)
                    : oldStatus;
                const didChangeStatus = oldStatus !== null && newStatus !== null && oldStatus !== newStatus;

                if (didChangeStatus) {
                    statusChanged += 1;

                    webhookService.trigger('lead.status_changed', {
                        lead: updatedLead,
                        oldStatus,
                        newStatus
                    }, {
                        ownerUserId: Number(updatedLead?.owner_user_id || ownerScopeUserId || 0) || undefined
                    });

                    try {
                        const statusConversation = await Conversation.findByLeadId(updatedLead.id, null);
                        await scheduleAutomations({
                            event: AUTOMATION_EVENT_TYPES.STATUS_CHANGE,
                            sessionId: statusConversation?.session_id || DEFAULT_AUTOMATION_SESSION_ID,
                            lead: updatedLead,
                            conversation: statusConversation || null,
                            oldStatus,
                            newStatus,
                            text: ''
                        });
                    } catch (automationError) {
                        console.error(`Falha ao agendar automacoes para lead ${leadId} em bulk status:`, automationError);
                    }
                }
            } catch (error) {
                failed += 1;
                if (errors.length < 25) {
                    errors.push({
                        id: leadId,
                        error: String(error?.message || 'Erro ao atualizar lead em lote')
                    });
                }
            }
        }

        res.json({
            success: true,
            total: leadIds.length,
            updated,
            skipped,
            failed,
            statusChanged,
            tagsUpdated,
            tagsRemoved,
            errors
        });
    } catch (error) {
        console.error('Falha ao atualizar leads em lote:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao atualizar leads em lote'
        });
    }
});



app.put('/api/leads/:id', authenticate, async (req, res) => {

    const lead = await Lead.findById(req.params.id);

    if (!lead) {

        return res.status(404).json({ error: 'Lead nÃ£o encontrado' });

    }

    if (!await canAccessLeadRecordInOwnerScope(req, lead)) {
        return res.status(404).json({ error: 'Lead nÃ£o encontrado' });
    }

    

    const oldStatus = normalizeAutomationStatus(lead.status);
    const updateData = { ...req.body };

    if (Object.prototype.hasOwnProperty.call(updateData, 'status')) {
        const normalizedStatus = normalizeLeadStatus(updateData.status, null);
        if (normalizedStatus === null) {
            return res.status(400).json({
                error: `Status invalido. Use ${LEAD_STATUS_VALUES.join(', ')}.`
            });
        }
        updateData.status = normalizedStatus;
    }

    if (Object.prototype.hasOwnProperty.call(updateData, 'name')) {
        const manualName = sanitizeAutoName(updateData.name);
        if (manualName) {
            updateData.name = manualName;
            updateData.custom_fields = lockLeadNameAsManual(
                mergeLeadCustomFields(lead.custom_fields, updateData.custom_fields),
                manualName
            );
        } else {
            delete updateData.name;
        }
    }

    await Lead.update(req.params.id, updateData);

    const updatedLead = await Lead.findById(req.params.id);

    

    webhookService.trigger('lead.updated', { lead: updatedLead }, {
        ownerUserId: Number(updatedLead?.owner_user_id || 0) || undefined
    });

    

    const hasStatusInPayload = Object.prototype.hasOwnProperty.call(updateData, 'status');
    const newStatus = hasStatusInPayload
        ? normalizeAutomationStatus(updateData.status)
        : oldStatus;
    const statusChanged = oldStatus !== null && newStatus !== null && oldStatus !== newStatus;

    if (statusChanged) {
        webhookService.trigger('lead.status_changed', {
            lead: updatedLead,
            oldStatus,
            newStatus
        }, {
            ownerUserId: Number(updatedLead?.owner_user_id || 0) || undefined
        });

        const statusSessionId = sanitizeSessionId(
            req.body?.session_id || req.body?.sessionId || req.query?.session_id || req.query?.sessionId
        );
        const statusConversation = await Conversation.findByLeadId(updatedLead.id, statusSessionId || null);
        await scheduleAutomations({
            event: AUTOMATION_EVENT_TYPES.STATUS_CHANGE,
            sessionId: statusConversation?.session_id || statusSessionId || DEFAULT_AUTOMATION_SESSION_ID,
            lead: updatedLead,
            conversation: statusConversation || null,
            oldStatus,
            newStatus,
            text: ''
        });
    }

    

    res.json({ success: true, lead: updatedLead });

});



app.delete('/api/leads/:id', authenticate, async (req, res) => {
    try {
        const leadId = parseInt(req.params.id, 10);
        if (!Number.isInteger(leadId) || leadId <= 0) {
            return res.status(400).json({
                success: false,
                error: 'ID de lead invalido'
            });
        }

        const lead = await Lead.findById(leadId);
        if (!lead) {
            return res.status(404).json({
                success: false,
                error: 'Lead nao encontrado'
            });
        }

        if (!await canAccessLeadRecordInOwnerScope(req, lead)) {
            return res.status(404).json({
                success: false,
                error: 'Lead nao encontrado'
            });
        }

        await Lead.delete(leadId);

        res.json({ success: true });
    } catch (error) {
        console.error('Falha ao excluir lead:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao excluir lead'
        });
    }
});



// ============================================

// API DE TAGS

// ============================================

async function listCampaignsWithTagFilterInScope(ownerScopeUserId = null) {
    const normalizedOwnerScopeUserId = normalizeOwnerUserId(ownerScopeUserId);
    const params = [];
    let sql = `
        SELECT c.id, c.tag_filter
        FROM campaigns c
        WHERE c.tag_filter IS NOT NULL
          AND TRIM(c.tag_filter) <> ''
    `;

    if (normalizedOwnerScopeUserId) {
        sql += `
          AND (
              c.created_by = ?
              OR EXISTS (
                  SELECT 1
                  FROM users owner_scope
                  WHERE owner_scope.id = c.created_by
                    AND (owner_scope.owner_user_id = ? OR owner_scope.id = ?)
              )
          )
        `;
        params.push(normalizedOwnerScopeUserId, normalizedOwnerScopeUserId, normalizedOwnerScopeUserId);
    }

    return await query(sql, params);
}

async function rewriteCampaignTagFiltersByTagName(currentTagName, nextTagName = null, ownerScopeUserId = null) {
    const currentTagKey = normalizeCampaignTag(currentTagName);
    if (!currentTagKey) return;

    const normalizedNextTagName = normalizeCampaignTagLabel(nextTagName);
    const campaigns = await listCampaignsWithTagFilterInScope(ownerScopeUserId);

    for (const campaign of campaigns || []) {
        const existingFilters = parseCampaignTagFilters(campaign?.tag_filter);
        if (!existingFilters.length) continue;

        let hasChanges = false;
        const seen = new Set();
        const nextFilters = [];

        for (const tagName of existingFilters) {
            const tagKey = normalizeCampaignTag(tagName);
            if (!tagKey) continue;

            if (tagKey === currentTagKey) {
                hasChanges = true;
                if (normalizedNextTagName) {
                    const normalizedNextTagKey = normalizeCampaignTag(normalizedNextTagName);
                    if (normalizedNextTagKey && !seen.has(normalizedNextTagKey)) {
                        seen.add(normalizedNextTagKey);
                        nextFilters.push(normalizedNextTagName);
                    }
                }
                continue;
            }

            if (seen.has(tagKey)) continue;
            seen.add(tagKey);
            nextFilters.push(tagName);
        }

        if (!hasChanges) continue;

        await run(
            `UPDATE campaigns
             SET tag_filter = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [normalizeCampaignTagFilterInput(nextFilters), campaign.id]
        );
    }
}

app.get('/api/tags', authenticate, async (req, res) => {
    try {
        const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
        const tagScope = {
            owner_user_id: ownerScopeUserId || undefined
        };

        try {
            await Tag.syncFromLeads(tagScope);
        } catch (syncError) {
            console.warn('Falha ao sincronizar tags a partir dos leads:', syncError);
        }
        const tags = await Tag.list(tagScope);
        res.json({ success: true, tags });
    } catch (error) {
        console.error('Falha ao listar tags:', error);
        res.status(500).json({ success: false, error: 'Erro ao carregar tags' });
    }
});

app.post('/api/tags', authenticate, async (req, res) => {
    try {
        const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
        const requesterUserId = getRequesterUserId(req);
        const tagScope = {
            owner_user_id: ownerScopeUserId || undefined
        };
        const name = normalizeTagNameInput(req.body?.name);
        const color = normalizeTagColorInput(req.body?.color);
        const description = normalizeTagDescriptionInput(req.body?.description);

        if (!name) {
            return res.status(400).json({ success: false, error: 'Nome da tag Ã© obrigatÃ³rio' });
        }

        const existing = await Tag.findByName(name, tagScope);
        if (existing) {
            return res.status(409).json({ success: false, error: 'JÃ¡ existe uma tag com este nome' });
        }

        const tag = await Tag.create(
            { name, color, description, created_by: requesterUserId || undefined },
            { ...tagScope, created_by: requesterUserId || undefined }
        );
        res.status(201).json({ success: true, tag });
    } catch (error) {
        console.error('Falha ao criar tag:', error);
        res.status(500).json({ success: false, error: 'Erro ao criar tag' });
    }
});

app.put('/api/tags/:id', authenticate, async (req, res) => {
    try {
        const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
        const tagScope = {
            owner_user_id: ownerScopeUserId || undefined
        };
        const tagId = parseInt(req.params.id, 10);
        if (!Number.isInteger(tagId) || tagId <= 0) {
            return res.status(400).json({ success: false, error: 'ID de tag invÃ¡lido' });
        }

        const currentTag = await Tag.findById(tagId, tagScope);
        if (!currentTag) {
            return res.status(404).json({ success: false, error: 'Tag nÃ£o encontrada' });
        }

        const payload = {};
        if (Object.prototype.hasOwnProperty.call(req.body, 'name')) {
            const nextName = normalizeTagNameInput(req.body.name);
            if (!nextName) {
                return res.status(400).json({ success: false, error: 'Nome da tag Ã© obrigatÃ³rio' });
            }

            const duplicate = await Tag.findByName(nextName, tagScope);
            if (duplicate && Number(duplicate.id) !== tagId) {
                return res.status(409).json({ success: false, error: 'JÃ¡ existe uma tag com este nome' });
            }
            payload.name = nextName;
        }
        if (Object.prototype.hasOwnProperty.call(req.body, 'color')) {
            payload.color = normalizeTagColorInput(req.body.color);
        }
        if (Object.prototype.hasOwnProperty.call(req.body, 'description')) {
            payload.description = normalizeTagDescriptionInput(req.body.description);
        }

        const updatedTag = await Tag.update(tagId, payload, tagScope);
        if (!updatedTag) {
            return res.status(404).json({ success: false, error: 'Tag nÃ£o encontrada' });
        }

        if (
            payload.name &&
            normalizeTagNameInput(currentTag.name).toLowerCase() !== normalizeTagNameInput(updatedTag.name).toLowerCase()
        ) {
            await Tag.renameInLeads(currentTag.name, updatedTag.name, tagScope);
            await rewriteCampaignTagFiltersByTagName(currentTag.name, updatedTag.name, ownerScopeUserId || null);
        }

        res.json({ success: true, tag: updatedTag });
    } catch (error) {
        console.error('Falha ao atualizar tag:', error);
        res.status(500).json({ success: false, error: 'Erro ao atualizar tag' });
    }
});

app.delete('/api/tags/:id', authenticate, async (req, res) => {
    try {
        const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
        const tagScope = {
            owner_user_id: ownerScopeUserId || undefined
        };
        const tagId = parseInt(req.params.id, 10);
        if (!Number.isInteger(tagId) || tagId <= 0) {
            return res.status(400).json({ success: false, error: 'ID de tag invÃ¡lido' });
        }

        const currentTag = await Tag.findById(tagId, tagScope);
        if (!currentTag) {
            return res.status(404).json({ success: false, error: 'Tag nÃ£o encontrada' });
        }

        const deleted = await Tag.delete(tagId, tagScope);
        if (!deleted) {
            return res.status(404).json({ success: false, error: 'Tag nao encontrada' });
        }

        await Tag.removeFromLeads(currentTag.name, tagScope);
        await rewriteCampaignTagFiltersByTagName(currentTag.name, null, ownerScopeUserId || null);

        res.json({ success: true });
    } catch (error) {
        console.error('Falha ao remover tag:', error);
        res.status(500).json({ success: false, error: 'Erro ao remover tag' });
    }
});



// ============================================

// API DE MENSAGENS

// ============================================



app.get('/api/conversations', authenticate, async (req, res) => {
    const { status, assigned_to, session_id, limit, offset } = req.query;
    const scopedUserId = getScopedUserId(req);
    const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
    const requestedAssignedTo = assigned_to ? parseInt(assigned_to) : undefined;
    const resolvedAssignedTo = scopedUserId || requestedAssignedTo;
    const conversations = await Conversation.list({
        status,
        assigned_to: resolvedAssignedTo,
        owner_user_id: ownerScopeUserId || undefined,
        session_id,
        limit: limit ? parseInt(limit) : 100,
        offset: offset ? parseInt(offset) : 0
    });
    const lastMessages = await Message.getLastMessagesByConversationIds(
        conversations.map((conversation) => conversation.id)
    );
    const lastMessageByConversationId = new Map(
        lastMessages.map((message) => [Number(message.conversation_id), message])
    );

    const previewForMedia = (mediaType) => {
        switch (mediaType) {
            case 'image':
                return '[imagem]';
            case 'video':
                return '[video]';
            case 'audio':
                return '[audio]';
            case 'document':
                return '[documento]';
            case 'sticker':
                return '[sticker]';
            default:
                return '[mensagem]';
        }
    };

    const normalizePhoneSuffix = (value) => {
        if (!value) return '';
        const digits = String(value).replace(/\D/g, '');
        if (!digits) return '';
        return digits.length >= 11 ? digits.slice(-11) : digits;
    };

    const normalized = conversations.map((c) => {
        const lastMessage = lastMessageByConversationId.get(Number(c.id)) || null;
        const decrypted = lastMessage?.content_encrypted
            ? decryptMessage(lastMessage.content_encrypted)
            : lastMessage?.content;

        let metadata = {};
        try {
            metadata = c?.metadata ? JSON.parse(c.metadata) : {};
        } catch (_) {
            metadata = {};
        }
        const metadataLastMessage = normalizeText(metadata?.last_message || '');
        const metadataLastMessageAt = normalizeText(metadata?.last_message_at || '');
        const lastMessageWasFromMe = Boolean(lastMessage?.is_from_me);
        const unreadCount = lastMessageWasFromMe ? 0 : Math.max(0, Number(c?.unread_count || 0));

        const lastMessageText =
            (decrypted || '').trim() ||
            (lastMessage ? previewForMedia(lastMessage.media_type) : '') ||
            metadataLastMessage ||
            (unreadCount > 0 ? '[mensagem recebida]' : '');

        const lastMessageAt =
            lastMessage?.sent_at ||
            lastMessage?.created_at ||
            metadataLastMessageAt ||
            c?.updated_at ||
            c?.created_at ||
            null;

        const leadCustomFields = parseLeadCustomFields(c?.lead_custom_fields);
        const avatarUrl = normalizeLeadAvatarUrl(
            leadCustomFields?.[LEAD_AVATAR_CUSTOM_FIELD_KEY] || leadCustomFields?.avatarUrl
        );

        let name = normalizeText(c.lead_name);
        const sessionPhone = getSessionPhone(c.session_id);
        const phoneDigits = normalizePhoneDigits(c.phone);
        const sessionDigits = normalizePhoneDigits(sessionPhone);
        if (isSelfPhone(phoneDigits, sessionDigits)) {
            const sessionName = normalizeText(getSessionDisplayName(c.session_id) || 'UsuÃ¡rio');
            name = sessionName ? `${sessionName} (VocÃª)` : 'VocÃª';
        }

        return {
            ...c,
            unread: unreadCount,
            lastMessage: normalizeText(lastMessageText),
            lastMessageAt,
            name,
            phone: c.phone,
            avatar_url: avatarUrl || null
        };
    }).filter((conv) => {
        if (!conv.lastMessageAt && !conv.lastMessage && Number(conv?.unread || 0) <= 0) {
            return false;
        }
        return true;
    });

    const deduped = new Map();
    for (const conv of normalized) {
        const phoneKey = normalizePhoneSuffix(conv.phone);
        const sessionKey = sanitizeSessionId(conv.session_id || conv.sessionId || '');
        const baseKey = phoneKey || String(conv.lead_id || conv.id);
        const key = sessionKey ? `${sessionKey}::${baseKey}` : baseKey;
        if (!deduped.has(key)) {
            deduped.set(key, conv);
            continue;
        }
        const existing = deduped.get(key);
        const existingTime = existing?.lastMessageAt ? new Date(existing.lastMessageAt).getTime() : 0;
        const currentTime = conv?.lastMessageAt ? new Date(conv.lastMessageAt).getTime() : 0;
        if (currentTime >= existingTime) {
            deduped.set(key, conv);
        }
    }

    const sorted = Array.from(deduped.values()).sort((a, b) => {
        const aTime = a?.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bTime = b?.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return bTime - aTime;
    });

    res.json({ success: true, conversations: sorted });
});





app.post('/api/conversations/:id/read', authenticate, async (req, res) => {

    const conversationId = parseInt(req.params.id, 10);
    const ownerScopeUserId = await resolveRequesterOwnerUserId(req);

    if (!conversationId) {

        return res.status(400).json({ error: 'ID de conversa invalido' });

    }

    try {
        const conversation = await Conversation.findById(conversationId);
        const hasAccess = conversation
            ? await canAccessConversationInOwnerScope(req, conversation, ownerScopeUserId)
            : false;
        if (!conversation || !hasAccess) {
            return res.status(404).json({ error: 'Conversa nao encontrada' });
        }

        await Conversation.markAsRead(conversationId);

        res.json({ success: true });

    } catch (error) {

        res.status(500).json({ error: error.message });

    }

});

app.post('/api/send', authenticate, async (req, res) => {

    const { sessionId, to, message, type, options } = req.body;
    const scopedUserId = getScopedUserId(req);
    const ownerScopeUserId = await resolveRequesterOwnerUserId(req);

    

    if (!sessionId || !to || !message) {

        return res.status(400).json({ error: 'ParÃ¢metros obrigatÃ³rios: sessionId, to, message' });

    }

    

    try {
        const normalizedSessionId = sanitizeSessionId(sessionId);
        if (ownerScopeUserId && normalizedSessionId) {
            const allowedSession = await WhatsAppSession.findBySessionId(normalizedSessionId, {
                owner_user_id: ownerScopeUserId
            });
            if (!allowedSession) {
                return res.status(403).json({ error: 'Sem permissao para usar esta conta WhatsApp' });
            }
        }

        const sendOptions = {
            ...(options || {}),
            ...(scopedUserId ? { assigned_to: scopedUserId } : {})
        };

        const result = await sendMessage(sessionId, to, message, type || 'text', sendOptions);

        const responseTimestamp = result?.savedMessage?.sent_at || result?.sentAt || new Date().toISOString();
        res.json({

            success: true,

            messageId: result.key.id,

            timestamp: responseTimestamp,
            sentAt: responseTimestamp

        });

    } catch (error) {

        res.status(500).json({ error: error.message });

    }

});



app.post('/api/messages/send', authenticate, async (req, res) => {

    const { leadId, phone, content, type, options, sessionId } = req.body;
    const scopedUserId = getScopedUserId(req);
    const ownerScopeUserId = await resolveRequesterOwnerUserId(req);



    let to = phone;

    if (!to && leadId) {

        const lead = await Lead.findById(leadId);
        const hasAccess = lead
            ? await canAccessLeadRecordInOwnerScope(req, lead, ownerScopeUserId)
            : false;
        if (!lead || !hasAccess) {
            return res.status(404).json({ error: 'Lead nao encontrado' });
        }

        to = lead?.phone;

    }



    if (!to || !content) {

        return res.status(400).json({ error: 'ParÃ¢metros obrigatÃ³rios: phone/to e content' });

    }



    try {

        const resolvedSessionId = resolveSessionIdOrDefault(sessionId);
        if (ownerScopeUserId && resolvedSessionId) {
            const allowedSession = await WhatsAppSession.findBySessionId(resolvedSessionId, {
                owner_user_id: ownerScopeUserId
            });
            if (!allowedSession) {
                return res.status(403).json({ error: 'Sem permissao para usar esta conta WhatsApp' });
            }
        }
        const sendOptions = {
            ...(options || {}),
            ...(scopedUserId ? { assigned_to: scopedUserId } : {})
        };
        const result = await sendMessage(resolvedSessionId, to, content, type || 'text', sendOptions);

        const responseTimestamp = result?.savedMessage?.sent_at || result?.sentAt || new Date().toISOString();
        res.json({

            success: true,

            messageId: result.key.id,

            timestamp: responseTimestamp,
            sentAt: responseTimestamp

        });

    } catch (error) {

        res.status(500).json({ error: error.message });

    }

});



async function countMissingStickerMediaForConversation(conversationId) {
    const normalizedConversationId = Number(conversationId);
    if (!Number.isFinite(normalizedConversationId) || normalizedConversationId <= 0) return 0;

    try {
        const rows = await query(`
            SELECT COUNT(*) AS total
            FROM messages
            WHERE conversation_id = ?
              AND LOWER(COALESCE(media_type, '')) = 'sticker'
              AND COALESCE(TRIM(media_url), '') = ''
        `, [normalizedConversationId]);

        return Math.max(0, Number(rows?.[0]?.total || 0) || 0);
    } catch (error) {
        console.warn(`[rehydrate-sticker] Falha ao contar stickers pendentes na conversa ${normalizedConversationId}:`, error.message);
        return 0;
    }
}

app.get('/api/messages/:leadId', authenticate, async (req, res) => {
    const leadId = Number(req.params.leadId);
    const limit = parseInt(req.query.limit) || 100;
    const conversationId = Number(req.query.conversation_id || req.query.conversationId);
    const hasConversationId = Number.isFinite(conversationId) && conversationId > 0;
    const sessionId = sanitizeSessionId(req.query.session_id || req.query.sessionId);
    const contactJid = normalizeJid(req.query.contact_jid || req.query.contactJid);
    const ownerScopeUserId = await resolveRequesterOwnerUserId(req);

    let messages = [];
    let resolvedConversation = null;
    let resolvedLead = null;

    if (hasConversationId) {
        const conversation = await Conversation.findById(conversationId);
        const conversationSessionId = sanitizeSessionId(conversation?.session_id);
        if (conversation && (!sessionId || conversationSessionId === sessionId)) {
            resolvedConversation = conversation;
        }
        if (resolvedConversation) {
            resolvedLead = await Lead.findById(resolvedConversation.lead_id);
            messages = await Message.listByConversation(resolvedConversation.id, { limit });
        }
    } else if (Number.isFinite(leadId) && leadId > 0) {
        resolvedLead = await Lead.findById(leadId);
        const conversation = await Conversation.findByLeadId(leadId, sessionId || null);
        if (conversation) {
            resolvedConversation = conversation;
            messages = await Message.listByConversation(conversation.id, { limit });
        } else {
            messages = [];
        }
    }

    const hasConversationAccess = resolvedConversation
        ? await canAccessConversationInOwnerScope(req, resolvedConversation, ownerScopeUserId)
        : false;

    if (resolvedLead && !hasConversationAccess && !(await canAccessAssignedRecordInOwnerScope(req, resolvedLead.assigned_to, ownerScopeUserId))) {
        return res.status(404).json({ success: false, error: 'Lead nao encontrado' });
    }
    if (!resolvedLead && resolvedConversation && !hasConversationAccess) {
        return res.status(404).json({ success: false, error: 'Conversa nao encontrada' });
    }

    const backfillSessionId = sanitizeSessionId(
        sessionId || resolvedConversation?.session_id
    );
    const hasMissingMedia = messages.some((item) => {
        const mediaType = String(item?.media_type || '').trim().toLowerCase();
        if (!mediaType || mediaType === 'text') return false;
        return !String(item?.media_url || '').trim();
    });
    if ((messages.length === 0 || hasMissingMedia) && resolvedConversation && backfillSessionId) {
        const backfillResult = await backfillConversationMessagesFromStore({
            sessionId: backfillSessionId,
            conversation: resolvedConversation,
            lead: resolvedLead,
            contactJid,
            limit: Math.max(limit, 50)
        });
        if ((backfillResult.inserted || 0) > 0 || (backfillResult.hydratedMedia || 0) > 0) {
            messages = await Message.listByConversation(resolvedConversation.id, { limit });
        }
    }

    const decrypted = messages.map(m => {
        const raw = m.content_encrypted ? decryptMessage(m.content_encrypted) : m.content;
        let text = raw;
        if ((!text || !String(text).trim()) && m.media_type && m.media_type !== 'text') {
            text = previewForMedia(m.media_type);
        }
        text = normalizeText(text);
        return {
            ...m,
            content: text
        };
    });

    res.json({ success: true, messages: decrypted });
});

app.post('/api/messages/:leadId/rehydrate-missing-media', authenticate, async (req, res) => {
    const leadId = Number(req.params.leadId);
    const payload = req.body || {};
    const requestedLimit = Number(payload.limit || req.query.limit);
    const limit = Math.max(50, Math.min(Number.isFinite(requestedLimit) ? requestedLimit : 250, 500));
    const conversationId = Number(
        payload.conversation_id ||
        payload.conversationId ||
        req.query.conversation_id ||
        req.query.conversationId
    );
    const hasConversationId = Number.isFinite(conversationId) && conversationId > 0;
    const sessionId = sanitizeSessionId(
        payload.session_id ||
        payload.sessionId ||
        req.query.session_id ||
        req.query.sessionId
    );
    const contactJid = normalizeJid(
        payload.contact_jid ||
        payload.contactJid ||
        req.query.contact_jid ||
        req.query.contactJid
    );
    const ownerScopeUserId = await resolveRequesterOwnerUserId(req);

    let resolvedConversation = null;
    let resolvedLead = null;

    if (hasConversationId) {
        const conversation = await Conversation.findById(conversationId);
        const conversationSessionId = sanitizeSessionId(conversation?.session_id);
        if (conversation && (!sessionId || conversationSessionId === sessionId)) {
            resolvedConversation = conversation;
        }
        if (resolvedConversation) {
            resolvedLead = await Lead.findById(resolvedConversation.lead_id);
        }
    } else if (Number.isFinite(leadId) && leadId > 0) {
        resolvedLead = await Lead.findById(leadId);
        const conversation = await Conversation.findByLeadId(leadId, sessionId || null);
        if (conversation) {
            resolvedConversation = conversation;
        }
    }

    const hasConversationAccess = resolvedConversation
        ? await canAccessConversationInOwnerScope(req, resolvedConversation, ownerScopeUserId)
        : false;

    if (resolvedLead && !hasConversationAccess && !(await canAccessAssignedRecordInOwnerScope(req, resolvedLead.assigned_to, ownerScopeUserId))) {
        return res.status(404).json({ success: false, error: 'Lead nao encontrado' });
    }
    if (!resolvedLead && resolvedConversation && !hasConversationAccess) {
        return res.status(404).json({ success: false, error: 'Conversa nao encontrada' });
    }
    if (!resolvedConversation) {
        return res.status(404).json({ success: false, error: 'Conversa nao encontrada' });
    }

    const backfillSessionId = sanitizeSessionId(sessionId || resolvedConversation.session_id);
    if (!backfillSessionId) {
        return res.status(400).json({ success: false, error: 'Sessao da conversa nao encontrada' });
    }

    try {
        const runtimeSession = sessions.get(backfillSessionId);
        if (runtimeSession?.socket && runtimeSession?.store) {
            try {
                await triggerChatSync(backfillSessionId, runtimeSession.socket, runtimeSession.store, 0);
            } catch (syncError) {
                console.warn(`[${backfillSessionId}] Falha no sync manual para reidratacao de midia:`, syncError.message);
            }
        }

        const missingStickersBefore = await countMissingStickerMediaForConversation(resolvedConversation.id);
        const backfillResult = await backfillConversationMessagesFromStore({
            sessionId: backfillSessionId,
            conversation: resolvedConversation,
            lead: resolvedLead,
            contactJid: contactJid || resolvedLead?.jid || resolvedLead?.phone || '',
            limit
        });
        const missingStickersAfter = await countMissingStickerMediaForConversation(resolvedConversation.id);

        return res.json({
            success: true,
            conversationId: resolvedConversation.id,
            leadId: resolvedLead?.id || resolvedConversation.lead_id || null,
            sessionId: backfillSessionId,
            limit,
            backfill: backfillResult || createStoreBackfillResult(),
            missingStickersBefore,
            missingStickersAfter
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error?.message || 'Falha ao reidratar midias da conversa'
        });
    }
});



// ============================================

// API DE FILA

// ============================================



app.get('/api/queue/status', authenticate, async (req, res) => {
    const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
    res.json({
        success: true,
        ...(await queueService.getStatus({
            ownerUserId: ownerScopeUserId || undefined
        }))
    });

});



app.post('/api/queue/add', authenticate, async (req, res) => {
    try {
        const {
            leadId,
            conversationId,
            campaignId,
            content,
            mediaType,
            mediaUrl,
            priority,
            scheduledAt,
            sessionId,
            isFirstContact,
            assignmentMeta
        } = req.body || {};

        const normalizedLeadId = Number(leadId);
        if (!Number.isInteger(normalizedLeadId) || normalizedLeadId <= 0) {
            return res.status(400).json({ success: false, error: 'leadId invalido' });
        }

        const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
        const lead = await Lead.findById(normalizedLeadId);
        if (!lead) {
            return res.status(404).json({ success: false, error: 'Lead nao encontrado' });
        }

        const hasLeadAccess = await canAccessLeadRecordInOwnerScope(req, lead, ownerScopeUserId || null);
        if (!hasLeadAccess) {
            return res.status(403).json({ success: false, error: 'Sem permissao para enfileirar mensagens para este lead' });
        }

        const normalizedConversationId = Number(conversationId);
        let resolvedConversationId = null;
        if (Number.isInteger(normalizedConversationId) && normalizedConversationId > 0) {
            const conversation = await Conversation.findById(normalizedConversationId);
            if (!conversation) {
                return res.status(404).json({ success: false, error: 'Conversa nao encontrada' });
            }

            const hasConversationAccess = await canAccessConversationInOwnerScope(req, conversation, ownerScopeUserId || null);
            if (!hasConversationAccess) {
                return res.status(403).json({ success: false, error: 'Sem permissao para enfileirar nesta conversa' });
            }

            if (Number(conversation.lead_id) !== normalizedLeadId) {
                return res.status(400).json({ success: false, error: 'Conversa informada nao pertence ao lead' });
            }

            resolvedConversationId = normalizedConversationId;
        }

        let resolvedSessionId = sanitizeSessionId(sessionId);
        if (resolvedSessionId) {
            const hasSessionAccess = await canAccessSessionRecordInOwnerScope(req, resolvedSessionId, ownerScopeUserId || null);
            if (!hasSessionAccess) {
                return res.status(403).json({ success: false, error: 'Sem permissao para usar esta conta de WhatsApp' });
            }
        } else {
            const allocation = await senderAllocatorService.allocateForSingleLead({
                leadId: normalizedLeadId,
                campaignId,
                strategy: 'round_robin',
                ownerUserId: ownerScopeUserId || undefined
            });
            resolvedSessionId = sanitizeSessionId(allocation?.sessionId);
        }

        const result = await queueService.add({
            leadId: normalizedLeadId,
            conversationId: resolvedConversationId,
            campaignId,
            sessionId: resolvedSessionId || null,
            isFirstContact: isFirstContact !== false,
            assignmentMeta: assignmentMeta || null,
            content,
            mediaType,
            mediaUrl,
            priority,
            scheduledAt
        });

        return res.json({ success: true, ...result });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error?.message || 'Falha ao adicionar mensagem na fila'
        });
    }

});



app.post('/api/queue/bulk', authenticate, async (req, res) => {
    try {
        const { leadIds, content } = req.body || {};
        const options = (req.body && typeof req.body.options === 'object' && req.body.options !== null)
            ? { ...req.body.options }
            : {};

        const parseNonNegative = (value) => {
            const parsed = Number(value);
            return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
        };

        const legacyDelay = parseNonNegative(req.body?.delay);
        const legacyDelayMin = parseNonNegative(req.body?.delayMin ?? req.body?.delay_min);
        const legacyDelayMax = parseNonNegative(req.body?.delayMax ?? req.body?.delay_max);

        if (options.delayMs === undefined && legacyDelay !== null) {
            options.delayMs = legacyDelay;
        }
        if (options.delayMinMs === undefined && legacyDelayMin !== null) {
            options.delayMinMs = legacyDelayMin;
        }
        if (options.delayMaxMs === undefined && legacyDelayMax !== null) {
            options.delayMaxMs = legacyDelayMax;
        }

        const hasSessionAssignments = options.sessionAssignments && typeof options.sessionAssignments === 'object';
        const normalizedLeadIds = Array.from(
            new Set(
                Array.isArray(leadIds)
                    ? leadIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
                    : []
            )
        );
        if (!normalizedLeadIds.length) {
            return res.status(400).json({ success: false, error: 'leadIds invalido' });
        }

        const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
        const leadRows = await query(
            'SELECT id, assigned_to, owner_user_id FROM leads WHERE id = ANY(?::int[])',
            [normalizedLeadIds]
        );
        const leadById = new Map((leadRows || []).map((lead) => [Number(lead.id), lead]));
        const missingLeadIds = normalizedLeadIds.filter((id) => !leadById.has(id));
        if (missingLeadIds.length > 0) {
            return res.status(404).json({
                success: false,
                error: 'Um ou mais leads nao foram encontrados',
                missing_lead_ids: missingLeadIds
            });
        }

        for (const leadIdValue of normalizedLeadIds) {
            const leadRecord = leadById.get(leadIdValue);
            const allowed = await canAccessLeadRecordInOwnerScope(req, leadRecord, ownerScopeUserId || null);
            if (!allowed) {
                return res.status(403).json({
                    success: false,
                    error: 'Sem permissao para enfileirar para um ou mais leads'
                });
            }
        }

        const fixedSessionId = sanitizeSessionId(
            options.sessionId || options.session_id || req.body?.sessionId || req.body?.session_id
        );
        const senderAccounts = normalizeSenderAccountsPayload(
            options.senderAccounts || options.sender_accounts || req.body?.sender_accounts || req.body?.senderAccounts
        );
        const distributionStrategy = normalizeCampaignDistributionStrategy(
            options.distributionStrategy || options.distribution_strategy || req.body?.distribution_strategy,
            fixedSessionId ? 'single' : (senderAccounts.length ? 'weighted_round_robin' : 'round_robin')
        );

        const sessionIdsToValidate = new Set();
        if (fixedSessionId) sessionIdsToValidate.add(fixedSessionId);
        for (const account of senderAccounts) {
            const accountSessionId = sanitizeSessionId(account?.session_id || account?.sessionId);
            if (accountSessionId) sessionIdsToValidate.add(accountSessionId);
        }
        if (hasSessionAssignments) {
            for (const leadIdValue of normalizedLeadIds) {
                const assignedSessionId = sanitizeSessionId(
                    options.sessionAssignments[String(leadIdValue)]
                    || options.sessionAssignments[leadIdValue]
                );
                if (assignedSessionId) sessionIdsToValidate.add(assignedSessionId);
            }
        }

        for (const sessionIdToValidate of sessionIdsToValidate) {
            const hasSessionAccess = await canAccessSessionRecordInOwnerScope(req, sessionIdToValidate, ownerScopeUserId || null);
            if (!hasSessionAccess) {
                return res.status(403).json({
                    success: false,
                    error: `Sem permissao para usar a conta de WhatsApp ${sessionIdToValidate}`
                });
            }
        }

        let distribution = { strategyUsed: fixedSessionId ? 'single' : distributionStrategy, summary: {} };
        if (!hasSessionAssignments) {
            const allocationPlan = await senderAllocatorService.buildDistributionPlan({
                leadIds: normalizedLeadIds,
                campaignId: options.campaignId || req.body?.campaignId || null,
                senderAccounts,
                strategy: distributionStrategy,
                sessionId: fixedSessionId || null,
                ownerUserId: ownerScopeUserId || undefined
            });
            options.sessionAssignments = allocationPlan.assignmentsByLead;
            options.assignmentMetaByLead = allocationPlan.assignmentMetaByLead;
            distribution = {
                strategyUsed: allocationPlan.strategyUsed,
                summary: allocationPlan.summary || {}
            };
        }

        options.ownerUserId = ownerScopeUserId || undefined;
        const results = await queueService.addBulk(normalizedLeadIds, content, options);

        return res.json({
            success: true,
            queued: results.length,
            distribution: {
                strategy: distribution.strategyUsed,
                by_session: distribution.summary
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error?.message || 'Falha ao enfileirar disparo em massa'
        });
    }

});



app.delete('/api/queue/:id', authenticate, async (req, res) => {
    const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
    const cancelled = await queueService.cancel(req.params.id, {
        ownerUserId: ownerScopeUserId || undefined
    });
    if (!cancelled) {
        return res.status(404).json({ success: false, error: 'Mensagem da fila nao encontrada' });
    }
    res.json({ success: true });

});



app.delete('/api/queue', authenticate, async (req, res) => {
    const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
    const count = await queueService.cancelAll({
        ownerUserId: ownerScopeUserId || undefined
    });

    res.json({ success: true, cancelled: count });

});



// ============================================

// API DE TEMPLATES

// ============================================



app.get('/api/templates', authenticate, async (req, res) => {

    const scopedUserId = getScopedUserId(req);
    const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
    const templates = await Template.list({
        ...req.query,
        owner_user_id: ownerScopeUserId || undefined,
        created_by: scopedUserId || undefined
    });

    res.json({ success: true, templates });

});



app.post('/api/templates', authenticate, async (req, res) => {

    const payload = {
        ...req.body,
        created_by: req.user?.id
    };
    const result = await Template.create(payload);

    const template = await Template.findById(result.id);

    res.json({ success: true, template });

});



app.put('/api/templates/:id', authenticate, async (req, res) => {
    const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
    const existing = await Template.findById(req.params.id, {
        owner_user_id: ownerScopeUserId || undefined,
        created_by: getScopedUserId(req) || undefined
    });
    if (!existing) {
        return res.status(404).json({ error: 'Template nao encontrado' });
    }
    if (!canAccessCreatedRecord(req, existing.created_by)) {
        return res.status(403).json({ error: 'Sem permissao para editar este template' });
    }

    await Template.update(req.params.id, req.body);

    const template = await Template.findById(req.params.id, {
        owner_user_id: ownerScopeUserId || undefined,
        created_by: getScopedUserId(req) || undefined
    });

    res.json({ success: true, template });

});



app.delete('/api/templates/:id', authenticate, async (req, res) => {
    const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
    const existing = await Template.findById(req.params.id, {
        owner_user_id: ownerScopeUserId || undefined,
        created_by: getScopedUserId(req) || undefined
    });
    if (!existing) {
        return res.status(404).json({ error: 'Template nao encontrado' });
    }
    if (!canAccessCreatedRecord(req, existing.created_by)) {
        return res.status(403).json({ error: 'Sem permissao para remover este template' });
    }

    await Template.delete(req.params.id);

    res.json({ success: true });

});



// ============================================

// API DE CAMPANHAS

// ============================================
const SUPPORTED_CAMPAIGN_TYPES = new Set(['broadcast', 'drip']);
const MAX_CAMPAIGN_MESSAGE_VARIATIONS = 10;

function normalizeCampaignMessageVariations(value) {
    if (!Array.isArray(value)) return [];

    const normalized = [];
    const seen = new Set();

    for (const item of value) {
        const text = String(item || '')
            .replace(/\r\n/g, '\n')
            .trim();
        if (!text || seen.has(text)) continue;
        seen.add(text);
        normalized.push(text);
        if (normalized.length >= MAX_CAMPAIGN_MESSAGE_VARIATIONS) break;
    }

    return normalized;
}

function readCampaignMessageVariationsFromConfig(campaignOrConfig) {
    if (!campaignOrConfig) return [];

    const directTopLevel = normalizeCampaignMessageVariations(campaignOrConfig.message_variations);
    if (directTopLevel.length) return directTopLevel;

    const configSource = Object.prototype.hasOwnProperty.call(campaignOrConfig, 'distribution_config')
        ? campaignOrConfig.distribution_config
        : campaignOrConfig;
    const parsedConfig = parseCampaignDistributionConfig(configSource);

    return normalizeCampaignMessageVariations(parsedConfig?.message_variations);
}

function buildBroadcastCampaignMessagePool(campaign) {
    const pool = [];
    const seen = new Set();

    const baseMessage = String(campaign?.message || '')
        .replace(/\r\n/g, '\n')
        .trim();
    if (baseMessage) {
        pool.push(baseMessage);
        seen.add(baseMessage);
    }

    for (const variation of readCampaignMessageVariationsFromConfig(campaign)) {
        if (!variation || seen.has(variation)) continue;
        seen.add(variation);
        pool.push(variation);
    }

    return pool;
}

function pickRandomCampaignMessagePoolEntry(pool = [], fallback = '') {
    if (!Array.isArray(pool) || pool.length === 0) return fallback;
    if (pool.length === 1) return String(pool[0] || fallback);

    const index = Math.floor(Math.random() * pool.length);
    return String(pool[index] || fallback);
}

const CAMPAIGN_SEND_WINDOW_DEFAULT_START = '08:00';
const CAMPAIGN_SEND_WINDOW_DEFAULT_END = '18:00';

function normalizeCampaignSendWindowTime(value, fallback = null) {
    const raw = String(value || '').trim();
    if (!raw) return fallback;
    const match = raw.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return fallback;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (!Number.isInteger(hour) || !Number.isInteger(minute)) return fallback;
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return fallback;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function campaignSendWindowTimeToMinutes(time, fallbackMinutes) {
    const match = String(time || '').match(/^(\d{2}):(\d{2})$/);
    if (!match) return fallbackMinutes;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (!Number.isInteger(hour) || !Number.isInteger(minute)) return fallbackMinutes;
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return fallbackMinutes;
    return (hour * 60) + minute;
}

function normalizeCampaignSendWindowConfig(campaign = {}) {
    const enabled = parseBooleanInput(campaign?.send_window_enabled, false);
    const start = normalizeCampaignSendWindowTime(
        campaign?.send_window_start,
        CAMPAIGN_SEND_WINDOW_DEFAULT_START
    ) || CAMPAIGN_SEND_WINDOW_DEFAULT_START;
    const end = normalizeCampaignSendWindowTime(
        campaign?.send_window_end,
        CAMPAIGN_SEND_WINDOW_DEFAULT_END
    ) || CAMPAIGN_SEND_WINDOW_DEFAULT_END;

    return {
        enabled,
        start,
        end,
        startMinutes: campaignSendWindowTimeToMinutes(start, 8 * 60),
        endMinutes: campaignSendWindowTimeToMinutes(end, 18 * 60)
    };
}

function sanitizeCampaignPayload(input = {}, options = {}) {

    const payload = { ...input };
    const applyDefaultType = !!options.applyDefaultType;

    const hasType = Object.prototype.hasOwnProperty.call(payload, 'type');
    if (hasType) {
        const normalizedType = String(payload.type || '').trim().toLowerCase();
        if (!normalizedType) {
            if (applyDefaultType) {
                payload.type = 'broadcast';
            } else {
                delete payload.type;
            }
        } else if (normalizedType === 'trigger') {
            throw new Error('Campanhas do tipo gatilho foram descontinuadas. Use Automacao para gatilhos.');
        } else if (!SUPPORTED_CAMPAIGN_TYPES.has(normalizedType)) {
            throw new Error('Tipo de campanha invalido. Use broadcast ou drip.');
        } else {
            payload.type = normalizedType;
        }
    } else if (applyDefaultType) {
        payload.type = 'broadcast';
    }

    if (!Object.prototype.hasOwnProperty.call(payload, 'distribution_strategy') && Object.prototype.hasOwnProperty.call(payload, 'distributionStrategy')) {
        payload.distribution_strategy = payload.distributionStrategy;
    }
    if (!Object.prototype.hasOwnProperty.call(payload, 'send_window_enabled') && Object.prototype.hasOwnProperty.call(payload, 'sendWindowEnabled')) {
        payload.send_window_enabled = payload.sendWindowEnabled;
    }
    if (!Object.prototype.hasOwnProperty.call(payload, 'send_window_start') && Object.prototype.hasOwnProperty.call(payload, 'sendWindowStart')) {
        payload.send_window_start = payload.sendWindowStart;
    }
    if (!Object.prototype.hasOwnProperty.call(payload, 'send_window_end') && Object.prototype.hasOwnProperty.call(payload, 'sendWindowEnd')) {
        payload.send_window_end = payload.sendWindowEnd;
    }
    if (!Object.prototype.hasOwnProperty.call(payload, 'tag_filter') && Object.prototype.hasOwnProperty.call(payload, 'tag_filters')) {
        payload.tag_filter = payload.tag_filters;
    }
    if (!Object.prototype.hasOwnProperty.call(payload, 'tag_filter') && Object.prototype.hasOwnProperty.call(payload, 'tagFilters')) {
        payload.tag_filter = payload.tagFilters;
    }
    const hasDistributionStrategy = Object.prototype.hasOwnProperty.call(payload, 'distribution_strategy');
    if (hasDistributionStrategy) {
        const normalizedDistributionStrategy = normalizeCampaignDistributionStrategy(payload.distribution_strategy, applyDefaultType ? 'single' : 'round_robin');
        payload.distribution_strategy = normalizedDistributionStrategy;
    } else if (applyDefaultType) {
        payload.distribution_strategy = 'single';
    }

    const hasDistributionConfig =
        Object.prototype.hasOwnProperty.call(payload, 'distribution_config') ||
        Object.prototype.hasOwnProperty.call(payload, 'distributionConfig');
    const hasMessageVariations =
        Object.prototype.hasOwnProperty.call(payload, 'message_variations') ||
        Object.prototype.hasOwnProperty.call(payload, 'messageVariations');

    let parsedDistributionConfig = null;
    if (hasDistributionConfig) {
        const rawDistributionConfig = Object.prototype.hasOwnProperty.call(payload, 'distribution_config')
            ? payload.distribution_config
            : payload.distributionConfig;
        parsedDistributionConfig = parseCampaignDistributionConfig(rawDistributionConfig);
    }

    if (hasMessageVariations) {
        const rawMessageVariations = Object.prototype.hasOwnProperty.call(payload, 'message_variations')
            ? payload.message_variations
            : payload.messageVariations;
        const normalizedMessageVariations = normalizeCampaignMessageVariations(rawMessageVariations);
        const nextDistributionConfig = (parsedDistributionConfig && typeof parsedDistributionConfig === 'object')
            ? { ...parsedDistributionConfig }
            : {};

        if (normalizedMessageVariations.length) {
            nextDistributionConfig.message_variations = normalizedMessageVariations;
        } else {
            delete nextDistributionConfig.message_variations;
        }

        parsedDistributionConfig = Object.keys(nextDistributionConfig).length ? nextDistributionConfig : null;
    }

    if (hasDistributionConfig || hasMessageVariations) {
        payload.distribution_config = parsedDistributionConfig ? JSON.stringify(parsedDistributionConfig) : null;
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'distributionConfig')) {
        delete payload.distributionConfig;
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'messageVariations')) {
        delete payload.messageVariations;
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'sendWindowEnabled')) {
        delete payload.sendWindowEnabled;
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'sendWindowStart')) {
        delete payload.sendWindowStart;
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'sendWindowEnd')) {
        delete payload.sendWindowEnd;
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'tag_filters')) {
        delete payload.tag_filters;
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'tagFilters')) {
        delete payload.tagFilters;
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'sender_accounts')) {
        delete payload.sender_accounts;
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'senderAccounts')) {
        delete payload.senderAccounts;
    }


    if (payload.start_at === '') {

        payload.start_at = null;

    }

    if (Object.prototype.hasOwnProperty.call(payload, 'send_window_enabled')) {
        payload.send_window_enabled = parseBooleanInput(payload.send_window_enabled, false) ? 1 : 0;
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'send_window_start')) {
        const rawStart = payload.send_window_start;
        const normalizedStart = normalizeCampaignSendWindowTime(rawStart, null);
        if (String(rawStart || '').trim() && !normalizedStart) {
            throw new Error('Horario inicial da janela de envio invalido. Use HH:MM.');
        }
        payload.send_window_start = normalizedStart;
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'send_window_end')) {
        const rawEnd = payload.send_window_end;
        const normalizedEnd = normalizeCampaignSendWindowTime(rawEnd, null);
        if (String(rawEnd || '').trim() && !normalizedEnd) {
            throw new Error('Horario final da janela de envio invalido. Use HH:MM.');
        }
        payload.send_window_end = normalizedEnd;
    }

    if (Number(payload.send_window_enabled) > 0) {
        payload.send_window_start = normalizeCampaignSendWindowTime(
            payload.send_window_start,
            CAMPAIGN_SEND_WINDOW_DEFAULT_START
        );
        payload.send_window_end = normalizeCampaignSendWindowTime(
            payload.send_window_end,
            CAMPAIGN_SEND_WINDOW_DEFAULT_END
        );
    }


    const parseMs = (value) => {
        const num = Number(value);
        return Number.isFinite(num) && num >= 0 ? num : null;
    };

    const delay = parseMs(payload.delay);
    const delayMin = parseMs(payload.delay_min);
    const delayMax = parseMs(payload.delay_max);

    let normalizedMin = delayMin;
    let normalizedMax = delayMax;

    if (normalizedMin === null && normalizedMax === null && delay !== null) {
        normalizedMin = delay;
        normalizedMax = delay;
    }

    if (normalizedMin === null && normalizedMax !== null) normalizedMin = normalizedMax;
    if (normalizedMax === null && normalizedMin !== null) normalizedMax = normalizedMin;

    if (normalizedMin !== null && normalizedMax !== null && normalizedMax < normalizedMin) {
        const swap = normalizedMin;
        normalizedMin = normalizedMax;
        normalizedMax = swap;
    }

    if (normalizedMin !== null) payload.delay_min = normalizedMin;
    if (normalizedMax !== null) payload.delay_max = normalizedMax;
    if (normalizedMin !== null) {
        // Campo legado mantido para compatibilidade.
        payload.delay = normalizedMin;
    } else if (delay !== null) {
        payload.delay = delay;
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'tag_filter')) {
        payload.tag_filter = normalizeCampaignTagFilterInput(payload.tag_filter);
    }


    return payload;

}

function resolveCampaignDelayRange(campaign, fallbackMs = 5000) {
    const fallback = Number.isFinite(Number(fallbackMs)) && Number(fallbackMs) >= 0 ? Number(fallbackMs) : 0;
    const legacyDelay = Number(campaign?.delay);
    const minCandidate = Number(campaign?.delay_min);
    const maxCandidate = Number(campaign?.delay_max);

    let minMs = Number.isFinite(minCandidate) && minCandidate >= 0
        ? minCandidate
        : (Number.isFinite(legacyDelay) && legacyDelay >= 0 ? legacyDelay : fallback);

    let maxMs = Number.isFinite(maxCandidate) && maxCandidate >= 0
        ? maxCandidate
        : minMs;

    if (maxMs < minMs) {
        const swap = minMs;
        minMs = maxMs;
        maxMs = swap;
    }

    return { minMs, maxMs };
}

function randomIntBetween(min, max) {
    if (max <= min) return min;
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function isWithinCampaignSendWindow(sendWindowConfig, date = new Date()) {
    if (!sendWindowConfig?.enabled) return true;

    const nowMinutes = (date.getHours() * 60) + date.getMinutes();
    const start = Number(sendWindowConfig.startMinutes);
    const end = Number(sendWindowConfig.endMinutes);

    if (!Number.isFinite(start) || !Number.isFinite(end)) return true;
    if (start === end) return true;

    if (start < end) {
        return nowMinutes >= start && nowMinutes < end;
    }

    return nowMinutes >= start || nowMinutes < end;
}

function alignCampaignScheduleToSendWindow(timestampMs, sendWindowConfig = null) {
    const numericTimestamp = Number(timestampMs);
    if (!Number.isFinite(numericTimestamp)) {
        return Date.now();
    }
    if (!sendWindowConfig?.enabled) {
        return numericTimestamp;
    }

    if (isWithinCampaignSendWindow(sendWindowConfig, new Date(numericTimestamp))) {
        return numericTimestamp;
    }

    const start = Number(sendWindowConfig.startMinutes);
    const end = Number(sendWindowConfig.endMinutes);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start === end) {
        return numericTimestamp;
    }

    const baseDate = new Date(numericTimestamp);
    const nowMinutes = (baseDate.getHours() * 60) + baseDate.getMinutes();
    const startHour = Math.floor(start / 60);
    const startMinute = start % 60;

    if (start < end) {
        if (nowMinutes < start) {
            baseDate.setHours(startHour, startMinute, 0, 0);
            return baseDate.getTime();
        }

        baseDate.setDate(baseDate.getDate() + 1);
        baseDate.setHours(startHour, startMinute, 0, 0);
        return baseDate.getTime();
    }

    baseDate.setHours(startHour, startMinute, 0, 0);
    return baseDate.getTime();
}

function addCampaignDelayRespectingSendWindow(currentMs, delayMs, sendWindowConfig = null) {
    const base = Number.isFinite(Number(currentMs)) ? Number(currentMs) : Date.now();
    const safeDelay = Number.isFinite(Number(delayMs)) ? Math.max(0, Number(delayMs)) : 0;
    return alignCampaignScheduleToSendWindow(base + safeDelay, sendWindowConfig);
}

function buildCampaignScheduledAtByLead(
    leadIds = [],
    assignmentMetaByLead = {},
    baseStartMs = Date.now(),
    delayMinMs = 0,
    delayMaxMs = 0,
    sendWindowConfig = null
) {
    const scheduledAtByLead = {};
    const nextMsByDayOffset = new Map();
    const normalizedBaseStartMs = alignCampaignScheduleToSendWindow(baseStartMs, sendWindowConfig);

    for (const leadId of leadIds) {
        const key = String(leadId);
        const meta = assignmentMetaByLead && typeof assignmentMetaByLead === 'object'
            ? assignmentMetaByLead[key]
            : null;
        const dayOffsetRaw = Number(meta?.day_offset);
        const dayOffset = Number.isFinite(dayOffsetRaw) && dayOffsetRaw > 0 ? Math.floor(dayOffsetRaw) : 0;
        const bucketStartMs = normalizedBaseStartMs + (dayOffset * 24 * 60 * 60 * 1000);
        const normalizedBucketStartMs = alignCampaignScheduleToSendWindow(bucketStartMs, sendWindowConfig);
        const nextMs = nextMsByDayOffset.has(dayOffset)
            ? Number(nextMsByDayOffset.get(dayOffset))
            : normalizedBucketStartMs;

        scheduledAtByLead[key] = new Date(nextMs).toISOString();
        nextMsByDayOffset.set(
            dayOffset,
            addCampaignDelayRespectingSendWindow(
                nextMs,
                randomIntBetween(delayMinMs, delayMaxMs),
                sendWindowConfig
            )
        );
    }

    return scheduledAtByLead;
}

function parseCampaignSteps(campaign) {

    const raw = String(campaign?.message || '').replace(/\r\n/g, '\n').trim();

    if (!raw) return [];

    if (campaign?.type !== 'drip') {

        return [raw];

    }

    // Sequencia drip: separar etapas usando uma linha com ---
    return raw
        .split(/\n\s*---+\s*\n/g)
        .map((step) => step.trim())
        .filter(Boolean);

}

function parseCampaignStartAt(startAt) {

    if (!startAt) return null;

    const parsed = Date.parse(String(startAt));

    return Number.isFinite(parsed) ? parsed : null;

}

async function reschedulePendingCampaignQueueByStartAt(campaign, previousStartAt = null) {
    const campaignId = Number(campaign?.id || 0);
    if (!Number.isInteger(campaignId) || campaignId <= 0) {
        return { updated: 0, reason: 'invalid_campaign' };
    }

    const pendingQueueRows = await query(`
        SELECT id, scheduled_at
        FROM message_queue
        WHERE campaign_id = ?
          AND status = 'pending'
        ORDER BY id ASC
    `, [campaignId]);

    if (!pendingQueueRows.length) {
        return { updated: 0, reason: 'no_pending_messages' };
    }

    const previousStartAtMs = parseCampaignStartAt(previousStartAt);
    const nextStartAtMs = parseCampaignStartAt(campaign?.start_at) || Date.now();
    const sendWindowConfig = normalizeCampaignSendWindowConfig(campaign);

    let referenceStartAtMs = previousStartAtMs;
    if (!Number.isFinite(referenceStartAtMs)) {
        const firstScheduledAtMs = parseCampaignStartAt(pendingQueueRows[0]?.scheduled_at);
        referenceStartAtMs = Number.isFinite(firstScheduledAtMs) ? firstScheduledAtMs : Date.now();
    }

    const deltaMs = Number(nextStartAtMs) - Number(referenceStartAtMs);
    let updated = 0;

    for (const queueRow of pendingQueueRows) {
        const queueId = Number(queueRow?.id || 0);
        if (!Number.isInteger(queueId) || queueId <= 0) continue;

        const currentScheduledAtMs = parseCampaignStartAt(queueRow?.scheduled_at) || Number(referenceStartAtMs);
        const shiftedScheduledAtMs = alignCampaignScheduleToSendWindow(
            Number(currentScheduledAtMs) + deltaMs,
            sendWindowConfig
        );

        const result = await run(`
            UPDATE message_queue
            SET scheduled_at = ?
            WHERE id = ?
              AND status = 'pending'
        `, [new Date(shiftedScheduledAtMs).toISOString(), queueId]);

        if (Number(result?.changes || 0) > 0) {
            updated += 1;
        }
    }

    return {
        updated,
        totalPending: pendingQueueRows.length,
        delta_ms: deltaMs
    };
}


function parseLeadTags(rawTags) {
    return uniqueUnifiedTagLabels(parseUnifiedTagList(rawTags));
}

function normalizeCampaignTagLabel(value) {
    return normalizeUnifiedTagLabel(value);
}

function normalizeCampaignTag(value) {
    return normalizeUnifiedTagKey(value);
}

function parseCampaignTagFilters(value) {
    return uniqueUnifiedTagLabels(parseUnifiedTagList(value));
}

function normalizeCampaignTagFilterInput(value) {
    return normalizeUnifiedTagFilterInput(value);
}

function resolveCampaignSegmentStatus(segment) {
    const normalizedSegment = String(segment || 'all').trim().toLowerCase();

    if (!normalizedSegment || normalizedSegment === 'all') return null;

    if (normalizedSegment === 'new' || normalizedSegment === 'novo' || normalizedSegment === 'etapa1' || normalizedSegment === 'stage1' || normalizedSegment === 'status_1') {
        return 1;
    }

    if (normalizedSegment === 'progress' || normalizedSegment === 'em_andamento' || normalizedSegment === 'etapa2' || normalizedSegment === 'stage2' || normalizedSegment === 'status_2') {
        return 2;
    }

    if (normalizedSegment === 'concluded' || normalizedSegment === 'concluido' || normalizedSegment === 'etapa3' || normalizedSegment === 'stage3' || normalizedSegment === 'status_3') {
        return 3;
    }

    if (normalizedSegment === 'lost' || normalizedSegment === 'perdido' || normalizedSegment === 'etapa4' || normalizedSegment === 'stage4' || normalizedSegment === 'status_4') {
        return 4;
    }

    const prefixed = normalizedSegment.match(/^status[_-](\d+)$/);
    if (prefixed) {
        const value = normalizeLeadStatus(prefixed[1], null);
        if (value !== null) return value;
    }

    const directNumeric = normalizeLeadStatus(normalizedSegment, null);
    if (directNumeric !== null) return directNumeric;

    return null;
}

function leadMatchesCampaignTag(lead, tagFilter = '') {
    return leadMatchesUnifiedTagFilter(lead?.tags, tagFilter);
}

async function resolveCampaignLeadIds(options = {}) {

    const segment = typeof options === 'string' ? options : options.segment;
    const tagFilter = typeof options === 'string'
        ? ''
        : (options.tagFilters ?? options.tagFilter ?? options.tag_filter ?? '');
    const assignedTo = Number(typeof options === 'string' ? 0 : options.assignedTo);
    const ownerUserId = normalizeOwnerUserId(typeof options === 'string' ? null : (options.ownerUserId ?? options.owner_user_id));
    const segmentStatus = resolveCampaignSegmentStatus(segment);

    let sql = 'SELECT id, tags FROM leads WHERE is_blocked = 0';

    const params = [];


    if (segmentStatus !== null) {
        sql += ' AND status = ?';
        params.push(segmentStatus);
    }

    if (Number.isInteger(assignedTo) && assignedTo > 0) {
        sql += ' AND assigned_to = ?';
        params.push(assignedTo);
    }

    if (ownerUserId) {
        sql += `
            AND (
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
        `;
        params.push(ownerUserId, ownerUserId, ownerUserId);
    }


    sql += ' ORDER BY updated_at DESC';


    const rows = await query(sql, params);

    return rows
        .filter((row) => leadMatchesCampaignTag(row, tagFilter))
        .map((row) => row.id);

}

function serializeCampaign(campaign, senderAccounts = []) {
    if (!campaign) return null;
    const parsedDistributionConfig = parseCampaignDistributionConfig(campaign.distribution_config);
    const messageVariations = readCampaignMessageVariationsFromConfig(parsedDistributionConfig || campaign);
    return {
        ...campaign,
        distribution_strategy: normalizeCampaignDistributionStrategy(campaign.distribution_strategy, 'single'),
        distribution_config: parsedDistributionConfig,
        tag_filters: parseCampaignTagFilters(campaign.tag_filter),
        message_variations: messageVariations,
        sender_accounts: normalizeSenderAccountsPayload(senderAccounts || [])
    };
}

async function attachCampaignSenderAccounts(campaign) {
    if (!campaign?.id) return serializeCampaign(campaign, []);
    const senderAccounts = await CampaignSenderAccount.listByCampaignId(campaign.id, { onlyActive: false });
    return serializeCampaign(campaign, senderAccounts);
}

async function attachCampaignSenderAccountsList(campaigns = []) {
    return await Promise.all(
        (campaigns || []).map((campaign) => attachCampaignSenderAccounts(campaign))
    );
}

async function attachCampaignQueueStateList(campaigns = []) {
    const normalizedCampaigns = Array.isArray(campaigns) ? campaigns : [];
    const campaignIds = Array.from(
        new Set(
            normalizedCampaigns
                .map((campaign) => Number(campaign?.id || 0))
                .filter((campaignId) => Number.isInteger(campaignId) && campaignId > 0)
        )
    );

    if (!campaignIds.length) {
        return normalizedCampaigns.map((campaign) => ({
            ...campaign,
            queue_total: 0,
            queue_pending: 0,
            queue_processing: 0,
            queue_finalized: false
        }));
    }

    const rows = await query(`
        SELECT
            campaign_id,
            COUNT(*) AS total,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) AS processing
        FROM message_queue
        WHERE campaign_id = ANY(?::int[])
        GROUP BY campaign_id
    `, [campaignIds]);

    const summaryByCampaignId = new Map(
        (rows || []).map((row) => [
            Number(row?.campaign_id || 0),
            {
                total: Number(row?.total || 0),
                pending: Number(row?.pending || 0),
                processing: Number(row?.processing || 0)
            }
        ])
    );

    return normalizedCampaigns.map((campaign) => {
        const campaignId = Number(campaign?.id || 0);
        const summary = summaryByCampaignId.get(campaignId) || {
            total: 0,
            pending: 0,
            processing: 0
        };
        const queueFinalized = summary.total > 0 && summary.pending === 0 && summary.processing === 0;

        return {
            ...campaign,
            queue_total: summary.total,
            queue_pending: summary.pending,
            queue_processing: summary.processing,
            queue_finalized: queueFinalized
        };
    });
}

async function attachCampaignQueueState(campaign) {
    if (!campaign) return campaign;
    const list = await attachCampaignQueueStateList([campaign]);
    return list[0] || campaign;
}

async function migrateLegacyTriggerCampaignsToAutomations() {
    let legacyCampaigns = [];

    try {
        legacyCampaigns = await query(`
            SELECT c.*
            FROM campaigns c
            LEFT JOIN campaign_automation_migrations m ON m.campaign_id = c.id
            WHERE c.type = 'trigger'
              AND m.campaign_id IS NULL
              AND COALESCE(TRIM(c.message), '') <> ''
            ORDER BY c.id ASC
        `);
    } catch (error) {
        console.error('Falha ao buscar campanhas legado para migracao:', error.message);
        return { total: 0, migrated: 0, linked: 0, skipped: 0, failed: 0 };
    }

    if (!legacyCampaigns.length) {
        return { total: 0, migrated: 0, linked: 0, skipped: 0, failed: 0 };
    }

    let migrated = 0;
    let linked = 0;
    let skipped = 0;
    let failed = 0;

    for (const campaign of legacyCampaigns) {
        try {
            const message = String(campaign?.message || '').trim();
            if (!message) {
                skipped += 1;
                continue;
            }

            const existingRows = await query(`
                SELECT id
                FROM automations
                WHERE trigger_type = 'message_received'
                  AND trigger_value LIKE ?
                  AND trigger_value LIKE ?
                ORDER BY id DESC
                LIMIT 1
            `, [
                `%"mode":"${LEGACY_CAMPAIGN_TRIGGER_MODE}"%`,
                `%"source_campaign_id":${campaign.id},%`
            ]);

            let automationId = Number(existingRows?.[0]?.id || 0);
            if (!(Number.isFinite(automationId) && automationId > 0)) {
                const { minMs, maxMs } = resolveCampaignDelayRange(campaign, 0);
                const delayMinMs = Math.max(0, Math.floor(minMs || 0));
                const delayMaxMs = Math.max(delayMinMs, Math.floor(maxMs || 0));
                const delaySeconds = Math.max(0, Math.round(delayMinMs / 1000));
                const normalizedSegment = String(campaign.segment || 'all').trim().toLowerCase() || 'all';
                const normalizedTagFilters = parseCampaignTagFilters(campaign.tag_filter);
                const normalizedStatus = String(campaign.status || '').trim().toLowerCase();
                const isActive = normalizedStatus === 'active' ? 1 : 0;
                const triggerValue = JSON.stringify({
                    mode: LEGACY_CAMPAIGN_TRIGGER_MODE,
                    segment: normalizedSegment,
                    tag_filter: normalizedTagFilters.length === 1 ? normalizedTagFilters[0] : null,
                    tag_filters: normalizedTagFilters,
                    start_at: campaign.start_at || null,
                    once_per_lead: true,
                    delay_min_ms: delayMinMs,
                    delay_max_ms: delayMaxMs,
                    source_campaign_id: Number(campaign.id),
                    source_campaign_uuid: campaign.uuid || null
                });
                const descriptionParts = [
                    String(campaign.description || '').trim(),
                    `Migrada da campanha gatilho #${campaign.id}.`
                ].filter(Boolean);

                const result = await Automation.create({
                    name: String(campaign.name || `Campanha ${campaign.id}`).trim() || `Campanha ${campaign.id}`,
                    description: descriptionParts.join(' '),
                    trigger_type: 'message_received',
                    trigger_value: triggerValue,
                    action_type: 'send_message',
                    action_value: message,
                    delay: delaySeconds,
                    is_active: isActive,
                    created_by: campaign.created_by
                });

                automationId = Number(result?.id || 0);
                if (!(Number.isFinite(automationId) && automationId > 0)) {
                    throw new Error('Automacao nao retornou id valido');
                }

                migrated += 1;
            } else {
                linked += 1;
            }

            const migratedAt = new Date().toISOString();
            const migrationNote = `Migrada automaticamente para automacao #${automationId} em ${migratedAt}`;
            await run(`
                INSERT INTO campaign_automation_migrations (campaign_id, automation_id, notes)
                VALUES (?, ?, ?)
                ON CONFLICT (campaign_id) DO NOTHING
            `, [campaign.id, automationId, migrationNote]);

            const currentDescription = String(campaign.description || '').trim();
            const hasMigrationNote = currentDescription.includes('Migrada automaticamente para automacao #');
            const updatedDescription = hasMigrationNote
                ? currentDescription
                : [currentDescription, migrationNote].filter(Boolean).join('\n');

            await Campaign.update(campaign.id, {
                status: 'completed',
                description: updatedDescription
            });
        } catch (error) {
            failed += 1;
            console.error(`Falha ao migrar campanha legado #${campaign?.id}:`, error.message);
        }
    }

    console.log(
        `Migracao de campanhas gatilho: total=${legacyCampaigns.length}, criadas=${migrated}, vinculadas=${linked}, ignoradas=${skipped}, falhas=${failed}`
    );

    return {
        total: legacyCampaigns.length,
        migrated,
        linked,
        skipped,
        failed
    };
}

async function queueCampaignMessages(campaign, options = {}) {
    const forceRequeueAll = options.forceRequeueAll === true || options.force_requeue_all === true;
    const campaignType = String(campaign?.type || '').trim().toLowerCase();
    if (campaignType === 'trigger') {
        throw new Error('Campanhas do tipo gatilho foram descontinuadas. Use Automacao para gatilhos.');
    }
    if (!SUPPORTED_CAMPAIGN_TYPES.has(campaignType)) {
        throw new Error('Tipo de campanha invalido. Use broadcast ou drip.');
    }

    const steps = parseCampaignSteps(campaign);

    if (!steps.length) {

        throw new Error('Campanha sem mensagem configurada');

    }


    const leadIds = await resolveCampaignLeadIds({
        segment: campaign.segment || 'all',
        tagFilter: campaign.tag_filter || '',
        assignedTo: options.assignedTo,
        ownerUserId: options.ownerUserId
    });

    if (!leadIds.length) {

        return { queued: 0, recipients: 0 };

    }

    const totalRecipients = leadIds.length;
    let queueCandidateLeadIds = [...leadIds];
    let skippedAlreadyQueuedOrSent = 0;

    if (campaignType === 'broadcast' && !forceRequeueAll) {
        const existingLeadIds = new Set(
            await MessageQueue.listLeadIdsWithQueuedOrSentForCampaign(campaign.id, leadIds)
        );
        if (existingLeadIds.size > 0) {
            queueCandidateLeadIds = leadIds.filter((leadId) => !existingLeadIds.has(Number(leadId)));
            skippedAlreadyQueuedOrSent = leadIds.length - queueCandidateLeadIds.length;
        }
    }

    if (!queueCandidateLeadIds.length) {
        return {
            queued: 0,
            recipients: totalRecipients,
            eligible_recipients: 0,
            skipped_already_queued_or_sent: skippedAlreadyQueuedOrSent,
            steps: steps.length,
            distribution: {
                strategy: normalizeCampaignDistributionStrategy(campaign?.distribution_strategy, 'single'),
                by_session: {}
            }
        };
    }

    const senderAccounts = await CampaignSenderAccount.listByCampaignId(campaign.id, { onlyActive: true });
    const distributionStrategy = normalizeCampaignDistributionStrategy(
        campaign?.distribution_strategy,
        senderAccounts.length ? 'round_robin' : 'single'
    );
    let distributionPlan;
    try {
        distributionPlan = await senderAllocatorService.buildDistributionPlan({
            leadIds: queueCandidateLeadIds,
            campaignId: campaign.id,
            senderAccounts,
            strategy: distributionStrategy,
            ownerUserId: options.ownerUserId
        });
    } catch (error) {
        const reason = String(error?.message || 'Falha ao alocar contas de envio');
        throw new Error(
            `${reason}. Destinatarios filtrados: ${leadIds.length}. ` +
            'Revise contas de envio conectadas e o limite diario (por exemplo, 0 = sem limite).'
        );
    }
    const sessionAssignments = distributionPlan.assignmentsByLead || {};
    const assignmentMetaByLead = distributionPlan.assignmentMetaByLead || {};

    const startAtMs = parseCampaignStartAt(campaign.start_at);
    const sendWindowConfig = normalizeCampaignSendWindowConfig(campaign);
    const baseStartMs = alignCampaignScheduleToSendWindow(startAtMs || Date.now(), sendWindowConfig);

    const { minMs: delayMinMsRaw, maxMs: delayMaxMsRaw } = resolveCampaignDelayRange(campaign, 5000);
    const delayMinMs = Math.max(250, delayMinMsRaw || 0);
    const delayMaxMs = Math.max(delayMinMs, delayMaxMsRaw || 0);
    const scheduledAtByLead = buildCampaignScheduledAtByLead(
        queueCandidateLeadIds,
        assignmentMetaByLead,
        baseStartMs,
        delayMinMs,
        delayMaxMs,
        sendWindowConfig
    );

    let queuedCount = 0;

    if (campaignType === 'drip') {
        const nextStepAtByLead = new Map();
        for (const leadId of queueCandidateLeadIds) {
            const leadKey = String(leadId);
            const precomputedScheduledAt = String(scheduledAtByLead[leadKey] || '').trim();
            const parsedScheduledAt = Date.parse(precomputedScheduledAt);
            const initialStepAt = Number.isFinite(parsedScheduledAt)
                ? parsedScheduledAt
                : alignCampaignScheduleToSendWindow(baseStartMs, sendWindowConfig);
            nextStepAtByLead.set(leadKey, initialStepAt);
        }

        for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
            const content = steps[stepIndex];

            for (let leadIndex = 0; leadIndex < queueCandidateLeadIds.length; leadIndex++) {
                const leadId = queueCandidateLeadIds[leadIndex];
                const leadKey = String(leadId);
                const assignmentMeta = assignmentMetaByLead[leadKey] || null;
                const rawStepAt = Number(nextStepAtByLead.get(leadKey));
                const safeStepAt = Number.isFinite(rawStepAt)
                    ? rawStepAt
                    : alignCampaignScheduleToSendWindow(baseStartMs, sendWindowConfig);
                const currentStepAt = alignCampaignScheduleToSendWindow(safeStepAt, sendWindowConfig);
                const scheduledAt = new Date(currentStepAt).toISOString();

                await queueService.add({

                    leadId,

                    campaignId: campaign.id,

                    sessionId: sessionAssignments[leadKey] || null,

                    isFirstContact: stepIndex === 0,

                    assignmentMeta,

                    content,

                    mediaType: 'text',

                    scheduledAt,

                    priority: 0

                });

                queuedCount += 1;

                nextStepAtByLead.set(
                    leadKey,
                    addCampaignDelayRespectingSendWindow(
                        currentStepAt,
                        randomIntBetween(delayMinMs, delayMaxMs),
                        sendWindowConfig
                    )
                );

            }

        }

    } else {

        const startAt = new Date(baseStartMs).toISOString();
        const broadcastMessagePool = buildBroadcastCampaignMessagePool(campaign);
        const contentByLead = broadcastMessagePool.length > 1
            ? queueCandidateLeadIds.reduce((acc, leadId) => {
                acc[String(leadId)] = pickRandomCampaignMessagePoolEntry(broadcastMessagePool, steps[0]);
                return acc;
            }, {})
            : null;

        const results = await queueService.addBulk(queueCandidateLeadIds, steps[0], {

            startAt,

            delayMinMs,

            delayMaxMs,

            campaignId: campaign.id,

            sessionAssignments,

            assignmentMetaByLead,

            ...(contentByLead ? { contentByLead } : {}),

            scheduledAtByLead,

            isFirstContact: true

        });

        queuedCount = results.length;

    }


    await Campaign.update(campaign.id, {
        status: 'active'
    });

    await Campaign.refreshMetrics(campaign.id);


    return {
        queued: queuedCount,
        recipients: totalRecipients,
        eligible_recipients: queueCandidateLeadIds.length,
        skipped_already_queued_or_sent: skippedAlreadyQueuedOrSent,
        restarted: forceRequeueAll,
        steps: steps.length,
        distribution: {
            strategy: distributionPlan.strategyUsed || distributionStrategy,
            by_session: distributionPlan.summary || {}
        }
    };

}

async function rollbackFailedCampaignCreation(campaignId) {
    const normalizedCampaignId = Number(campaignId || 0);
    if (!Number.isInteger(normalizedCampaignId) || normalizedCampaignId <= 0) return;

    try {
        await run('DELETE FROM message_queue WHERE campaign_id = ?', [normalizedCampaignId]);
    } catch (error) {
        console.error(`Falha ao remover fila da campanha #${normalizedCampaignId} durante rollback:`, error.message);
    }

    try {
        await Campaign.delete(normalizedCampaignId);
    } catch (error) {
        console.error(`Falha ao remover campanha #${normalizedCampaignId} durante rollback:`, error.message);
    }
}

function getSafeCampaignApiErrorMessage(error, fallbackMessage) {
    const rawMessage = String(error?.message || '').trim();
    if (!rawMessage) return fallbackMessage;

    const unsafeMessagePatterns = [
        /column\s+.*\s+does not exist/i,
        /relation\s+.*\s+does not exist/i,
        /syntax error at or near/i,
        /SQLSTATE/i,
        /password authentication failed/i,
        /database/i
    ];

    if (unsafeMessagePatterns.some((pattern) => pattern.test(rawMessage))) {
        return fallbackMessage;
    }

    return rawMessage;
}

app.get('/api/campaigns', authenticate, async (req, res) => {

    const { status, type, limit, offset, search } = req.query;
    const scopedUserId = getScopedUserId(req);
    const ownerScopeUserId = await resolveRequesterOwnerUserId(req);

    const campaigns = await Campaign.list({

        status,

        type,

        search,

        created_by: scopedUserId || undefined,
        owner_user_id: ownerScopeUserId || undefined,

        limit: limit ? parseInt(limit) : 50,

        offset: offset ? parseInt(offset) : 0

    });



    const campaignsWithSenders = await attachCampaignSenderAccountsList(campaigns);
    const campaignsWithQueueState = await attachCampaignQueueStateList(campaignsWithSenders);

    res.json({ success: true, campaigns: campaignsWithQueueState });

});



app.get('/api/campaigns/:id', authenticate, async (req, res) => {

    const scopedUserId = getScopedUserId(req);
    const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
    const campaign = await Campaign.findById(req.params.id, {
        created_by: scopedUserId || undefined,
        owner_user_id: ownerScopeUserId || undefined
    });

    if (!campaign) {

        return res.status(404).json({ error: 'Campanha nÃ£o encontrada' });

    }

    if (!canAccessCreatedRecord(req, campaign.created_by)) {
        return res.status(404).json({ error: 'Campanha nÃ£o encontrada' });
    }

    const campaignWithSenders = await attachCampaignSenderAccounts(campaign);
    const campaignWithQueueState = await attachCampaignQueueState(campaignWithSenders);

    res.json({ success: true, campaign: campaignWithQueueState });

});

app.get('/api/campaigns/:id/recipients', authenticate, async (req, res) => {

    const scopedUserId = getScopedUserId(req);
    const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
    const campaign = await Campaign.findById(req.params.id, {
        created_by: scopedUserId || undefined,
        owner_user_id: ownerScopeUserId || undefined
    });

    if (!campaign) {

        return res.status(404).json({ error: 'Campanha nÃ£o encontrada' });

    }

    if (!canAccessCreatedRecord(req, campaign.created_by)) {
        return res.status(404).json({ error: 'Campanha nÃ£o encontrada' });
    }

    const requestedLimit = parseInt(String(req.query.limit || '200'), 10);
    const limit = Number.isFinite(requestedLimit)
        ? Math.max(1, Math.min(requestedLimit, 1000))
        : 200;

    const leadIds = await resolveCampaignLeadIds({
        segment: campaign.segment || 'all',
        tagFilter: campaign.tag_filter || '',
        assignedTo: scopedUserId || undefined,
        ownerUserId: ownerScopeUserId || undefined
    });

    if (!leadIds.length) {
        return res.json({
            success: true,
            total: 0,
            segment: campaign.segment || 'all',
            tag_filter: campaign.tag_filter || null,
            tag_filters: parseCampaignTagFilters(campaign.tag_filter),
            recipients: []
        });
    }

    const limitedIds = leadIds.slice(0, limit);
    const placeholders = limitedIds.map(() => '?').join(', ');
    const recipients = await query(
        `SELECT id, name, phone, status, tags, vehicle, plate, last_message_at
         FROM leads
         WHERE id IN (${placeholders})
         ORDER BY updated_at DESC`,
        limitedIds
    );

    const messageStatusRows = await query(
        `SELECT
            lead_id,
            MAX(CASE WHEN status IN ('sent', 'delivered', 'read') THEN 1 ELSE 0 END) AS campaign_sent,
            MAX(CASE WHEN status IN ('delivered', 'read') THEN 1 ELSE 0 END) AS campaign_delivered,
            MAX(CASE WHEN status = 'read' THEN 1 ELSE 0 END) AS campaign_read,
            MAX(COALESCE(sent_at, created_at)) AS campaign_sent_at
         FROM messages
         WHERE campaign_id = ?
           AND is_from_me = 1
           AND lead_id IN (${placeholders})
         GROUP BY lead_id`,
        [campaign.id, ...limitedIds]
    );

    const latestQueueRows = await query(
        `SELECT q.lead_id, q.status AS campaign_queue_status, q.error_message AS campaign_queue_error
         FROM message_queue q
         INNER JOIN (
             SELECT lead_id, MAX(id) AS latest_id
             FROM message_queue
             WHERE campaign_id = ?
               AND lead_id IN (${placeholders})
             GROUP BY lead_id
         ) latest ON latest.latest_id = q.id`,
        [campaign.id, ...limitedIds]
    );

    const messageStatusByLeadId = new Map(
        (messageStatusRows || []).map((row) => [Number(row.lead_id || 0), row])
    );
    const queueStatusByLeadId = new Map(
        (latestQueueRows || []).map((row) => [Number(row.lead_id || 0), row])
    );

    const recipientsWithCampaignStatus = (recipients || []).map((lead) => {
        const leadId = Number(lead?.id || 0);
        const messageStatus = messageStatusByLeadId.get(leadId) || null;
        const queueStatus = queueStatusByLeadId.get(leadId) || null;

        return {
            ...lead,
            campaign_sent: Number(messageStatus?.campaign_sent || 0) > 0,
            campaign_delivered: Number(messageStatus?.campaign_delivered || 0) > 0,
            campaign_read: Number(messageStatus?.campaign_read || 0) > 0,
            campaign_sent_at: messageStatus?.campaign_sent_at || null,
            campaign_queue_status: queueStatus?.campaign_queue_status || null,
            campaign_queue_error: queueStatus?.campaign_queue_error || null
        };
    });

    res.json({
        success: true,
        total: leadIds.length,
        segment: campaign.segment || 'all',
        tag_filter: campaign.tag_filter || null,
        tag_filters: parseCampaignTagFilters(campaign.tag_filter),
        recipients: recipientsWithCampaignStatus
    });

});



app.post('/api/campaigns', authenticate, async (req, res) => {

    let createdCampaignId = null;
    try {
        const scopedUserId = getScopedUserId(req);
        const ownerScopeUserId = await resolveRequesterOwnerUserId(req);

        const senderAccountsPayload = normalizeSenderAccountsPayload(
            req.body?.sender_accounts ?? req.body?.senderAccounts
        );
        const payload = sanitizeCampaignPayload({

            ...req.body,

            created_by: req.user?.id

        }, { applyDefaultType: true });

        const requestedStatus = String(payload?.status || '').trim().toLowerCase();
        const createPayload = { ...payload };
        if (requestedStatus === 'active') {
            // So marca como ativa apos o enfileiramento ocorrer com sucesso.
            createPayload.status = 'draft';
        }

        const result = await Campaign.create(createPayload);
        createdCampaignId = Number(result?.id || 0) || null;
        await CampaignSenderAccount.replaceForCampaign(result.id, senderAccountsPayload);

        let campaign = await attachCampaignSenderAccounts(await Campaign.findById(result.id, {
            created_by: scopedUserId || undefined,
            owner_user_id: ownerScopeUserId || undefined
        }));
        campaign = await attachCampaignQueueState(campaign);
        let queueResult = { queued: 0, recipients: 0 };

        if (requestedStatus === 'active' && campaign) {
            queueResult = await queueCampaignMessages(campaign, {
                assignedTo: scopedUserId || undefined,
                ownerUserId: ownerScopeUserId || undefined
            });
            campaign = await attachCampaignSenderAccounts(await Campaign.findById(result.id, {
                created_by: scopedUserId || undefined,
                owner_user_id: ownerScopeUserId || undefined
            }));
            campaign = await attachCampaignQueueState(campaign);
        }

        res.json({ success: true, campaign, queue: queueResult });

    } catch (error) {
        if (createdCampaignId) {
            await rollbackFailedCampaignCreation(createdCampaignId);
        }

        console.error('[campaign:create] Falha ao criar campanha:', error?.message || error);
        const message = getSafeCampaignApiErrorMessage(error, 'Nao foi possivel criar a campanha');
        res.status(400).json({ error: message });

    }

});



app.put('/api/campaigns/:id', authenticate, async (req, res) => {

    try {
        const scopedUserId = getScopedUserId(req);
        const ownerScopeUserId = await resolveRequesterOwnerUserId(req);

        const campaign = await Campaign.findById(req.params.id, {
            created_by: scopedUserId || undefined,
            owner_user_id: ownerScopeUserId || undefined
        });

        if (!campaign) {

            return res.status(404).json({ error: 'Campanha nao encontrada' });

        }

        if (!canAccessCreatedRecord(req, campaign.created_by)) {
            return res.status(403).json({ error: 'Sem permissao para editar esta campanha' });
        }

        const senderAccountsProvided =
            Object.prototype.hasOwnProperty.call(req.body || {}, 'sender_accounts') ||
            Object.prototype.hasOwnProperty.call(req.body || {}, 'senderAccounts');
        const restartRequested = parseBooleanInput(
            req.body?.restart ?? req.body?.restart_campaign ?? req.body?.force_requeue,
            false
        );
        const senderAccountsPayload = senderAccountsProvided
            ? normalizeSenderAccountsPayload(req.body?.sender_accounts ?? req.body?.senderAccounts)
            : null;
        const payload = sanitizeCampaignPayload(req.body, { applyDefaultType: false });
        const requestedStatus = String(payload?.status || '').trim().toLowerCase();
        const currentCampaignStatus = String(campaign.status || '').trim().toLowerCase();
        const nextCampaignStatus = requestedStatus || currentCampaignStatus;
        const startAtProvided = Object.prototype.hasOwnProperty.call(payload, 'start_at');
        const previousStartAtMs = parseCampaignStartAt(campaign?.start_at);
        const nextStartAtMs = startAtProvided
            ? parseCampaignStartAt(payload?.start_at)
            : previousStartAtMs;
        const startAtChanged = startAtProvided && previousStartAtMs !== nextStartAtMs;
        const shouldActivate = requestedStatus === 'active' && (campaign.status !== 'active' || restartRequested);
        let shouldQueue = false;
        if (shouldActivate) {
            const progress = await MessageQueue.getCampaignProgress(campaign.id);
            const hasPendingOrProcessing = Number(progress?.pending || 0) > 0 || Number(progress?.processing || 0) > 0;
            if (restartRequested && hasPendingOrProcessing) {
                return res.status(409).json({
                    error: 'Nao e possivel reiniciar enquanto ainda existem mensagens pendentes/processando nesta campanha'
                });
            }
            shouldQueue = restartRequested ? true : !hasPendingOrProcessing;
        }
        const shouldReschedulePendingStartAt = startAtChanged
            && !shouldQueue
            && !restartRequested
            && nextCampaignStatus === 'active';
        const payloadBeforeQueue = { ...payload };
        if (shouldQueue) {
            // Evita deixar campanha "ativa" quando o enfileiramento falha.
            delete payloadBeforeQueue.status;
        }

        await Campaign.update(req.params.id, payloadBeforeQueue);
        if (senderAccountsProvided) {
            await CampaignSenderAccount.replaceForCampaign(req.params.id, senderAccountsPayload || []);
        }

        let updatedCampaign = await attachCampaignSenderAccounts(await Campaign.findById(req.params.id, {
            created_by: scopedUserId || undefined,
            owner_user_id: ownerScopeUserId || undefined
        }));
        updatedCampaign = await attachCampaignQueueState(updatedCampaign);
        let queueResult = { queued: 0, recipients: 0, restarted: restartRequested };

        if (shouldQueue && updatedCampaign) {
            queueResult = await queueCampaignMessages(updatedCampaign, {
                assignedTo: scopedUserId || undefined,
                ownerUserId: ownerScopeUserId || undefined,
                forceRequeueAll: restartRequested
            });
            updatedCampaign = await attachCampaignSenderAccounts(await Campaign.findById(req.params.id, {
                created_by: scopedUserId || undefined,
                owner_user_id: ownerScopeUserId || undefined
            }));
            updatedCampaign = await attachCampaignQueueState(updatedCampaign);
        } else if (
            shouldReschedulePendingStartAt
            && updatedCampaign
            && String(updatedCampaign.status || '').trim().toLowerCase() === 'active'
        ) {
            const rescheduleResult = await reschedulePendingCampaignQueueByStartAt(
                updatedCampaign,
                campaign.start_at
            );
            queueResult = {
                ...queueResult,
                rescheduled: Number(rescheduleResult?.updated || 0) > 0,
                rescheduled_pending: Number(rescheduleResult?.updated || 0),
                reschedule_reason: rescheduleResult?.reason || null,
                reschedule_delta_ms: Number(rescheduleResult?.delta_ms || 0) || 0
            };

            updatedCampaign = await attachCampaignSenderAccounts(await Campaign.findById(req.params.id, {
                created_by: scopedUserId || undefined,
                owner_user_id: ownerScopeUserId || undefined
            }));
            updatedCampaign = await attachCampaignQueueState(updatedCampaign);
        }

        res.json({ success: true, campaign: updatedCampaign, queue: queueResult });

    } catch (error) {

        console.error('[campaign:update] Falha ao atualizar campanha:', error?.message || error);
        const message = getSafeCampaignApiErrorMessage(error, 'Nao foi possivel atualizar a campanha');
        res.status(400).json({ error: message });

    }

});



app.delete('/api/campaigns/:id', authenticate, async (req, res) => {

    const scopedUserId = getScopedUserId(req);
    const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
    const campaign = await Campaign.findById(req.params.id, {
        created_by: scopedUserId || undefined,
        owner_user_id: ownerScopeUserId || undefined
    });
    if (!campaign) {
        return res.status(404).json({ error: 'Campanha nao encontrada' });
    }
    if (!canAccessCreatedRecord(req, campaign.created_by)) {
        return res.status(403).json({ error: 'Sem permissao para remover esta campanha' });
    }

    await Campaign.delete(req.params.id);

    res.json({ success: true });

});



// ============================================

// API DE AUTOMACOES

// ============================================



app.get('/api/automations', authenticate, async (req, res) => {

    const { is_active, trigger_type, limit, offset, search } = req.query;
    const ownerScopeUserId = await resolveRequesterOwnerUserId(req);

    const automations = await Automation.list({

        is_active: is_active !== undefined ? parseInt(is_active) : undefined,

        trigger_type,

        search,

        owner_user_id: ownerScopeUserId || undefined,

        limit: limit ? parseInt(limit) : 50,

        offset: offset ? parseInt(offset) : 0

    });



    res.json({ success: true, automations: automations.map(enrichAutomationForResponse) });

});



app.get('/api/automations/:id', authenticate, async (req, res) => {

    const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
    const automation = await Automation.findById(req.params.id, {
        owner_user_id: ownerScopeUserId || undefined
    });

    if (!automation) {

        return res.status(404).json({ error: 'AutomaÃ§Ã£o nÃ£o encontrada' });

    }

    if (!canAccessCreatedRecord(req, automation.created_by)) {
        return res.status(404).json({ error: 'AutomaÃ§Ã£o nÃ£o encontrada' });
    }

    res.json({ success: true, automation: enrichAutomationForResponse(automation) });

});



app.post('/api/automations', authenticate, async (req, res) => {

    try {

        const payload = {

            ...req.body,

            created_by: req.user?.id

        };

        if (Object.prototype.hasOwnProperty.call(payload, 'session_ids') || Object.prototype.hasOwnProperty.call(payload, 'session_scope')) {
            payload.session_scope = normalizeAutomationSessionScopeInput(
                Object.prototype.hasOwnProperty.call(payload, 'session_ids') ? payload.session_ids : payload.session_scope
            );
            delete payload.session_ids;
        }
        if (Object.prototype.hasOwnProperty.call(payload, 'tag_filters') || Object.prototype.hasOwnProperty.call(payload, 'tag_filter')) {
            payload.tag_filter = normalizeAutomationTagFilterInput(
                Object.prototype.hasOwnProperty.call(payload, 'tag_filters') ? payload.tag_filters : payload.tag_filter
            );
            delete payload.tag_filters;
        }

        const triggerType = String(payload.trigger_type || '').trim().toLowerCase();
        if (!isSupportedAutomationTriggerType(triggerType)) {
            return res.status(400).json({
                error: 'Trigger de automacao invalido. Use new_lead, status_change, message_received, keyword, schedule ou inactivity.'
            });
        }
        payload.trigger_type = triggerType;

        const result = await Automation.create(payload);

        const automation = await Automation.findById(result.id);

        res.json({ success: true, automation: enrichAutomationForResponse(automation) });

    } catch (error) {

        res.status(400).json({ error: error.message });

    }

});



app.put('/api/automations/:id', authenticate, async (req, res) => {

    const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
    const automation = await Automation.findById(req.params.id, {
        owner_user_id: ownerScopeUserId || undefined
    });

    if (!automation) {

        return res.status(404).json({ error: 'AutomaÃ§Ã£o nÃ£o encontrada' });

    }

    if (!canAccessCreatedRecord(req, automation.created_by)) {
        return res.status(403).json({ error: 'Sem permissao para editar esta automacao' });
    }


    const payload = {
        ...req.body
    };

    if (Object.prototype.hasOwnProperty.call(payload, 'session_ids') || Object.prototype.hasOwnProperty.call(payload, 'session_scope')) {
        payload.session_scope = normalizeAutomationSessionScopeInput(
            Object.prototype.hasOwnProperty.call(payload, 'session_ids') ? payload.session_ids : payload.session_scope
        );
        delete payload.session_ids;
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'tag_filters') || Object.prototype.hasOwnProperty.call(payload, 'tag_filter')) {
        payload.tag_filter = normalizeAutomationTagFilterInput(
            Object.prototype.hasOwnProperty.call(payload, 'tag_filters') ? payload.tag_filters : payload.tag_filter
        );
        delete payload.tag_filters;
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'trigger_type')) {
        const triggerType = String(payload.trigger_type || '').trim().toLowerCase();
        if (!isSupportedAutomationTriggerType(triggerType)) {
            return res.status(400).json({
                error: 'Trigger de automacao invalido. Use new_lead, status_change, message_received, keyword, schedule ou inactivity.'
            });
        }
        payload.trigger_type = triggerType;
    }

    await Automation.update(req.params.id, payload);

    const updatedAutomation = await Automation.findById(req.params.id, {
        owner_user_id: ownerScopeUserId || undefined
    });

    res.json({ success: true, automation: enrichAutomationForResponse(updatedAutomation) });

});



app.delete('/api/automations/:id', authenticate, async (req, res) => {

    const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
    const automation = await Automation.findById(req.params.id, {
        owner_user_id: ownerScopeUserId || undefined
    });
    if (!automation) {
        return res.status(404).json({ error: 'Automacao nao encontrada' });
    }
    if (!canAccessCreatedRecord(req, automation.created_by)) {
        return res.status(403).json({ error: 'Sem permissao para remover esta automacao' });
    }

    await Automation.delete(req.params.id);

    res.json({ success: true });

});



// ============================================

// API DE FLUXOS

// ============================================


app.post('/api/ai/flows/generate', authenticate, async (req, res) => {

    try {
        const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
        const prompt = String(req.body?.prompt || '').trim();
        const preset = String(req.body?.preset || '').trim();

        if (!prompt) {
            return res.status(400).json({ success: false, error: 'Prompt e obrigatorio' });
        }

        if (prompt.length > 5000) {
            return res.status(400).json({ success: false, error: 'Prompt muito longo (maximo 5000 caracteres)' });
        }

        const aiSettingsKey = buildScopedSettingsKey('ai_assistant', ownerScopeUserId);
        const aiSettings = await Settings.get(aiSettingsKey);
        const normalizedAiConfig = aiFlowDraftService.normalizeAiConfig(aiSettings || {});
        const aiConfigHasEnabledFlag = Boolean(
            aiSettings
            && typeof aiSettings === 'object'
            && !Array.isArray(aiSettings)
            && Object.prototype.hasOwnProperty.call(aiSettings, 'enabled')
        );

        if (aiConfigHasEnabledFlag && !normalizedAiConfig.enabled) {
            return res.status(403).json({
                success: false,
                error: 'Ative a Inteligencia Artificial em Configuracoes para gerar fluxos.'
            });
        }

        const generated = await openAiFlowDraftService.generateFlowDraft({
            prompt,
            preset: preset || null,
            businessContext: normalizedAiConfig
        });

        res.json({
            success: true,
            provider: generated.provider || 'openai',
            intent: generated.intent || null,
            context: generated.context || {},
            draft: generated.draft || null
        });
    } catch (error) {
        console.error('Falha ao gerar rascunho de fluxo por IA:', error);
        const statusCode = Number(error?.statusCode) || 500;
        res.status(statusCode).json({
            success: false,
            error: error?.publicMessage || error?.message || 'Erro ao gerar fluxo com IA'
        });
    }

});



async function resolveFlowSessionScopePayload(req, ownerScopeUserId = null) {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const hasSessionField = Object.prototype.hasOwnProperty.call(body, 'session_id')
        || Object.prototype.hasOwnProperty.call(body, 'sessionId');

    if (!hasSessionField) {
        return { provided: false, sessionId: null };
    }

    const rawSessionId = body.session_id ?? body.sessionId;
    const normalizedSessionId = sanitizeSessionId(rawSessionId);
    if (!normalizedSessionId) {
        return { provided: true, sessionId: null };
    }

    const canAccessSession = await canAccessSessionRecordInOwnerScope(req, normalizedSessionId, ownerScopeUserId);
    if (!canAccessSession) {
        return {
            provided: true,
            sessionId: null,
            error: 'Conta WhatsApp nao encontrada ou sem permissao'
        };
    }

    return { provided: true, sessionId: normalizedSessionId };
}

app.get('/api/flows', authenticate, async (req, res) => {

    const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
    const requestedSessionId = sanitizeSessionId(req.query?.session_id || req.query?.sessionId);
    if (requestedSessionId) {
        const canAccessSession = await canAccessSessionRecordInOwnerScope(req, requestedSessionId, ownerScopeUserId);
        if (!canAccessSession) {
            return res.status(403).json({ error: 'Sem permissao para acessar esta conta WhatsApp' });
        }
    }

    const flows = await Flow.list({
        ...req.query,
        session_id: requestedSessionId || undefined,
        owner_user_id: ownerScopeUserId || undefined
    });

    res.json({ success: true, flows });

});



app.get('/api/flows/:id', authenticate, async (req, res) => {

    const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
    const flow = await Flow.findById(req.params.id, {
        owner_user_id: ownerScopeUserId || undefined
    });

    if (!flow) {

        return res.status(404).json({ error: 'Fluxo nÃ£o encontrado' });

    }

    if (!canAccessCreatedRecord(req, flow.created_by)) {
        return res.status(404).json({ error: 'Fluxo nÃ£o encontrado' });
    }

    res.json({ success: true, flow });

});



app.post('/api/flows', authenticate, async (req, res) => {

    const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
    const flowSessionScope = await resolveFlowSessionScopePayload(req, ownerScopeUserId);
    if (flowSessionScope.error) {
        return res.status(403).json({ error: flowSessionScope.error });
    }
    const payload = {
        ...req.body,
        created_by: req.user?.id,
        owner_user_id: ownerScopeUserId || undefined,
        session_id: flowSessionScope.provided ? flowSessionScope.sessionId : null
    };
    delete payload.sessionId;
    const triggerType = String(payload?.trigger_type || '').trim().toLowerCase();
    if (triggerType === 'webhook') {
        return res.status(400).json({
            error: 'Trigger webhook ainda nao esta disponivel por HTTP. Use new_contact, keyword ou manual.'
        });
    }
    const result = await Flow.create(payload);

    const flow = await Flow.findById(result.id, {
        owner_user_id: ownerScopeUserId || undefined
    });

    res.json({
        success: true,
        flow,
        meta: {
            deactivated_flow_ids: Array.isArray(result?.deactivated_flow_ids) ? result.deactivated_flow_ids : []
        }
    });

});



app.put('/api/flows/:id', authenticate, async (req, res) => {

    const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
    const existing = await Flow.findById(req.params.id, {
        owner_user_id: ownerScopeUserId || undefined
    });
    if (!existing) {
        return res.status(404).json({ error: 'Fluxo nao encontrado' });
    }
    if (!canAccessCreatedRecord(req, existing.created_by)) {
        return res.status(403).json({ error: 'Sem permissao para editar este fluxo' });
    }

    const flowSessionScope = await resolveFlowSessionScopePayload(req, ownerScopeUserId);
    if (flowSessionScope.error) {
        return res.status(403).json({ error: flowSessionScope.error });
    }
    const payload = {
        ...req.body
    };
    payload.owner_user_id = ownerScopeUserId || undefined;
    if (flowSessionScope.provided) {
        payload.session_id = flowSessionScope.sessionId;
    }
    delete payload.sessionId;
    if (Object.prototype.hasOwnProperty.call(payload, 'trigger_type')) {
        const triggerType = String(payload?.trigger_type || '').trim().toLowerCase();
        if (triggerType === 'webhook') {
            return res.status(400).json({
                error: 'Trigger webhook ainda nao esta disponivel por HTTP. Use new_contact, keyword ou manual.'
            });
        }
    }

    const updateResult = await Flow.update(req.params.id, payload);

    const flow = await Flow.findById(req.params.id, {
        owner_user_id: ownerScopeUserId || undefined
    });

    res.json({
        success: true,
        flow,
        meta: {
            deactivated_flow_ids: Array.isArray(updateResult?.deactivated_flow_ids) ? updateResult.deactivated_flow_ids : []
        }
    });

});



app.delete('/api/flows/:id', authenticate, async (req, res) => {

    const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
    const existing = await Flow.findById(req.params.id, {
        owner_user_id: ownerScopeUserId || undefined
    });
    if (!existing) {
        return res.status(404).json({ error: 'Fluxo nao encontrado' });
    }
    if (!canAccessCreatedRecord(req, existing.created_by)) {
        return res.status(403).json({ error: 'Sem permissao para remover este fluxo' });
    }

    await Flow.delete(req.params.id);

    res.json({ success: true });

});



// ============================================

// API DE WEBHOOKS

// ============================================



app.get('/api/webhooks', authenticate, async (req, res) => {

    const { Webhook } = require('./database/models');

    const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
    const scopedUserId = getScopedUserId(req);
    const webhooks = await Webhook.list({
        owner_user_id: ownerScopeUserId || undefined,
        created_by: scopedUserId || undefined
    });

    res.json({ success: true, webhooks });

});



app.post('/api/webhooks', authenticate, async (req, res) => {

    const { Webhook } = require('./database/models');

    const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
    const scopedUserId = getScopedUserId(req);
    const requesterUserId = getRequesterUserId(req);
    const result = await Webhook.create({
        ...(req.body && typeof req.body === 'object' ? req.body : {}),
        created_by: requesterUserId || undefined
    });

    const webhook = await Webhook.findById(result.id, {
        owner_user_id: ownerScopeUserId || undefined,
        created_by: scopedUserId || undefined
    });

    res.json({ success: true, webhook });

});



app.put('/api/webhooks/:id', authenticate, async (req, res) => {

    const { Webhook } = require('./database/models');

    const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
    const scopedUserId = getScopedUserId(req);
    const webhook = await Webhook.update(req.params.id, req.body, {
        owner_user_id: ownerScopeUserId || undefined,
        created_by: scopedUserId || undefined
    });

    if (!webhook) {
        return res.status(404).json({ error: 'Webhook nao encontrado' });
    }

    res.json({ success: true, webhook });

});



app.delete('/api/webhooks/:id', authenticate, async (req, res) => {

    const { Webhook } = require('./database/models');

    const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
    const scopedUserId = getScopedUserId(req);
    const deleted = await Webhook.delete(req.params.id, {
        owner_user_id: ownerScopeUserId || undefined,
        created_by: scopedUserId || undefined
    });

    if (!deleted) {
        return res.status(404).json({ error: 'Webhook nao encontrado' });
    }

    res.json({ success: true });

});



// ============================================

// API ADMIN - DASHBOARD DA APLICACAO

// ============================================

function compareByTextAsc(a, b) {
    return String(a || '').localeCompare(String(b || ''), 'pt-BR', { sensitivity: 'base' });
}

function isValidEmailAddress(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

async function buildApplicationAdminOverview() {
    const allUsers = await User.listAll();
    const users = Array.isArray(allUsers) ? allUsers : [];
    const usersById = new Map();
    const groupedByOwner = new Map();

    for (const user of users) {
        const userId = Number(user?.id || 0);
        if (userId > 0) {
            usersById.set(userId, user);
        }

        const ownerUserId = normalizeOwnerUserId(user?.owner_user_id) || userId;
        if (!ownerUserId) continue;

        if (!groupedByOwner.has(ownerUserId)) {
            groupedByOwner.set(ownerUserId, []);
        }
        groupedByOwner.get(ownerUserId).push(user);
    }

    const ownerIds = Array.from(groupedByOwner.keys()).sort((a, b) => a - b);
    const accountSummaries = [];
    const planStatusBreakdown = {};

    for (const ownerId of ownerIds) {
        const ownerUser = usersById.get(ownerId) || await User.findById(ownerId);
        let companyName = '';
        try {
            companyName = String(await Settings.get(buildScopedSettingsKey('company_name', ownerId)) || '').trim();
        } catch (_) {
            companyName = '';
        }
        let plan;
        try {
            plan = await buildOwnerPlanStatus(ownerId);
        } catch (error) {
            plan = {
                name: 'Plano nao configurado',
                code: '',
                status: 'unknown',
                status_label: 'Nao configurado',
                renewal_date: null,
                last_verified_at: null,
                provider: 'Nao configurado',
                source: 'settings',
                api_configured: false,
                external_reference: '',
                message: 'Nao foi possivel carregar o status do plano.'
            };
        }

        const usersInAccount = (groupedByOwner.get(ownerId) || [])
            .map((item) => sanitizeUserPayload(item, ownerId))
            .filter(Boolean)
            .sort((a, b) => compareByTextAsc(a.name || a.email || '', b.name || b.email || ''));

        const activeUsers = usersInAccount.filter((item) => Number(item.is_active) > 0).length;
        const adminUsers = usersInAccount.filter((item) => isUserAdminRole(item.role)).length;
        const pendingEmailConfirmation = usersInAccount.filter((item) => Number(item.email_confirmed) <= 0).length;

        const normalizedPlanStatus = normalizePlanStatusForApi(plan?.status);
        planStatusBreakdown[normalizedPlanStatus] = Number(planStatusBreakdown[normalizedPlanStatus] || 0) + 1;

        accountSummaries.push({
            owner_user_id: ownerId,
            company_name: companyName || String(ownerUser?.name || ownerUser?.email || `Conta ${ownerId}`),
            owner: ownerUser ? sanitizeUserPayload(ownerUser, ownerId) : null,
            plan,
            totals: {
                total_users: usersInAccount.length,
                active_users: activeUsers,
                inactive_users: Math.max(0, usersInAccount.length - activeUsers),
                admin_users: adminUsers,
                pending_email_confirmation: pendingEmailConfirmation
            },
            users: usersInAccount
        });
    }

    accountSummaries.sort((a, b) => {
        return compareByTextAsc(
            a.company_name || a.owner?.name || a.owner?.email || String(a.owner_user_id),
            b.company_name || b.owner?.name || b.owner?.email || String(b.owner_user_id)
        );
    });

    const totalUsers = users.length;
    const totalActiveUsers = users.filter((item) => Number(item?.is_active) > 0).length;
    const totalPendingEmailConfirmation = users.filter((item) => Number(item?.email_confirmed) <= 0).length;

    return {
        generated_at: new Date().toISOString(),
        summary: {
            total_accounts: accountSummaries.length,
            total_users: totalUsers,
            total_active_users: totalActiveUsers,
            total_inactive_users: Math.max(0, totalUsers - totalActiveUsers),
            total_pending_email_confirmation: totalPendingEmailConfirmation,
            plan_status_breakdown: planStatusBreakdown
        },
        accounts: accountSummaries
    };
}

function parseSupportInboxIdentity(value) {
    const raw = String(value || '').trim();
    if (!raw) return { name: '', email: '' };

    const bracketMatch = raw.match(/^(.*)<([^>]+)>$/);
    if (bracketMatch) {
        return {
            name: String(bracketMatch[1] || '').replace(/["']/g, '').trim(),
            email: String(bracketMatch[2] || '').trim().toLowerCase()
        };
    }

    return {
        name: '',
        email: raw.toLowerCase()
    };
}

function parseSupportInboxEnvelope(value) {
    if (!value) return null;
    if (typeof value === 'object' && !Array.isArray(value)) return value;
    const raw = String(value || '').trim();
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed;
        }
        return null;
    } catch (_) {
        return null;
    }
}

function normalizeSupportInboxReceivedAt(rawTimestamp) {
    if (rawTimestamp === undefined || rawTimestamp === null || rawTimestamp === '') {
        return new Date().toISOString();
    }

    const numeric = Number(rawTimestamp);
    if (Number.isFinite(numeric) && numeric > 0) {
        const asMs = numeric > 1000000000000 ? numeric : (numeric * 1000);
        const parsed = new Date(asMs);
        if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    }

    const parsed = new Date(String(rawTimestamp));
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    return new Date().toISOString();
}

function normalizeSupportInboxIncomingPayload(body = {}, options = {}) {
    const envelope = parseSupportInboxEnvelope(body?.envelope);
    const fromRaw = String(
        body?.from
        || body?.sender
        || body?.from_email
        || envelope?.from
        || ''
    ).trim();
    const toRaw = String(
        body?.recipient
        || body?.to
        || body?.to_email
        || (Array.isArray(envelope?.to) ? envelope.to[0] : envelope?.to)
        || 'support@zapvender.com'
    ).trim();
    const identity = parseSupportInboxIdentity(fromRaw);
    const toIdentity = parseSupportInboxIdentity(toRaw);
    const subject = String(body?.subject || '').trim() || '(Sem assunto)';

    const messageIdCandidates = [
        body?.messageId,
        body?.message_id,
        body?.['Message-Id'],
        body?.['message-id'],
        body?.['Message-ID'],
        body?.['X-Message-Id'],
        body?.['X-Message-ID'],
        body?.sg_message_id
    ];
    const externalMessageId = messageIdCandidates
        .map((candidate) => String(candidate || '').trim())
        .find(Boolean) || null;

    const bodyText = String(
        body?.['stripped-text']
        || body?.['body-plain']
        || body?.text
        || body?.body
        || body?.plain
        || ''
    );
    const bodyHtml = String(
        body?.['body-html']
        || body?.['stripped-html']
        || body?.html
        || ''
    );

    return {
        external_message_id: externalMessageId,
        provider: String(options?.provider || body?.provider || 'unknown').trim().toLowerCase() || 'unknown',
        from_name: identity.name || null,
        from_email: identity.email,
        to_email: toIdentity.email || 'support@zapvender.com',
        subject,
        body_text: bodyText || null,
        body_html: bodyHtml || null,
        received_at: normalizeSupportInboxReceivedAt(body?.timestamp || body?.received_at || body?.receivedAt || body?.Date || null),
        raw_payload: body
    };
}

app.post('/webhooks/support-inbox/incoming', upload.none(), async (req, res) => {
    try {
        const expectedSecret = String(process.env.SUPPORT_INBOX_WEBHOOK_SECRET || '').trim();
        const providedSecret = String(
            req.headers['x-support-inbox-secret']
            || req.body?.secret
            || req.query?.secret
            || ''
        ).trim();

        if (expectedSecret && providedSecret !== expectedSecret) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized'
            });
        }

        const payload = normalizeSupportInboxIncomingPayload(req.body || {}, {
            provider: req.query?.provider
        });

        if (!payload.from_email || !isValidEmailAddress(payload.from_email)) {
            return res.status(400).json({
                success: false,
                error: 'from_email invalido'
            });
        }

        const saved = await SupportInboxMessage.upsert(payload);
        return res.json({
            success: true,
            id: Number(saved?.id || 0) || null,
            created: saved?.created === true
        });
    } catch (error) {
        console.error('[support-inbox:incoming] falha:', error);
        return res.status(500).json({
            success: false,
            error: 'Falha ao processar email de suporte'
        });
    }
});

app.get('/api/admin/dashboard/overview', authenticate, async (req, res) => {
    if (!ensureApplicationAdmin(req, res)) return;

    try {
        const overview = await buildApplicationAdminOverview();
        res.json({
            success: true,
            overview
        });
    } catch (error) {
        console.error('[admin/dashboard/overview] falha:', error);
        res.status(500).json({
            success: false,
            error: 'Falha ao carregar dashboard administrativo'
        });
    }
});

app.get('/api/admin/dashboard/email-settings', authenticate, async (req, res) => {
    if (!ensureApplicationAdmin(req, res)) return;

    try {
        const currentSettings = await loadEmailDeliverySettings();
        res.json({
            success: true,
            settings: sanitizeEmailDeliverySettingsForResponse(currentSettings)
        });
    } catch (error) {
        console.error('[admin/dashboard/email-settings:get] falha:', error);
        res.status(500).json({
            success: false,
            error: 'Falha ao carregar configuracoes de email'
        });
    }
});

app.put('/api/admin/dashboard/email-settings', authenticate, async (req, res) => {
    if (!ensureApplicationAdmin(req, res)) return;

    try {
        const currentSettings = await loadEmailDeliverySettings();
        const normalized = normalizeEmailDeliverySettingsInput(req.body, currentSettings);

        if (normalized.provider === 'sendgrid') {
            if (!normalized.sendgridFromEmail || !isValidEmailAddress(normalized.sendgridFromEmail)) {
                return res.status(400).json({
                    success: false,
                    error: 'Informe um email remetente valido para o SendGrid'
                });
            }

            if (!String(normalized.sendgridApiKey || '').trim()) {
                return res.status(400).json({
                    success: false,
                    error: 'Informe a SENDGRID_API_KEY para enviar emails'
                });
            }
        }

        if (normalized.provider === 'mailgun') {
            if (!String(normalized.mailgunDomain || '').trim()) {
                return res.status(400).json({
                    success: false,
                    error: 'Informe o MAILGUN_DOMAIN para enviar emails'
                });
            }

            if (!normalized.mailgunFromEmail || !isValidEmailAddress(normalized.mailgunFromEmail)) {
                return res.status(400).json({
                    success: false,
                    error: 'Informe um email remetente valido para o Mailgun'
                });
            }

            if (!String(normalized.mailgunApiKey || '').trim()) {
                return res.status(400).json({
                    success: false,
                    error: 'Informe a MAILGUN_API_KEY para enviar emails'
                });
            }
        }

        const serialized = serializeEmailDeliverySettingsForStorage(normalized);
        await Settings.set(EMAIL_DELIVERY_SETTINGS_KEY, serialized, 'json');

        const refreshed = await loadEmailDeliverySettings();
        res.json({
            success: true,
            settings: sanitizeEmailDeliverySettingsForResponse(refreshed)
        });
    } catch (error) {
        console.error('[admin/dashboard/email-settings:put] falha:', error);
        res.status(500).json({
            success: false,
            error: 'Falha ao salvar configuracoes de email'
        });
    }
});

app.post('/api/admin/dashboard/email-settings/preview', authenticate, async (req, res) => {
    if (!ensureApplicationAdmin(req, res)) return;

    try {
        const currentSettings = await loadEmailDeliverySettings();
        const normalized = normalizeEmailDeliverySettingsInput(req.body, currentSettings);
        const runtimeSettings = buildRuntimeEmailDeliveryConfig(normalized);

        const tokenPayload = createEmailConfirmationTokenPayload();
        const baseAppUrl = resolveAppUrl(req) || String(process.env.APP_URL || 'https://zapvender.com').trim();
        const confirmationUrl = buildEmailConfirmationUrl(baseAppUrl, tokenPayload.token);

        const rawPreviewEmail = String(req.body?.previewEmail || req.body?.email || req.user?.email || '').trim().toLowerCase();
        const previewEmail = isValidEmailAddress(rawPreviewEmail) ? rawPreviewEmail : 'contato@empresa.com';
        const previewName = String(req.body?.previewName || req.body?.name || 'Usuario').trim() || 'Usuario';

        const context = buildEmailTemplateContext(
            {
                id: req.user?.id || null,
                name: previewName,
                email: previewEmail
            },
            confirmationUrl,
            {
                appName: runtimeSettings.appName,
                expiresInText: tokenPayload.expiresInText,
                appUrl: baseAppUrl
            }
        );
        const content = buildRenderedEmailContent(context, runtimeSettings);

        return res.json({
            success: true,
            preview: {
                subject: content.subject,
                html: content.html,
                text: content.text
            }
        });
    } catch (error) {
        console.error('[admin/dashboard/email-settings:preview] falha:', error);
        return res.status(500).json({
            success: false,
            error: 'Falha ao gerar pre-visualizacao do email'
        });
    }
});

app.post('/api/admin/dashboard/email-settings/test', authenticate, async (req, res) => {
    if (!ensureApplicationAdmin(req, res)) return;

    try {
        const targetEmail = String(req.body?.email || req.user?.email || '').trim().toLowerCase();
        if (!targetEmail || !isValidEmailAddress(targetEmail)) {
            return res.status(400).json({
                success: false,
                error: 'Informe um email valido para o envio de teste'
            });
        }

        const runtimeSettings = await getRegistrationEmailRuntimeConfig();
        const tokenPayload = createEmailConfirmationTokenPayload();

        await sendRegistrationConfirmationEmail(
            req,
            {
                id: req.user?.id || null,
                name: 'Teste de configuracao',
                email: targetEmail
            },
            tokenPayload,
            {
                emailSettings: runtimeSettings
            }
        );

        res.json({
            success: true,
            message: 'Email de teste enviado com sucesso',
            email: targetEmail,
            provider: runtimeSettings.provider
        });
    } catch (error) {
        if (error instanceof MailMktIntegrationError) {
            return res.status(error.statusCode || 502).json({
                success: false,
                error: error.message || 'Falha ao enviar email de teste',
                retryable: error.retryable !== false
            });
        }

        console.error('[admin/dashboard/email-settings:test] falha:', error);
        res.status(500).json({
            success: false,
            error: 'Falha ao enviar email de teste'
        });
    }
});

app.get('/api/admin/dashboard/email-support-inbox', authenticate, async (req, res) => {
    if (!ensureApplicationAdmin(req, res)) return;

    try {
        const limit = Math.max(1, Math.min(100, Number(req.query?.limit || 30) || 30));
        const offset = Math.max(0, Number(req.query?.offset || 0) || 0);
        const unreadOnly = ['1', 'true', 'yes', 'sim', 'on'].includes(
            String(req.query?.unread_only ?? req.query?.unreadOnly ?? '').trim().toLowerCase()
        );

        const [messages, unreadCount] = await Promise.all([
            SupportInboxMessage.list({
                limit,
                offset,
                unread_only: unreadOnly
            }),
            SupportInboxMessage.count({
                unread_only: true
            })
        ]);

        res.json({
            success: true,
            inbox: {
                messages,
                unreadCount
            }
        });
    } catch (error) {
        console.error('[admin/dashboard/email-support-inbox:get] falha:', error);
        res.status(500).json({
            success: false,
            error: 'Falha ao carregar caixa de entrada de suporte'
        });
    }
});

app.post('/api/admin/dashboard/email-support-inbox/:id/read', authenticate, async (req, res) => {
    if (!ensureApplicationAdmin(req, res)) return;

    try {
        const messageId = parseInt(String(req.params?.id || ''), 10);
        if (!Number.isInteger(messageId) || messageId <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Mensagem invalida'
            });
        }

        const isRead = req.body?.isRead === false || req.body?.is_read === 0 || req.body?.is_read === false
            ? false
            : true;
        await SupportInboxMessage.markRead(messageId, isRead);
        const message = await SupportInboxMessage.findById(messageId);

        res.json({
            success: true,
            supportMessage: message
        });
    } catch (error) {
        console.error('[admin/dashboard/email-support-inbox:read] falha:', error);
        res.status(500).json({
            success: false,
            error: 'Falha ao atualizar status da mensagem'
        });
    }
});

app.put('/api/admin/dashboard/users/:id', authenticate, async (req, res) => {
    if (!ensureApplicationAdmin(req, res)) return;

    try {
        const targetId = parseInt(String(req.params?.id || ''), 10);
        if (!Number.isInteger(targetId) || targetId <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Usuario invalido'
            });
        }

        const current = await User.findById(targetId);
        if (!current) {
            return res.status(404).json({
                success: false,
                error: 'Usuario nao encontrado'
            });
        }

        const ownerUserId = normalizeOwnerUserId(current.owner_user_id) || Number(current.id || 0);
        const isPrimaryOwnerAdmin = isPrimaryOwnerAdminUser(current, ownerUserId);
        const requesterId = Number(req.user?.id || 0);
        const payload = {};
        const body = req.body && typeof req.body === 'object' ? req.body : {};

        if (Object.prototype.hasOwnProperty.call(body, 'name')) {
            const name = String(body.name || '').trim();
            if (!name) {
                return res.status(400).json({
                    success: false,
                    error: 'Nome e obrigatorio'
                });
            }
            payload.name = name;
        }

        if (Object.prototype.hasOwnProperty.call(body, 'email')) {
            const email = String(body.email || '').trim().toLowerCase();
            if (!email || !isValidEmailAddress(email)) {
                return res.status(400).json({
                    success: false,
                    error: 'Informe um e-mail valido'
                });
            }

            const existing = await User.findActiveByEmail(email);
            if (existing && Number(existing.id) !== targetId) {
                return res.status(409).json({
                    success: false,
                    error: 'E-mail ja cadastrado para outro usuario'
                });
            }

            payload.email = email;
        }

        if (Object.prototype.hasOwnProperty.call(body, 'role')) {
            payload.role = normalizeUserRoleInput(body.role);
            if (isPrimaryOwnerAdmin && !isUserAdminRole(payload.role)) {
                return res.status(400).json({
                    success: false,
                    error: 'Nao e permitido rebaixar o admin principal da conta'
                });
            }
        }

        if (Object.prototype.hasOwnProperty.call(body, 'is_active')) {
            payload.is_active = normalizeUserActiveInput(body.is_active, Number(current.is_active) > 0 ? 1 : 0);
            if (isPrimaryOwnerAdmin && Number(payload.is_active) === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Nao e permitido desativar o admin principal da conta'
                });
            }
            if (requesterId === targetId && Number(payload.is_active) === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Nao e possivel desativar o proprio usuario'
                });
            }
        }

        if (Object.prototype.hasOwnProperty.call(body, 'email_confirmed')) {
            const confirmed = Number(body.email_confirmed) > 0;
            payload.email_confirmed = confirmed ? 1 : 0;
            payload.email_confirmed_at = confirmed ? new Date().toISOString() : null;
            payload.email_confirmation_token_hash = null;
            payload.email_confirmation_expires_at = null;
        }

        if (!Object.keys(payload).length) {
            return res.json({
                success: true,
                user: sanitizeUserPayload(current, ownerUserId)
            });
        }

        await User.update(targetId, payload);
        if (Object.prototype.hasOwnProperty.call(payload, 'is_active') && Number(payload.is_active) === 0) {
            markUserPresenceOffline(targetId);
        }

        const updated = await User.findById(targetId);
        return res.json({
            success: true,
            user: sanitizeUserPayload(updated, ownerUserId)
        });
    } catch (error) {
        console.error('[admin/dashboard/users:put] falha:', error);
        return res.status(500).json({
            success: false,
            error: 'Falha ao atualizar usuario'
        });
    }
});

app.delete('/api/admin/dashboard/users/:id', authenticate, async (req, res) => {
    if (!ensureApplicationAdmin(req, res)) return;

    try {
        const targetId = parseInt(String(req.params?.id || ''), 10);
        if (!Number.isInteger(targetId) || targetId <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Usuario invalido'
            });
        }

        const modeRaw = String(req.query?.mode || '').trim().toLowerCase();
        const hardDelete = ['delete', 'hard', 'purge', 'remove', 'excluir'].includes(modeRaw);

        const requesterId = Number(req.user?.id || 0);
        if (requesterId === targetId) {
            return res.status(400).json({
                success: false,
                error: hardDelete
                    ? 'Nao e possivel excluir o proprio usuario'
                    : 'Nao e possivel desativar o proprio usuario'
            });
        }

        const current = await User.findById(targetId);
        if (!current) {
            return res.status(404).json({
                success: false,
                error: 'Usuario nao encontrado'
            });
        }

        const ownerUserId = normalizeOwnerUserId(current.owner_user_id) || Number(current.id || 0);
        if (isPrimaryOwnerAdminUser(current, ownerUserId)) {
            return res.status(400).json({
                success: false,
                error: 'Use a acao de desativar conta para remover o admin principal'
            });
        }

        if (!hardDelete) {
            await User.update(targetId, { is_active: 0 });
            markUserPresenceOffline(targetId);
            const updated = await User.findById(targetId);
            return res.json({
                success: true,
                user: sanitizeUserPayload(updated, ownerUserId)
            });
        }

        const fallbackOwnerUserId = ownerUserId && ownerUserId !== targetId ? ownerUserId : null;
        const fallbackAssignedUserId = Number.isInteger(fallbackOwnerUserId) && fallbackOwnerUserId > 0
            ? fallbackOwnerUserId
            : null;

        const runSafeReferenceUpdate = async (sql, params = []) => {
            try {
                await run(sql, params);
            } catch (error) {
                const message = String(error?.message || '').toLowerCase();
                if (
                    message.includes('does not exist') ||
                    message.includes('undefined table') ||
                    message.includes('undefined column')
                ) {
                    return;
                }
                throw error;
            }
        };

        await run('BEGIN');
        try {
            await run(
                'UPDATE users SET owner_user_id = ? WHERE owner_user_id = ? AND id <> ?',
                [fallbackAssignedUserId, targetId, targetId]
            );
            await run(
                'UPDATE leads SET assigned_to = ? WHERE assigned_to = ?',
                [fallbackAssignedUserId, targetId]
            );
            await run(
                'UPDATE leads SET owner_user_id = ? WHERE owner_user_id = ?',
                [fallbackAssignedUserId, targetId]
            );
            await run(
                'UPDATE conversations SET assigned_to = ? WHERE assigned_to = ?',
                [fallbackAssignedUserId, targetId]
            );

            const createdByTables = [
                'flows',
                'templates',
                'campaigns',
                'automations',
                'custom_events',
                'webhooks',
                'whatsapp_sessions',
                'tags'
            ];

            for (const tableName of createdByTables) {
                await runSafeReferenceUpdate(
                    `UPDATE ${tableName} SET created_by = ? WHERE created_by = ?`,
                    [fallbackAssignedUserId, targetId]
                );
            }

            await runSafeReferenceUpdate(
                'UPDATE tenant_integrity_audit_runs SET owner_user_id = ? WHERE owner_user_id = ?',
                [fallbackAssignedUserId, targetId]
            );
            await runSafeReferenceUpdate(
                'UPDATE audit_logs SET user_id = NULL WHERE user_id = ?',
                [targetId]
            );

            await run('DELETE FROM users WHERE id = ?', [targetId]);
            await run('COMMIT');
        } catch (error) {
            try {
                await run('ROLLBACK');
            } catch (_) {
                // ignore rollback failure
            }
            throw error;
        }

        markUserPresenceOffline(targetId);
        return res.json({
            success: true,
            deleted: true,
            user_id: targetId
        });
    } catch (error) {
        console.error('[admin/dashboard/users:delete] falha:', error);
        return res.status(500).json({
            success: false,
            error: 'Falha ao remover usuario'
        });
    }
});

app.put('/api/admin/dashboard/accounts/:ownerUserId', authenticate, async (req, res) => {
    if (!ensureApplicationAdmin(req, res)) return;

    try {
        const ownerUserId = parseInt(String(req.params?.ownerUserId || ''), 10);
        if (!Number.isInteger(ownerUserId) || ownerUserId <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Conta invalida'
            });
        }

        const ownerUser = await User.findById(ownerUserId);
        if (!ownerUser) {
            return res.status(404).json({
                success: false,
                error: 'Conta nao encontrada'
            });
        }

        const requesterId = Number(req.user?.id || 0);
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const userPayload = {};
        const shouldReactivateAllUsers = normalizeUserActiveInput(
            body.reactivate_all_users ?? body.reactivateAllUsers,
            0
        ) === 1;

        if (Object.prototype.hasOwnProperty.call(body, 'name')) {
            const name = String(body.name || '').trim();
            if (!name) {
                return res.status(400).json({
                    success: false,
                    error: 'Nome do admin principal e obrigatorio'
                });
            }
            userPayload.name = name;
        }

        if (Object.prototype.hasOwnProperty.call(body, 'email')) {
            const email = String(body.email || '').trim().toLowerCase();
            if (!email || !isValidEmailAddress(email)) {
                return res.status(400).json({
                    success: false,
                    error: 'Informe um e-mail valido'
                });
            }

            const existing = await User.findActiveByEmail(email);
            if (existing && Number(existing.id) !== ownerUserId) {
                return res.status(409).json({
                    success: false,
                    error: 'E-mail ja cadastrado para outra conta'
                });
            }
            userPayload.email = email;
        }

        if (Object.prototype.hasOwnProperty.call(body, 'is_active')) {
            userPayload.is_active = normalizeUserActiveInput(body.is_active, Number(ownerUser.is_active) > 0 ? 1 : 0);
            if (requesterId === ownerUserId && Number(userPayload.is_active) === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Nao e possivel desativar a propria conta de administrador'
                });
            }
        }

        const hasCompanyNamePayload =
            Object.prototype.hasOwnProperty.call(body, 'company_name')
            || Object.prototype.hasOwnProperty.call(body, 'companyName');
        if (hasCompanyNamePayload) {
            const companyName = String(body.company_name ?? body.companyName ?? '').trim();
            if (!companyName) {
                return res.status(400).json({
                    success: false,
                    error: 'Nome da empresa Ã© obrigatÃ³rio'
                });
            }
            await Settings.set(buildScopedSettingsKey('company_name', ownerUserId), companyName, 'string');
        }

        userPayload.role = 'admin';
        userPayload.owner_user_id = ownerUserId;
        await User.update(ownerUserId, userPayload);
        if (Number(userPayload.is_active) === 0) {
            markUserPresenceOffline(ownerUserId);
        }
        let reactivatedUsers = 0;
        if (Number(userPayload.is_active) === 1 && shouldReactivateAllUsers) {
            const usersInAccount = await User.listByOwner(ownerUserId, { includeInactive: true });
            const usersById = new Map();

            for (const user of Array.isArray(usersInAccount) ? usersInAccount : []) {
                const userId = Number(user?.id || 0);
                if (userId > 0) usersById.set(userId, user);
            }
            if (!usersById.has(ownerUserId)) {
                usersById.set(ownerUserId, ownerUser);
            }

            for (const user of usersById.values()) {
                const userId = Number(user?.id || 0);
                if (!userId) continue;
                await User.update(userId, { is_active: 1 });
                reactivatedUsers += 1;
            }

            await Settings.set(buildScopedSettingsKey('plan_status', ownerUserId), 'active', 'string');
            await Settings.set(buildScopedSettingsKey('plan_message', ownerUserId), 'Conta reativada pelo administrador da aplicacao.', 'string');
            await Settings.set(buildScopedSettingsKey('plan_last_verified_at', ownerUserId), new Date().toISOString(), 'string');
        }

        const hasPlanPayload = Object.prototype.hasOwnProperty.call(body, 'plan') && body.plan && typeof body.plan === 'object';
        if (hasPlanPayload) {
            const plan = body.plan;
            if (Object.prototype.hasOwnProperty.call(plan, 'name')) {
                await Settings.set(buildScopedSettingsKey('plan_name', ownerUserId), String(plan.name || '').trim(), 'string');
            }
            if (Object.prototype.hasOwnProperty.call(plan, 'code')) {
                await Settings.set(buildScopedSettingsKey('plan_code', ownerUserId), String(plan.code || '').trim(), 'string');
            }
            if (Object.prototype.hasOwnProperty.call(plan, 'status')) {
                const normalizedStatus = normalizePlanStatusForApi(plan.status);
                await Settings.set(buildScopedSettingsKey('plan_status', ownerUserId), normalizedStatus, 'string');
            }
            if (Object.prototype.hasOwnProperty.call(plan, 'provider')) {
                await Settings.set(buildScopedSettingsKey('plan_provider', ownerUserId), String(plan.provider || '').trim(), 'string');
            }
            if (Object.prototype.hasOwnProperty.call(plan, 'message')) {
                await Settings.set(buildScopedSettingsKey('plan_message', ownerUserId), String(plan.message || '').trim(), 'string');
            }
            if (Object.prototype.hasOwnProperty.call(plan, 'renewal_date')) {
                const renewalDate = normalizeOptionalIsoDate(plan.renewal_date);
                await Settings.set(buildScopedSettingsKey('plan_renewal_date', ownerUserId), renewalDate || '', 'string');
            }
        }

        const overview = await buildApplicationAdminOverview();
        const account = (Array.isArray(overview.accounts) ? overview.accounts : [])
            .find((item) => Number(item.owner_user_id || 0) === ownerUserId) || null;

        return res.json({
            success: true,
            account,
            reactivated_users: reactivatedUsers
        });
    } catch (error) {
        console.error('[admin/dashboard/accounts:put] falha:', error);
        return res.status(500).json({
            success: false,
            error: 'Falha ao atualizar conta'
        });
    }
});

app.delete('/api/admin/dashboard/accounts/:ownerUserId', authenticate, async (req, res) => {
    if (!ensureApplicationAdmin(req, res)) return;

    try {
        const ownerUserId = parseInt(String(req.params?.ownerUserId || ''), 10);
        if (!Number.isInteger(ownerUserId) || ownerUserId <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Conta invalida'
            });
        }

        const ownerUser = await User.findById(ownerUserId);
        if (!ownerUser) {
            return res.status(404).json({
                success: false,
                error: 'Conta nao encontrada'
            });
        }

        const modeRaw = String(req.query?.mode || '').trim().toLowerCase();
        const hardDelete = ['delete', 'hard', 'purge', 'remove', 'excluir'].includes(modeRaw);
        const users = await User.listByOwner(ownerUserId, { includeInactive: true });
        const usersById = new Map();

        for (const user of Array.isArray(users) ? users : []) {
            const userId = Number(user?.id || 0);
            if (userId > 0) {
                usersById.set(userId, user);
            }
        }

        // Fallback para contas legadas em que owner_user_id ainda nao foi preenchido corretamente.
        if (!usersById.has(ownerUserId)) {
            usersById.set(ownerUserId, ownerUser);
        }

        const usersInAccount = Array.from(usersById.values());
        if (usersInAccount.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Conta nao encontrada'
            });
        }

        if (hardDelete) {
            const userIds = usersInAccount
                .map((user) => Number(user?.id || 0))
                .filter((id) => Number.isInteger(id) && id > 0);

            const runSafeReferenceUpdate = async (sql, params = []) => {
                try {
                    await run(sql, params);
                } catch (error) {
                    const message = String(error?.message || '').toLowerCase();
                    if (
                        message.includes('does not exist')
                        || message.includes('undefined table')
                        || message.includes('undefined column')
                    ) {
                        return;
                    }
                    throw error;
                }
            };

            await run('BEGIN');
            try {
                if (userIds.length > 0) {
                    const placeholders = userIds.map(() => '?').join(', ');
                    await runSafeReferenceUpdate(
                        `UPDATE users SET owner_user_id = NULL WHERE owner_user_id IN (${placeholders})`,
                        userIds
                    );
                    await runSafeReferenceUpdate(
                        `UPDATE leads SET assigned_to = NULL WHERE assigned_to IN (${placeholders})`,
                        userIds
                    );
                    await runSafeReferenceUpdate(
                        `UPDATE leads SET owner_user_id = NULL WHERE owner_user_id IN (${placeholders})`,
                        userIds
                    );
                    await runSafeReferenceUpdate(
                        `UPDATE conversations SET assigned_to = NULL WHERE assigned_to IN (${placeholders})`,
                        userIds
                    );

                    const createdByTables = [
                        'flows',
                        'templates',
                        'campaigns',
                        'automations',
                        'custom_events',
                        'webhooks',
                        'whatsapp_sessions',
                        'tags'
                    ];

                    for (const tableName of createdByTables) {
                        await runSafeReferenceUpdate(
                            `UPDATE ${tableName} SET created_by = NULL WHERE created_by IN (${placeholders})`,
                            userIds
                        );
                    }

                    await runSafeReferenceUpdate(
                        `UPDATE audit_logs SET user_id = NULL WHERE user_id IN (${placeholders})`,
                        userIds
                    );
                }

                const ownerScopedTables = [
                    'flows',
                    'templates',
                    'campaigns',
                    'automations',
                    'custom_events',
                    'webhooks',
                    'whatsapp_sessions',
                    'tags',
                    'tenant_integrity_audit_runs'
                ];

                for (const tableName of ownerScopedTables) {
                    await runSafeReferenceUpdate(
                        `DELETE FROM ${tableName} WHERE owner_user_id = ?`,
                        [ownerUserId]
                    );
                }

                await runSafeReferenceUpdate(
                    'DELETE FROM settings WHERE key LIKE ?',
                    [`user:${ownerUserId}:%`]
                );

                if (userIds.length > 0) {
                    const placeholders = userIds.map(() => '?').join(', ');
                    await runSafeReferenceUpdate(
                        `DELETE FROM users WHERE id IN (${placeholders})`,
                        userIds
                    );
                }

                await run('COMMIT');
            } catch (error) {
                try {
                    await run('ROLLBACK');
                } catch (_) {
                    // ignore rollback failure
                }
                throw error;
            }

            for (const userId of userIds) {
                markUserPresenceOffline(userId);
            }

            return res.json({
                success: true,
                owner_user_id: ownerUserId,
                deleted_account: true,
                deleted_users: userIds.length
            });
        }

        let disabledUsers = 0;
        for (const user of usersInAccount) {
            const userId = Number(user?.id || 0);
            if (!userId) continue;
            await User.update(userId, { is_active: 0 });
            markUserPresenceOffline(userId);
            disabledUsers += 1;
        }

        await Settings.set(buildScopedSettingsKey('plan_status', ownerUserId), 'canceled', 'string');
        await Settings.set(buildScopedSettingsKey('plan_message', ownerUserId), 'Conta desativada pelo administrador da aplicacao.', 'string');
        await Settings.set(buildScopedSettingsKey('plan_last_verified_at', ownerUserId), new Date().toISOString(), 'string');

        return res.json({
            success: true,
            owner_user_id: ownerUserId,
            disabled_users: disabledUsers
        });
    } catch (error) {
        console.error('[admin/dashboard/accounts:delete] falha:', error);
        const modeRaw = String(req.query?.mode || '').trim().toLowerCase();
        const hardDelete = ['delete', 'hard', 'purge', 'remove', 'excluir'].includes(modeRaw);
        return res.status(500).json({
            success: false,
            error: hardDelete
                ? `Falha ao excluir conta: ${String(error?.message || 'erro interno')}`
                : 'Falha ao desativar conta'
        });
    }
});



// ============================================

// API ADMIN - AUDITORIA DE INTEGRIDADE MULTI-TENANT

// ============================================

app.get('/api/admin/audits/tenant-integrity', authenticate, async (req, res) => {
    const requesterRole = getRequesterRole(req);
    if (!isUserAdminRole(requesterRole)) {
        return res.status(403).json({ error: 'Sem permissao para acessar auditoria de integridade' });
    }

    const workerState = buildTenantIntegrityAuditWorkerState();
    const response = {
        success: true,
        worker: {
            enabled: workerState.enabled,
            intervalMs: workerState.intervalMs,
            sampleLimit: workerState.sampleLimit,
            leaderLockEnabled: workerState.leaderLockEnabled,
            leaderLockHeld: workerState.leaderLockHeld,
            running: workerState.running,
            lastRunAt: workerState.lastRunAt,
            lastError: workerState.lastError,
            lastRunRecordId: workerState.lastRunRecordId,
            lastPersistError: workerState.lastPersistError,
            hasLastResult: !!workerState.lastResult
        },
        manualRun: {
            defaultScope: 'owner',
            allowGlobal: TENANT_INTEGRITY_AUDIT_ALLOW_GLOBAL_MANUAL
        }
    };

    if (TENANT_INTEGRITY_AUDIT_ALLOW_GLOBAL_MANUAL && workerState.lastResult) {
        response.worker.lastResult = workerState.lastResult;
    }

    res.json(response);
});

app.get('/api/admin/audits/tenant-integrity/history', authenticate, async (req, res) => {
    const requesterRole = getRequesterRole(req);
    if (!isUserAdminRole(requesterRole)) {
        return res.status(403).json({ error: 'Sem permissao para acessar historico da auditoria' });
    }

    try {
        const requestedScope = String(req.query?.scope || 'owner').trim().toLowerCase();
        const requestedLimit = req.query?.limit || 20;
        const includeResult = ['1', 'true', 'sim', 'yes', 'on'].includes(String(req.query?.includeResult || '').trim().toLowerCase());
        const onlyIssues = ['1', 'true', 'sim', 'yes', 'on'].includes(String(req.query?.onlyIssues || '').trim().toLowerCase());

        let ownerScopeUserId = null;
        if (requestedScope !== 'global') {
            ownerScopeUserId = await resolveRequesterOwnerUserId(req);
            if (!ownerScopeUserId) {
                return res.status(400).json({ error: 'Nao foi possivel resolver owner da conta' });
            }
        } else if (!TENANT_INTEGRITY_AUDIT_ALLOW_GLOBAL_MANUAL) {
            return res.status(403).json({ error: 'Consulta global do historico desabilitada' });
        }

        const runs = await tenantIntegrityAuditService.listAuditRuns({
            scope: requestedScope === 'global' ? 'global' : 'owner',
            ownerUserId: requestedScope === 'global' ? null : ownerScopeUserId,
            limit: requestedLimit,
            includeResult,
            onlyIssues
        });

        res.json({
            success: true,
            scope: requestedScope === 'global' ? 'global' : 'owner',
            ownerUserId: requestedScope === 'global' ? null : ownerScopeUserId,
            count: Array.isArray(runs) ? runs.length : 0,
            runs
        });
    } catch (error) {
        console.error('[TenantIntegrityAudit][history-endpoint] falha:', error);
        res.status(500).json({ error: 'Falha ao consultar historico da auditoria', details: error.message });
    }
});

app.post('/api/admin/audits/tenant-integrity/run', authenticate, async (req, res) => {
    const requesterRole = getRequesterRole(req);
    if (!isUserAdminRole(requesterRole)) {
        return res.status(403).json({ error: 'Sem permissao para executar auditoria de integridade' });
    }

    try {
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const requestedScope = String(body.scope || req.query?.scope || 'owner').trim().toLowerCase();
        const requestedSampleLimit = body.sampleLimit || req.query?.sampleLimit || TENANT_INTEGRITY_AUDIT_SAMPLE_LIMIT;

        let ownerScopeUserId = null;
        if (requestedScope !== 'global') {
            ownerScopeUserId = await resolveRequesterOwnerUserId(req);
            if (!ownerScopeUserId) {
                return res.status(400).json({ error: 'Nao foi possivel resolver owner da conta' });
            }
        } else if (!TENANT_INTEGRITY_AUDIT_ALLOW_GLOBAL_MANUAL) {
            return res.status(403).json({ error: 'Execucao manual global de auditoria desabilitada' });
        }

        const audit = await runTenantIntegrityAudit({
            trigger: 'manual-endpoint',
            ownerUserId: requestedScope === 'global' ? null : ownerScopeUserId,
            sampleLimit: requestedSampleLimit,
            cacheAsWorker: false
        });

        res.json({
            success: true,
            audit,
            worker: buildTenantIntegrityAuditWorkerState()
        });
    } catch (error) {
        console.error('[TenantIntegrityAudit][manual-endpoint] falha:', error);
        res.status(500).json({ error: 'Falha ao executar auditoria de integridade', details: error.message });
    }
});



// Webhook de entrada (para receber dados externos)

function resolveIncomingWebhookOwnerUserId() {
    const value = normalizeOwnerUserId(process.env.WEBHOOK_INCOMING_OWNER_USER_ID);
    return value || null;
}

function normalizeIncomingWebhookSecret(value) {
    return String(value || '').trim();
}

function extractIncomingWebhookSecret(req, payload = null) {
    const sourcePayload = payload && typeof payload === 'object' ? payload : {};
    const bodySecret = normalizeIncomingWebhookSecret(sourcePayload.secret);
    if (bodySecret) {
        return bodySecret;
    }

    const headerSecret = normalizeIncomingWebhookSecret(
        req.get('x-webhook-secret')
        || req.get('x-incoming-webhook-secret')
        || req.get('x-api-key')
    );
    if (headerSecret) {
        return headerSecret;
    }

    const authorization = normalizeIncomingWebhookSecret(req.get('authorization'));
    if (authorization && /^bearer\s+/i.test(authorization)) {
        return normalizeIncomingWebhookSecret(authorization.replace(/^bearer\s+/i, ''));
    }

    return '';
}

function timingSafeIncomingWebhookSecretEquals(inputSecret, expectedSecret) {
    const left = normalizeIncomingWebhookSecret(inputSecret);
    const right = normalizeIncomingWebhookSecret(expectedSecret);
    if (!left || !right) return false;

    const leftBuffer = Buffer.from(left, 'utf8');
    const rightBuffer = Buffer.from(right, 'utf8');
    if (leftBuffer.length !== rightBuffer.length) return false;

    try {
        return crypto.timingSafeEqual(leftBuffer, rightBuffer);
    } catch (_) {
        return false;
    }
}

function maskIncomingWebhookSecret(prefix = '', suffix = '') {
    const normalizedPrefix = String(prefix || '').trim();
    const normalizedSuffix = String(suffix || '').trim();
    if (!normalizedPrefix && !normalizedSuffix) return '';
    return `${normalizedPrefix}***${normalizedSuffix}`;
}

function serializeIncomingWebhookCredentialForApi(credential) {
    if (!credential) return null;
    return {
        id: Number(credential.id || 0) || null,
        owner_user_id: Number(credential.owner_user_id || 0) || null,
        secret_masked: maskIncomingWebhookSecret(credential.secret_prefix, credential.secret_suffix),
        secret_prefix: String(credential.secret_prefix || '').trim(),
        secret_suffix: String(credential.secret_suffix || '').trim(),
        created_by: Number(credential.created_by || 0) || null,
        last_rotated_at: credential.last_rotated_at || null,
        last_used_at: credential.last_used_at || null,
        created_at: credential.created_at || null,
        updated_at: credential.updated_at || null
    };
}

async function ensureLegacyIncomingWebhookCredentialBridge() {
    const legacySecret = normalizeIncomingWebhookSecret(process.env.WEBHOOK_SECRET);
    const legacyOwnerUserId = resolveIncomingWebhookOwnerUserId();

    if (!legacySecret || !legacyOwnerUserId) {
        return;
    }

    const existingOwnerCredential = await IncomingWebhookCredential.findByOwnerUserId(legacyOwnerUserId);
    if (existingOwnerCredential) {
        return;
    }

    try {
        await IncomingWebhookCredential.upsertForOwner(legacyOwnerUserId, {
            secret: legacySecret
        });
        console.log(`[IncomingWebhook] Credencial legada sincronizada para owner ${legacyOwnerUserId}`);
    } catch (error) {
        console.warn(`[IncomingWebhook] Nao foi possivel sincronizar credencial legada do owner ${legacyOwnerUserId}: ${error.message}`);
    }
}

async function resolveIncomingWebhookOwnerContext(req, payload = null) {
    const sourcePayload = payload && typeof payload === 'object' ? payload : {};
    const secret = extractIncomingWebhookSecret(req, sourcePayload);
    if (!secret) {
        return {
            ownerUserId: null,
            source: 'missing-secret'
        };
    }

    let tableLookupFailed = false;
    try {
        const credential = await IncomingWebhookCredential.findOwnerBySecret(secret);
        const ownerUserId = normalizeOwnerUserId(credential?.owner_user_id);
        if (ownerUserId) {
            return {
                ownerUserId,
                source: 'owner-secret',
                credential
            };
        }
    } catch (error) {
        tableLookupFailed = true;
        console.error('[IncomingWebhook] Falha ao validar credencial por owner:', error.message);
    }

    const legacySecret = normalizeIncomingWebhookSecret(process.env.WEBHOOK_SECRET);
    const legacyOwnerUserId = resolveIncomingWebhookOwnerUserId();
    if (
        legacySecret
        && legacyOwnerUserId
        && timingSafeIncomingWebhookSecretEquals(secret, legacySecret)
    ) {
        return {
            ownerUserId: legacyOwnerUserId,
            source: 'legacy-secret'
        };
    }

    return {
        ownerUserId: null,
        source: tableLookupFailed ? 'lookup-error' : 'invalid-secret'
    };
}

function normalizeIncomingWebhookLeadPayload(rawData, ownerUserId) {
    const sourceData = rawData && typeof rawData === 'object' ? rawData : {};
    const phone = normalizeImportedLeadPhone(
        sourceData.phone
        || sourceData.telefone
        || sourceData.whatsapp
        || sourceData.celular
        || sourceData.numero
    );

    const name = String(sourceData.name || sourceData.nome || '').trim() || 'Sem nome';
    const email = String(sourceData.email || '').trim().toLowerCase();
    const status = parsePositiveIntInRange(sourceData.status, 1, 1, 4);
    const tags = Array.from(new Set(parseLeadTagsForMerge(sourceData.tags)));
    const customFields = parseLeadCustomFields(sourceData.custom_fields);

    const payload = {
        name,
        phone,
        email,
        status,
        tags,
        source: 'webhook',
        assigned_to: ownerUserId,
        owner_user_id: ownerUserId
    };

    if (Object.keys(customFields).length > 0) {
        payload.custom_fields = customFields;
    }

    return payload;
}

app.get('/api/webhooks/incoming/credential', authenticate, async (req, res) => {
    try {
        const requesterRole = getRequesterRole(req);
        if (!isUserAdminRole(requesterRole)) {
            return res.status(403).json({ error: 'Sem permissao para gerenciar webhook de entrada' });
        }

        const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
        if (!ownerScopeUserId) {
            return res.status(400).json({ error: 'Nao foi possivel resolver owner da conta' });
        }

        const credential = await IncomingWebhookCredential.findByOwnerUserId(ownerScopeUserId);
        const legacyOwnerUserId = resolveIncomingWebhookOwnerUserId();
        const legacySecretConfigured = normalizeIncomingWebhookSecret(process.env.WEBHOOK_SECRET).length > 0;

        return res.json({
            success: true,
            credential: serializeIncomingWebhookCredentialForApi(credential),
            legacy_fallback: {
                configured: legacySecretConfigured && !!legacyOwnerUserId,
                owner_user_id: legacyOwnerUserId || null,
                active_for_owner: legacySecretConfigured
                    && !!legacyOwnerUserId
                    && legacyOwnerUserId === ownerScopeUserId
            }
        });
    } catch (error) {
        console.error('[IncomingWebhook] Falha ao consultar credencial:', error);
        return res.status(500).json({ error: 'Falha ao consultar credencial do webhook de entrada' });
    }
});

app.post('/api/webhooks/incoming/credential/regenerate', authenticate, async (req, res) => {
    try {
        const requesterRole = getRequesterRole(req);
        if (!isUserAdminRole(requesterRole)) {
            return res.status(403).json({ error: 'Sem permissao para gerenciar webhook de entrada' });
        }

        const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
        if (!ownerScopeUserId) {
            return res.status(400).json({ error: 'Nao foi possivel resolver owner da conta' });
        }

        const incomingBody = req.body && typeof req.body === 'object' ? req.body : {};
        const requestedSecret = normalizeIncomingWebhookSecret(incomingBody.secret);
        if (
            requestedSecret
            && !IncomingWebhookCredential.isValidSecret(requestedSecret)
        ) {
            return res.status(400).json({
                error: `Secret invalido (minimo ${IncomingWebhookCredential.MIN_SECRET_LENGTH} caracteres)`
            });
        }

        const result = await IncomingWebhookCredential.upsertForOwner(ownerScopeUserId, {
            secret: requestedSecret || undefined,
            created_by: getRequesterUserId(req) || undefined
        });

        return res.json({
            success: true,
            secret: result.secret,
            credential: serializeIncomingWebhookCredentialForApi(result.credential)
        });
    } catch (error) {
        console.error('[IncomingWebhook] Falha ao regenerar credencial:', error);
        return res.status(400).json({ error: error.message || 'Falha ao regenerar credencial do webhook de entrada' });
    }
});

app.post('/api/webhook/incoming', async (req, res) => {
    const payload = req.body && typeof req.body === 'object' ? req.body : {};
    const event = String(payload.event || '').trim().toLowerCase();
    const data = payload.data;
    const ownerContext = await resolveIncomingWebhookOwnerContext(req, payload);
    if (!ownerContext.ownerUserId) {
        if (ownerContext.source === 'lookup-error') {
            return res.status(503).json({ error: 'Webhook incoming indisponivel' });
        }
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (event === 'lead.create' && data) {
        try {
            const ownerUserId = ownerContext.ownerUserId;
            const leadPayload = normalizeIncomingWebhookLeadPayload(data, ownerUserId);
            if (!leadPayload.phone) {
                return res.status(400).json({ error: 'Telefone obrigatorio para lead.create' });
            }

            const result = await Lead.create(leadPayload);
            return res.json({ success: true, leadId: result.id });
        } catch (error) {
            return res.status(Number(error?.statusCode || 400) || 400).json({
                error: error.message,
                ...(error?.code ? { code: error.code } : {})
            });
        }
    }

    return res.json({ success: true, received: true });
});



// ============================================

// API DE CONFIGURAÃ‡Ã•ES

// ============================================



const PLAN_STATUS_ALLOWED = new Set(['active', 'trialing', 'past_due', 'canceled', 'suspended', 'expired']);

function normalizePlanStatusForApi(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return PLAN_STATUS_ALLOWED.has(normalized) ? normalized : 'unknown';
}

function getPlanStatusLabel(status) {
    const normalized = normalizePlanStatusForApi(status);
    const labels = {
        active: 'Ativo',
        trialing: 'Em teste',
        past_due: 'Pagamento pendente',
        canceled: 'Cancelado',
        suspended: 'Suspenso',
        expired: 'Expirado',
        unknown: 'Nao configurado'
    };
    return labels[normalized] || labels.unknown;
}

function normalizeOptionalIsoDate(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString();
}

function buildPlanLimitSnapshot(current, max, label) {
    const normalizedCurrent = Math.max(0, Number(current || 0) || 0);
    const normalizedMax = Number.isInteger(Number(max)) && Number(max) >= 0
        ? Math.floor(Number(max))
        : null;

    return {
        label: String(label || '').trim() || 'recurso',
        current: normalizedCurrent,
        max: normalizedMax,
        unlimited: normalizedMax === null,
        remaining: normalizedMax === null ? null : Math.max(normalizedMax - normalizedCurrent, 0)
    };
}

async function buildOwnerPlanStatus(ownerScopeUserId) {
    const normalizedOwnerUserId = normalizeOwnerUserId(ownerScopeUserId);
    const keys = {
        planName: buildScopedSettingsKey('plan_name', normalizedOwnerUserId),
        planCode: buildScopedSettingsKey('plan_code', normalizedOwnerUserId),
        planStatus: buildScopedSettingsKey('plan_status', normalizedOwnerUserId),
        planProvider: buildScopedSettingsKey('plan_provider', normalizedOwnerUserId),
        planRenewalDate: buildScopedSettingsKey('plan_renewal_date', normalizedOwnerUserId),
        planLastVerifiedAt: buildScopedSettingsKey('plan_last_verified_at', normalizedOwnerUserId),
        planExternalReference: buildScopedSettingsKey('plan_external_reference', normalizedOwnerUserId),
        planMessage: buildScopedSettingsKey('plan_message', normalizedOwnerUserId)
    };

    const [
        planName,
        planCode,
        planStatusRaw,
        planProvider,
        planRenewalDate,
        planLastVerifiedAt,
        planExternalReference,
        planMessage,
        resolvedPlan,
        contactsCurrent,
        whatsappSessionsCurrent
    ] = await Promise.all([
        Settings.get(keys.planName),
        Settings.get(keys.planCode),
        Settings.get(keys.planStatus),
        Settings.get(keys.planProvider),
        Settings.get(keys.planRenewalDate),
        Settings.get(keys.planLastVerifiedAt),
        Settings.get(keys.planExternalReference),
        Settings.get(keys.planMessage),
        planLimitsService.resolveOwnerPlan(normalizedOwnerUserId),
        planLimitsService.countOwnerContacts(normalizedOwnerUserId),
        planLimitsService.countOwnerWhatsAppSessions(normalizedOwnerUserId)
    ]);

    const status = planStatusRaw === null || typeof planStatusRaw === 'undefined' || String(planStatusRaw).trim() === ''
        ? 'active'
        : normalizePlanStatusForApi(planStatusRaw);
    const provider = String(planProvider || '').trim() || 'API nao configurada';
    const apiConfigured = provider.toLowerCase() !== 'api nao configurada';
    const resolvedPlanName = String(
        planName
        || resolvedPlan?.configuredName
        || (resolvedPlan?.code && resolvedPlan.code !== 'unknown' ? resolvedPlan.name : '')
        || 'Plano de teste'
    ).trim() || 'Plano de teste';
    const resolvedPlanCode = String(
        planCode
        || resolvedPlan?.configuredCode
        || (resolvedPlan?.code && resolvedPlan.code !== 'unknown' ? resolvedPlan.code : '')
        || ''
    ).trim();

    return {
        name: resolvedPlanName,
        code: resolvedPlanCode,
        status,
        status_label: getPlanStatusLabel(status),
        renewal_date: normalizeOptionalIsoDate(planRenewalDate),
        last_verified_at: normalizeOptionalIsoDate(planLastVerifiedAt),
        provider,
        source: 'settings',
        api_configured: apiConfigured,
        external_reference: String(planExternalReference || ''),
        message: String(planMessage || 'A confirmacao automatica do plano via API sera habilitada apos configurar a integracao.'),
        limits: {
            contacts: buildPlanLimitSnapshot(contactsCurrent, resolvedPlan?.maxContacts, 'contatos'),
            whatsapp_sessions: buildPlanLimitSnapshot(
                whatsappSessionsCurrent,
                resolvedPlan?.maxWhatsAppSessions,
                'conexoes WhatsApp'
            )
        }
    };
}

app.get('/api/plan/status', authenticate, async (req, res) => {
    try {
        const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
        const ownerAdmin = await User.findById(ownerScopeUserId || req.user?.id);
        const plan = await buildOwnerPlanStatus(ownerScopeUserId);

        res.json({
            success: true,
            owner_admin: ownerAdmin ? {
                id: ownerAdmin.id,
                name: ownerAdmin.name,
                email: ownerAdmin.email
            } : null,
            plan
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Erro ao carregar status do plano' });
    }
});

app.post('/api/plan/status/refresh', authenticate, async (req, res) => {
    try {
        const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
        const nowIso = new Date().toISOString();
        const ownerAdmin = await User.findById(ownerScopeUserId || req.user?.id);
        let plan = await buildOwnerPlanStatus(ownerScopeUserId);

        if (String(plan?.provider || '').trim().toLowerCase() === 'stripe') {
            const subscriptionId = String(plan?.external_reference || '').trim();
            if (subscriptionId) {
                const subscription = await stripeCheckoutService.retrieveSubscription(subscriptionId);
                const registration = await CheckoutRegistration.findByStripeSubscriptionId(subscriptionId)
                    || await CheckoutRegistration.findByStripeCustomerId(subscription?.customer);
                const priceId = String(subscription?.items?.data?.[0]?.price?.id || '').trim();
                const inferredPlan = stripeCheckoutService.inferPlanByPriceId(priceId);

                await syncStripePlanStatusByIdentifiers({
                    subscriptionId,
                    customerId: String(subscription?.customer || '').trim(),
                    priceId,
                    planKey: registration?.stripe_plan_key || inferredPlan?.key || '',
                    planCode: registration?.stripe_plan_code || inferredPlan?.code || '',
                    planName: registration?.stripe_plan_name || inferredPlan?.name || '',
                    subscriptionStatus: stripeCheckoutService.normalizePlanStatus(subscription?.status),
                    renewalDate: Number(subscription?.current_period_end || 0) > 0
                        ? new Date(Number(subscription.current_period_end) * 1000).toISOString()
                        : null
                });
                plan = await buildOwnerPlanStatus(ownerScopeUserId);
            } else {
                await Settings.set(
                    buildScopedSettingsKey('plan_last_verified_at', ownerScopeUserId),
                    nowIso,
                    'string'
                );
                plan = await buildOwnerPlanStatus(ownerScopeUserId);
            }
        } else if (String(plan?.provider || '').trim().toLowerCase() === 'pagarme') {
            const subscriptionId = String(plan?.external_reference || '').trim();
            if (subscriptionId) {
                const subscription = await pagarmeCheckoutService.retrieveSubscription(subscriptionId);
                const subscriptionPayload = await pagarmeCheckoutService.resolveSubscriptionPayload(subscription);
                const registration = await CheckoutRegistration.findByStripeSubscriptionId(subscriptionId)
                    || await CheckoutRegistration.findByStripeCustomerId(subscriptionPayload?.customerId || '');

                await syncPagarmePlanStatusByIdentifiers({
                    subscriptionId,
                    customerId: String(subscriptionPayload?.customerId || '').trim(),
                    customerEmail: String(subscriptionPayload?.customerEmail || '').trim().toLowerCase(),
                    priceId: String(subscriptionPayload?.priceId || '').trim(),
                    planKey: subscriptionPayload?.planKey || registration?.stripe_plan_key || '',
                    planCode: subscriptionPayload?.planCode || registration?.stripe_plan_code || '',
                    planName: subscriptionPayload?.planName || registration?.stripe_plan_name || '',
                    subscriptionStatus: subscriptionPayload?.subscriptionStatus || 'active',
                    renewalDate: subscriptionPayload?.renewalDate || null,
                    metadata: {
                        ...(subscriptionPayload?.metadata && typeof subscriptionPayload.metadata === 'object'
                            ? subscriptionPayload.metadata
                            : {}),
                        provider: 'pagarme'
                    }
                });
                plan = await buildOwnerPlanStatus(ownerScopeUserId);
            } else {
                await Settings.set(
                    buildScopedSettingsKey('plan_last_verified_at', ownerScopeUserId),
                    nowIso,
                    'string'
                );
                plan = await buildOwnerPlanStatus(ownerScopeUserId);
            }
        } else {
            await Settings.set(
                buildScopedSettingsKey('plan_last_verified_at', ownerScopeUserId),
                nowIso,
                'string'
            );
            plan = await buildOwnerPlanStatus(ownerScopeUserId);
        }

        res.json({
            success: true,
            owner_admin: ownerAdmin ? {
                id: ownerAdmin.id,
                name: ownerAdmin.name,
                email: ownerAdmin.email
            } : null,
            plan
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Erro ao atualizar status do plano' });
    }
});

app.get('/api/settings', authenticate, async (req, res) => {

    const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
    const settings = normalizeSettingsForResponse(await Settings.getAll(), ownerScopeUserId);

    res.json({ success: true, settings });

});



app.put('/api/settings', authenticate, async (req, res) => {

    const requesterRole = getRequesterRole(req);
    if (!isUserAdminRole(requesterRole)) {
        return res.status(403).json({
            success: false,
            error: 'Sem permissao para atualizar configuracoes da conta'
        });
    }

    const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
    const incomingSettings = req.body && typeof req.body === 'object' ? req.body : {};
    const changedKeys = Object.keys(incomingSettings);

    for (const [key, value] of Object.entries(incomingSettings)) {

        const type = typeof value === 'number' ? 'number' : 

                     typeof value === 'boolean' ? 'boolean' :

                     typeof value === 'object' ? 'json' : 'string';

        await Settings.set(buildScopedSettingsKey(key, ownerScopeUserId), value, type);

    }

    

    // Atualizar serviÃ§o de fila se necessÃ¡rio

    const hasQueueSettings =
        Object.prototype.hasOwnProperty.call(incomingSettings, 'bulk_message_delay') ||
        Object.prototype.hasOwnProperty.call(incomingSettings, 'max_messages_per_minute');

    if (hasQueueSettings && !ownerScopeUserId) {

        await queueService.updateSettings({

            delay: incomingSettings.bulk_message_delay,

            maxPerMinute: incomingSettings.max_messages_per_minute

        });

    }

    const touchedBusinessHours = changedKeys.some((key) => String(key || '').startsWith('business_hours_'));
    if (touchedBusinessHours) {
        invalidateBusinessHoursSettingsCache(ownerScopeUserId || null);
        if (typeof queueService.invalidateBusinessHoursCache === 'function') {
            queueService.invalidateBusinessHoursCache(ownerScopeUserId || null);
        }
    }

    

    res.json({
        success: true,
        settings: normalizeSettingsForResponse(await Settings.getAll(), ownerScopeUserId)
    });

});



// ============================================

// UPLOAD DE ARQUIVOS

// ============================================



app.post('/api/upload', authenticate, upload.single('file'), (req, res) => {

    if (!req.file) {

        return res.status(400).json({ error: 'Nenhum arquivo enviado' });

    }

    

    res.json({

        success: true,

        file: {

            filename: req.file.filename,

            originalname: `${sanitizeUploadBaseName(req.file.originalname || '')}${normalizeUploadExtension(req.file.originalname || '')}`,

            mimetype: req.file.mimetype,

            size: req.file.size,

            url: `/uploads/${req.file.filename}`

        }

    });

});



// ============================================

// ROTAS DE PÃGINAS

// ============================================



app.get('/confirm-email', (req, res) => {
    const rawToken = String(req.query?.token || '').trim();
    if (!rawToken) {
        return res.redirect('/#/finalizar-cadastro?emailConfirmError=token_required');
    }

    return res.redirect(`/#/finalizar-cadastro?confirmEmailToken=${encodeURIComponent(rawToken)}`);
});



app.get('/', (req, res) => {

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Clear-Site-Data', '"cache"');

    res.sendFile(path.join(STATIC_DIR, 'app.html'));

});



app.get('*', (req, res, next) => {
    if (String(req.path || '').startsWith('/api/')) {
        return next();
    }

    const staticRoot = path.resolve(STATIC_DIR);
    const requestPath = String(req.path || '').replace(/\\/g, '/');
    const relativeRequestPath = requestPath.replace(/^\/+/, '');
    const requestedFile = path.resolve(staticRoot, relativeRequestPath || '.');
    const comparableStaticRoot = process.platform === 'win32' ? staticRoot.toLowerCase() : staticRoot;
    const comparableRequestedFile = process.platform === 'win32' ? requestedFile.toLowerCase() : requestedFile;
    const isInsideStaticRoot = comparableRequestedFile === comparableStaticRoot
        || comparableRequestedFile.startsWith(`${comparableStaticRoot}${path.sep}`);

    if (!isInsideStaticRoot) {
        return res.status(404).json({ error: 'Arquivo nao encontrado' });
    }

    if (relativeRequestPath && fs.existsSync(requestedFile)) {
        try {
            if (fs.statSync(requestedFile).isFile()) {
                return res.sendFile(requestedFile);
            }
        } catch (_) {
            // fallback para app shell abaixo
        }
    }

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Clear-Site-Data', '"cache"');

    return res.sendFile(path.join(STATIC_DIR, 'app.html'));

});

// TRATAMENTO DE ERROS

// ============================================



// Middleware de tratamento de erros

app.use((err, req, res, next) => {
    if (String(err?.message || '').trim() === 'NÃ£o permitido por CORS') {
        err.status = 403;
        err.statusCode = 403;
    }
    return errorHandler(err, req, res, next);
});

// Handler para rotas nÃ£o encontradas

app.use((req, res) => notFoundHandler(req, res));

process.on('unhandledRejection', (reason, promise) => {

    console.error('? Unhandled Rejection:', reason);

});



process.on('uncaughtException', (error) => {

    console.error('? Uncaught Exception:', error);

    // Em produÃ§Ã£o, pode querer fazer graceful shutdown

    if (process.env.NODE_ENV === 'production') {

        process.exit(1);

    }

});



// ============================================

// LOG DE INICIALIZAÃ‡ÃƒO

// ============================================



    console.log('');

    console.log('+------------------------------------------------------------+');

    console.log('Â¦     SELF PROTEÃ‡ÃƒO VEICULAR - SERVIDOR v4.1                 Â¦');

    console.log('Â¦     Sistema de AutomaÃ§Ã£o de Mensagens WhatsApp             Â¦');

    console.log('Â¦------------------------------------------------------------Â¦');

    console.log(`Â¦  ?? Servidor rodando na porta ${PORT}                          Â¦`);

    console.log(`Â¦  ?? SessÃµes: ${SESSIONS_DIR.substring(0, 42).padEnd(42)} Â¦`);

    console.log(`Â¦  ?? URL: http://localhost:${PORT}                               Â¦`);

    console.log(`Â¦  ?? ReconexÃ£o automÃ¡tica: ${MAX_RECONNECT_ATTEMPTS} tentativas                  Â¦`);

    console.log(`Â¦  ?? Fila de mensagens: Ativa                               Â¦`);

    console.log(`Â¦  ?? Criptografia: Ativa                                    Â¦`);

    console.log('+------------------------------------------------------------+');

    console.log('');

    console.log('? Servidor pronto para receber conexÃµes!');

    console.log('');



    // Graceful shutdown (referÃªncias em closure)

    process.on('SIGTERM', async () => {
        if (isServerShuttingDown) return;
        isServerShuttingDown = true;

        console.log('??  SIGTERM recebido, encerrando servidor...');

        queueService.stopProcessing();
        stopInboxReconciliationWorker();
        stopFlowAwaitingInputRecoveryWorker();
        await webhookQueueService.shutdown();

        for (const [sessionId] of sessions.entries()) {
            clearSessionReconnectCatchupTimer(sessionId);
        }
        for (const session of sessions.values()) {
            clearRuntimeSessionReconnectTimer(session);
        }
        reconnectInFlight.clear();

        for (const [, session] of sessions.entries()) {
            try { await session.socket.end(); } catch (e) {}
        }

        await closeDatabase();

        server.close(() => { console.log('? Servidor encerrado'); process.exit(0); });

    });



    process.on('SIGINT', async () => {
        if (isServerShuttingDown) return;
        isServerShuttingDown = true;

        console.log('??  SIGINT recebido, encerrando servidor...');

        queueService.stopProcessing();
        stopInboxReconciliationWorker();
        stopFlowAwaitingInputRecoveryWorker();
        await webhookQueueService.shutdown();

        for (const [sessionId] of sessions.entries()) {
            clearSessionReconnectCatchupTimer(sessionId);
        }
        for (const session of sessions.values()) {
            clearRuntimeSessionReconnectTimer(session);
        }
        reconnectInFlight.clear();

        for (const [, session] of sessions.entries()) {
            try { await session.socket.end(); } catch (e) {}
        }

        await closeDatabase();

        process.exit(0);

    });

};
