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

const { getDatabase, close: closeDatabase, query, run } = require('./database/connection');

const { migrate } = require('./database/migrate');

const { Lead, Conversation, Message, MessageQueue, Template, Campaign, Automation, Flow, Settings, User } = require('./database/models');



// Services

const webhookService = require('./services/webhookService');

const queueService = require('./services/queueService');

const flowService = require('./services/flowService');



// Utils - Fixers (correções automáticas baseadas em análise de projetos GitHub)

const audioFixer = require('./utils/audioFixer');

const connectionFixer = require('./utils/connectionFixer');



// WhatsApp Service (engine Baileys modular)

const whatsappService = require('./services/whatsapp');



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

    message: { error: 'Muitas requisições, tente novamente mais tarde' }

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

    if (path.startsWith('/auth/login') || path.startsWith('/auth/refresh') || path.startsWith('/auth/register')) {

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



function isLidJid(jid) {

    return typeof jid === 'string' && jid.includes('@lid');

}



function isUserJid(jid) {

    return typeof jid === 'string' && jid.includes('@s.whatsapp.net');

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
function normalizeJid(jid) {

    if (!jid) return null;

    if (isLidJid(jid) && jidAliasMap.has(jid)) {

        return jidAliasMap.get(jid);

    }

    return jid;

}



async function registerContactAlias(contact, sessionId = '', sessionPhone = '') {
    if (!contact) return;

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

        if (!lidJid && isLidJid(cand)) lidJid = cand;

        if (isUserJid(cand)) {
            userJids.push(cand);
            if (!userJid) {
                const candidateDigits = normalizePhoneDigits(extractNumber(cand));
                if (!isSelfPhone(candidateDigits, sessionDigits)) {
                    userJid = cand;
                }
            }
        }

    }

    if (notifyName) {
        for (const candidateJid of userJids) {
            const normalizedCandidateJid = normalizeJid(candidateJid) || candidateJid;
            const candidatePhone = extractNumber(normalizedCandidateJid);
            const lead = await Lead.findByJid(normalizedCandidateJid) || await Lead.findByPhone(candidatePhone);
            if (!lead) continue;

            if (shouldAutoUpdateLeadName(lead, lead.phone || candidatePhone, sessionDisplayName)) {
                await Lead.update(lead.id, { name: notifyName });
            }
        }
    }

    if (candidates.length < 2) return;



    if (lidJid && userJid) {

        jidAliasMap.set(lidJid, userJid);



        const primary = await Lead.findByJid(userJid) || await Lead.findByPhone(extractNumber(userJid));

        const duplicate = await Lead.findByJid(lidJid) || await Lead.findByPhone(extractNumber(lidJid));



        if (primary && duplicate && primary.id !== duplicate.id) {

            await mergeLeads(primary, duplicate);

        } else if (!primary && duplicate) {

            await updateLeadIdentity(duplicate, userJid, extractNumber(userJid));

        } else if (primary && primary.jid !== userJid) {

            await updateLeadIdentity(primary, userJid, extractNumber(userJid));

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
        (hasParticipant && remoteJid && !isUserJid(remoteJid))
    );
}

function resolveMessageJid(msg, sessionPhone = '') {
    const content = unwrapMessageContent(msg?.message);
    const candidates = [

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

        if (!lidJid && isLidJid(jid)) lidJid = jid;

        if (isUserJid(jid)) userJids.push(jid);

    }

    const nonSelfUserJid = userJids.find((jid) => {
        const phoneDigits = normalizePhoneDigits(extractNumber(jid));
        return !isSelfPhone(phoneDigits, sessionDigits);
    });

    const preferredUserJid = nonSelfUserJid || userJids[0] || null;

    // NÃ£o mapear LID para o prÃ³prio nÃºmero da sessÃ£o, pois isso causa
    // roteamento incorreto para o chat "VocÃª".
    if (lidJid && nonSelfUserJid) {

        jidAliasMap.set(lidJid, nonSelfUserJid);

    }

    for (const jid of userJids) {
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

    return normalizeJid(msg?.key?.remoteJid);

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

            await run('DELETE FROM leads WHERE id = ?', [lead.id]);

        }

        console.log(`Removidos ${lidLeads.length} leads com @lid`);

    } catch (error) {

        console.warn('Falha ao limpar leads @lid:', error.message);

    }

}



async function cleanupInvalidPhones() {

    try {

        const candidates = await query(

            "SELECT id, jid, phone FROM leads WHERE jid LIKE '%@s.whatsapp.net%'"

        );

        if (!candidates || candidates.length === 0) return;



        for (const lead of candidates) {

            const normalized = normalizePhoneFromJid(lead.jid);

            if (!normalized) continue;

            if (normalized === String(lead.phone || '')) continue;



            const existing = await Lead.findByPhone(normalized);

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

            await run('DELETE FROM leads WHERE id = ?', [lead.id]);

        }

        console.log(`Removidos ${emptyLeads.length} leads WhatsApp sem mensagens`);

    } catch (error) {

        console.warn('Falha ao limpar leads WhatsApp sem mensagens:', error.message);

    }

}





async function cleanupDuplicatePhoneSuffixLeads() {

    try {

        const leads = await query("SELECT id, phone, jid, name, source, custom_fields, last_message_at FROM leads WHERE phone IS NOT NULL");

        if (!leads || leads.length === 0) return;



        const groups = new Map();

        for (const lead of leads) {

            const digits = String(lead.phone || '').replace(/\D/g, '');

            if (digits.length < 11) continue;

            const key = digits.slice(-11);

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

        await run(`

            INSERT INTO whatsapp_sessions (session_id, status, qr_code, last_connected_at, updated_at)

            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)

            ON CONFLICT(session_id) DO UPDATE SET

                status = excluded.status,

                qr_code = excluded.qr_code,

                last_connected_at = excluded.last_connected_at,

                updated_at = CURRENT_TIMESTAMP

        `, [sessionId, status, qr_code, last_connected_at]);

    } catch (error) {

        console.error(`[${sessionId}] Erro ao persistir sessão:`, error.message);

    }

}



async function rehydrateSessions(ioInstance) {

    try {

        const stored = await query(`SELECT session_id FROM whatsapp_sessions`);

        for (const row of stored) {

            const sessionId = row.session_id;

            if (sessionExists(sessionId)) {

                console.log(`[${sessionId}] Reidratando sessão armazenada...`);

                await createSession(sessionId, null);

            } else {

                console.log(`[${sessionId}] Sessão no banco sem arquivos locais, ignorando.`);

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

    const sid = sessionId || 'self_whatsapp_session';

    const session = whatsappService.getSession(sid);

    

    if (!session || !session.isConnected) {

        throw new Error('WhatsApp não está conectado');

    }

    

    const targetJid = jid || formatJid(to);

    let result;

    

    if (mediaType === 'image' && mediaUrl) {

        result = await session.socket.sendMessage(targetJid, {

            image: { url: mediaUrl },

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

    

    return result;

}



/**

 * Criar sessão WhatsApp

 */

async function createSession(sessionId, socket, attempt = 0) {

    const clientSocket = socket || { emit: () => {} };

    if (sessionInitLocks.has(sessionId)) {
        const existingSession = sessions.get(sessionId);
        if (existingSession && socket) {
            existingSession.clientSocket = socket;
        }

        clientSocket.emit('session-status', {
            status: existingSession?.isConnected ? 'connected' : 'reconnecting',
            sessionId,
            user: existingSession?.user || null
        });
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

    

    if (qrTimeouts.has(sessionId)) {

        clearTimeout(qrTimeouts.get(sessionId));

        qrTimeouts.delete(sessionId);

    }

    

    const baileys = await baileysLoader.getBaileys();

        const {

            default: makeWASocket,

            DisconnectReason,

            useMultiFileAuthState,

            fetchLatestBaileysVersion,

            makeCacheableSignalKeyStore,

            makeInMemoryStore,

            delay

        } = baileys;

    

    try {

        console.log(`[${sessionId}] Criando sessão... (Tentativa ${attempt + 1}/${MAX_RECONNECT_ATTEMPTS})`);

        persistWhatsappSession(sessionId, 'connecting');

        

        // Validar e corrigir sessão se necessário

        const sessionValidation = await connectionFixer.validateSession(sessionPath);

        if (!sessionValidation.valid && attempt === 0) {

            console.log(`[${sessionId}] Problemas na sessão detectados, corrigindo...`);

            await connectionFixer.fixSession(sessionPath);

        }

        

        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

        const { version } = await fetchLatestBaileysVersion();

        

        console.log(`[${sessionId}] Usando Baileys versão: ${version.join('.')}`);

        

        const syncFullHistory = process.env.WHATSAPP_SYNC_FULL_HISTORY !== 'false';

        const store = typeof makeInMemoryStore === 'function' ? makeInMemoryStore({ logger }) : null;



        const sock = makeWASocket({

            version,

            logger,

// printQRInTerminal: true, // Depreciado no Baileys

            auth: {

                creds: state.creds,

                keys: makeCacheableSignalKeyStore(state.keys, logger)

            },

            browser: ['SELF Proteção Veicular', 'Chrome', '120.0.0'],

            generateHighQualityLinkPreview: true,

            syncFullHistory,

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



        if (store) {

            store.bind(sock.ev);

        }

        

        sessions.set(sessionId, {

            socket: sock,

            clientSocket,

            isConnected: false,

            user: null,

            reconnecting: false,

            qrGenerated: false

        });

        

        reconnectAttempts.set(sessionId, 0);

        

        // Eventos de conexão

        sock.ev.on('connection.update', async (update) => {

            const { connection, lastDisconnect, qr } = update;

            const session = sessions.get(sessionId);

            

            if (qr) {

                try {

                    const qrDataUrl = await qrcode.toDataURL(qr, {

                        width: 300,

                        margin: 2,

                        color: { dark: '#000000', light: '#ffffff' }

                    });

                    

                    if (session) session.qrGenerated = true;

                    

                    clientSocket.emit('qr', { qr: qrDataUrl, sessionId, expiresIn: 30 });

                    io.emit('whatsapp-qr', { qr: qrDataUrl, sessionId });

                    

                    // Webhook

                    webhookService.trigger('whatsapp.qr_generated', { sessionId });

                    persistWhatsappSession(sessionId, 'qr_pending', { qr_code: qrDataUrl });

                    

                    console.log(`[${sessionId}] ? QR Code gerado`);

                    

                    const timeout = setTimeout(() => {

                        const currentSession = sessions.get(sessionId);

                        if (currentSession && !currentSession.isConnected) {

                            clientSocket.emit('qr-expired', { sessionId });

                        }

                    }, QR_TIMEOUT);

                    

                    qrTimeouts.set(sessionId, timeout);

                    

                } catch (qrError) {

                    console.error(`[${sessionId}] ? Erro ao gerar QR:`, qrError.message);

                    clientSocket.emit('error', { message: 'Erro ao gerar QR Code' });

                }

            }

            

            if (connection === 'close') {

                if (qrTimeouts.has(sessionId)) {

                    clearTimeout(qrTimeouts.get(sessionId));

                    qrTimeouts.delete(sessionId);

                }

                

                const statusCode = lastDisconnect?.error?.output?.statusCode;

                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                

                console.log(`[${sessionId}] Conexão fechada. Status: ${statusCode}`);

                persistWhatsappSession(sessionId, 'disconnected');

                

                // Detectar tipo de erro e aplicar correção

                const errorInfo = connectionFixer.detectDisconnectReason(lastDisconnect?.error);

                console.log(`[${sessionId}] Tipo de erro: ${errorInfo.type}, Ação: ${errorInfo.action}`);

                

                // Aplicar correção se necessário

                if (errorInfo.action === 'clean_session' || errorInfo.action === 'regenerate_keys') {

                    await connectionFixer.applyFixAction(sessionPath, errorInfo.action);

                }

                

                // Webhook

                webhookService.trigger('whatsapp.disconnected', { sessionId, statusCode, errorType: errorInfo.type });

                

                if (shouldReconnect) {

                    const currentAttempt = reconnectAttempts.get(sessionId) || 0;

                    

                    if (currentAttempt < MAX_RECONNECT_ATTEMPTS) {

                        reconnectAttempts.set(sessionId, currentAttempt + 1);

                        

                        if (session) {

                            session.reconnecting = true;

                            session.isConnected = false;

                        }

                        

                        clientSocket.emit('reconnecting', { sessionId, attempt: currentAttempt + 1 });

                        io.emit('whatsapp-status', { sessionId, status: 'reconnecting' });

                        

                        await delay(RECONNECT_DELAY);

                        await createSession(sessionId, clientSocket, currentAttempt + 1);

                    } else {

                        sessions.delete(sessionId);

                        reconnectAttempts.delete(sessionId);

                        clientSocket.emit('reconnect-failed', { sessionId });

                    }

                } else {

                    sessions.delete(sessionId);

                    reconnectAttempts.delete(sessionId);

                    clientSocket.emit('disconnected', { sessionId, reason: 'logged_out' });

                    persistWhatsappSession(sessionId, 'disconnected');

                    

                    if (fs.existsSync(sessionPath)) {

                        fs.rmSync(sessionPath, { recursive: true, force: true });

                    }

                }

            }

            

            if (connection === 'connecting') {

                clientSocket.emit('connecting', { sessionId });

                io.emit('whatsapp-status', { sessionId, status: 'connecting' });

            }

            

            if (connection === 'open') {

                if (qrTimeouts.has(sessionId)) {

                    clearTimeout(qrTimeouts.get(sessionId));

                    qrTimeouts.delete(sessionId);

                }

                

                if (session) {

                    session.isConnected = true;

                    session.reconnecting = false;

                    session.user = {

                        id: sock.user?.id,

                        name: sock.user?.name || 'Usuário',

                        pushName: sock.user?.verifiedName || sock.user?.name,

                        phone: extractNumber(sock.user?.id)

                    };

                    

                    reconnectAttempts.set(sessionId, 0);

                    

                    clientSocket.emit('connected', { sessionId, user: session.user });

                    io.emit('whatsapp-status', { sessionId, status: 'connected', user: session.user });

                    persistWhatsappSession(sessionId, 'connected', { last_connected_at: new Date().toISOString() });

                    

                    // Webhook

                    webhookService.trigger('whatsapp.connected', { sessionId, user: session.user });

                    

                    console.log(`[${sessionId}] ? WhatsApp conectado: ${session.user.name}`);



                    // Forçar sincronização inicial de chats

                    setTimeout(() => {

                        triggerChatSync(sessionId, sock, store);

                    }, 1500);

                    

                    // Criar monitor de saúde da conexão

                    const healthMonitor = connectionFixer.createHealthMonitor(sock, sessionId);

                    session.healthMonitor = healthMonitor;

                }

            }

        });

        

        sock.ev.on('creds.update', saveCreds);

        

        // Receber mensagens

        sock.ev.on('messages.upsert', async ({ messages, type }) => {

            if (type === 'notify' || type === 'append') {

                for (const msg of messages) {

                    if (isGroupMessage(msg)) continue;

                    await processIncomingMessage(sessionId, msg);

                }

            }

        });

        

        // Status de mensagens

        sock.ev.on('messages.update', async (updates) => {

            for (const update of updates) {

                if (update.update.status) {

                    const statusMap = { 1: 'pending', 2: 'sent', 3: 'delivered', 4: 'read' };

                    const status = statusMap[update.update.status] || 'pending';

                    

                    // Atualizar no banco

                    await Message.updateStatus(update.key.id, status, new Date().toISOString());

                    const trackedMessage = await Message.findByMessageId(update.key.id);
                    if (trackedMessage?.campaign_id) {
                        await Campaign.refreshMetrics(trackedMessage.campaign_id);
                    }

                    

                    io.emit('message-status', {

                        sessionId,

                        messageId: update.key.id,

                        remoteJid: update.key.remoteJid,

                        status

                    });

                    

                    // Webhook

                    if (status === 'delivered') {

                        webhookService.trigger('message.delivered', { messageId: update.key.id, status });

                    } else if (status === 'read') {

                        webhookService.trigger('message.read', { messageId: update.key.id, status });

                    }

                }

            }

        });



        sock.ev.on('contacts.set', async (payload) => {

            const contacts = payload?.contacts || [];
            const sessionPhone = getSessionPhone(sessionId);

            for (const contact of contacts) {

                await registerContactAlias(contact, sessionId, sessionPhone);

            }

        });



        sock.ev.on('contacts.upsert', async (contacts) => {

            const list = Array.isArray(contacts) ? contacts : [contacts];
            const sessionPhone = getSessionPhone(sessionId);

            for (const contact of list) {

                await registerContactAlias(contact, sessionId, sessionPhone);

            }

        });



        // Sincronizar lista de chats/contatos

        sock.ev.on('chats.set', async (payload) => {

            try {

                await syncChatsToDatabase(sessionId, payload);

            } catch (error) {

                console.error(`[${sessionId}] ? Erro ao sincronizar chats:`, error.message);

            }

        });



        sock.ev.on('chats.upsert', async (payload) => {

            try {

                await syncChatsToDatabase(sessionId, payload);

            } catch (error) {

                console.error(`[${sessionId}] ? Erro ao sincronizar chats:`, error.message);

            }

        });



        sock.ev.on('chats.update', async (payload) => {

            try {

                await syncChatsToDatabase(sessionId, payload);

            } catch (error) {

                console.error(`[${sessionId}] ? Erro ao sincronizar chats:`, error.message);

            }

        });

        

        // Presença (digitando)

        sock.ev.on('presence.update', (presence) => {

            const jid = presence.id;

            const isTyping = presence.presences?.[jid]?.lastKnownPresence === 'composing';

            

            typingStatus.set(jid, isTyping);

            

            io.emit('typing-status', {

                sessionId,

                jid,

                isTyping,

                name: presence.presences?.[jid]?.name

            });

        });

        

        sock.ev.on('error', (error) => {

            console.error(`[${sessionId}] ? Erro:`, error.message);

            clientSocket.emit('error', { message: error.message });

        });

        

        return sock;

        

    } catch (error) {

        console.error(`[${sessionId}] ? Erro ao criar sessão:`, error.message);

        

        const currentAttempt = reconnectAttempts.get(sessionId) || 0;

        if (currentAttempt < MAX_RECONNECT_ATTEMPTS) {

            reconnectAttempts.set(sessionId, currentAttempt + 1);

            await baileys.delay(RECONNECT_DELAY);
            releaseSessionLock();
            return await createSession(sessionId, clientSocket, currentAttempt + 1);

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

        .split(',')

        .map((keyword) => normalizeAutomationText(keyword))

        .filter(Boolean);

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



function shouldTriggerAutomation(automation, context, normalizedText) {

    const triggerType = automation?.trigger_type;



    if (triggerType === 'keyword') {

        if (!normalizedText) return false;

        const keywords = extractAutomationKeywords(automation.trigger_value || '');

        if (keywords.length === 0) return false;

        return keywords.some((keyword) => normalizedText.includes(keyword));

    }



    if (triggerType === 'message_received') {

        return true;

    }



    if (triggerType === 'new_lead') {

        return !!context?.leadCreated;

    }



    return false;

}



async function executeAutomationAction(automation, context) {

    const { lead, conversation, sessionId, text } = context || {};



    if (!automation || !lead) return;



    const variables = buildAutomationVariables(lead, text);

    const actionType = automation.action_type;

    const actionValue = automation.action_value || '';



    switch (actionType) {

        case 'send_message': {

            const content = applyAutomationTemplate(actionValue, variables).trim();

            if (!content) return;

            await sendMessage(sessionId, lead.phone, content, 'text');

            break;

        }

        case 'change_status': {

            const nextStatus = parseInt(actionValue, 10);

            if (!Number.isFinite(nextStatus)) return;

            await Lead.update(lead.id, { status: nextStatus });

            break;

        }

        case 'add_tag': {

            const tag = String(actionValue || '').trim();

            if (!tag) return;

            let tags = [];

            try {

                tags = Array.isArray(lead.tags) ? lead.tags : JSON.parse(lead.tags || '[]');

            } catch (e) {

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

            if (conversation && conversation.is_bot_active) {

                await flowService.startFlow(flow, lead, conversation, { text });

            }

            break;

        }

        case 'notify': {

            const message = applyAutomationTemplate(actionValue, variables).trim();

            webhookService.trigger('automation.notify', {

                automationId: automation.id,

                message,

                lead: { id: lead.id, name: lead.name, phone: lead.phone }

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

    const automations = await Automation.list({ is_active: 1 });

    if (!automations || automations.length === 0) return;



    const normalizedText = normalizeAutomationText(context?.text || '');



    for (const automation of automations) {

        if (!shouldTriggerAutomation(automation, context, normalizedText)) continue;



        const delaySeconds = Number(automation.delay || 0);

        const delayMs = Number.isFinite(delaySeconds) && delaySeconds > 0 ? delaySeconds * 1000 : 0;



        if (delayMs > 0) {

            setTimeout(() => {

                executeAutomationAction(automation, context).catch((error) => {

                    console.error(`? Erro ao executar automação ${automation.id}:`, error.message);

                });

            }, delayMs);

        } else {

            executeAutomationAction(automation, context).catch((error) => {

                console.error(`? Erro ao executar automação ${automation.id}:`, error.message);

            });

        }

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



    for (const chat of chats) {

        const rawJid = chat?.id || chat?.jid;

        const jid = normalizeJid(rawJid);

        if (!jid || !isUserJid(jid)) continue;



        if (!chat?.lastMessage) continue;



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



        let lead = await Lead.findByJid(jid) || await Lead.findByPhone(phone);

        const rawPhoneDigits = normalizePhoneDigits(extractNumber(rawJid));
        const isRawSelfChat = isSelfPhone(rawPhoneDigits, sessionDigits);

        if (rawJid && rawJid !== jid && !isSelfChat && !isRawSelfChat) {

            const aliasLead = await Lead.findByJid(rawJid) || await Lead.findByPhone(extractNumber(rawJid));

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

                source: 'whatsapp'

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

            session_id: sessionId

        });

        const conversation = convResult.conversation;



        const updates = {};

        if (typeof chat.unreadCount === 'number') {

            updates.unread_count = chat.unreadCount;

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



/**

 * Processar mensagem recebida

 */

async function processIncomingMessage(sessionId, msg) {

    if (isGroupMessage(msg)) return;
    if (!msg?.message) return;
    const sessionDisplayName = getSessionDisplayName(sessionId);
    const sessionPhone = getSessionPhone(sessionId);

    const fromRaw = msg.key.remoteJid;
    const isFromMe = msg.key.fromMe;
    const sessionDigits = normalizePhoneDigits(sessionPhone);

    let from = resolveMessageJid(msg, sessionPhone);
    const contentForRouting = unwrapMessageContent(msg.message);

    const fromRawDigits = normalizePhoneDigits(extractNumber(fromRaw));
    const isFromRawUser = isUserJid(fromRaw);
    const isFromRawSelf = isSelfPhone(fromRawDigits, sessionDigits);

    // Em mensagens recebidas, quando o remoteJid jÃ¡ vem como usuÃ¡rio vÃ¡lido
    // (e nÃ£o Ã© self), ele Ã© a melhor fonte para evitar roteamento incorreto.
    if (!isFromMe && isFromRawUser && !isFromRawSelf) {
        from = fromRaw;
    }

    // Em mensagens enviadas pelo proprio celular, prioriza o destino explicito.
    if (isFromMe) {
        const outgoingCandidates = [
            msg?.message?.deviceSentMessage?.destinationJid,
            msg?.key?.remoteJid,
            msg?.key?.participant,
            msg?.participant,
            msg?.message?.extendedTextMessage?.contextInfo?.participant,
            contentForRouting?.extendedTextMessage?.contextInfo?.participant
        ].filter(Boolean);

        const outgoingTarget = outgoingCandidates.find((candidate) => {
            if (!isUserJid(candidate)) return false;
            const candidateDigits = normalizePhoneDigits(extractNumber(candidate));
            return !isSelfPhone(candidateDigits, sessionDigits);
        });

        if (outgoingTarget) {
            from = normalizeJid(outgoingTarget) || outgoingTarget;
        }
    }

    if (!from || !isUserJid(from)) return;

    let resolvedDigits = normalizePhoneDigits(extractNumber(from));
    let isFromResolvedSelf = isSelfPhone(resolvedDigits, sessionDigits);

    if (isFromResolvedSelf) {
        const fallbackCandidates = [
            msg?.message?.deviceSentMessage?.destinationJid,
            msg?.key?.remoteJid,
            msg?.key?.participant,
            msg?.participant,
            msg?.message?.extendedTextMessage?.contextInfo?.participant,
            contentForRouting?.extendedTextMessage?.contextInfo?.participant
        ].filter(Boolean);

        const fallbackJid = fallbackCandidates.find((candidate) => {
            if (!isUserJid(candidate)) return false;
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

    // Ignora upserts de controle/protocolo sem conteudo renderizavel.
    if (!text && mediaType === 'text') return;

    if (!text && mediaType !== 'text') {
        text = previewForMedia(mediaType);
    }
    text = normalizeText(text);
    const pushName = normalizeText(msg.pushName || '');

    

    if (fromRaw && from && fromRaw !== from && !isFromRawSelf && !isFromResolvedSelf) {

        const resolvedPhone = isUserJid(from) ? extractNumber(from) : null;

        const primary = await Lead.findByJid(from) || (resolvedPhone ? await Lead.findByPhone(resolvedPhone) : null);

        const duplicate = await Lead.findByJid(fromRaw) || await Lead.findByPhone(extractNumber(fromRaw));

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

        source: 'whatsapp'

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

    

    // Buscar ou criar conversa

    const { conversation, created: convCreated } = await Conversation.findOrCreate({

        lead_id: lead.id,

        session_id: sessionId

    });



    const existingMessage = await Message.findByMessageId(msg.key.id);

    if (existingMessage) {

        return;

    }

    

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

        status: normalizedStatus,

        is_from_me: isFromMe,

        sent_at: msg.messageTimestamp ? new Date(Number(msg.messageTimestamp) * 1000).toISOString() : new Date().toISOString()

    };

    

    const savedMessage = await Message.create(messageData);

    const messageTimestampIso = messageData.sent_at || new Date().toISOString();

    // Atualizar conversa

    if (!isFromMe) {

        await Conversation.incrementUnread(conversation.id);

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

        timestamp: msg.messageTimestamp ? Number(msg.messageTimestamp) * 1000 : Date.now(),

        pushName: msg.pushName || '',

        status: normalizedStatus,

        leadId: lead.id,

        leadName: lead.name,

        conversationId: conversation.id

    };

    

    const session = sessions.get(sessionId);

    if (session?.clientSocket) {

        session.clientSocket.emit('message', messageForClient);

    }

    

    io.emit('new-message', messageForClient);

    

    // Webhook

    if (!isFromMe) {

        webhookService.trigger('message.received', {

            message: messageForClient,

            lead: { id: lead.id, name: lead.name, phone: lead.phone }

        });

        

        console.log(`[${sessionId}] ?? Mensagem de ${lead.name || phone}: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);

        

        // Processar fluxo de automação

        if (conversation.is_bot_active) {

            conversation.created = convCreated;

            await flowService.processIncomingMessage(

                { text, mediaType },

                lead,

                conversation

            );

        }



        await scheduleAutomations({

            sessionId,

            text,

            mediaType,

            lead,

            conversation,

            leadCreated,

            conversationCreated: convCreated

        });

        if (!isSelfChat) {
            await triggerCampaignsForIncomingLead({
                lead,
                conversation
            });
        }

    }

}



/**

 * Enviar mensagem

 */

async function sendMessage(sessionId, to, message, type = 'text', options = {}) {

    const session = sessions.get(sessionId);

    

    if (!session || !session.isConnected) {

        throw new Error('Sessão não está conectada');

    }

    

    const jid = formatJid(to);

    const normalizedPhone = extractNumber(jid);

    

    // Buscar ou criar lead

    const { lead } = await Lead.findOrCreate({

        phone: normalizedPhone,

        jid,

        source: 'manual'

    });

    

    // Buscar ou criar conversa
    let conversation = null;

    if (options.conversationId) {
        const existingConversation = await Conversation.findById(options.conversationId);
        if (existingConversation && Number(existingConversation.lead_id) === Number(lead.id)) {
            conversation = existingConversation;
        }
    }

    if (!conversation) {
        const conversationResult = await Conversation.findOrCreate({
            lead_id: lead.id,
            session_id: sessionId
        });
        conversation = conversationResult.conversation;
    }

    

    let result;

    

    if (type === 'text') {

        result = await session.socket.sendMessage(jid, { text: message });

    } else if (type === 'image') {

        result = await session.socket.sendMessage(jid, {

            image: { url: options.url || message },

            caption: options.caption || ''

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

            mimetype: 'audio/mp4',

            ptt: true

        });

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



    // Salvar mensagem

    let savedMessage;

    try {

        savedMessage = await Message.create({

            message_id: messageId,

            conversation_id: conversation.id,

            lead_id: lead.id,

            sender_type: 'agent',

            content: type === 'text' ? message : (options.caption || ''),

            content_encrypted: encryptMessage(type === 'text' ? message : (options.caption || '')),

            media_type: type,

            media_url: type !== 'text' ? (options.url || message) : null,

            status: 'sent',

            is_from_me: true,

            sent_at: new Date().toISOString(),
            campaign_id: options.campaignId || null

        });

    } catch (error) {

        if (String(error.message || '').includes('UNIQUE')) {

            savedMessage = await Message.findByMessageId(messageId);

        } else {

            throw error;

        }

    }

    

    await Conversation.touch(conversation.id, savedMessage?.id || null, new Date().toISOString());
    if (options.campaignId) {
        await Campaign.refreshMetrics(options.campaignId);
    }

    // Webhook

    webhookService.trigger('message.sent', {

        messageId,

        to,

        content: message,

        type

    });

    

    console.log(`[${sessionId}] ? Mensagem enviada para ${to}`);

    

    return { ...result, savedMessage, lead, conversation };

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
        const sid = options.sessionId || 'self_whatsapp_session';
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
    });

    flowService.init(async (options) => {
        return await sendMessageToWhatsApp({
            ...options,
            sessionId: 'self_whatsapp_session'
        });
    });

    await rehydrateSessions(io);
})().catch((error) => {
    console.error('Erro ao inicializar servicos apos migracao:', error.message);
});



// ============================================

// SOCKET.IO EVENTOS

// ============================================



io.on('connection', (socket) => {

    console.log('?? Cliente conectado:', socket.id);

    

    socket.on('check-session', async ({ sessionId }) => {

        const session = sessions.get(sessionId);

        
        if (session) {
            session.clientSocket = socket;
            socket.emit('session-status', {
                status: session.isConnected ? 'connected' : 'reconnecting',
                sessionId,
                user: session.user
            });
            return;
        }

        if (sessionExists(sessionId)) {
            socket.emit('session-status', { status: 'reconnecting', sessionId });
            await createSession(sessionId, socket);
            return;
        }

        socket.emit('session-status', { status: 'disconnected', sessionId });

    });

    

    socket.on('start-session', async ({ sessionId }) => {

        const existingSession = sessions.get(sessionId);

        if (existingSession) {
            existingSession.clientSocket = socket;
            socket.emit('session-status', {
                status: existingSession.isConnected ? 'connected' : 'reconnecting',
                sessionId,
                user: existingSession.user
            });
            if (!existingSession.isConnected && !existingSession.reconnecting && !sessionInitLocks.has(sessionId)) {
                await createSession(sessionId, socket);
            }
            return;
        }

        await createSession(sessionId, socket);

    });

    

    socket.on('send-message', async ({ sessionId, to, message, type, options }) => {

        try {

            const result = await sendMessage(sessionId, to, message, type, options);

            socket.emit('message-sent', {

                sessionId,

                to,

                message,

                messageId: result.key.id,

                timestamp: Date.now()

            });

        } catch (error) {

            socket.emit('error', { message: error.message, code: 'SEND_ERROR' });

        }

    });

    

    socket.on('get-messages', async ({ sessionId, contactJid, leadId }) => {
        let messages = [];

        if (leadId) {
            messages = await Message.listByLead(leadId, { limit: 100 });
        } else if (contactJid) {
            const lead = await Lead.findByJid(contactJid);
            if (lead) {
                messages = await Message.listByLead(lead.id, { limit: 100 });
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

        socket.emit('messages-list', { sessionId, contactJid, leadId, messages });
    });

    

    socket.on('get-contacts', async ({ sessionId }) => {
        const leads = await Lead.list({ limit: 200 });
        const sessionPhone = getSessionPhone(sessionId);
        const sessionDisplayName = normalizeText(getSessionDisplayName(sessionId) || 'Usuário');

        const contacts = (await Promise.all(leads.map(async (lead) => {
            const lastMsg = await Message.getLastByLead(lead.id);
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

        socket.emit('contacts-list', { sessionId, contacts });
    });

    

    socket.on('get-leads', async (options = {}) => {

        const leads = await Lead.list(options);

        const total = await Lead.count(options);

        socket.emit('leads-list', { leads, total });

    });

    

    socket.on('mark-read', async ({ sessionId, contactJid, conversationId }) => {

        if (conversationId) {

            await Conversation.markAsRead(conversationId);

        } else if (contactJid) {

            const lead = await Lead.findByJid(contactJid);

            if (lead) {

                const conv = await Conversation.findByLeadId(lead.id);

                if (conv) await Conversation.markAsRead(conv.id);

            }

        }

    });

    

    socket.on('get-templates', async () => {

        const templates = await Template.list();

        socket.emit('templates-list', { templates });

    });

    

    socket.on('get-flows', async () => {

        const flows = await Flow.list();

        socket.emit('flows-list', { flows });

    });

    

    socket.on('toggle-bot', async ({ conversationId, active }) => {

        await Conversation.update(conversationId, { is_bot_active: active ? 1 : 0 });

        socket.emit('bot-toggled', { conversationId, active });

    });

    

    socket.on('assign-conversation', async ({ conversationId, userId }) => {

        await Conversation.update(conversationId, { assigned_to: userId });

        socket.emit('conversation-assigned', { conversationId, userId });

        

        webhookService.trigger('conversation.assigned', { conversationId, userId });

    });

    

    socket.on('logout', async ({ sessionId }) => {

        const session = sessions.get(sessionId);

        

        if (qrTimeouts.has(sessionId)) {

            clearTimeout(qrTimeouts.get(sessionId));

            qrTimeouts.delete(sessionId);

        }

        

        if (session) {

            try {

                await session.socket.logout();

            } catch (e) {}

            

            sessions.delete(sessionId);

            reconnectAttempts.delete(sessionId);

            

            const sessionPath = path.join(SESSIONS_DIR, sessionId);

            if (fs.existsSync(sessionPath)) {

                fs.rmSync(sessionPath, { recursive: true, force: true });

            }

        }

        

        socket.emit('disconnected', { sessionId });

        io.emit('whatsapp-status', { sessionId, status: 'disconnected' });

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

    const sessionId = 'self_whatsapp_session';

    const session = sessions.get(sessionId);

    const connected = !!(session && session.isConnected);

    let phone = null;

    if (session && session.user && session.user.id) {

        const jid = String(session.user.id);

        phone = '+' + jid.replace(/@s\.whatsapp\.net|@c\.us/g, '').trim();

    }

    res.json({ connected, phone });

});



app.post('/api/whatsapp/disconnect', authenticate, async (req, res) => {

    try {

        const sessionId = 'self_whatsapp_session';

        await whatsappService.logoutSession(sessionId, SESSIONS_DIR);

        io.emit('whatsapp-status', { sessionId, status: 'disconnected' });

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

        

        await User.updateLastLogin(user.id);

        

        const token = generateToken(user);

        const refreshToken = generateRefreshToken(user);

        

        res.json({

            success: true,

            token,

            refreshToken,

            user: {

                id: user.id,

                uuid: user.uuid,

                name: user.name,

                email: user.email,

                role: user.role

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

            return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });

        }



        if (String(password).length < 6) {

            return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres' });

        }



        const { User } = require('./database/models');

        const { generateToken, generateRefreshToken, hashPassword } = require('./middleware/auth');



        const normalizedEmail = String(email || '').trim().toLowerCase();

        const existing = await User.findByEmail(normalizedEmail);

        if (existing) {

            return res.status(409).json({ error: 'Email já cadastrado' });

        }



        await User.create({

            name: String(name || '').trim(),

            email: normalizedEmail,

            password_hash: hashPassword(String(password)),

            role: 'agent'

        });



        const user = await User.findByEmail(normalizedEmail);

        if (!user) {

            return res.status(500).json({ error: 'Falha ao criar usuário' });

        }



        const token = generateToken(user);

        const refreshToken = generateRefreshToken(user);



        res.json({

            success: true,

            token,

            refreshToken,

            user: {

                id: user.id,

                uuid: user.uuid,

                name: user.name,

                email: user.email,

                role: user.role

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

        

        const token = generateToken(user);

        

        res.json({ success: true, token });

    } catch (error) {

        res.status(500).json({ error: error.message });

    }

});



// ============================================

// API DE LEADS

// ============================================



app.get('/api/leads', optionalAuth, async (req, res) => {

    const { status, search, limit, offset } = req.query;

    const leads = await Lead.list({ 

        status: status ? parseInt(status) : undefined,

        search,

        limit: limit ? parseInt(limit) : 50,

        offset: offset ? parseInt(offset) : 0

    });

    const total = await Lead.count({ status: status ? parseInt(status) : undefined });

    

    res.json({ success: true, leads, total });

});



app.get('/api/leads/:id', optionalAuth, async (req, res) => {

    const lead = await Lead.findById(req.params.id);

    if (!lead) {

        return res.status(404).json({ error: 'Lead não encontrado' });

    }

    res.json({ success: true, lead });

});



app.post('/api/leads', authenticate, async (req, res) => {

    try {

        const result = await Lead.create(req.body);

        const lead = await Lead.findById(result.id);

        

        webhookService.trigger('lead.created', { lead });

        

        res.json({ success: true, lead });

    } catch (error) {

        res.status(400).json({ error: error.message });

    }

});



app.put('/api/leads/:id', authenticate, async (req, res) => {

    const lead = await Lead.findById(req.params.id);

    if (!lead) {

        return res.status(404).json({ error: 'Lead não encontrado' });

    }

    

    const oldStatus = lead.status;
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

    

    webhookService.trigger('lead.updated', { lead: updatedLead });

    

    if (updateData.status && updateData.status !== oldStatus) {

        webhookService.trigger('lead.status_changed', { 

            lead: updatedLead, 

            oldStatus, 

            newStatus: updateData.status 

        });

    }

    

    res.json({ success: true, lead: updatedLead });

});



app.delete('/api/leads/:id', authenticate, async (req, res) => {

    await Lead.delete(req.params.id);

    res.json({ success: true });

});



// ============================================

// API DE MENSAGENS

// ============================================



app.get('/api/conversations', optionalAuth, async (req, res) => {
    const { status, assigned_to, session_id, limit, offset } = req.query;
    const conversations = await Conversation.list({
        status,
        assigned_to: assigned_to ? parseInt(assigned_to) : undefined,
        session_id,
        limit: limit ? parseInt(limit) : 100,
        offset: offset ? parseInt(offset) : 0
    });

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

    const normalized = (await Promise.all(conversations.map(async (c) => {
        const lastMessage = await Message.getLastMessage(c.id);
        const decrypted = lastMessage?.content_encrypted
            ? decryptMessage(lastMessage.content_encrypted)
            : lastMessage?.content;

        const lastMessageText =
            (decrypted || '').trim() ||
            (lastMessage ? previewForMedia(lastMessage.media_type) : '');

        const lastMessageAt =
            lastMessage?.sent_at ||
            lastMessage?.created_at ||
            null;

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
            phone: c.phone
        };
    }))).filter((conv) => {
        if (!conv.lastMessageAt && !conv.lastMessage) {
            return false;
        }
        return true;
    });

    const deduped = new Map();
    for (const conv of normalized) {
        const phoneKey = normalizePhoneSuffix(conv.phone);
        const key = phoneKey || String(conv.lead_id || conv.id);
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

    if (!conversationId) {

        return res.status(400).json({ error: 'ID de conversa invalido' });

    }

    try {

        await Conversation.markAsRead(conversationId);

        res.json({ success: true });

    } catch (error) {

        res.status(500).json({ error: error.message });

    }

});

app.post('/api/send', authenticate, async (req, res) => {

    const { sessionId, to, message, type, options } = req.body;

    

    if (!sessionId || !to || !message) {

        return res.status(400).json({ error: 'Parâmetros obrigatórios: sessionId, to, message' });

    }

    

    try {

        const result = await sendMessage(sessionId, to, message, type || 'text', options);

        res.json({ 

            success: true, 

            messageId: result.key.id,

            timestamp: new Date().toISOString()

        });

    } catch (error) {

        res.status(500).json({ error: error.message });

    }

});



app.post('/api/messages/send', authenticate, async (req, res) => {

    const { leadId, phone, content, type, options } = req.body;



    let to = phone;

    if (!to && leadId) {

        const lead = await Lead.findById(leadId);

        to = lead?.phone;

    }



    if (!to || !content) {

        return res.status(400).json({ error: 'Parâmetros obrigatórios: phone/to e content' });

    }



    try {

        const result = await sendMessage('self_whatsapp_session', to, content, type || 'text', options || {});

        res.json({

            success: true,

            messageId: result.key.id,

            timestamp: new Date().toISOString()

        });

    } catch (error) {

        res.status(500).json({ error: error.message });

    }

});



app.get('/api/messages/:leadId', authenticate, async (req, res) => {
    const messages = await Message.listByLead(req.params.leadId, { 
        limit: parseInt(req.query.limit) || 100 
    });

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



// ============================================

// API DE FILA

// ============================================



app.get('/api/queue/status', authenticate, async (req, res) => {

    res.json({ success: true, ...(await queueService.getStatus()) });

});



app.post('/api/queue/add', authenticate, async (req, res) => {

    const { leadId, conversationId, campaignId, content, mediaType, mediaUrl, priority, scheduledAt } = req.body;

    

    const result = await queueService.add({

        leadId,

        conversationId,

        campaignId,

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

    

    const results = await queueService.addBulk(leadIds, content, options);

    

    res.json({ success: true, queued: results.length });

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



app.get('/api/templates', optionalAuth, async (req, res) => {

    const templates = await Template.list(req.query);

    res.json({ success: true, templates });

});



app.post('/api/templates', authenticate, async (req, res) => {

    const result = await Template.create(req.body);

    const template = await Template.findById(result.id);

    res.json({ success: true, template });

});



app.put('/api/templates/:id', authenticate, async (req, res) => {

    await Template.update(req.params.id, req.body);

    const template = await Template.findById(req.params.id);

    res.json({ success: true, template });

});



app.delete('/api/templates/:id', authenticate, async (req, res) => {

    await Template.delete(req.params.id);

    res.json({ success: true });

});



// ============================================

// API DE CAMPANHAS

// ============================================




function sanitizeCampaignPayload(input = {}) {

    const payload = { ...input };


    if (payload.start_at === '') {

        payload.start_at = null;

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
        const normalizedTagFilter = String(payload.tag_filter || '').trim();
        payload.tag_filter = normalizedTagFilter || null;
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

function normalizeCampaignTag(value) {
    return String(value || '').trim().toLowerCase();
}

function leadMatchesCampaignTag(lead, tagFilter = '') {
    const normalizedTagFilter = normalizeCampaignTag(tagFilter);
    if (!normalizedTagFilter) return true;

    const leadTags = parseLeadTags(lead?.tags);
    return leadTags.some((tag) => normalizeCampaignTag(tag) === normalizedTagFilter);
}

async function resolveCampaignLeadIds(options = {}) {

    const segment = typeof options === 'string' ? options : options.segment;
    const tagFilter = typeof options === 'string' ? '' : options.tagFilter;

    const normalizedSegment = String(segment || 'all').toLowerCase();

    let sql = 'SELECT id, tags FROM leads WHERE is_blocked = 0';

    const params = [];


    if (normalizedSegment === 'new') {

        sql += ' AND status = ?';

        params.push(1);

    } else if (normalizedSegment === 'progress') {

        sql += ' AND status = ?';

        params.push(2);

    } else if (normalizedSegment === 'concluded') {

        sql += ' AND status = ?';

        params.push(3);

    }


    sql += ' ORDER BY updated_at DESC';


    const rows = await query(sql, params);

    return rows
        .filter((row) => leadMatchesCampaignTag(row, tagFilter))
        .map((row) => row.id);

}

function leadMatchesCampaignSegment(lead, segment = 'all') {
    const normalizedSegment = String(segment || 'all').toLowerCase();
    const leadStatus = Number(lead?.status || 0);

    if (normalizedSegment === 'all') return true;
    if (normalizedSegment === 'new') return leadStatus === 1;
    if (normalizedSegment === 'progress') return leadStatus === 2;
    if (normalizedSegment === 'concluded') return leadStatus === 3;
    return true;
}

function leadMatchesCampaignFilters(lead, campaign = {}) {
    if (!leadMatchesCampaignSegment(lead, campaign?.segment)) return false;
    return leadMatchesCampaignTag(lead, campaign?.tag_filter);
}

function resolveCampaignScheduledAt(campaign) {
    const { minMs, maxMs } = resolveCampaignDelayRange(campaign, 0);
    if (maxMs <= 0) {
        return null;
    }
    const delayMs = randomIntBetween(Math.max(0, minMs), Math.max(0, maxMs));
    return new Date(Date.now() + delayMs).toISOString();
}

async function triggerCampaignsForIncomingLead({ lead, conversation }) {
    if (!lead?.id || !conversation?.id) return { queued: 0, armed: 0 };

    const activeTriggers = await Campaign.list({
        status: 'active',
        type: 'trigger',
        limit: 200
    });

    if (!activeTriggers.length) {
        return { queued: 0, armed: 0 };
    }

    let queued = 0;

    for (const campaign of activeTriggers) {
        const message = String(campaign?.message || '').trim();
        if (!message) continue;

        const startAt = campaign?.start_at ? Date.parse(campaign.start_at) : NaN;
        if (Number.isFinite(startAt) && Date.now() < startAt) {
            continue;
        }

        if (!leadMatchesCampaignFilters(lead, campaign)) {
            continue;
        }

        const alreadyDelivered = await Message.hasCampaignDelivery(campaign.id, lead.id);
        if (alreadyDelivered) {
            continue;
        }

        const alreadyQueued = await MessageQueue.hasQueuedOrSentForCampaignLead(campaign.id, lead.id);
        if (alreadyQueued) {
            continue;
        }

        await queueService.add({
            leadId: lead.id,
            conversationId: conversation.id,
            campaignId: campaign.id,
            content: message,
            mediaType: 'text',
            scheduledAt: resolveCampaignScheduledAt(campaign),
            priority: 1
        });

        queued += 1;
    }

    return { queued, armed: activeTriggers.length };
}


async function queueCampaignMessages(campaign) {

    const steps = parseCampaignSteps(campaign);

    if (!steps.length) {

        throw new Error('Campanha sem mensagem configurada');

    }


    if (campaign.type === 'trigger') {

        return { queued: 0, recipients: 0, armed: true };

    }


    const leadIds = await resolveCampaignLeadIds({
        segment: campaign.segment || 'all',
        tagFilter: campaign.tag_filter || ''
    });

    if (!leadIds.length) {

        return { queued: 0, recipients: 0 };

    }


    const startAtMs = parseCampaignStartAt(campaign.start_at);

    const baseStartMs = startAtMs || Date.now();

    const { minMs: delayMinMsRaw, maxMs: delayMaxMsRaw } = resolveCampaignDelayRange(campaign, 5000);
    const delayMinMs = Math.max(250, delayMinMsRaw || 0);
    const delayMaxMs = Math.max(delayMinMs, delayMaxMsRaw || 0);

    let queuedCount = 0;

    if (campaign.type === 'drip') {

        for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {

            const content = steps[stepIndex];
            const stepBaseMs = baseStartMs + (stepIndex * delayMaxMs);
            let nextLeadAtMs = stepBaseMs;

            for (let leadIndex = 0; leadIndex < leadIds.length; leadIndex++) {

                const leadId = leadIds[leadIndex];

                const scheduledAt = new Date(nextLeadAtMs).toISOString();

                await queueService.add({

                    leadId,

                    campaignId: campaign.id,

                    content,

                    mediaType: 'text',

                    scheduledAt,

                    priority: 0

                });

                queuedCount += 1;

                nextLeadAtMs += randomIntBetween(delayMinMs, delayMaxMs);

            }

        }

    } else {

        const startAt = new Date(baseStartMs).toISOString();

        const results = await queueService.addBulk(leadIds, steps[0], {

            startAt,

            delayMinMs,

            delayMaxMs,

            campaignId: campaign.id

        });

        queuedCount = results.length;

    }


    await Campaign.update(campaign.id, {
        status: 'active'
    });

    await Campaign.refreshMetrics(campaign.id);


    return { queued: queuedCount, recipients: leadIds.length, steps: steps.length };

}


app.get('/api/campaigns', optionalAuth, async (req, res) => {

    const { status, type, limit, offset, search } = req.query;

    const campaigns = await Campaign.list({

        status,

        type,

        search,

        limit: limit ? parseInt(limit) : 50,

        offset: offset ? parseInt(offset) : 0

    });



    res.json({ success: true, campaigns });

});



app.get('/api/campaigns/:id', optionalAuth, async (req, res) => {

    const campaign = await Campaign.findById(req.params.id);

    if (!campaign) {

        return res.status(404).json({ error: 'Campanha não encontrada' });

    }

    res.json({ success: true, campaign });

});

app.get('/api/campaigns/:id/recipients', optionalAuth, async (req, res) => {

    const campaign = await Campaign.findById(req.params.id);

    if (!campaign) {

        return res.status(404).json({ error: 'Campanha não encontrada' });

    }

    const requestedLimit = parseInt(String(req.query.limit || '200'), 10);
    const limit = Number.isFinite(requestedLimit)
        ? Math.max(1, Math.min(requestedLimit, 1000))
        : 200;

    const leadIds = await resolveCampaignLeadIds({
        segment: campaign.segment || 'all',
        tagFilter: campaign.tag_filter || ''
    });

    if (!leadIds.length) {
        return res.json({
            success: true,
            total: 0,
            segment: campaign.segment || 'all',
            tag_filter: campaign.tag_filter || null,
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

    res.json({
        success: true,
        total: leadIds.length,
        segment: campaign.segment || 'all',
        tag_filter: campaign.tag_filter || null,
        recipients
    });

});



app.post('/api/campaigns', authenticate, async (req, res) => {

    try {

        const payload = sanitizeCampaignPayload({

            ...req.body,

            created_by: req.user?.id

        });

        const result = await Campaign.create(payload);

        let campaign = await Campaign.findById(result.id);
        let queueResult = { queued: 0, recipients: 0 };

        if (campaign?.status === 'active') {
            queueResult = await queueCampaignMessages(campaign);
            campaign = await Campaign.findById(result.id);
        }

        res.json({ success: true, campaign, queue: queueResult });

    } catch (error) {

        res.status(400).json({ error: error.message });

    }

});



app.put('/api/campaigns/:id', authenticate, async (req, res) => {

    try {

        const campaign = await Campaign.findById(req.params.id);

        if (!campaign) {

            return res.status(404).json({ error: 'Campanha nao encontrada' });

        }

        const payload = sanitizeCampaignPayload(req.body);
        const shouldQueue = campaign.status !== 'active' && payload.status === 'active';

        await Campaign.update(req.params.id, payload);

        let updatedCampaign = await Campaign.findById(req.params.id);
        let queueResult = { queued: 0, recipients: 0 };

        if (shouldQueue && updatedCampaign) {
            queueResult = await queueCampaignMessages(updatedCampaign);
            updatedCampaign = await Campaign.findById(req.params.id);
        }

        res.json({ success: true, campaign: updatedCampaign, queue: queueResult });

    } catch (error) {

        res.status(400).json({ error: error.message });

    }

});



app.delete('/api/campaigns/:id', authenticate, async (req, res) => {

    await Campaign.delete(req.params.id);

    res.json({ success: true });

});



// ============================================

// API DE AUTOMACOES

// ============================================



app.get('/api/automations', optionalAuth, async (req, res) => {

    const { is_active, trigger_type, limit, offset, search } = req.query;

    const automations = await Automation.list({

        is_active: is_active !== undefined ? parseInt(is_active) : undefined,

        trigger_type,

        search,

        limit: limit ? parseInt(limit) : 50,

        offset: offset ? parseInt(offset) : 0

    });



    res.json({ success: true, automations });

});



app.get('/api/automations/:id', optionalAuth, async (req, res) => {

    const automation = await Automation.findById(req.params.id);

    if (!automation) {

        return res.status(404).json({ error: 'Automação não encontrada' });

    }

    res.json({ success: true, automation });

});



app.post('/api/automations', authenticate, async (req, res) => {

    try {

        const payload = {

            ...req.body,

            created_by: req.user?.id

        };

        const result = await Automation.create(payload);

        const automation = await Automation.findById(result.id);

        res.json({ success: true, automation });

    } catch (error) {

        res.status(400).json({ error: error.message });

    }

});



app.put('/api/automations/:id', authenticate, async (req, res) => {

    const automation = await Automation.findById(req.params.id);

    if (!automation) {

        return res.status(404).json({ error: 'Automação não encontrada' });

    }



    await Automation.update(req.params.id, req.body);

    const updatedAutomation = await Automation.findById(req.params.id);

    res.json({ success: true, automation: updatedAutomation });

});



app.delete('/api/automations/:id', authenticate, async (req, res) => {

    await Automation.delete(req.params.id);

    res.json({ success: true });

});



// ============================================

// API DE FLUXOS

// ============================================



app.get('/api/flows', optionalAuth, async (req, res) => {

    const flows = await Flow.list(req.query);

    res.json({ success: true, flows });

});



app.get('/api/flows/:id', optionalAuth, async (req, res) => {

    const flow = await Flow.findById(req.params.id);

    if (!flow) {

        return res.status(404).json({ error: 'Fluxo não encontrado' });

    }

    res.json({ success: true, flow });

});



app.post('/api/flows', authenticate, async (req, res) => {

    const result = await Flow.create(req.body);

    const flow = await Flow.findById(result.id);

    res.json({ success: true, flow });

});



app.put('/api/flows/:id', authenticate, async (req, res) => {

    await Flow.update(req.params.id, req.body);

    const flow = await Flow.findById(req.params.id);

    res.json({ success: true, flow });

});



app.delete('/api/flows/:id', authenticate, async (req, res) => {

    await Flow.delete(req.params.id);

    res.json({ success: true });

});



// ============================================

// API DE WEBHOOKS

// ============================================



app.get('/api/webhooks', authenticate, async (req, res) => {

    const { Webhook } = require('./database/models');

    const webhooks = await Webhook.list();

    res.json({ success: true, webhooks });

});



app.post('/api/webhooks', authenticate, async (req, res) => {

    const { Webhook } = require('./database/models');

    const result = await Webhook.create(req.body);

    const webhook = await Webhook.findById(result.id);

    res.json({ success: true, webhook });

});



app.put('/api/webhooks/:id', authenticate, async (req, res) => {

    const { Webhook } = require('./database/models');

    await Webhook.update(req.params.id, req.body);

    const webhook = await Webhook.findById(req.params.id);

    res.json({ success: true, webhook });

});



app.delete('/api/webhooks/:id', authenticate, async (req, res) => {

    const { Webhook } = require('./database/models');

    await Webhook.delete(req.params.id);

    res.json({ success: true });

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



app.get('/api/settings', authenticate, async (req, res) => {

    const settings = await Settings.getAll();

    res.json({ success: true, settings });

});



app.put('/api/settings', authenticate, async (req, res) => {

    for (const [key, value] of Object.entries(req.body)) {

        const type = typeof value === 'number' ? 'number' : 

                     typeof value === 'boolean' ? 'boolean' :

                     typeof value === 'object' ? 'json' : 'string';

        await Settings.set(key, value, type);

    }

    

    // Atualizar serviço de fila se necessário

    if (req.body.bulk_message_delay || req.body.max_messages_per_minute) {

        await queueService.updateSettings({

            delay: req.body.bulk_message_delay,

            maxPerMinute: req.body.max_messages_per_minute

        });

    }

    

    res.json({ success: true, settings: await Settings.getAll() });

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




































