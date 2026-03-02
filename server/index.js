/**

 * SELF PROTEÇÃO VEICULAR - SERVIDOR PRINCIPAL v4.1

 * Carregado por server/start.js (bootstrap) após listen - app e server já criados.

 */



module.exports = function init(app, server) {

const express = require('express');

const cors = require('cors');

const helmet = require('helmet');

const rateLimit = require('express-rate-limit');

const path = require('path');

const fs = require('fs');

const multer = require('multer');



// Baileys (loader dinâmico - ESM)

const baileysLoader = require('./services/whatsapp/baileysLoader');

const pino = require('pino');

const qrcode = require('qrcode');



// Database

const { getDatabase, close: closeDatabase, query, run, generateUUID, USE_POSTGRES } = require('./database/connection');

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
    Settings,
    User,
    WhatsAppSession
} = require('./database/models');



// Services

const webhookService = require('./services/webhookService');

const queueService = require('./services/queueService');

const flowService = require('./services/flowService');
const aiFlowDraftService = require('./services/aiFlowDraftService');
const openAiFlowDraftService = require('./services/openAiFlowDraftService');
const senderAllocatorService = require('./services/senderAllocatorService');
const tenantIntegrityAuditService = require('./services/tenantIntegrityAuditService');
const { PostgresAdvisoryLock } = require('./services/postgresAdvisoryLock');
const {
    DEFAULT_APP_NAME,
    DEFAULT_EMAIL_HTML_TEMPLATE,
    DEFAULT_EMAIL_SUBJECT_TEMPLATE,
    DEFAULT_EMAIL_TEXT_TEMPLATE,
    MailMktIntegrationError,
    buildRuntimeEmailDeliveryConfig,
    createEmailConfirmationTokenPayload,
    hashEmailConfirmationToken,
    isEmailConfirmed,
    isEmailConfirmationExpired,
    sendRegistrationConfirmationEmail,
    tokenFingerprint
} = require('./services/emailConfirmationService');
const {
    DEFAULT_WHATSAPP_SESSION_ID,
    LEGACY_WHATSAPP_SESSION_ALIASES,
    listDefaultSessionCandidates,
    sanitizeSessionId: sanitizeConfiguredSessionId
} = require('./config/sessionDefaults');



// Utils - Fixers (correções automáticas baseadas em análise de projetos GitHub)

const audioFixer = require('./utils/audioFixer');

const connectionFixer = require('./utils/connectionFixer');



// WhatsApp Service (engine Baileys modular)

const whatsappService = require('./services/whatsapp');
const {
    createBaileysAuthState,
    hasPersistedBaileysAuthState,
    clearPersistedBaileysAuthState
} = require('./services/whatsapp/baileysAuthStateStore');



// Middleware

const { authenticate, optionalAuth, requestLogger, verifyToken } = require('./middleware/auth');



// Encryption

const { encrypt, decrypt } = require('./utils/encryption');



// ============================================

// CONFIGURAÇÕES

// ============================================



const PORT = process.env.PORT || 3001;

const HOST = process.env.HOST || '0.0.0.0';

const SESSIONS_DIR = process.env.SESSIONS_DIR || path.join(__dirname, '..', 'sessions');

const UPLOADS_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');

const STATIC_DIR = process.env.NODE_ENV === 'production'

    ? path.join(__dirname, '..', 'dist')

    : path.join(__dirname, '..', 'public');

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
const WHATSAPP_KEEPALIVE_INTERVAL_MS = parsePositiveIntEnv(process.env.WHATSAPP_KEEPALIVE_INTERVAL_MS, 15000);
const WHATSAPP_CONNECT_TIMEOUT_MS = parsePositiveIntEnv(process.env.WHATSAPP_CONNECT_TIMEOUT_MS, 60000);
const WHATSAPP_DEFAULT_QUERY_TIMEOUT_MS = parsePositiveIntEnv(process.env.WHATSAPP_DEFAULT_QUERY_TIMEOUT_MS, 60000);
const WHATSAPP_RETRY_REQUEST_DELAY_MS = parsePositiveIntEnv(process.env.WHATSAPP_RETRY_REQUEST_DELAY_MS, 500);
const WHATSAPP_SESSION_SEND_WARMUP_MS = parsePositiveIntEnv(process.env.WHATSAPP_SESSION_SEND_WARMUP_MS, 12000);
const WHATSAPP_SESSION_DISPATCH_BACKOFF_MS = parsePositiveIntEnv(process.env.WHATSAPP_SESSION_DISPATCH_BACKOFF_MS, 60000);
const WHATSAPP_AUTH_STATE_DRIVER = String(process.env.WHATSAPP_AUTH_STATE_DRIVER || 'multi_file').trim().toLowerCase();
const WHATSAPP_AUTH_STATE_DB_FALLBACK_MULTI_FILE = parseBooleanEnv(process.env.WHATSAPP_AUTH_STATE_DB_FALLBACK_MULTI_FILE, true);
let cachedBaileysSocketVersion = null;
let cachedBaileysSocketVersionSource = null;

function parseBooleanEnv(value, fallback = false) {
    if (value === undefined || value === null || value === '') return fallback;
    const normalized = String(value).trim().toLowerCase();
    if (['1', 'true', 'yes', 'sim', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'nao', 'não', 'off'].includes(normalized)) return false;
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
    if (WHATSAPP_BAILEYS_VERSION_PIN) {
        cachedBaileysSocketVersion = [...WHATSAPP_BAILEYS_VERSION_PIN];
        cachedBaileysSocketVersionSource = 'env-pin';
        return [...cachedBaileysSocketVersion];
    }

    if (!WHATSAPP_USE_LATEST_BAILEYS_VERSION) {
        cachedBaileysSocketVersion = null;
        cachedBaileysSocketVersionSource = 'library-default';
        return null;
    }

    if (cachedBaileysSocketVersion && Array.isArray(cachedBaileysSocketVersion)) {
        return [...cachedBaileysSocketVersion];
    }

    if (typeof fetchLatestBaileysVersion !== 'function') {
        cachedBaileysSocketVersion = null;
        cachedBaileysSocketVersionSource = 'library-default';
        return null;
    }

    try {
        const latest = await fetchLatestBaileysVersion();
        const version = Array.isArray(latest?.version) ? latest.version : null;
        if (version && version.length >= 3) {
            cachedBaileysSocketVersion = version.slice(0, 3);
            cachedBaileysSocketVersionSource = 'latest';
            return [...cachedBaileysSocketVersion];
        }
    } catch (error) {
        console.warn(`[${sessionId || 'whatsapp'}] Falha ao resolver versao latest do Baileys, usando versao interna:`, error.message);
    }

    cachedBaileysSocketVersion = null;
    cachedBaileysSocketVersionSource = 'library-default';
    return null;
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

async function resolveWhatsAppBrowserName() {
    try {
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
    if (runtimeOwnerUserId) return runtimeOwnerUserId;

    const storedSession = await WhatsAppSession.findBySessionId(normalizedSessionId);
    return normalizeOwnerUserId(storedSession?.created_by) || null;
}

async function canAccessSessionRecordInOwnerScope(req, sessionId, ownerScopeUserId = null) {
    if (isScopedAgent(req)) return false;

    const normalizedSessionId = sanitizeSessionId(sessionId);
    if (!normalizedSessionId) return false;

    const effectiveOwnerUserId = normalizeOwnerUserId(ownerScopeUserId) || await resolveRequesterOwnerUserId(req);
    if (!effectiveOwnerUserId) return true;

    const session = await WhatsAppSession.findBySessionId(normalizedSessionId, {
        owner_user_id: effectiveOwnerUserId
    });
    return !!session;
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



// Avisar se chaves de segurança não foram configuradas (não bloqueia startup para deploy funcionar)

if (process.env.NODE_ENV === 'production') {

    if (!process.env.ENCRYPTION_KEY || ENCRYPTION_KEY === 'self-protecao-veicular-key-2024') {

        console.warn('??  AVISO: Configure ENCRYPTION_KEY nas variáveis de ambiente para produção.');

    }

    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'self-protecao-jwt-secret-2024') {

        console.warn('??  AVISO: Configure JWT_SECRET nas variáveis de ambiente para produção.');

    }

}



// Criar diretórios necessários

[SESSIONS_DIR, UPLOADS_DIR, path.join(__dirname, '..', 'data')].forEach(dir => {

    if (!fs.existsSync(dir)) {

        fs.mkdirSync(dir, { recursive: true });

    }

});



// Migracao roda aqui (servidor ja esta ouvindo via start.js)
async function bootstrapDatabase() {
    try {
        const ok = await migrate();
        if (ok) {
            console.log('Banco de dados inicializado');
        }

        await cleanupDuplicateMessages();
        await cleanupLidLeads();
        await cleanupInvalidPhones();
        await cleanupEmptyWhatsappLeads();
        await cleanupDuplicatePhoneSuffixLeads();
        await cleanupBrokenLeadNames();
        await migrateLegacyTriggerCampaignsToAutomations();
    } catch (error) {
        console.error('Erro ao inicializar banco de dados:', error.message);
    }
}

const bootstrapPromise = bootstrapDatabase();

// ============================================

// MIDDLEWARES E ROTAS (app já tem /health do start.js)

// ============================================



// Segurança

app.use(helmet({

    contentSecurityPolicy: false,

    crossOriginEmbedderPolicy: false

}));



// Railway/Proxy: confiar no proxy para X-Forwarded-For

app.set('trust proxy', 1);



// Rate limiting

const limiter = rateLimit({

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
    : (process.env.NODE_ENV === 'production'
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

const getRequestHost = (req) => {
    const forwardedHost = req.header('X-Forwarded-Host');
    const host = (forwardedHost || req.header('Host') || '').split(',')[0].trim();
    return host.split(':')[0].toLowerCase();
};

const corsOptionsDelegate = (req, callback) => {
    const origin = req.header('Origin');
    const normalizedOrigin = sanitizeOriginEntry(origin);
    const originHost = parseOriginHost(normalizedOrigin);
    const requestHost = getRequestHost(req);

    const isSameOrigin = Boolean(
        origin &&
        originHost &&
        requestHost &&
        originHost === requestHost
    );

    const isAllowed =
        !origin ||
        allowedOriginSet.has('*') ||
        allowedOriginEntries.length === 0 ||
        isSameOrigin ||
        allowedOriginSet.has(normalizedOrigin) ||
        allowedHostSet.has(originHost);

    if (!isAllowed) {
        return callback(new Error('Não permitido por CORS'));
    }

    return callback(null, {
        origin: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    });
};

app.use(cors(corsOptionsDelegate));



// Request logging

if (process.env.NODE_ENV !== 'production') {

    app.use(requestLogger);

}



// Body parser

app.use(express.json({ limit: '50mb' }));

app.use(express.urlencoded({ extended: true, limit: '50mb' }));



// Autenticação obrigatória para /api (exceto login/refresh)

app.use('/api', (req, res, next) => {

    const path = req.path || '';

    if (
        path.startsWith('/auth/login') ||
        path.startsWith('/auth/refresh') ||
        path.startsWith('/auth/register') ||
        path.startsWith('/auth/confirm-email') ||
        path.startsWith('/auth/resend-confirmation')
    ) {

        return next();

    }

    return authenticate(req, res, next);

});



// Arquivos estáticos

app.use(express.static(STATIC_DIR, {

    setHeaders: (res, filePath) => {

        if (filePath.endsWith('app.html')) {

            res.setHeader('Cache-Control', 'no-store');

        }

    }

}));

app.use('/uploads', express.static(UPLOADS_DIR));



// Upload de arquivos

const storage = multer.diskStorage({

    destination: (req, file, cb) => cb(null, UPLOADS_DIR),

    filename: (req, file, cb) => {

        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);

        cb(null, uniqueSuffix + '-' + file.originalname);

    }

});

const upload = multer({ 

    storage,

    limits: { fileSize: 50 * 1024 * 1024 } // 50MB

});



// ============================================

// SOCKET.IO

// ============================================



const { Server } = require('socket.io');

const io = new Server(server, {

    cors: {

        origin: '*',

        methods: ['GET', 'POST']

    },

    pingTimeout: 60000,

    pingInterval: 25000,

    transports: ['websocket', 'polling']

});



// Autenticação via JWT no handshake do Socket.IO

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

io.use((socket, next) => {

    try {

        const headerToken = socket.handshake.headers?.authorization;

        const token = socket.handshake.auth?.token || (headerToken ? headerToken.replace(/Bearer\s+/i, '') : null);

        if (!token) {

            return next(new Error('unauthorized'));

        }

        const decoded = verifyToken(token);

        if (!decoded) {

            return next(new Error('unauthorized'));

        }

        socket.user = decoded;

        return next();

    } catch (error) {

        return next(new Error('unauthorized'));

    }

});



// ============================================

// WHATSAPP - GERENCIAMENTO DE SESSÕES (via whatsapp service)

// ============================================



const sessions = whatsappService.sessions;

const reconnectAttempts = whatsappService.reconnectAttempts;

const qrTimeouts = whatsappService.qrTimeouts;

const logger = pino({ level: 'silent' });

const typingStatus = new Map();

const jidAliasMap = new Map();
const sessionInitLocks = new Set();
const pendingCiphertextRecoveries = new Map();
const pendingLidResolutionRecoveries = new Map();
const recoveredFlowMessageIds = new Map();
const sessionReconnectCatchupTimers = new Map();
const sessionReconnectCatchupInFlight = new Set();
const sessionHistorySyncQueues = new Map();
const reconnectInFlight = new Set();
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
const WHATSAPP_HISTORY_SYNC_ENABLED = parseBooleanEnv(process.env.WHATSAPP_HISTORY_SYNC_ENABLED, true);
const WHATSAPP_HISTORY_SYNC_MESSAGES_LIMIT = parsePositiveIntEnv(process.env.WHATSAPP_HISTORY_SYNC_MESSAGES_LIMIT, 600);

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

function setRuntimeSessionDispatchBackoff(session, backoffMs = WHATSAPP_SESSION_DISPATCH_BACKOFF_MS) {
    if (!session) return 0;
    const durationMs = Number(backoffMs);
    const normalizedBackoffMs = Number.isFinite(durationMs) && durationMs > 0
        ? Math.floor(durationMs)
        : WHATSAPP_SESSION_DISPATCH_BACKOFF_MS;
    const nextBlockedUntilMs = Date.now() + normalizedBackoffMs;
    session.dispatchBlockedUntilMs = Math.max(Number(session.dispatchBlockedUntilMs || 0), nextBlockedUntilMs);
    return session.dispatchBlockedUntilMs;
}

function clearRuntimeSessionDispatchBackoff(session) {
    if (!session) return;
    session.dispatchBlockedUntilMs = 0;
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

    const runtimeSession = session || sessions.get(normalizedSessionId);
    if (!runtimeSession) return;
    if (runtimeSession.reconnecting) return;
    if (sessionInitLocks.has(normalizedSessionId)) return;
    if (reconnectInFlight.has(normalizedSessionId)) return;

    runtimeSession.reconnecting = true;

    setTimeout(() => {
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

    if (text.includes('Ã') || text.includes('Â')) {
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
            [/Usu[?\uFFFD]rio/g, 'Usuário'],
            [/Voc[?\uFFFD]/g, 'Você'],
            [/N[?\uFFFD]o/g, 'Não'],
            [/n[?\uFFFD]o/g, 'não'],
            [/Conex[?\uFFFD]o/g, 'Conexão'],
            [/Sess[?\uFFFD]es/g, 'Sessões'],
            [/Automa[?\uFFFD][?\uFFFD]o/g, 'Automação'],
            [/Prote[?\uFFFD][?\uFFFD]o/g, 'Proteção']
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
        lower === 'você' ||
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
    const system = merged.__system && typeof merged.__system === 'object' && !Array.isArray(merged.__system)
        ? merged.__system
        : {};

    merged.__system = {
        ...system,
        manual_name_locked: true,
        manual_name_source: 'manual',
        manual_name_updated_at: new Date().toISOString()
    };

    return merged;
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
    if (Array.isArray(rawTags)) {
        return rawTags
            .map((tag) => String(tag || '').trim())
            .filter(Boolean);
    }

    const raw = String(rawTags || '').trim();
    if (!raw) return [];

    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return parsed
                .map((tag) => String(tag || '').trim())
                .filter(Boolean);
        }
    } catch {
        // formato legado
    }

    return raw
        .split(',')
        .map((tag) => String(tag || '').trim())
        .filter(Boolean);
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
    const primaryName = sanitizeAutoName(primaryLead?.name);
    const duplicateName = sanitizeAutoName(duplicateLead?.name);

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

    if (sanitizeAutoName(lead?.name)) score += 4;
    if (isLeadNameManuallyLocked(lead)) score += 3;
    const source = normalizeLeadSource(lead?.source);
    if (source && source !== 'whatsapp') score += 2;
    if (lead?.jid && String(lead.jid).includes('@s.whatsapp.net')) score += 1;

    return score;
}

function shouldAutoUpdateLeadName(lead, phone, sessionDisplayName = '') {
    if (isLeadNameManuallyLocked(lead)) return false;

    const currentRaw = normalizeText(String(lead?.name || '').trim());
    if (!currentRaw) return true;

    const current = currentRaw.toLowerCase();
    if (
        current === 'sem nome' ||
        current === 'unknown' ||
        current === 'undefined' ||
        current === 'null' ||
        current === 'você' ||
        current === 'voce' ||
        current === 'usuário (você)' ||
        current === 'usuario (voce)'
    ) {
        return true;
    }

    const currentDigits = normalizePhoneDigits(currentRaw);
    const phoneDigits = normalizePhoneDigits(phone);
    if (phoneDigits && currentDigits && currentDigits === phoneDigits) return true;
    if (/^\d+$/.test(currentRaw)) return true;

    const sessionName = normalizeText(String(sessionDisplayName || '').trim());
    if (sessionName && (currentRaw === sessionName || currentRaw === `${sessionName} (Você)`)) {
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
    return (
        content.conversation ||
        content.extendedTextMessage?.text ||
        content.imageMessage?.caption ||
        content.videoMessage?.caption ||
        content.documentMessage?.caption ||
        ''
    );
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

    // NÃ£o mapear LID para o prÃ³prio nÃºmero da sessÃ£o, pois isso causa
    // roteamento incorreto para o chat "VocÃª".
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
    const nameDigits = String(lead.name || '').replace(/\D/g, '');
    const nextName = nameDigits && nameDigits === oldPhone && nameDigits !== cleanedPhone
        ? cleanedPhone
        : lead.name;

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

        // Remover duplicados com message_id igual (segurança extra)

        await run(`

            DELETE FROM messages

            WHERE message_id IS NOT NULL

            AND id NOT IN (

                SELECT MIN(id) FROM messages

                WHERE message_id IS NOT NULL

                GROUP BY message_id

            )

        `);



        // Remover duplicados sem message_id (mesmo conteúdo no mesmo segundo)

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
        const leads = await query("SELECT id, name, phone FROM leads WHERE name IS NOT NULL");
        if (!leads || leads.length === 0) return;

        for (const lead of leads) {
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
async function persistWhatsappSession(sessionId, status, options = {}) {

    try {

        const qr_code = options.qr_code || null;

        const last_connected_at = options.last_connected_at || null;
        const requestedOwnerUserId = Number(options.ownerUserId);
        const ownerUserId = Number.isInteger(requestedOwnerUserId) && requestedOwnerUserId > 0
            ? requestedOwnerUserId
            : null;

        await run(`

            INSERT INTO whatsapp_sessions (session_id, status, qr_code, last_connected_at, created_by, updated_at)

            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)

            ON CONFLICT(session_id) DO UPDATE SET

                status = excluded.status,

                qr_code = excluded.qr_code,

                last_connected_at = excluded.last_connected_at,

                created_by = COALESCE(whatsapp_sessions.created_by, excluded.created_by),

                updated_at = CURRENT_TIMESTAMP

        `, [sessionId, status, qr_code, last_connected_at, ownerUserId]);

    } catch (error) {

        console.error(`[${sessionId}] Erro ao persistir sessão:`, error.message);

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

                console.log(`[${sessionId}] Reidratando sessão armazenada...`);

                await createSession(sessionId, null, 0, {
                    ownerUserId: Number.isInteger(ownerUserId) && ownerUserId > 0 ? ownerUserId : undefined
                });

            } else {

                console.log(`[${sessionId}] Sessão no banco sem auth state local/DB, ignorando.`);

            }

        }

    } catch (error) {

        console.error('? Erro ao reidratar sessões:', error.message);

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

 * Função de envio de mensagem (usada pelos serviços)

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

                console.error('[SendMessage] Erro ao preparar áudio, usando método padrão:', error.message);

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

 * Criar sessão WhatsApp

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

    const clientSocket = socket || { emit: () => {} };
    const pairingPhone = normalizePairingPhoneNumber(options.pairingPhone || options.phoneNumber);
    const shouldRequestPairingCode = Boolean(options.requestPairingCode && pairingPhone);
    const requestedOwnerUserId = Number(options.ownerUserId);
    const ownerUserId = Number.isInteger(requestedOwnerUserId) && requestedOwnerUserId > 0
        ? requestedOwnerUserId
        : null;

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
    let lockReleased = false;
    const releaseSessionLock = () => {
        if (!lockReleased) {
            sessionInitLocks.delete(sessionId);
            lockReleased = true;
        }
    };

    const sessionPath = path.join(SESSIONS_DIR, sessionId);

    const previousSession = sessions.get(sessionId);
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

    

    const baileys = await baileysLoader.getBaileys();

        const {

            default: makeWASocket,

            DisconnectReason,

            fetchLatestBaileysVersion,

            makeCacheableSignalKeyStore,

            makeInMemoryStore,

            delay

        } = baileys;

    

    try {

        console.log(`[${sessionId}] Criando sessão... (Tentativa ${attempt + 1}/${MAX_RECONNECT_ATTEMPTS})`);

        persistWhatsappSession(sessionId, 'connecting', { ownerUserId });

        

        // Validar e corrigir sessÃ£o local somente quando o auth state principal for por arquivos.
        if (WHATSAPP_AUTH_STATE_DRIVER === 'multi_file') {

            const sessionValidation = await connectionFixer.validateSession(sessionPath);

            if (!sessionValidation.valid && attempt === 0) {

                console.log(`[${sessionId}] Problemas na sessão detectados, corrigindo...`);

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
        const browserName = await resolveWhatsAppBrowserName();

        const store = createRuntimeStore({ sessionId, makeInMemoryStore });



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
            lastDisconnectReason: null,
            lastDisconnectAt: null

        });

        

        reconnectAttempts.set(sessionId, 0);

        

        // Eventos de conexão

        sock.ev.on('connection.update', async (update) => {

            const { connection, lastDisconnect, qr } = update;

            const session = sessions.get(sessionId);
            if (!session || session.socket !== sock) {
                return;
            }
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

                    persistWhatsappSession(sessionId, 'qr_pending', {
                        qr_code: qrDataUrl,
                        ownerUserId: Number(session?.ownerUserId || ownerUserId || 0) || null
                    });

                    

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

                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                session.isConnected = false;
                session.sendReadyAtMs = 0;
                stopSessionHealthMonitor(session);

                

                console.log(`[${sessionId}] Conexão fechada. Status: ${statusCode}`);

                persistWhatsappSession(sessionId, 'disconnected', {
                    ownerUserId: Number(session?.ownerUserId || ownerUserId || 0) || null
                });

                

                // Detectar tipo de erro e aplicar correção

                const errorInfo = connectionFixer.detectDisconnectReason(lastDisconnect?.error);
                session.lastDisconnectAt = Date.now();
                session.lastDisconnectReason = {
                    statusCode: Number.isFinite(Number(statusCode)) ? Number(statusCode) : null,
                    errorType: errorInfo.type || 'unknown',
                    message: String(lastDisconnect?.error?.message || '').slice(0, 300) || null,
                    at: new Date().toISOString()
                };
                setRuntimeSessionDispatchBackoff(session);

                console.log(`[${sessionId}] Tipo de erro: ${errorInfo.type}, Ação: ${errorInfo.action}`);

                

                // Aplicar correção se necessário

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
                        persistWhatsappSession(sessionId, 'disconnected', {
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

                        name: sock.user?.name || 'Usuário',

                        pushName: sock.user?.verifiedName || sock.user?.name,

                        phone: extractNumber(sock.user?.id)

                    };

                    

                    reconnectAttempts.set(sessionId, 0);
                    clearRuntimeSessionDispatchBackoff(session);
                    session.sendReadyAtMs = Date.now() + WHATSAPP_SESSION_SEND_WARMUP_MS;
                    session.dispatchBlockedUntilMs = Math.max(
                        Number(session.dispatchBlockedUntilMs || 0),
                        session.sendReadyAtMs
                    );

                    

                    activeClientSocket.emit('connected', { sessionId, user: session.user });

                    await emitToSessionOwnerScope(sessionId, 'whatsapp-status', { sessionId, status: 'connected', user: session.user }, {
                        ownerUserId: Number(session?.ownerUserId || ownerUserId || 0) || null
                    });

                    persistWhatsappSession(sessionId, 'connected', {
                        last_connected_at: new Date().toISOString(),
                        ownerUserId: Number(session?.ownerUserId || ownerUserId || 0) || null
                    });

                    

                    // Webhook

                    webhookService.trigger('whatsapp.connected', { sessionId, user: session.user }, {
                        ownerUserId: Number(session?.ownerUserId || ownerUserId || 0) || undefined
                    });

                    

                    console.log(`[${sessionId}] ? WhatsApp conectado: ${session.user.name}`);
                    if (WHATSAPP_SESSION_SEND_WARMUP_MS > 0) {
                        console.log(`[${sessionId}] Aguardando ${WHATSAPP_SESSION_SEND_WARMUP_MS}ms de aquecimento antes de liberar disparos`);
                    }



                    // Forçar sincronização inicial de chats

                    setTimeout(() => {

                        triggerChatSync(sessionId, sock, store);

                    }, 1500);
                    scheduleSessionReconnectCatchup(sessionId, {
                        trigger: attempt > 0 ? 'reconnect-open' : 'initial-open',
                        expectedSocket: sock
                    });

                    

                    // Criar monitor de saúde da conexão

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

        

        // Presença (digitando)

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

        console.error(`[${sessionId}] ? Erro ao criar sessão:`, error.message);

        

        const currentAttempt = reconnectAttempts.get(sessionId) || 0;

        if (currentAttempt < MAX_RECONNECT_ATTEMPTS) {

            reconnectAttempts.set(sessionId, currentAttempt + 1);

            await baileys.delay(RECONNECT_DELAY);
            releaseSessionLock();
            return await createSession(sessionId, clientSocket, currentAttempt + 1, options);

        } else {

            clientSocket.emit('error', { message: 'Erro ao criar sessão WhatsApp' });

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
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    const normalized = Math.trunc(parsed);
    return normalized > 0 ? normalized : null;
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

    const rawSessionId = String(context?.sessionId || context?.session_id || '').trim();
    if (rawSessionId) {
        const sessionOwnerUserId = await resolveSessionOwnerUserId(normalizedContext.sessionId);
        if (sessionOwnerUserId) return sessionOwnerUserId;
    }

    return await resolveOwnerScopeUserIdFromAssignees(
        normalizedContext?.conversation?.assigned_to,
        normalizedContext?.lead?.assigned_to
    );
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
    return String(value || '').trim();
}

function normalizeAutomationTagKey(value) {
    return normalizeAutomationTagLabel(value).toLowerCase();
}

function parseAutomationTagFilters(value) {
    if (value === undefined || value === null || value === '') return [];

    let parsed = value;
    if (typeof parsed === 'string') {
        const trimmed = parsed.trim();
        if (!trimmed) return [];
        try {
            parsed = JSON.parse(trimmed);
        } catch (_) {
            parsed = trimmed
                .split(',')
                .map((item) => normalizeAutomationTagLabel(item))
                .filter(Boolean);
        }
    }

    if (!Array.isArray(parsed)) {
        parsed = [parsed];
    }

    const seen = new Set();
    const normalized = [];
    for (const item of parsed) {
        const label = normalizeAutomationTagLabel(item);
        const key = normalizeAutomationTagKey(label);
        if (!label || !key || seen.has(key)) continue;
        seen.add(key);
        normalized.push(label);
    }

    return normalized;
}

function normalizeAutomationTagFilterInput(value) {
    if (value === undefined) return undefined;
    const tags = parseAutomationTagFilters(value);
    if (!tags.length) return null;
    return JSON.stringify(tags);
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
    const tagFilters = parseAutomationTagFilters(automation?.tag_filter);
    if (!tagFilters.length) return true;
    if (!lead) return false;

    const leadTagKeys = new Set(
        parseLeadTags(lead?.tags)
            .map((tag) => normalizeAutomationTagKey(tag))
            .filter(Boolean)
    );
    if (!leadTagKeys.size) return false;

    return tagFilters.some((tag) => leadTagKeys.has(normalizeAutomationTagKey(tag)));
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
                await sendMessage(sessionId, lead.phone, content, 'text');
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
            displayName = safeSessionName ? `${safeSessionName} (Você)` : 'Você';
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

            const leadResult = await Lead.findOrCreate({

                phone,

                jid,

                name: displayName,

                source: 'whatsapp',
                assigned_to: sessionOwnerUserId || undefined,
                owner_user_id: sessionOwnerUserId || undefined

            });
            lead = leadResult.lead;

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

function createRuntimeStore({ sessionId = '', makeInMemoryStore = null } = {}) {
    const normalizedSessionId = sanitizeSessionId(sessionId);
    if (typeof makeInMemoryStore === 'function') {
        try {
            const store = makeInMemoryStore({ logger });
            if (store && typeof store.bind === 'function' && typeof store.loadMessages === 'function') {
                return store;
            }
            console.warn(
                `[${normalizedSessionId || 'runtime'}] makeInMemoryStore retornou store sem loadMessages/bind; usando fallback local.`
            );
        } catch (error) {
            console.warn(
                `[${normalizedSessionId || 'runtime'}] Falha ao criar store via makeInMemoryStore; usando fallback local:`,
                error.message
            );
        }
    } else {
        console.warn(`[${normalizedSessionId || 'runtime'}] makeInMemoryStore indisponivel; usando fallback local.`);
    }

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

    const store = createRuntimeStore({
        sessionId,
        makeInMemoryStore: options.makeInMemoryStore
    });

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

        console.warn(`[${sessionId}] ?? Não foi possível buscar chats por API:`, error.message);

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
        const sentAtIso = messageTimestampMs > 0 ? new Date(messageTimestampMs).toISOString() : new Date().toISOString();
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
        latestSavedMessageId = savedMessage?.id || latestSavedMessageId;
        latestSentAt = sentAtIso || latestSentAt;
        if (!isFromMe) unreadFromLead += 1;
    }

    if (!inserted && !hydratedMedia) return createStoreBackfillResult();

    if (inserted > 0) {
        await Conversation.touch(conversation.id, latestSavedMessageId, latestSentAt || null);
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

    console.log(`[${sessionId}] Backfill local recuperou ${inserted} mensagem(ns) e atualizou ${hydratedMedia} mídia(s) na conversa ${conversation.id}`);
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

    const safeLimit = Math.max(1, Math.min(Number(limit) || WHATSAPP_RECONNECT_CATCHUP_MAX_CONVERSATIONS, 200));
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
        200
    );
    const messagesPerConversation = parsePositiveIntInRange(
        options.messagesPerConversation,
        WHATSAPP_RECONNECT_CATCHUP_MESSAGES_PER_CONVERSATION,
        10,
        500
    );
    const maxRuntimeMs = parsePositiveIntInRange(
        options.maxRuntimeMs,
        WHATSAPP_RECONNECT_CATCHUP_MAX_RUNTIME_MS,
        3000,
        300000
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

    const backfillResult = await backfillConversationMessagesFromStore({
        sessionId,
        conversation,
        lead,
        contactJid: remoteJid,
        limit: 40
    });

    if ((backfillResult?.inserted || 0) <= 0) return false;

    const recentIncoming = await query(`
        SELECT id, message_id, content, content_encrypted, media_type, metadata, sent_at, created_at, is_from_me
        FROM messages
        WHERE conversation_id = ?
          AND is_from_me = 0
        ORDER BY COALESCE(sent_at, created_at) DESC, id DESC
        LIMIT 12
    `, [conversation.id]);
    if (!Array.isArray(recentIncoming) || recentIncoming.length === 0) return false;

    const now = Date.now();
    let recovered = false;
    for (const candidate of recentIncoming) {
        const messageId = String(candidate?.message_id || '').trim();
        if (!messageId || hasRecoveredFlowMessage(messageId)) continue;

        const metadata = parseJsonSafe(candidate?.metadata, {});
        if (String(metadata?.source || '').trim() !== 'store_backfill') continue;

        const rawTimestamp = candidate?.sent_at || candidate?.created_at;
        const sentAtMs = Date.parse(String(rawTimestamp || ''));
        if (!Number.isFinite(sentAtMs) || (now - sentAtMs) > FLOW_RECOVERY_WINDOW_MS) continue;

        let text = candidate?.content_encrypted
            ? decryptMessage(candidate.content_encrypted)
            : candidate?.content;
        if ((!text || !String(text).trim()) && candidate?.media_type && candidate.media_type !== 'text') {
            text = previewForMedia(candidate.media_type);
        }
        text = normalizeText(text);
        if (!text) continue;

        conversation = await Conversation.findById(conversation.id) || conversation;
        await flowService.processIncomingMessage(
            { text, mediaType: candidate.media_type || 'text' },
            lead,
            conversation
        );
        rememberRecoveredFlowMessage(messageId);
        console.log(`[${sessionId}] Recuperacao automatica processou mensagem cifrada (${messageId}) para continuar fluxo`);
        recovered = true;
        break;
    }

    return recovered;
}



let cachedBusinessHoursSettings = null;
let cachedBusinessHoursSettingsAt = 0;
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

function invalidateBusinessHoursSettingsCache() {
    cachedBusinessHoursSettings = null;
    cachedBusinessHoursSettingsAt = 0;
}

async function getBusinessHoursSettings(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && cachedBusinessHoursSettings && (now - cachedBusinessHoursSettingsAt) < BUSINESS_HOURS_CACHE_TTL_MS) {
        return cachedBusinessHoursSettings;
    }

    const [enabledValue, startValue, endValue, autoReplyMessageValue] = await Promise.all([
        Settings.get('business_hours_enabled'),
        Settings.get('business_hours_start'),
        Settings.get('business_hours_end'),
        Settings.get('business_hours_auto_reply_message')
    ]);

    const normalized = normalizeBusinessHoursSettings({
        enabled: enabledValue,
        start: startValue,
        end: endValue,
        autoReplyMessage: autoReplyMessageValue
    });

    cachedBusinessHoursSettings = normalized;
    cachedBusinessHoursSettingsAt = now;

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

    // Em mensagens recebidas, quando o remoteJid jÃ¡ vem como usuÃ¡rio vÃ¡lido
    // (e nÃ£o Ã© self), ele Ã© a melhor fonte para evitar roteamento incorreto.
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
    let text = extractTextFromMessageContent(content);
    let mediaType = detectMediaTypeFromMessageContent(content);
    let persistedMedia = null;

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

    const selfName = safeSessionName ? `${safeSessionName} (Você)` : 'Você';

    

    // Buscar ou criar lead

    const leadResult = await Lead.findOrCreate({

        phone,

        jid: from,

        name: isSelfChat ? selfName : (!isFromMe ? (pushName || phone) : undefined),

        source: 'whatsapp',
        assigned_to: sessionOwnerUserId || undefined,
        owner_user_id: sessionOwnerUserId || undefined

    });
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

        await Conversation.touch(conversation.id, savedMessage.id, messageTimestampIso);

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

            const businessHoursSettings = await getBusinessHoursSettings();
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
                    { text, mediaType },
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

    if (options.conversationId) {
        const existingConversation = await Conversation.findById(options.conversationId);
        if (existingConversation && Number(existingConversation.lead_id) === Number(lead.id)) {
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

    const renderedTextMessage = type === 'text'
        ? applyLeadTemplate(message, lead, { mensagem: message || '' })
        : message;
    const renderedCaption = type !== 'text' && String(options.caption || '').trim()
        ? applyLeadTemplate(options.caption || '', lead, { mensagem: options.caption || '' })
        : (options.caption || '');

    

    let result;

    try {
        if (type === 'text') {

            result = await session.socket.sendMessage(jid, { text: renderedTextMessage });

        } else if (type === 'image') {

            result = await session.socket.sendMessage(jid, {

                image: { url: options.url || message },

                caption: renderedCaption || ''

            });

        } else if (type === 'video') {

            result = await session.socket.sendMessage(jid, {

                video: { url: options.url || message },

                caption: renderedCaption || ''

            });

        } else if (type === 'document') {

            result = await session.socket.sendMessage(jid, {

                document: { url: options.url || message },

                mimetype: options.mimetype || 'application/pdf',

                fileName: options.fileName || 'documento'

            });

        } else if (type === 'audio') {

            result = await session.socket.sendMessage(jid, {

                audio: { url: options.url || message },

                mimetype: options.mimetype || 'audio/ogg; codecs=opus',

                ptt: options.ptt === true

            });

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

            content: type === 'text' ? renderedTextMessage : (renderedCaption || ''),

            content_encrypted: encryptMessage(type === 'text' ? renderedTextMessage : (renderedCaption || '')),

            media_type: type,

            media_url: type !== 'text' ? (options.url || message) : null,

            media_mime_type: type !== 'text' ? (options.mimetype || null) : null,

            media_filename: type !== 'text' ? (options.fileName || null) : null,

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

    

    await Conversation.touch(conversation.id, savedMessage?.id || null, sentAtIso);
    if (options.campaignId) {
        await Campaign.refreshMetrics(options.campaignId);
    }

    // Webhook

    webhookService.trigger('message.sent', {

        messageId,

        to,

        content: type === 'text' ? renderedTextMessage : (renderedCaption || ''),

        type

    }, {
        ownerUserId: Number(sessionOwnerUserId || lead?.owner_user_id || 0) || undefined
    });

    

    console.log(`[${sessionId}] ? Mensagem enviada para ${to}`);

    

    return { ...result, savedMessage, lead, conversation, sentAt: sentAtIso };

}



/**

 * Verificar se sessão existe

 */

function sessionExists(sessionId) {

    return whatsappService.hasSession(sessionId, SESSIONS_DIR);

}



// ============================================

// INICIALIZAR SERVIÇOS

// ============================================



// Inicializar serviço de fila

(async () => {
    await bootstrapPromise;

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
            const allocation = await senderAllocatorService.allocateForSingleLead({
                leadId: lead?.id,
                campaignId: message?.campaign_id || null,
                sessionId: message?.session_id || null,
                strategy: 'round_robin',
                ownerUserId: Number(lead?.assigned_to || 0) > 0 ? Number(lead?.assigned_to) : undefined
            });
            return {
                sessionId: allocation?.sessionId || null,
                assignmentMeta: allocation?.assignmentMeta || null
            };
        },
        getSessionDispatchState
    });

    flowService.init(async (options = {}) => {
        const resolvedSessionId = resolveSessionIdOrDefault(options?.sessionId || options?.session_id);
        const destination = String(options?.to || extractNumber(options?.jid || '') || '').trim();
        if (!destination) {
            throw new Error('Destino invalido para envio no fluxo');
        }

        const mediaType = String(options?.mediaType || options?.media_type || 'text').trim().toLowerCase() || 'text';
        const content = String(options?.content || '');

        return await sendMessage(
            resolvedSessionId,
            destination,
            content,
            mediaType,
            {
                url: options?.mediaUrl || options?.url || null,
                mimetype: options?.mimetype,
                fileName: options?.fileName,
                ptt: options?.ptt,
                duration: options?.duration,
                conversationId: options?.conversationId || options?.conversation_id || null
            }
        );
    });

    await rehydrateSessions(io);
    startScheduledAutomationsWorker();
    startTenantIntegrityAuditWorker();
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
                error: 'Sua assinatura não está ativa. Reative para poder usar a aplicação.',
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
    const ownerScopeUserId = await ensureSocketOwnerScopeRoom(socket);
    const hasActivePlan = await hasOwnerActiveWhatsAppPlan(ownerScopeUserId);
    if (!hasActivePlan) {
        const normalizedSessionId = sanitizeSessionId(sessionId);
        socket.emit('error', {
            message: 'Sua assinatura não está ativa. Reative para poder usar a aplicação.',
            code: 'PLAN_INACTIVE'
        });
        socket.emit('session-status', {
            status: 'disconnected',
            sessionId: normalizedSessionId || null
        });
        return { allowed: false, ownerScopeUserId };
    }
    return { allowed: true, ownerScopeUserId };
}

io.on('connection', (socket) => {

    console.log('?? Cliente conectado:', socket.id);
    ensureSocketOwnerScopeRoom(socket).catch((error) => {
        console.warn(`[socket:${socket.id}] Falha ao resolver escopo inicial:`, error.message);
    });

    

    socket.on('check-session', async ({ sessionId }) => {

        const normalizedSessionId = sanitizeSessionId(sessionId);
        if (!normalizedSessionId) {
            socket.emit('session-status', { status: 'disconnected', sessionId: null });
            return;
        }

        const planAccess = await ensureSocketActiveWhatsAppPlan(socket, normalizedSessionId);
        if (!planAccess.allowed) return;
        const ownerScopeUserId = planAccess.ownerScopeUserId;
        if (ownerScopeUserId) {
            const storedSession = await WhatsAppSession.findBySessionId(normalizedSessionId, {
                owner_user_id: ownerScopeUserId
            });
            if (!storedSession) {
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

    });

    

    socket.on('start-session', async (payload = {}) => {
        const sessionId = sanitizeSessionId(payload.sessionId);
        const pairingPhone = normalizePairingPhoneNumber(payload.phoneNumber);
        const shouldRequestPairingCode = Boolean(payload.requestPairingCode && pairingPhone);
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

        const existingSession = sessions.get(sessionId);

        if (existingSession) {
            existingSession.clientSocket = socket;
            socket.emit('session-status', {
                status: existingSession.isConnected ? 'connected' : 'reconnecting',
                sessionId,
                user: existingSession.user
            });
            let pairingHandledByCreate = false;
            if (!existingSession.isConnected && !existingSession.reconnecting && !sessionInitLocks.has(sessionId)) {
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

        await createSession(sessionId, socket, 0, {
            requestPairingCode: shouldRequestPairingCode,
            pairingPhone,
            ownerUserId: resolvedOwnerUserId || undefined
        });

    });

    socket.on('request-pairing-code', async (payload = {}) => {
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
            if (!existingSession.isConnected && !existingSession.reconnecting && !sessionInitLocks.has(sessionId)) {
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

        await createSession(sessionId, socket, 0, {
            requestPairingCode: true,
            pairingPhone,
            ownerUserId: resolvedOwnerUserId || undefined
        });
    });

    

    socket.on('send-message', async ({ sessionId, to, message, type, options }) => {

        try {
            const normalizedSessionId = sanitizeSessionId(sessionId);
            if (!normalizedSessionId) {
                socket.emit('error', { message: 'sessionId e obrigatorio', code: 'SESSION_ID_REQUIRED' });
                return;
            }

            const ownerScopeUserId = await ensureSocketOwnerScopeRoom(socket);
            if (ownerScopeUserId) {
                const allowedSession = await WhatsAppSession.findBySessionId(normalizedSessionId, {
                    owner_user_id: ownerScopeUserId
                });
                if (!allowedSession) {
                    socket.emit('error', { message: 'Sem permissao para usar esta conta WhatsApp', code: 'SESSION_FORBIDDEN' });
                    return;
                }
            }

            const safeOptions = options && typeof options === 'object' ? { ...options } : {};
            const normalizedConversationId = Number(safeOptions.conversationId);
            if (Number.isInteger(normalizedConversationId) && normalizedConversationId > 0) {
                const socketReq = buildSocketRequestLike(socket);
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
            const allowedSession = await WhatsAppSession.findBySessionId(normalizedSessionId, {
                owner_user_id: ownerScopeUserId
            });
            if (!allowedSession) {
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
            const allowedSession = await WhatsAppSession.findBySessionId(normalizedSessionId, {
                owner_user_id: ownerScopeUserId
            });
            if (!allowedSession) {
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
        const sessionDisplayName = normalizeText(getSessionDisplayName(normalizedSessionId) || 'Usuário');

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
                    displayName = safeSessionName ? `${safeSessionName} (Você)` : 'Você';
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
            const allowedSession = await WhatsAppSession.findBySessionId(normalizedSessionId, {
                owner_user_id: ownerScopeUserId
            });
            if (!allowedSession) {
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

        const normalizedSessionId = sanitizeSessionId(sessionId);
        if (!normalizedSessionId) {
            socket.emit('error', { message: 'sessionId e obrigatorio', code: 'SESSION_ID_REQUIRED' });
            return;
        }

        const planAccess = await ensureSocketActiveWhatsAppPlan(socket, normalizedSessionId);
        if (!planAccess.allowed) return;
        const ownerScopeUserId = planAccess.ownerScopeUserId;
        if (ownerScopeUserId) {
            const storedSession = await WhatsAppSession.findBySessionId(normalizedSessionId, {
                owner_user_id: ownerScopeUserId
            });
            if (!storedSession) {
                socket.emit('error', { message: 'Sem permissao para remover esta conta', code: 'SESSION_FORBIDDEN' });
                return;
            }
        }

        const session = sessions.get(normalizedSessionId);

        

        if (qrTimeouts.has(normalizedSessionId)) {

            clearTimeout(qrTimeouts.get(normalizedSessionId));

            qrTimeouts.delete(normalizedSessionId);

        }

        

        if (session) {
            stopSessionHealthMonitor(session);

            try {
                if (typeof session.socket?.ev?.removeAllListeners === 'function') {
                    session.socket.ev.removeAllListeners();
                }
                await session.socket.logout();

            } catch (e) {}

            

            sessions.delete(normalizedSessionId);
            reconnectAttempts.delete(normalizedSessionId);
            reconnectInFlight.delete(normalizedSessionId);

            

            const sessionPath = path.join(SESSIONS_DIR, normalizedSessionId);

            if (fs.existsSync(sessionPath)) {

                fs.rmSync(sessionPath, { recursive: true, force: true });

            }
        }

        await clearPersistedBaileysAuthState(normalizedSessionId);

        

        socket.emit('disconnected', { sessionId: normalizedSessionId });

        emitToOwnerScope(ownerScopeUserId || null, 'whatsapp-status', { sessionId: normalizedSessionId, status: 'disconnected' });

    });

    

    socket.on('disconnect', () => {

        console.log('?? Cliente desconectado:', socket.id);

    });

});



// ============================================

// ROTAS API REST

// ============================================



// Status do WhatsApp (para Configurações > Conexão)

app.get('/api/whatsapp/status', optionalAuth, (req, res) => {

    const sessionId = resolveSessionIdOrDefault(req.query?.sessionId);

    const session = sessions.get(sessionId);

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
        lastDisconnectReason: session?.lastDisconnectReason || null
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
        const scopeRaw = String(payload.scope || 'all').trim().toLowerCase();
        const unreadOnly = ['unread', 'pending', 'nao_lidas', 'nao-lidas', 'naolidas'].includes(scopeRaw);
        const maxConversations = parsePositiveIntInRange(
            payload.maxConversations ?? payload.max_conversations,
            WHATSAPP_RECONNECT_CATCHUP_MAX_CONVERSATIONS,
            1,
            200
        );
        const messagesPerConversation = parsePositiveIntInRange(
            payload.messagesPerConversation ??
            payload.messages_per_conversation ??
            payload.limitPerConversation ??
            payload.limit_per_conversation,
            WHATSAPP_RECONNECT_CATCHUP_MESSAGES_PER_CONVERSATION,
            10,
            500
        );
        const maxRuntimeMs = parsePositiveIntInRange(
            payload.maxRuntimeMs ?? payload.max_runtime_ms,
            WHATSAPP_RECONNECT_CATCHUP_MAX_RUNTIME_MS,
            3000,
            300000
        );
        const trigger = String(payload.trigger || 'manual-api').trim() || 'manual-api';

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
        res.status(400).json({ error: error.message });
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

        await whatsappService.logoutSession(sessionId, SESSIONS_DIR);
        await clearPersistedBaileysAuthState(sessionId);
        await WhatsAppSession.deleteBySessionId(sessionId, {
            owner_user_id: ownerScopeUserId || undefined,
            created_by: ownerScopeUserId || undefined
        });

        emitToOwnerScope(ownerScopeUserId || null, 'whatsapp-status', { sessionId, status: 'disconnected' });
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

        await whatsappService.logoutSession(sessionId, SESSIONS_DIR);
        await clearPersistedBaileysAuthState(sessionId);

        emitToOwnerScope(ownerScopeUserId || null, 'whatsapp-status', { sessionId, status: 'disconnected' });

        res.json({ success: true });

    } catch (error) {

        res.status(500).json({ error: error.message });

    }

});



// Status do servidor

app.get('/api/status', async (req, res) => {

    const activeSessions = Array.from(sessions.entries()).map(([id, session]) => ({

        id,

        connected: session.isConnected,

        user: session.user?.name || null

    }));

    

    res.json({

        status: 'online',

        version: '4.0.0',

        sessions: sessions.size,

        activeSessions,

        queue: await queueService.getStatus(),

        uptime: process.uptime(),

        timestamp: new Date().toISOString()

    });

});



// ============================================

// API DE AUTENTICAÇÃO

// ============================================



app.post('/api/auth/login', async (req, res) => {

    try {

        const { email, password } = req.body;

        

        if (!email || !password) {

            return res.status(400).json({ error: 'Email e senha são obrigatórios' });

        }

        

        const { User } = require('./database/models');

        const { verifyPassword, generateToken, generateRefreshToken, hashPassword } = require('./middleware/auth');



        const normalizedEmail = String(email || '').trim().toLowerCase();

        let user = await User.findByEmail(normalizedEmail);



        // Compatibilidade com login legado (usuário: thyago / senha: thyago123)

        if (!user && normalizedEmail === 'thyago' && password === 'thyago123') {

            const legacyEmail = 'thyago@self.com.br';

            user = await User.findByEmail(legacyEmail);



            if (!user) {

                const created = await User.create({

                    name: 'thyago',

                    email: legacyEmail,

                    password_hash: hashPassword('thyago123'),

                    role: 'admin'

                });

                user = await User.findByEmail(legacyEmail);

            }

        }



        if (!user || !verifyPassword(password, user.password_hash)) {

            return res.status(401).json({ error: 'Credenciais inválidas' });

        }

        

        if (!user.is_active) {

            return res.status(401).json({ error: 'Usuário desativado' });

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

        const { name, email, password } = req.body;



        if (!name || !email || !password) {

            return res.status(400).json({ error: 'Nome, email e senha sao obrigatorios' });

        }



        if (String(password).length < 6) {

            return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres' });

        }



        const { hashPassword } = require('./middleware/auth');

        const normalizedName = String(name || '').trim();
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

        if (!email) {
            return res.status(400).json({
                error: 'Email e obrigatorio',
                code: 'EMAIL_REQUIRED'
            });
        }

        const user = await User.findActiveByEmail(email);

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



app.post('/api/auth/refresh', async (req, res) => {

    try {

        const { refreshToken } = req.body;

        if (!refreshToken) {

            return res.status(400).json({ error: 'Refresh token é obrigatório' });

        }

        

        const { verifyToken, generateToken } = require('./middleware/auth');

        const { User } = require('./database/models');

        

        const decoded = verifyToken(refreshToken);

        if (!decoded || decoded.type !== 'refresh') {

            return res.status(401).json({ error: 'Refresh token inválido' });

        }

        

        const user = await User.findById(decoded.id);

        if (!user || !user.is_active) {

            return res.status(401).json({ error: 'Usuário não encontrado ou inativo' });

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
        source.htmlTemplate ?? current.htmlTemplate,
        DEFAULT_EMAIL_HTML_TEMPLATE
    );
    const textTemplate = sanitizeEmailTemplateValue(
        source.textTemplate ?? current.textTemplate,
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
        if (['0', 'false', 'no', 'nao', 'não', 'off'].includes(normalized)) return 0;
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
        res.status(500).json({ success: false, error: 'Erro ao carregar usuários' });
    }
});

app.post('/api/users', authenticate, async (req, res) => {
    try {
        const requesterRole = String(req.user?.role || '').toLowerCase();
        if (requesterRole !== 'admin') {
            return res.status(403).json({ success: false, error: 'Sem permissão para criar usuários' });
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
            return res.status(400).json({ success: false, error: 'Nome, e-mail e senha são obrigatórios' });
        }

        if (password.length < 6) {
            return res.status(400).json({ success: false, error: 'A senha deve ter pelo menos 6 caracteres' });
        }

        const existing = await User.findActiveByEmail(email);
        if (existing) {
            return res.status(409).json({ success: false, error: 'E-mail já cadastrado' });
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
        res.status(500).json({ success: false, error: 'Erro ao criar usuário' });
    }
});

app.put('/api/users/:id', authenticate, async (req, res) => {
    try {
        const targetId = parseInt(req.params.id, 10);
        if (!Number.isInteger(targetId) || targetId <= 0) {
            return res.status(400).json({ success: false, error: 'Usuário inválido' });
        }

        const requesterRole = String(req.user?.role || '').toLowerCase();
        const requesterId = Number(req.user?.id || 0);
        const requesterOwnerUserId = await resolveRequesterOwnerUserId(req);
        const isAdmin = requesterRole === 'admin';
        const isSelf = requesterId === targetId;

        if (!isAdmin && !isSelf) {
            return res.status(403).json({ success: false, error: 'Sem permissão para editar este usuário' });
        }

        const current = await User.findById(targetId);
        if (!current) {
            return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
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
                return res.status(400).json({ success: false, error: 'Nome é obrigatório' });
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
                return res.status(400).json({ success: false, error: 'Não é possível desativar o próprio usuário' });
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
        res.status(500).json({ success: false, error: 'Erro ao atualizar usuário' });
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
            return res.status(401).json({ success: false, error: 'Usuário não autenticado' });
        }

        const currentPassword = String(req.body?.currentPassword || '');
        const newPassword = String(req.body?.newPassword || '');

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, error: 'Senha atual e nova senha são obrigatórias' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, error: 'A nova senha deve ter pelo menos 6 caracteres' });
        }

        const { verifyPassword, hashPassword } = require('./middleware/auth');
        const user = await User.findByIdWithPassword(userId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
        }

        if (!verifyPassword(currentPassword, user.password_hash)) {
            return res.status(400).json({ success: false, error: 'Senha atual inválida' });
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
            return res.status(400).json({ success: false, error: 'Métrica inválida' });
        }

        const startInput = normalizePeriodDateInput(req.query.startDate);
        const endInput = normalizePeriodDateInput(req.query.endDate);

        if (!startInput || !endInput) {
            return res.status(400).json({ success: false, error: 'Período inválido' });
        }

        if (startInput.date > endInput.date) {
            return res.status(400).json({ success: false, error: 'Data inicial maior que data final' });
        }

        const maxDaysRange = 370;
        const periodDays = Math.floor((endInput.date.getTime() - startInput.date.getTime()) / 86400000) + 1;
        if (periodDays > maxDaysRange) {
            return res.status(400).json({ success: false, error: `Período máximo é de ${maxDaysRange} dias` });
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
        console.error('Falha ao carregar estatísticas por período:', error);
        res.status(500).json({ success: false, error: 'Erro ao carregar estatísticas por período' });
    }
});



function parseBooleanInput(value, fallback = false) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value > 0;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['1', 'true', 'yes', 'sim', 'on'].includes(normalized)) return true;
        if (['0', 'false', 'no', 'nao', 'não', 'off'].includes(normalized)) return false;
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

        return res.status(404).json({ error: 'Lead não encontrado' });

    }

    if (!await canAccessLeadRecordInOwnerScope(req, lead)) {
        return res.status(404).json({ error: 'Lead não encontrado' });
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

        res.status(400).json({ error: error.message });

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
        res.status(500).json({
            success: false,
            error: 'Erro ao importar leads em lote'
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
                error: 'Lista de IDs inválida'
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
                error: 'Lista de IDs inválida'
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
        const requestedStatus = hasStatusField ? parseInt(String(body.status || ''), 10) : null;

        if (hasStatusField && ![1, 2, 3, 4].includes(Number(requestedStatus))) {
            return res.status(400).json({
                success: false,
                error: 'Status inválido. Use 1, 2, 3 ou 4.'
            });
        }

        const addTagsInput = Object.prototype.hasOwnProperty.call(body, 'addTags')
            ? body.addTags
            : body.tags;
        const tagsToAdd = Array.from(new Set(parseLeadTagsForMerge(addTagsInput)));

        if (!hasStatusField && tagsToAdd.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Nenhuma alteração informada (status ou addTags)'
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

                if (hasStatusField && Number(lead.status) !== Number(requestedStatus)) {
                    updateData.status = Number(requestedStatus);
                }

                if (tagsToAdd.length > 0) {
                    const currentTags = parseLeadTagsForMerge(lead.tags);
                    const mergedTags = Array.from(new Set([...currentTags, ...tagsToAdd]));
                    const tagsChanged = mergedTags.length !== currentTags.length
                        || mergedTags.some((tag, index) => tag !== currentTags[index]);

                    if (tagsChanged) {
                        updateData.tags = mergedTags;
                        tagsWereUpdated = true;
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
                        errors.push({ id: leadId, error: 'Lead não encontrado após atualização' });
                    }
                    continue;
                }

                updated += 1;
                if (tagsWereUpdated) {
                    tagsUpdated += 1;
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

        return res.status(404).json({ error: 'Lead não encontrado' });

    }

    if (!await canAccessLeadRecordInOwnerScope(req, lead)) {
        return res.status(404).json({ error: 'Lead não encontrado' });
    }

    

    const oldStatus = normalizeAutomationStatus(lead.status);
    const updateData = { ...req.body };

    if (Object.prototype.hasOwnProperty.call(updateData, 'name')) {
        const manualName = sanitizeAutoName(updateData.name);
        if (manualName) {
            updateData.custom_fields = lockLeadNameAsManual(
                mergeLeadCustomFields(lead.custom_fields, updateData.custom_fields)
            );
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

        await Tag.syncFromLeads(tagScope);
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
            return res.status(400).json({ success: false, error: 'Nome da tag é obrigatório' });
        }

        const existing = await Tag.findByName(name, tagScope);
        if (existing) {
            return res.status(409).json({ success: false, error: 'Já existe uma tag com este nome' });
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
            return res.status(400).json({ success: false, error: 'ID de tag inválido' });
        }

        const currentTag = await Tag.findById(tagId, tagScope);
        if (!currentTag) {
            return res.status(404).json({ success: false, error: 'Tag não encontrada' });
        }

        const payload = {};
        if (Object.prototype.hasOwnProperty.call(req.body, 'name')) {
            const nextName = normalizeTagNameInput(req.body.name);
            if (!nextName) {
                return res.status(400).json({ success: false, error: 'Nome da tag é obrigatório' });
            }

            const duplicate = await Tag.findByName(nextName, tagScope);
            if (duplicate && Number(duplicate.id) !== tagId) {
                return res.status(409).json({ success: false, error: 'Já existe uma tag com este nome' });
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
            return res.status(404).json({ success: false, error: 'Tag não encontrada' });
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
            return res.status(400).json({ success: false, error: 'ID de tag inválido' });
        }

        const currentTag = await Tag.findById(tagId, tagScope);
        if (!currentTag) {
            return res.status(404).json({ success: false, error: 'Tag não encontrada' });
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

        const lastMessageText =
            (decrypted || '').trim() ||
            (lastMessage ? previewForMedia(lastMessage.media_type) : '') ||
            metadataLastMessage ||
            (Number(c?.unread_count || 0) > 0 ? '[mensagem recebida]' : '');

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
            const sessionName = normalizeText(getSessionDisplayName(c.session_id) || 'Usuário');
            name = sessionName ? `${sessionName} (Você)` : 'Você';
        }

        return {
            ...c,
            unread: c.unread_count || 0,
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

        return res.status(400).json({ error: 'Parâmetros obrigatórios: sessionId, to, message' });

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

        return res.status(400).json({ error: 'Parâmetros obrigatórios: phone/to e content' });

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

    res.json({ success: true, ...(await queueService.getStatus()) });

});



app.post('/api/queue/add', authenticate, async (req, res) => {

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
    } = req.body;

    

    let resolvedSessionId = sanitizeSessionId(sessionId);
    if (!resolvedSessionId) {
        const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
        const allocation = await senderAllocatorService.allocateForSingleLead({
            leadId,
            campaignId,
            strategy: 'round_robin',
            ownerUserId: ownerScopeUserId || undefined
        });
        resolvedSessionId = sanitizeSessionId(allocation?.sessionId);
    }

    const result = await queueService.add({

        leadId,

        conversationId,

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

    

    res.json({ success: true, ...result });

});



app.post('/api/queue/bulk', authenticate, async (req, res) => {

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
    const normalizedLeadIds = Array.isArray(leadIds) ? leadIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0) : [];
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

    let distribution = { strategyUsed: fixedSessionId ? 'single' : distributionStrategy, summary: {} };
    if (!hasSessionAssignments) {
        const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
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

    

    const results = await queueService.addBulk(leadIds, content, options);

    

    res.json({
        success: true,
        queued: results.length,
        distribution: {
            strategy: distribution.strategyUsed,
            by_session: distribution.summary
        }
    });

});



app.delete('/api/queue/:id', authenticate, async (req, res) => {

    await queueService.cancel(req.params.id);

    res.json({ success: true });

});



app.delete('/api/queue', authenticate, async (req, res) => {

    const count = await queueService.cancelAll();

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


function parseLeadTags(rawTags) {
    if (Array.isArray(rawTags)) {
        return rawTags
            .map((tag) => String(tag || '').trim())
            .filter(Boolean);
    }

    const raw = String(rawTags || '').trim();
    if (!raw) return [];

    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return parsed
                .map((tag) => String(tag || '').trim())
                .filter(Boolean);
        }
    } catch {
        // Valor legado pode estar em formato livre.
    }

    return raw
        .split(',')
        .map((tag) => String(tag || '').trim())
        .filter(Boolean);
}

function normalizeCampaignTagLabel(value) {
    return String(value || '').trim();
}

function normalizeCampaignTag(value) {
    return normalizeCampaignTagLabel(value).toLowerCase();
}

function parseCampaignTagFilters(value) {
    if (value === undefined || value === null || value === '') return [];

    let parsed = value;
    if (typeof parsed === 'string') {
        const trimmed = parsed.trim();
        if (!trimmed) return [];
        try {
            parsed = JSON.parse(trimmed);
        } catch (_) {
            parsed = trimmed
                .split(',')
                .map((item) => normalizeCampaignTagLabel(item))
                .filter(Boolean);
        }
    }

    if (!Array.isArray(parsed)) {
        parsed = [parsed];
    }

    const seen = new Set();
    const normalized = [];
    for (const item of parsed) {
        const label = normalizeCampaignTagLabel(item);
        const key = normalizeCampaignTag(label);
        if (!label || !key || seen.has(key)) continue;
        seen.add(key);
        normalized.push(label);
    }

    return normalized;
}

function normalizeCampaignTagFilterInput(value) {
    if (value === undefined) return undefined;
    const tags = parseCampaignTagFilters(value);
    if (!tags.length) return null;
    return JSON.stringify(tags);
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
        const value = Number(prefixed[1]);
        if ([1, 2, 3, 4].includes(value)) return value;
    }

    const directNumeric = Number(normalizedSegment);
    if ([1, 2, 3, 4].includes(directNumeric)) return directNumeric;

    return null;
}

function leadMatchesCampaignTag(lead, tagFilter = '') {
    const tagFilters = parseCampaignTagFilters(tagFilter)
        .map((tag) => normalizeCampaignTag(tag))
        .filter(Boolean);
    if (!tagFilters.length) return true;

    const leadTagKeys = new Set(
        parseLeadTags(lead?.tags)
            .map((tag) => normalizeCampaignTag(tag))
            .filter(Boolean)
    );
    if (!leadTagKeys.size) return false;

    return tagFilters.some((tag) => leadTagKeys.has(tag));
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
            AND EXISTS (
                SELECT 1
                FROM users owner_scope
                WHERE owner_scope.id = leads.assigned_to
                  AND (owner_scope.owner_user_id = ? OR owner_scope.id = ?)
            )
        `;
        params.push(ownerUserId, ownerUserId);
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

    const senderAccounts = await CampaignSenderAccount.listByCampaignId(campaign.id, { onlyActive: true });
    const distributionStrategy = normalizeCampaignDistributionStrategy(
        campaign?.distribution_strategy,
        senderAccounts.length ? 'round_robin' : 'single'
    );
    let distributionPlan;
    try {
        distributionPlan = await senderAllocatorService.buildDistributionPlan({
            leadIds,
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
        leadIds,
        assignmentMetaByLead,
        baseStartMs,
        delayMinMs,
        delayMaxMs,
        sendWindowConfig
    );

    let queuedCount = 0;

    if (campaignType === 'drip') {

        for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {

            const content = steps[stepIndex];
            const stepBaseMs = alignCampaignScheduleToSendWindow(
                baseStartMs + (stepIndex * delayMaxMs),
                sendWindowConfig
            );
            const nextLeadAtMsByDayOffset = new Map();

            for (let leadIndex = 0; leadIndex < leadIds.length; leadIndex++) {

                const leadId = leadIds[leadIndex];
                const assignmentMeta = assignmentMetaByLead[String(leadId)] || null;
                const leadDayOffsetRaw = Number(assignmentMeta?.day_offset);
                const leadDayOffset = Number.isFinite(leadDayOffsetRaw) && leadDayOffsetRaw > 0
                    ? Math.floor(leadDayOffsetRaw)
                    : 0;
                const defaultNextLeadAtMs = alignCampaignScheduleToSendWindow(
                    stepBaseMs + (leadDayOffset * 24 * 60 * 60 * 1000),
                    sendWindowConfig
                );
                const nextLeadAtMs = nextLeadAtMsByDayOffset.has(leadDayOffset)
                    ? Number(nextLeadAtMsByDayOffset.get(leadDayOffset))
                    : defaultNextLeadAtMs;
                const scheduledAt = new Date(nextLeadAtMs).toISOString();

                await queueService.add({

                    leadId,

                    campaignId: campaign.id,

                    sessionId: sessionAssignments[String(leadId)] || null,

                    isFirstContact: stepIndex === 0,

                    assignmentMeta,

                    content,

                    mediaType: 'text',

                    scheduledAt,

                    priority: 0

                });

                queuedCount += 1;

                nextLeadAtMsByDayOffset.set(
                    leadDayOffset,
                    addCampaignDelayRespectingSendWindow(
                        nextLeadAtMs,
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
            ? leadIds.reduce((acc, leadId) => {
                acc[String(leadId)] = pickRandomCampaignMessagePoolEntry(broadcastMessagePool, steps[0]);
                return acc;
            }, {})
            : null;

        const results = await queueService.addBulk(leadIds, steps[0], {

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
        recipients: leadIds.length,
        steps: steps.length,
        distribution: {
            strategy: distributionPlan.strategyUsed || distributionStrategy,
            by_session: distributionPlan.summary || {}
        }
    };

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



    res.json({ success: true, campaigns: await attachCampaignSenderAccountsList(campaigns) });

});



app.get('/api/campaigns/:id', authenticate, async (req, res) => {

    const scopedUserId = getScopedUserId(req);
    const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
    const campaign = await Campaign.findById(req.params.id, {
        created_by: scopedUserId || undefined,
        owner_user_id: ownerScopeUserId || undefined
    });

    if (!campaign) {

        return res.status(404).json({ error: 'Campanha não encontrada' });

    }

    if (!canAccessCreatedRecord(req, campaign.created_by)) {
        return res.status(404).json({ error: 'Campanha não encontrada' });
    }

    res.json({ success: true, campaign: await attachCampaignSenderAccounts(campaign) });

});

app.get('/api/campaigns/:id/recipients', authenticate, async (req, res) => {

    const scopedUserId = getScopedUserId(req);
    const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
    const campaign = await Campaign.findById(req.params.id, {
        created_by: scopedUserId || undefined,
        owner_user_id: ownerScopeUserId || undefined
    });

    if (!campaign) {

        return res.status(404).json({ error: 'Campanha não encontrada' });

    }

    if (!canAccessCreatedRecord(req, campaign.created_by)) {
        return res.status(404).json({ error: 'Campanha não encontrada' });
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
        await CampaignSenderAccount.replaceForCampaign(result.id, senderAccountsPayload);

        let campaign = await attachCampaignSenderAccounts(await Campaign.findById(result.id, {
            created_by: scopedUserId || undefined,
            owner_user_id: ownerScopeUserId || undefined
        }));
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
        }

        res.json({ success: true, campaign, queue: queueResult });

    } catch (error) {

        res.status(400).json({ error: error.message });

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
        const senderAccountsPayload = senderAccountsProvided
            ? normalizeSenderAccountsPayload(req.body?.sender_accounts ?? req.body?.senderAccounts)
            : null;
        const payload = sanitizeCampaignPayload(req.body, { applyDefaultType: false });
        const requestedStatus = String(payload?.status || '').trim().toLowerCase();
        const shouldQueue = campaign.status !== 'active' && requestedStatus === 'active';
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
        let queueResult = { queued: 0, recipients: 0 };

        if (shouldQueue && updatedCampaign) {
            queueResult = await queueCampaignMessages(updatedCampaign, {
                assignedTo: scopedUserId || undefined,
                ownerUserId: ownerScopeUserId || undefined
            });
            updatedCampaign = await attachCampaignSenderAccounts(await Campaign.findById(req.params.id, {
                created_by: scopedUserId || undefined,
                owner_user_id: ownerScopeUserId || undefined
            }));
        }

        res.json({ success: true, campaign: updatedCampaign, queue: queueResult });

    } catch (error) {

        res.status(400).json({ error: error.message });

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

        return res.status(404).json({ error: 'Automação não encontrada' });

    }

    if (!canAccessCreatedRecord(req, automation.created_by)) {
        return res.status(404).json({ error: 'Automação não encontrada' });
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

        return res.status(404).json({ error: 'Automação não encontrada' });

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



app.get('/api/flows', authenticate, async (req, res) => {

    const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
    const flows = await Flow.list({
        ...req.query,
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

        return res.status(404).json({ error: 'Fluxo não encontrado' });

    }

    if (!canAccessCreatedRecord(req, flow.created_by)) {
        return res.status(404).json({ error: 'Fluxo não encontrado' });
    }

    res.json({ success: true, flow });

});



app.post('/api/flows', authenticate, async (req, res) => {

    const payload = {
        ...req.body,
        created_by: req.user?.id
    };
    const result = await Flow.create(payload);

    const flow = await Flow.findById(result.id);

    res.json({ success: true, flow });

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

    await Flow.update(req.params.id, req.body);

    const flow = await Flow.findById(req.params.id, {
        owner_user_id: ownerScopeUserId || undefined
    });

    res.json({ success: true, flow });

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
        const ownerA = a.owner || {};
        const ownerB = b.owner || {};
        return compareByTextAsc(ownerA.name || ownerA.email || String(a.owner_user_id), ownerB.name || ownerB.email || String(b.owner_user_id));
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

        const requesterId = Number(req.user?.id || 0);
        if (requesterId === targetId) {
            return res.status(400).json({
                success: false,
                error: 'Nao e possivel desativar o proprio usuario'
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

        await User.update(targetId, { is_active: 0 });
        markUserPresenceOffline(targetId);
        const updated = await User.findById(targetId);
        return res.json({
            success: true,
            user: sanitizeUserPayload(updated, ownerUserId)
        });
    } catch (error) {
        console.error('[admin/dashboard/users:delete] falha:', error);
        return res.status(500).json({
            success: false,
            error: 'Falha ao desativar usuario'
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

        userPayload.role = 'admin';
        userPayload.owner_user_id = ownerUserId;
        await User.update(ownerUserId, userPayload);
        if (Number(userPayload.is_active) === 0) {
            markUserPresenceOffline(ownerUserId);
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
            account
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

        const requesterOwnerUserId = normalizeOwnerUserId(req.user?.owner_user_id) || Number(req.user?.id || 0);
        if (ownerUserId === requesterOwnerUserId) {
            return res.status(400).json({
                success: false,
                error: 'Nao e possivel desativar a propria conta'
            });
        }

        const users = await User.listByOwner(ownerUserId, { includeInactive: true });
        if (!Array.isArray(users) || users.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Conta nao encontrada'
            });
        }

        let disabledUsers = 0;
        for (const user of users) {
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
        return res.status(500).json({
            success: false,
            error: 'Falha ao desativar conta'
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

app.post('/api/webhook/incoming', async (req, res) => {

    const { event, data, secret } = req.body;

    

    // Validar secret se configurado

    const expectedSecret = process.env.WEBHOOK_SECRET;

    if (expectedSecret && secret !== expectedSecret) {

        return res.status(401).json({ error: 'Unauthorized' });

    }

    

    console.log(`?? Webhook recebido: ${event}`);

    

    // Processar evento

    if (event === 'lead.create' && data) {

        try {

            const result = await Lead.create(data);

            res.json({ success: true, leadId: result.id });

        } catch (error) {

            res.status(400).json({ error: error.message });

        }

    } else {

        res.json({ success: true, received: true });

    }

});



// ============================================

// API DE CONFIGURAÇÕES

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
        planMessage
    ] = await Promise.all([
        Settings.get(keys.planName),
        Settings.get(keys.planCode),
        Settings.get(keys.planStatus),
        Settings.get(keys.planProvider),
        Settings.get(keys.planRenewalDate),
        Settings.get(keys.planLastVerifiedAt),
        Settings.get(keys.planExternalReference),
        Settings.get(keys.planMessage)
    ]);

    const status = planStatusRaw === null || typeof planStatusRaw === 'undefined' || String(planStatusRaw).trim() === ''
        ? 'active'
        : normalizePlanStatusForApi(planStatusRaw);
    const provider = String(planProvider || '').trim() || 'API nao configurada';
    const apiConfigured = provider.toLowerCase() !== 'api nao configurada';

    return {
        name: String(planName || 'Plano de teste'),
        code: String(planCode || ''),
        status,
        status_label: getPlanStatusLabel(status),
        renewal_date: normalizeOptionalIsoDate(planRenewalDate),
        last_verified_at: normalizeOptionalIsoDate(planLastVerifiedAt),
        provider,
        source: 'settings',
        api_configured: apiConfigured,
        external_reference: String(planExternalReference || ''),
        message: String(planMessage || 'A confirmacao automatica do plano via API sera habilitada apos configurar a integracao.')
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

        await Settings.set(
            buildScopedSettingsKey('plan_last_verified_at', ownerScopeUserId),
            nowIso,
            'string'
        );

        // Placeholder para integração externa de validação do plano.
        // Aqui entra a chamada da API de assinatura no próximo passo.
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
        res.status(500).json({ success: false, error: 'Erro ao atualizar status do plano' });
    }
});

app.get('/api/settings', authenticate, async (req, res) => {

    const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
    const settings = normalizeSettingsForResponse(await Settings.getAll(), ownerScopeUserId);

    res.json({ success: true, settings });

});



app.put('/api/settings', authenticate, async (req, res) => {

    const ownerScopeUserId = await resolveRequesterOwnerUserId(req);
    const incomingSettings = req.body && typeof req.body === 'object' ? req.body : {};
    const changedKeys = Object.keys(incomingSettings);

    for (const [key, value] of Object.entries(incomingSettings)) {

        const type = typeof value === 'number' ? 'number' : 

                     typeof value === 'boolean' ? 'boolean' :

                     typeof value === 'object' ? 'json' : 'string';

        await Settings.set(buildScopedSettingsKey(key, ownerScopeUserId), value, type);

    }

    

    // Atualizar serviço de fila se necessário

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
    if (touchedBusinessHours && !ownerScopeUserId) {
        invalidateBusinessHoursSettingsCache();
        if (typeof queueService.invalidateBusinessHoursCache === 'function') {
            queueService.invalidateBusinessHoursCache();
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

            originalname: req.file.originalname,

            mimetype: req.file.mimetype,

            size: req.file.size,

            url: `/uploads/${req.file.filename}`

        }

    });

});



// ============================================

// ROTAS DE PÁGINAS

// ============================================



app.get('/confirm-email', (req, res) => {
    const rawToken = String(req.query?.token || '').trim();
    if (!rawToken) {
        return res.redirect('/#/login?emailConfirmError=token_required');
    }

    return res.redirect(`/#/login?confirmEmailToken=${encodeURIComponent(rawToken)}`);
});



app.get('/', (req, res) => {

    res.setHeader('Cache-Control', 'no-store');

    res.sendFile(path.join(STATIC_DIR, 'app.html'));

});



app.get('*', (req, res) => {

    const requestedFile = path.join(STATIC_DIR, req.path);

    if (fs.existsSync(requestedFile)) {

        res.sendFile(requestedFile);

    } else {

        res.setHeader('Cache-Control', 'no-store');

        res.sendFile(path.join(STATIC_DIR, 'app.html'));

    }

});

// TRATAMENTO DE ERROS

// ============================================



// Middleware de tratamento de erros

app.use((err, req, res, next) => {

    console.error('? Erro:', err);

    

    // Erro de CORS

    if (err.message === 'Não permitido por CORS') {

        return res.status(403).json({ 

            error: 'Origem não permitida',

            code: 'CORS_ERROR'

        });

    }

    

    // Erro de validação

    if (err.name === 'ValidationError') {

        return res.status(400).json({ 

            error: 'Dados inválidos',

            details: err.message,

            code: 'VALIDATION_ERROR'

        });

    }

    

    // Erro genérico

    res.status(err.status || 500).json({ 

        error: process.env.NODE_ENV === 'production' 

            ? 'Erro interno do servidor' 

            : err.message,

        code: err.code || 'INTERNAL_ERROR'

    });

});



// Handler para rotas não encontradas

app.use((req, res) => {

    res.status(404).json({ 

        error: 'Rota não encontrada',

        code: 'NOT_FOUND'

    });

});



process.on('unhandledRejection', (reason, promise) => {

    console.error('? Unhandled Rejection:', reason);

});



process.on('uncaughtException', (error) => {

    console.error('? Uncaught Exception:', error);

    // Em produção, pode querer fazer graceful shutdown

    if (process.env.NODE_ENV === 'production') {

        process.exit(1);

    }

});



// ============================================

// LOG DE INICIALIZAÇÃO

// ============================================



    console.log('');

    console.log('+------------------------------------------------------------+');

    console.log('¦     SELF PROTEÇÃO VEICULAR - SERVIDOR v4.1                 ¦');

    console.log('¦     Sistema de Automação de Mensagens WhatsApp             ¦');

    console.log('¦------------------------------------------------------------¦');

    console.log(`¦  ?? Servidor rodando na porta ${PORT}                          ¦`);

    console.log(`¦  ?? Sessões: ${SESSIONS_DIR.substring(0, 42).padEnd(42)} ¦`);

    console.log(`¦  ?? URL: http://localhost:${PORT}                               ¦`);

    console.log(`¦  ?? Reconexão automática: ${MAX_RECONNECT_ATTEMPTS} tentativas                  ¦`);

    console.log(`¦  ?? Fila de mensagens: Ativa                               ¦`);

    console.log(`¦  ?? Criptografia: Ativa                                    ¦`);

    console.log('+------------------------------------------------------------+');

    console.log('');

    console.log('? Servidor pronto para receber conexões!');

    console.log('');



    // Graceful shutdown (referências em closure)

    process.on('SIGTERM', async () => {

        console.log('??  SIGTERM recebido, encerrando servidor...');

        queueService.stopProcessing();

        for (const [sessionId, session] of sessions.entries()) {

            try { await session.socket.end(); } catch (e) {}

        }

        await closeDatabase();

        server.close(() => { console.log('? Servidor encerrado'); process.exit(0); });

    });



    process.on('SIGINT', async () => {

        console.log('??  SIGINT recebido, encerrando servidor...');

        queueService.stopProcessing();

        await closeDatabase();

        process.exit(0);

    });

};
