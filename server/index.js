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
const { Lead, Conversation, Message, Template, Campaign, Automation, Flow, Settings, User } = require('./database/models');

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
        console.warn('⚠️  AVISO: Configure ENCRYPTION_KEY nas variáveis de ambiente para produção.');
    }
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'self-protecao-jwt-secret-2024') {
        console.warn('⚠️  AVISO: Configure JWT_SECRET nas variáveis de ambiente para produção.');
    }
}

// Criar diretórios necessários
[SESSIONS_DIR, UPLOADS_DIR, path.join(__dirname, '..', 'data')].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Migração roda aqui (servidor já está ouvindo via start.js)
try {
    migrate();
    console.log('✅ Banco de dados inicializado');
    cleanupDuplicateMessages();
    cleanupLidLeads();
} catch (error) {
    console.error('❌ Erro ao inicializar banco de dados:', error.message);
}

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

// CORS - Configurável via variável de ambiente
const allowedOrigins = process.env.CORS_ORIGINS 
    ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
    : (process.env.NODE_ENV === 'production' ? [] : ['http://localhost:3000', 'http://localhost:3001']);

app.use(cors({
    origin: (origin, callback) => {
        // Permitir requisições sem origin (mobile apps, Postman, etc)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.length === 0 || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Não permitido por CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

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

function getSessionUser(sessionId) {
    return sessions.get(sessionId)?.user || null;
}

function getSessionDisplayName(sessionId) {
    const user = getSessionUser(sessionId);
    return user?.pushName || user?.name || null;
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

function normalizeJid(jid) {
    if (!jid) return null;
    if (isLidJid(jid) && jidAliasMap.has(jid)) {
        return jidAliasMap.get(jid);
    }
    return jid;
}

function registerContactAlias(contact) {
    if (!contact) return;
    const candidates = [
        contact.id,
        contact.jid,
        contact.lid,
        contact.lidJid,
        contact?.lid?.id,
        contact?.lid?.jid
    ].filter(Boolean);

    if (candidates.length < 2) return;

    let lidJid = null;
    let userJid = null;

    for (const cand of candidates) {
        if (!lidJid && isLidJid(cand)) lidJid = cand;
        if (!userJid && isUserJid(cand)) userJid = cand;
    }

    if (lidJid && userJid) {
        jidAliasMap.set(lidJid, userJid);

        const primary = Lead.findByJid(userJid) || Lead.findByPhone(extractNumber(userJid));
        const duplicate = Lead.findByJid(lidJid) || Lead.findByPhone(extractNumber(lidJid));

        if (primary && duplicate && primary.id !== duplicate.id) {
            mergeLeads(primary, duplicate);
        } else if (!primary && duplicate) {
            updateLeadIdentity(duplicate, userJid, extractNumber(userJid));
        } else if (primary && primary.jid !== userJid) {
            updateLeadIdentity(primary, userJid, extractNumber(userJid));
        }
    }
}

function resolveMessageJid(msg) {
    const candidates = [
        msg?.key?.remoteJid,
        msg?.key?.participant,
        msg?.participant,
        msg?.message?.extendedTextMessage?.contextInfo?.participant,
        msg?.message?.senderKeyDistributionMessage?.groupId
    ].filter(Boolean);

    let lidJid = null;
    let userJid = null;

    for (const jid of candidates) {
        if (!lidJid && isLidJid(jid)) lidJid = jid;
        if (!userJid && isUserJid(jid)) userJid = jid;
    }

    if (lidJid && userJid) {
        jidAliasMap.set(lidJid, userJid);
    }

    for (const jid of candidates) {
        const normalized = normalizeJid(jid);
        if (normalized && isUserJid(normalized)) {
            return normalized;
        }
    }

    return normalizeJid(msg?.key?.remoteJid);
}

function mergeConversationsForLeads(primaryLeadId, duplicateLeadId) {
    const conversations = query(
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
        run('UPDATE messages SET conversation_id = ? WHERE conversation_id = ?', [primaryConversationId, conversation.id]);
        run('DELETE FROM conversations WHERE id = ?', [conversation.id]);
    }

    // Garantir lead correto na conversa principal
    run('UPDATE conversations SET lead_id = ?, unread_count = ? WHERE id = ?', [
        primaryLeadId,
        totalUnread,
        primaryConversationId
    ]);
}

function mergeLeads(primaryLead, duplicateLead) {
    if (!primaryLead || !duplicateLead || primaryLead.id === duplicateLead.id) return;

    // Mesclar conversas e mensagens
    mergeConversationsForLeads(primaryLead.id, duplicateLead.id);
    run('UPDATE messages SET lead_id = ? WHERE lead_id = ?', [primaryLead.id, duplicateLead.id]);
    run('UPDATE conversations SET lead_id = ? WHERE lead_id = ?', [primaryLead.id, duplicateLead.id]);

    // Remover lead duplicado
    Lead.delete(duplicateLead.id);
}

function updateLeadIdentity(lead, jid, phone) {
    if (!lead || !jid) return lead;

    const cleanedPhone = phone ? String(phone).replace(/\D/g, '') : '';
    if (!cleanedPhone) return lead;

    const hasChanges = lead.jid !== jid || String(lead.phone || '') !== cleanedPhone;
    if (!hasChanges) return lead;

    try {
        run(
            "UPDATE leads SET jid = ?, phone = ?, phone_formatted = ?, updated_at = datetime('now') WHERE id = ?",
            [jid, cleanedPhone, cleanedPhone, lead.id]
        );
        return Lead.findById(lead.id) || lead;
    } catch (error) {
        console.warn('⚠️ Falha ao atualizar identidade do lead:', error.message);
        return lead;
    }
}

function cleanupDuplicateMessages() {
    try {
        // Remover duplicados com message_id igual (segurança extra)
        run(`
            DELETE FROM messages
            WHERE message_id IS NOT NULL
            AND id NOT IN (
                SELECT MIN(id) FROM messages
                WHERE message_id IS NOT NULL
                GROUP BY message_id
            )
        `);

        // Remover duplicados sem message_id (mesmo conteúdo no mesmo segundo)
        run(`
            DELETE FROM messages
            WHERE message_id IS NULL
            AND id NOT IN (
                SELECT MIN(id) FROM messages
                WHERE message_id IS NULL
                GROUP BY conversation_id, lead_id, sender_type, content, media_type, is_from_me, strftime('%Y-%m-%d %H:%M:%S', created_at)
            )
        `);
    } catch (error) {
        console.warn('⚠️ Falha ao limpar mensagens duplicadas:', error.message);
    }
}


function cleanupLidLeads() {
    try {
        const lidLeads = query(
            "SELECT id FROM leads WHERE jid LIKE '%@lid%' OR phone LIKE '%@lid%'"
        );
        if (!lidLeads || lidLeads.length === 0) return;

        for (const lead of lidLeads) {
            run('DELETE FROM leads WHERE id = ?', [lead.id]);
        }
        console.log(`Removidos ${lidLeads.length} leads com @lid`);
    } catch (error) {
        console.warn('Falha ao limpar leads @lid:', error.message);
    }
}

function persistWhatsappSession(sessionId, status, options = {}) {
    try {
        const qr_code = options.qr_code || null;
        const last_connected_at = options.last_connected_at || null;
        run(`
            INSERT INTO whatsapp_sessions (session_id, status, qr_code, last_connected_at, updated_at)
            VALUES (?, ?, ?, ?, datetime('now'))
            ON CONFLICT(session_id) DO UPDATE SET
                status = excluded.status,
                qr_code = excluded.qr_code,
                last_connected_at = excluded.last_connected_at,
                updated_at = datetime('now')
        `, [sessionId, status, qr_code, last_connected_at]);
    } catch (error) {
        console.error(`[${sessionId}] Erro ao persistir sessão:`, error.message);
    }
}

async function rehydrateSessions(ioInstance) {
    try {
        const stored = query(`SELECT session_id FROM whatsapp_sessions`);
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
        console.error('❌ Erro ao reidratar sessões:', error.message);
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
                const msg = Message.findByMessageId(key.id);
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
                    
                    console.log(`[${sessionId}] ✅ QR Code gerado`);
                    
                    const timeout = setTimeout(() => {
                        const currentSession = sessions.get(sessionId);
                        if (currentSession && !currentSession.isConnected) {
                            clientSocket.emit('qr-expired', { sessionId });
                        }
                    }, QR_TIMEOUT);
                    
                    qrTimeouts.set(sessionId, timeout);
                    
                } catch (qrError) {
                    console.error(`[${sessionId}] ❌ Erro ao gerar QR:`, qrError.message);
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
                    
                    console.log(`[${sessionId}] ✅ WhatsApp conectado: ${session.user.name}`);

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
                    await processIncomingMessage(sessionId, msg);
                }
            }
        });
        
        // Status de mensagens
        sock.ev.on('messages.update', (updates) => {
            for (const update of updates) {
                if (update.update.status) {
                    const statusMap = { 1: 'pending', 2: 'sent', 3: 'delivered', 4: 'read' };
                    const status = statusMap[update.update.status] || 'pending';
                    
                    // Atualizar no banco
                    Message.updateStatus(update.key.id, status, new Date().toISOString());
                    
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

        sock.ev.on('contacts.set', (payload) => {
            const contacts = payload?.contacts || [];
            for (const contact of contacts) {
                registerContactAlias(contact);
            }
        });

        sock.ev.on('contacts.upsert', (contacts) => {
            const list = Array.isArray(contacts) ? contacts : [contacts];
            for (const contact of list) {
                registerContactAlias(contact);
            }
        });

        // Sincronizar lista de chats/contatos
        sock.ev.on('chats.set', (payload) => {
            try {
                syncChatsToDatabase(sessionId, payload);
            } catch (error) {
                console.error(`[${sessionId}] ❌ Erro ao sincronizar chats:`, error.message);
            }
        });

        sock.ev.on('chats.upsert', (payload) => {
            try {
                syncChatsToDatabase(sessionId, payload);
            } catch (error) {
                console.error(`[${sessionId}] ❌ Erro ao sincronizar chats:`, error.message);
            }
        });

        sock.ev.on('chats.update', (payload) => {
            try {
                syncChatsToDatabase(sessionId, payload);
            } catch (error) {
                console.error(`[${sessionId}] ❌ Erro ao sincronizar chats:`, error.message);
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
            console.error(`[${sessionId}] ❌ Erro:`, error.message);
            clientSocket.emit('error', { message: error.message });
        });
        
        return sock;
        
    } catch (error) {
        console.error(`[${sessionId}] ❌ Erro ao criar sessão:`, error.message);
        
        const currentAttempt = reconnectAttempts.get(sessionId) || 0;
        if (currentAttempt < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts.set(sessionId, currentAttempt + 1);
            await baileys.delay(RECONNECT_DELAY);
            return await createSession(sessionId, clientSocket, currentAttempt + 1);
        } else {
            clientSocket.emit('error', { message: 'Erro ao criar sessão WhatsApp' });
            return null;
        }
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
            Lead.update(lead.id, { status: nextStatus });
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
                Lead.update(lead.id, { tags });
            }
            break;
        }
        case 'start_flow': {
            const flowId = parseInt(actionValue, 10);
            if (!Number.isFinite(flowId)) return;
            const flow = Flow.findById(flowId);
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

    run(
        `UPDATE automations SET executions = executions + 1, last_execution = ?, updated_at = datetime('now') WHERE id = ?`,
        [new Date().toISOString(), automation.id]
    );
}

function scheduleAutomations(context) {
    const automations = Automation.list({ is_active: 1 });
    if (!automations || automations.length === 0) return;

    const normalizedText = normalizeAutomationText(context?.text || '');

    for (const automation of automations) {
        if (!shouldTriggerAutomation(automation, context, normalizedText)) continue;

        const delaySeconds = Number(automation.delay || 0);
        const delayMs = Number.isFinite(delaySeconds) && delaySeconds > 0 ? delaySeconds * 1000 : 0;

        if (delayMs > 0) {
            setTimeout(() => {
                executeAutomationAction(automation, context).catch((error) => {
                    console.error(`❌ Erro ao executar automação ${automation.id}:`, error.message);
                });
            }, delayMs);
        } else {
            executeAutomationAction(automation, context).catch((error) => {
                console.error(`❌ Erro ao executar automação ${automation.id}:`, error.message);
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

function syncChatsToDatabase(sessionId, payload) {
    const chats = normalizeChatPayload(payload);
    if (chats.length === 0) return;

    const sessionDisplayName = getSessionDisplayName(sessionId);
    const sessionPhone = getSessionPhone(sessionId);

    for (const chat of chats) {
        const rawJid = chat?.id || chat?.jid;
        const jid = normalizeJid(rawJid);
        if (!jid || String(jid).endsWith('@g.us')) continue;

        const phone = extractNumber(jid);
        if (!phone) continue;

        let displayName = getChatDisplayName(chat, phone);
        const isSelfChat = sessionPhone && phone === sessionPhone;
        if (isSelfChat) {
            displayName = sessionDisplayName ? `${sessionDisplayName} (Você)` : 'Você';
        }

        let lead = Lead.findByJid(jid) || Lead.findByPhone(phone);
        if (rawJid && rawJid !== jid) {
            const aliasLead = Lead.findByJid(rawJid) || Lead.findByPhone(extractNumber(rawJid));
            if (aliasLead && lead && aliasLead.id !== lead.id) {
                mergeLeads(lead, aliasLead);
            } else if (aliasLead && !lead) {
                lead = updateLeadIdentity(aliasLead, jid, phone);
            } else if (aliasLead && lead && aliasLead.id === lead.id) {
                lead = updateLeadIdentity(lead, jid, phone);
            }
        }
        if (lead && lead.jid !== jid) {
            lead = updateLeadIdentity(lead, jid, phone);
        }
        if (!lead) {
            lead = Lead.findOrCreate({
                phone,
                jid,
                name: displayName,
                source: 'whatsapp'
            }).lead;
        } else if (displayName) {
            const shouldUpdateName =
                !lead.name ||
                lead.name === phone ||
                (sessionDisplayName && lead.name === sessionDisplayName) ||
                (sessionDisplayName && lead.name === `${sessionDisplayName} (Você)`) ||
                lead.name === 'Você';
            if (shouldUpdateName) {
                Lead.update(lead.id, { name: displayName });
                lead = Lead.findById(lead.id);
            }
        }

        const convResult = Conversation.findOrCreate({
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
            Conversation.update(conversation.id, updates);
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
                syncChatsToDatabase(sessionId, chats);
                synced = true;
            }
        } else if (typeof sock?.getChats === 'function') {
            const chats = await sock.getChats();
            if (chats?.length) {
                syncChatsToDatabase(sessionId, chats);
                synced = true;
            }
        }
    } catch (error) {
        console.warn(`[${sessionId}] ⚠️ Não foi possível buscar chats por API:`, error.message);
    }

    if (!synced) {
        const chats = extractStoreChats(store);
        if (chats.length > 0) {
            syncChatsToDatabase(sessionId, chats);
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
    const fromRaw = msg.key.remoteJid;
    const from = resolveMessageJid(msg);
    const isFromMe = msg.key.fromMe;
    const sessionDisplayName = getSessionDisplayName(sessionId);
    const sessionPhone = getSessionPhone(sessionId);
    
    // Ignorar grupos por enquanto
    if (from?.endsWith('@g.us')) return;
    
    // Extrair texto
    let text = '';
    if (msg.message) {
        text = msg.message.conversation || 
               msg.message.extendedTextMessage?.text || 
               msg.message.imageMessage?.caption ||
               msg.message.videoMessage?.caption ||
               msg.message.documentMessage?.caption ||
               '';
    }
    
    // Tipo de mídia
    let mediaType = 'text';
    if (msg.message?.imageMessage) mediaType = 'image';
    else if (msg.message?.videoMessage) mediaType = 'video';
    else if (msg.message?.audioMessage) mediaType = 'audio';
    else if (msg.message?.documentMessage) mediaType = 'document';
    else if (msg.message?.stickerMessage) mediaType = 'sticker';
    
    if (fromRaw && from && fromRaw !== from) {
        const resolvedPhone = isUserJid(from) ? extractNumber(from) : null;
        const primary = Lead.findByJid(from) || (resolvedPhone ? Lead.findByPhone(resolvedPhone) : null);
        const duplicate = Lead.findByJid(fromRaw) || Lead.findByPhone(extractNumber(fromRaw));
        if (primary && duplicate && primary.id !== duplicate.id) {
            mergeLeads(primary, duplicate);
        } else if (!primary && duplicate && resolvedPhone) {
            updateLeadIdentity(duplicate, from, resolvedPhone);
        } else if (primary && !duplicate && resolvedPhone) {
            updateLeadIdentity(primary, from, resolvedPhone);
        }
    }

    const phone = extractNumber(from);
    if (!phone) {
        console.warn(`[${sessionId}] Ignorando mensagem com JID invalido: ${from}`);
        return;
    }
    const isSelfChat = sessionPhone && phone === sessionPhone;
    const selfName = sessionDisplayName ? `${sessionDisplayName} (Você)` : 'Você';
    
    // Buscar ou criar lead
    const { lead, created: leadCreated } = Lead.findOrCreate({
        phone,
        jid: from,
        name: isSelfChat ? selfName : (!isFromMe ? (msg.pushName || phone) : undefined),
        source: 'whatsapp'
    });

    if (isSelfChat) {
        if (!lead.name || lead.name !== selfName) {
            Lead.update(lead.id, { name: selfName });
        }
    } else if (!isFromMe && msg.pushName) {
        const shouldUpdateName =
            !lead.name ||
            lead.name === phone ||
            (sessionDisplayName && lead.name === sessionDisplayName) ||
            (sessionDisplayName && lead.name === `${sessionDisplayName} (Você)`) ||
            lead.name === 'Você';
        if (shouldUpdateName) {
            Lead.update(lead.id, { name: msg.pushName });
        }
    }
    
    // Buscar ou criar conversa
    const { conversation, created: convCreated } = Conversation.findOrCreate({
        lead_id: lead.id,
        session_id: sessionId
    });

    const existingMessage = Message.findByMessageId(msg.key.id);
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
    
    const savedMessage = Message.create(messageData);
    
    // Atualizar conversa
    if (!isFromMe) {
        Conversation.incrementUnread(conversation.id);
        Lead.update(lead.id, { last_message_at: new Date().toISOString() });
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
        
        console.log(`[${sessionId}] 📨 Mensagem de ${lead.name || phone}: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);
        
        // Processar fluxo de automação
        if (conversation.is_bot_active) {
            conversation.created = convCreated;
            await flowService.processIncomingMessage(
                { text, mediaType },
                lead,
                conversation
            );
        }

        scheduleAutomations({
            sessionId,
            text,
            mediaType,
            lead,
            conversation,
            leadCreated,
            conversationCreated: convCreated
        });
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
    
    // Buscar ou criar lead
    const { lead } = Lead.findOrCreate({
        phone: to.replace(/\D/g, ''),
        jid,
        source: 'manual'
    });
    
    // Buscar ou criar conversa
    const { conversation } = Conversation.findOrCreate({
        lead_id: lead.id,
        session_id: sessionId
    });
    
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
        console.warn(`[${sessionId}] ⚠️ Mensagem enviada sem id retornado.`);
        return { ...result, lead, conversation };
    }

    const existingMessage = Message.findByMessageId(messageId);
    if (existingMessage) {
        return { ...result, savedMessage: existingMessage, lead, conversation, deduped: true };
    }

    // Salvar mensagem
    let savedMessage;
    try {
        savedMessage = Message.create({
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
            sent_at: new Date().toISOString()
        });
    } catch (error) {
        if (String(error.message || '').includes('UNIQUE')) {
            savedMessage = Message.findByMessageId(messageId);
        } else {
            throw error;
        }
    }
    
    // Webhook
    webhookService.trigger('message.sent', {
        messageId,
        to,
        content: message,
        type
    });
    
    console.log(`[${sessionId}] ✅ Mensagem enviada para ${to}`);
    
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
queueService.init(async (options) => {
    return await sendMessageToWhatsApp({
        ...options,
        sessionId: 'self_whatsapp_session'
    });
});

// Inicializar serviço de fluxos
flowService.init(async (options) => {
    return await sendMessageToWhatsApp({
        ...options,
        sessionId: 'self_whatsapp_session'
    });
});

// Reidratar sessões armazenadas (após restart)
rehydrateSessions(io);

// ============================================
// SOCKET.IO EVENTOS
// ============================================

io.on('connection', (socket) => {
    console.log('🔌 Cliente conectado:', socket.id);
    
    socket.on('check-session', async ({ sessionId }) => {
        const session = sessions.get(sessionId);
        
        if (session && session.isConnected) {
            session.clientSocket = socket;
            socket.emit('session-status', { status: 'connected', sessionId, user: session.user });
        } else if (sessionExists(sessionId)) {
            socket.emit('session-status', { status: 'reconnecting', sessionId });
            await createSession(sessionId, socket);
        } else {
            socket.emit('session-status', { status: 'disconnected', sessionId });
        }
    });
    
    socket.on('start-session', async ({ sessionId }) => {
        const existingSession = sessions.get(sessionId);
        if (existingSession && existingSession.isConnected) {
            existingSession.clientSocket = socket;
            socket.emit('session-status', { status: 'connected', sessionId, user: existingSession.user });
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
    
    socket.on('get-messages', ({ sessionId, contactJid, leadId }) => {
        let messages = [];
        
        if (leadId) {
            messages = Message.listByLead(leadId, { limit: 100 });
        } else if (contactJid) {
            const lead = Lead.findByJid(contactJid);
            if (lead) {
                messages = Message.listByLead(lead.id, { limit: 100 });
            }
        }
        
        // Descriptografar mensagens
        messages = messages.map(m => ({
            ...m,
            text: m.content_encrypted ? decryptMessage(m.content_encrypted) : m.content,
            content: m.content_encrypted ? decryptMessage(m.content_encrypted) : m.content
        }));
        
        socket.emit('messages-list', { sessionId, contactJid, leadId, messages });
    });
    
    socket.on('get-contacts', ({ sessionId }) => {
        const leads = Lead.list({ limit: 100 });
        
        const contacts = leads.map(lead => {
            const lastMsg = Message.listByLead(lead.id, { limit: 1 })[0];
            return {
                jid: lead.jid,
                number: lead.phone,
                name: lead.name,
                vehicle: lead.vehicle,
                plate: lead.plate,
                status: lead.status,
                lastMessage: lastMsg?.content?.substring(0, 50) || 'Clique para iniciar conversa',
                lastMessageTime: lastMsg?.created_at ? new Date(lastMsg.created_at).getTime() : new Date(lead.created_at).getTime(),
                unreadCount: 0
            };
        });
        
        socket.emit('contacts-list', { sessionId, contacts });
    });
    
    socket.on('get-leads', (options = {}) => {
        const leads = Lead.list(options);
        const total = Lead.count(options);
        socket.emit('leads-list', { leads, total });
    });
    
    socket.on('mark-read', ({ sessionId, contactJid, conversationId }) => {
        if (conversationId) {
            Conversation.markAsRead(conversationId);
        } else if (contactJid) {
            const lead = Lead.findByJid(contactJid);
            if (lead) {
                const conv = Conversation.findByLeadId(lead.id);
                if (conv) Conversation.markAsRead(conv.id);
            }
        }
    });
    
    socket.on('get-templates', () => {
        const templates = Template.list();
        socket.emit('templates-list', { templates });
    });
    
    socket.on('get-flows', () => {
        const flows = Flow.list();
        socket.emit('flows-list', { flows });
    });
    
    socket.on('toggle-bot', ({ conversationId, active }) => {
        Conversation.update(conversationId, { is_bot_active: active ? 1 : 0 });
        socket.emit('bot-toggled', { conversationId, active });
    });
    
    socket.on('assign-conversation', ({ conversationId, userId }) => {
        Conversation.update(conversationId, { assigned_to: userId });
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
        console.log('🔌 Cliente desconectado:', socket.id);
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
app.get('/api/status', (req, res) => {
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
        queue: queueService.getStatus(),
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
        let user = User.findByEmail(normalizedEmail);

        // Compatibilidade com login legado (usuário: thyago / senha: thyago123)
        if (!user && normalizedEmail === 'thyago' && password === 'thyago123') {
            const legacyEmail = 'thyago@self.com.br';
            user = User.findByEmail(legacyEmail);

            if (!user) {
                const created = User.create({
                    name: 'thyago',
                    email: legacyEmail,
                    password_hash: hashPassword('thyago123'),
                    role: 'admin'
                });
                user = User.findByEmail(legacyEmail);
            }
        }

        if (!user || !verifyPassword(password, user.password_hash)) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }
        
        if (!user.is_active) {
            return res.status(401).json({ error: 'Usuário desativado' });
        }
        
        User.updateLastLogin(user.id);
        
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
        const existing = User.findByEmail(normalizedEmail);
        if (existing) {
            return res.status(409).json({ error: 'Email já cadastrado' });
        }

        User.create({
            name: String(name || '').trim(),
            email: normalizedEmail,
            password_hash: hashPassword(String(password)),
            role: 'agent'
        });

        const user = User.findByEmail(normalizedEmail);
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

app.post('/api/auth/refresh', (req, res) => {
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
        
        const user = User.findById(decoded.id);
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

app.get('/api/leads', optionalAuth, (req, res) => {
    const { status, search, limit, offset } = req.query;
    const leads = Lead.list({ 
        status: status ? parseInt(status) : undefined,
        search,
        limit: limit ? parseInt(limit) : 50,
        offset: offset ? parseInt(offset) : 0
    });
    const total = Lead.count({ status: status ? parseInt(status) : undefined });
    
    res.json({ success: true, leads, total });
});

app.get('/api/leads/:id', optionalAuth, (req, res) => {
    const lead = Lead.findById(req.params.id);
    if (!lead) {
        return res.status(404).json({ error: 'Lead não encontrado' });
    }
    res.json({ success: true, lead });
});

app.post('/api/leads', authenticate, (req, res) => {
    try {
        const result = Lead.create(req.body);
        const lead = Lead.findById(result.id);
        
        webhookService.trigger('lead.created', { lead });
        
        res.json({ success: true, lead });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.put('/api/leads/:id', authenticate, (req, res) => {
    const lead = Lead.findById(req.params.id);
    if (!lead) {
        return res.status(404).json({ error: 'Lead não encontrado' });
    }
    
    const oldStatus = lead.status;
    Lead.update(req.params.id, req.body);
    const updatedLead = Lead.findById(req.params.id);
    
    webhookService.trigger('lead.updated', { lead: updatedLead });
    
    if (req.body.status && req.body.status !== oldStatus) {
        webhookService.trigger('lead.status_changed', { 
            lead: updatedLead, 
            oldStatus, 
            newStatus: req.body.status 
        });
    }
    
    res.json({ success: true, lead: updatedLead });
});

app.delete('/api/leads/:id', authenticate, (req, res) => {
    Lead.delete(req.params.id);
    res.json({ success: true });
});

// ============================================
// API DE MENSAGENS
// ============================================

app.get('/api/conversations', optionalAuth, (req, res) => {
    const { status, assigned_to, session_id, limit, offset } = req.query;
    const conversations = Conversation.list({
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

    const normalized = conversations.map((c) => {
        const lastMessage = Message.getLastMessage(c.id);
        const decrypted = lastMessage?.content_encrypted
            ? decryptMessage(lastMessage.content_encrypted)
            : lastMessage?.content;

        let metadata = {};
        try {
            metadata = c.metadata ? JSON.parse(c.metadata) : {};
        } catch (e) {
            metadata = {};
        }

        const metadataLast = metadata.last_message || '';
        const metadataLastAt = metadata.last_message_at || null;

        const lastMessageText =
            (decrypted || '').trim() ||
            (metadataLast ? String(metadataLast).trim() : '') ||
            (lastMessage ? previewForMedia(lastMessage.media_type) : 'Clique para iniciar conversa');

        const lastMessageAt =
            lastMessage?.sent_at ||
            lastMessage?.created_at ||
            metadataLastAt ||
            c.updated_at;

        return {
            ...c,
            unread: c.unread_count || 0,
            lastMessage: lastMessageText,
            lastMessageAt,
            name: c.lead_name,
            phone: c.phone
        };
    });

    res.json({ success: true, conversations: normalized });
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
        const lead = Lead.findById(leadId);
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

app.get('/api/messages/:leadId', authenticate, (req, res) => {
    const messages = Message.listByLead(req.params.leadId, { 
        limit: parseInt(req.query.limit) || 100 
    });
    
    const decrypted = messages.map(m => ({
        ...m,
        content: m.content_encrypted ? decryptMessage(m.content_encrypted) : m.content
    }));
    
    res.json({ success: true, messages: decrypted });
});

// ============================================
// API DE FILA
// ============================================

app.get('/api/queue/status', authenticate, (req, res) => {
    res.json({ success: true, ...queueService.getStatus() });
});

app.post('/api/queue/add', authenticate, (req, res) => {
    const { leadId, content, mediaType, mediaUrl, priority, scheduledAt } = req.body;
    
    const result = queueService.add({
        leadId,
        content,
        mediaType,
        mediaUrl,
        priority,
        scheduledAt
    });
    
    res.json({ success: true, ...result });
});

app.post('/api/queue/bulk', authenticate, (req, res) => {
    const { leadIds, content, options } = req.body;
    
    const results = queueService.addBulk(leadIds, content, options);
    
    res.json({ success: true, queued: results.length });
});

app.delete('/api/queue/:id', authenticate, (req, res) => {
    queueService.cancel(req.params.id);
    res.json({ success: true });
});

app.delete('/api/queue', authenticate, (req, res) => {
    const count = queueService.cancelAll();
    res.json({ success: true, cancelled: count });
});

// ============================================
// API DE TEMPLATES
// ============================================

app.get('/api/templates', optionalAuth, (req, res) => {
    const templates = Template.list(req.query);
    res.json({ success: true, templates });
});

app.post('/api/templates', authenticate, (req, res) => {
    const result = Template.create(req.body);
    const template = Template.findById(result.id);
    res.json({ success: true, template });
});

app.put('/api/templates/:id', authenticate, (req, res) => {
    Template.update(req.params.id, req.body);
    const template = Template.findById(req.params.id);
    res.json({ success: true, template });
});

app.delete('/api/templates/:id', authenticate, (req, res) => {
    Template.delete(req.params.id);
    res.json({ success: true });
});

// ============================================
// API DE CAMPANHAS
// ============================================

app.get('/api/campaigns', optionalAuth, (req, res) => {
    const { status, type, limit, offset, search } = req.query;
    const campaigns = Campaign.list({
        status,
        type,
        search,
        limit: limit ? parseInt(limit) : 50,
        offset: offset ? parseInt(offset) : 0
    });

    res.json({ success: true, campaigns });
});

app.get('/api/campaigns/:id', optionalAuth, (req, res) => {
    const campaign = Campaign.findById(req.params.id);
    if (!campaign) {
        return res.status(404).json({ error: 'Campanha nÃ£o encontrada' });
    }
    res.json({ success: true, campaign });
});

app.post('/api/campaigns', authenticate, (req, res) => {
    try {
        const payload = {
            ...req.body,
            created_by: req.user?.id
        };
        const result = Campaign.create(payload);
        const campaign = Campaign.findById(result.id);
        res.json({ success: true, campaign });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.put('/api/campaigns/:id', authenticate, (req, res) => {
    const campaign = Campaign.findById(req.params.id);
    if (!campaign) {
        return res.status(404).json({ error: 'Campanha nÃ£o encontrada' });
    }

    Campaign.update(req.params.id, req.body);
    const updatedCampaign = Campaign.findById(req.params.id);
    res.json({ success: true, campaign: updatedCampaign });
});

app.delete('/api/campaigns/:id', authenticate, (req, res) => {
    Campaign.delete(req.params.id);
    res.json({ success: true });
});

// ============================================
// API DE AUTOMACOES
// ============================================

app.get('/api/automations', optionalAuth, (req, res) => {
    const { is_active, trigger_type, limit, offset, search } = req.query;
    const automations = Automation.list({
        is_active: is_active !== undefined ? parseInt(is_active) : undefined,
        trigger_type,
        search,
        limit: limit ? parseInt(limit) : 50,
        offset: offset ? parseInt(offset) : 0
    });

    res.json({ success: true, automations });
});

app.get('/api/automations/:id', optionalAuth, (req, res) => {
    const automation = Automation.findById(req.params.id);
    if (!automation) {
        return res.status(404).json({ error: 'AutomaÃ§Ã£o nÃ£o encontrada' });
    }
    res.json({ success: true, automation });
});

app.post('/api/automations', authenticate, (req, res) => {
    try {
        const payload = {
            ...req.body,
            created_by: req.user?.id
        };
        const result = Automation.create(payload);
        const automation = Automation.findById(result.id);
        res.json({ success: true, automation });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.put('/api/automations/:id', authenticate, (req, res) => {
    const automation = Automation.findById(req.params.id);
    if (!automation) {
        return res.status(404).json({ error: 'AutomaÃ§Ã£o nÃ£o encontrada' });
    }

    Automation.update(req.params.id, req.body);
    const updatedAutomation = Automation.findById(req.params.id);
    res.json({ success: true, automation: updatedAutomation });
});

app.delete('/api/automations/:id', authenticate, (req, res) => {
    Automation.delete(req.params.id);
    res.json({ success: true });
});

// ============================================
// API DE FLUXOS
// ============================================

app.get('/api/flows', optionalAuth, (req, res) => {
    const flows = Flow.list(req.query);
    res.json({ success: true, flows });
});

app.get('/api/flows/:id', optionalAuth, (req, res) => {
    const flow = Flow.findById(req.params.id);
    if (!flow) {
        return res.status(404).json({ error: 'Fluxo não encontrado' });
    }
    res.json({ success: true, flow });
});

app.post('/api/flows', authenticate, (req, res) => {
    const result = Flow.create(req.body);
    const flow = Flow.findById(result.id);
    res.json({ success: true, flow });
});

app.put('/api/flows/:id', authenticate, (req, res) => {
    Flow.update(req.params.id, req.body);
    const flow = Flow.findById(req.params.id);
    res.json({ success: true, flow });
});

app.delete('/api/flows/:id', authenticate, (req, res) => {
    Flow.delete(req.params.id);
    res.json({ success: true });
});

// ============================================
// API DE WEBHOOKS
// ============================================

app.get('/api/webhooks', authenticate, (req, res) => {
    const { Webhook } = require('./database/models');
    const webhooks = Webhook.list();
    res.json({ success: true, webhooks });
});

app.post('/api/webhooks', authenticate, (req, res) => {
    const { Webhook } = require('./database/models');
    const result = Webhook.create(req.body);
    const webhook = Webhook.findById(result.id);
    res.json({ success: true, webhook });
});

app.put('/api/webhooks/:id', authenticate, (req, res) => {
    const { Webhook } = require('./database/models');
    Webhook.update(req.params.id, req.body);
    const webhook = Webhook.findById(req.params.id);
    res.json({ success: true, webhook });
});

app.delete('/api/webhooks/:id', authenticate, (req, res) => {
    const { Webhook } = require('./database/models');
    Webhook.delete(req.params.id);
    res.json({ success: true });
});

// Webhook de entrada (para receber dados externos)
app.post('/api/webhook/incoming', (req, res) => {
    const { event, data, secret } = req.body;
    
    // Validar secret se configurado
    const expectedSecret = process.env.WEBHOOK_SECRET;
    if (expectedSecret && secret !== expectedSecret) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    console.log(`📥 Webhook recebido: ${event}`);
    
    // Processar evento
    if (event === 'lead.create' && data) {
        try {
            const result = Lead.create(data);
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

app.get('/api/settings', authenticate, (req, res) => {
    const settings = Settings.getAll();
    res.json({ success: true, settings });
});

app.put('/api/settings', authenticate, (req, res) => {
    for (const [key, value] of Object.entries(req.body)) {
        const type = typeof value === 'number' ? 'number' : 
                     typeof value === 'boolean' ? 'boolean' :
                     typeof value === 'object' ? 'json' : 'string';
        Settings.set(key, value, type);
    }
    
    // Atualizar serviço de fila se necessário
    if (req.body.bulk_message_delay || req.body.max_messages_per_minute) {
        queueService.updateSettings({
            delay: req.body.bulk_message_delay,
            maxPerMinute: req.body.max_messages_per_minute
        });
    }
    
    res.json({ success: true, settings: Settings.getAll() });
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
    console.error('❌ Erro:', err);
    
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
    console.error('❌ Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    // Em produção, pode querer fazer graceful shutdown
    if (process.env.NODE_ENV === 'production') {
        process.exit(1);
    }
});

// ============================================
// LOG DE INICIALIZAÇÃO
// ============================================

    console.log('');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║     SELF PROTEÇÃO VEICULAR - SERVIDOR v4.1                 ║');
    console.log('║     Sistema de Automação de Mensagens WhatsApp             ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║  🚀 Servidor rodando na porta ${PORT}                          ║`);
    console.log(`║  📁 Sessões: ${SESSIONS_DIR.substring(0, 42).padEnd(42)} ║`);
    console.log(`║  🌐 URL: http://localhost:${PORT}                               ║`);
    console.log(`║  🔄 Reconexão automática: ${MAX_RECONNECT_ATTEMPTS} tentativas                  ║`);
    console.log(`║  📬 Fila de mensagens: Ativa                               ║`);
    console.log(`║  🔒 Criptografia: Ativa                                    ║`);
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('✅ Servidor pronto para receber conexões!');
    console.log('');

    // Graceful shutdown (referências em closure)
    process.on('SIGTERM', async () => {
        console.log('⚠️  SIGTERM recebido, encerrando servidor...');
        queueService.stopProcessing();
        for (const [sessionId, session] of sessions.entries()) {
            try { await session.socket.end(); } catch (e) {}
        }
        closeDatabase();
        server.close(() => { console.log('✅ Servidor encerrado'); process.exit(0); });
    });

    process.on('SIGINT', async () => {
        console.log('⚠️  SIGINT recebido, encerrando servidor...');
        queueService.stopProcessing();
        closeDatabase();
        process.exit(0);
    });
};
