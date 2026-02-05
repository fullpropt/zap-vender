/**
 * SELF PROTEÇÃO VEICULAR - SERVIDOR PRINCIPAL v4.1
 * Carregado por server/start.js (bootstrap) após listen - app e server já criados.
 */

module.exports = function init(app, server) {
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Baileys
const { 
    default: makeWASocket, 
    DisconnectReason, 
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    delay
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode');

// Database
const { getDatabase, close: closeDatabase } = require('./database/connection');
const { migrate } = require('./database/migrate');
const { Lead, Conversation, Message, Template, Flow, Settings, User } = require('./database/models');

// Services
const webhookService = require('./services/webhookService');
const queueService = require('./services/queueService');
const flowService = require('./services/flowService');

// Middleware
const { authenticate, optionalAuth, requestLogger } = require('./middleware/auth');

// Encryption
const { encrypt, decrypt } = require('./utils/encryption');

// ============================================
// CONFIGURAÇÕES
// ============================================

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';
const SESSIONS_DIR = process.env.SESSIONS_DIR || path.join(__dirname, '..', 'sessions');
const UPLOADS_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
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

// Arquivos estáticos
app.use(express.static(path.join(__dirname, '..', 'public')));
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

// ============================================
// WHATSAPP - GERENCIAMENTO DE SESSÕES
// ============================================

const sessions = new Map();
const reconnectAttempts = new Map();
const qrTimeouts = new Map();
const typingStatus = new Map();

const logger = pino({ level: 'silent' });

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

/**
 * Formatar número para JID
 */
function formatJid(phone) {
    let cleaned = phone.replace(/[^0-9]/g, '');
    if (!cleaned.startsWith('55') && cleaned.length <= 11) {
        cleaned = '55' + cleaned;
    }
    return cleaned + '@s.whatsapp.net';
}

/**
 * Extrair número do JID
 */
function extractNumber(jid) {
    if (!jid) return '';
    return jid.replace('@s.whatsapp.net', '').replace('@g.us', '');
}

/**
 * Função de envio de mensagem (usada pelos serviços)
 */
async function sendMessageToWhatsApp(options) {
    const { to, jid, content, mediaType, mediaUrl, sessionId } = options;
    const targetJid = jid || formatJid(to);
    const session = sessions.get(sessionId || 'self_whatsapp_session');
    
    if (!session || !session.isConnected) {
        throw new Error('WhatsApp não está conectado');
    }
    
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
        result = await session.socket.sendMessage(targetJid, {
            audio: { url: mediaUrl },
            mimetype: 'audio/mp4',
            ptt: true
        });
    } else {
        result = await session.socket.sendMessage(targetJid, { text: content });
    }
    
    return result;
}

/**
 * Criar sessão WhatsApp
 */
async function createSession(sessionId, socket, attempt = 0) {
    const sessionPath = path.join(SESSIONS_DIR, sessionId);
    
    if (qrTimeouts.has(sessionId)) {
        clearTimeout(qrTimeouts.get(sessionId));
        qrTimeouts.delete(sessionId);
    }
    
    try {
        console.log(`[${sessionId}] Criando sessão... (Tentativa ${attempt + 1}/${MAX_RECONNECT_ATTEMPTS})`);
        
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
        const { version } = await fetchLatestBaileysVersion();
        
        console.log(`[${sessionId}] Usando Baileys versão: ${version.join('.')}`);
        
        const sock = makeWASocket({
            version,
            logger,
            printQRInTerminal: false,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger)
            },
            browser: ['SELF Proteção Veicular', 'Chrome', '120.0.0'],
            generateHighQualityLinkPreview: true,
            syncFullHistory: false,
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
        
        sessions.set(sessionId, {
            socket: sock,
            clientSocket: socket,
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
                    
                    socket.emit('qr', { qr: qrDataUrl, sessionId, expiresIn: 30 });
                    io.emit('whatsapp-qr', { qr: qrDataUrl, sessionId });
                    
                    // Webhook
                    webhookService.trigger('whatsapp.qr_generated', { sessionId });
                    
                    console.log(`[${sessionId}] ✅ QR Code gerado`);
                    
                    const timeout = setTimeout(() => {
                        const currentSession = sessions.get(sessionId);
                        if (currentSession && !currentSession.isConnected) {
                            socket.emit('qr-expired', { sessionId });
                        }
                    }, QR_TIMEOUT);
                    
                    qrTimeouts.set(sessionId, timeout);
                    
                } catch (qrError) {
                    console.error(`[${sessionId}] ❌ Erro ao gerar QR:`, qrError.message);
                    socket.emit('error', { message: 'Erro ao gerar QR Code' });
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
                
                // Webhook
                webhookService.trigger('whatsapp.disconnected', { sessionId, statusCode });
                
                if (shouldReconnect) {
                    const currentAttempt = reconnectAttempts.get(sessionId) || 0;
                    
                    if (currentAttempt < MAX_RECONNECT_ATTEMPTS) {
                        reconnectAttempts.set(sessionId, currentAttempt + 1);
                        
                        if (session) {
                            session.reconnecting = true;
                            session.isConnected = false;
                        }
                        
                        socket.emit('reconnecting', { sessionId, attempt: currentAttempt + 1 });
                        io.emit('whatsapp-status', { sessionId, status: 'reconnecting' });
                        
                        await delay(RECONNECT_DELAY);
                        await createSession(sessionId, socket, currentAttempt + 1);
                    } else {
                        sessions.delete(sessionId);
                        reconnectAttempts.delete(sessionId);
                        socket.emit('reconnect-failed', { sessionId });
                    }
                } else {
                    sessions.delete(sessionId);
                    reconnectAttempts.delete(sessionId);
                    socket.emit('disconnected', { sessionId, reason: 'logged_out' });
                    
                    if (fs.existsSync(sessionPath)) {
                        fs.rmSync(sessionPath, { recursive: true, force: true });
                    }
                }
            }
            
            if (connection === 'connecting') {
                socket.emit('connecting', { sessionId });
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
                    
                    socket.emit('connected', { sessionId, user: session.user });
                    io.emit('whatsapp-status', { sessionId, status: 'connected', user: session.user });
                    
                    // Webhook
                    webhookService.trigger('whatsapp.connected', { sessionId, user: session.user });
                    
                    console.log(`[${sessionId}] ✅ WhatsApp conectado: ${session.user.name}`);
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
                    const status = statusMap[update.update.status] || 'unknown';
                    
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
            socket.emit('error', { message: error.message });
        });
        
        return sock;
        
    } catch (error) {
        console.error(`[${sessionId}] ❌ Erro ao criar sessão:`, error.message);
        
        const currentAttempt = reconnectAttempts.get(sessionId) || 0;
        if (currentAttempt < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts.set(sessionId, currentAttempt + 1);
            await delay(RECONNECT_DELAY);
            return await createSession(sessionId, socket, currentAttempt + 1);
        } else {
            socket.emit('error', { message: 'Erro ao criar sessão WhatsApp' });
            return null;
        }
    }
}

/**
 * Processar mensagem recebida
 */
async function processIncomingMessage(sessionId, msg) {
    const from = msg.key.remoteJid;
    const isFromMe = msg.key.fromMe;
    
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
    
    const phone = extractNumber(from);
    
    // Buscar ou criar lead
    const { lead, created: leadCreated } = Lead.findOrCreate({
        phone,
        jid: from,
        name: msg.pushName || phone,
        source: 'whatsapp'
    });
    
    // Buscar ou criar conversa
    const { conversation, created: convCreated } = Conversation.findOrCreate({
        lead_id: lead.id,
        session_id: sessionId
    });
    
    // Salvar mensagem
    const messageData = {
        message_id: msg.key.id,
        conversation_id: conversation.id,
        lead_id: lead.id,
        sender_type: isFromMe ? 'agent' : 'lead',
        content: text,
        content_encrypted: encryptMessage(text),
        media_type: mediaType,
        status: isFromMe ? 'sent' : 'received',
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
        status: isFromMe ? 'sent' : 'received',
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
    
    // Salvar mensagem
    const savedMessage = Message.create({
        message_id: result.key.id,
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
    
    // Webhook
    webhookService.trigger('message.sent', {
        messageId: result.key.id,
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
    const sessionPath = path.join(SESSIONS_DIR, sessionId);
    return fs.existsSync(sessionPath) && fs.existsSync(path.join(sessionPath, 'creds.json'));
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

// ============================================
// SOCKET.IO EVENTOS
// ============================================

io.on('connection', (socket) => {
    console.log('🔌 Cliente conectado:', socket.id);
    
    socket.on('check-session', async ({ sessionId }) => {
        const session = sessions.get(sessionId);
        
        if (session && session.isConnected) {
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
        const { verifyPassword, generateToken, generateRefreshToken } = require('./middleware/auth');
        
        const user = User.findByEmail(email);
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
    res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
});

app.get('*', (req, res) => {
    const requestedFile = path.join(__dirname, '..', 'public', req.path);
    if (fs.existsSync(requestedFile)) {
        res.sendFile(requestedFile);
    } else {
        res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
    }
});

// ============================================
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
