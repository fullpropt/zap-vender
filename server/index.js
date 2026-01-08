/**
 * SERVIDOR WHATSAPP - SELF PROTEÇÃO VEICULAR
 * Servidor Node.js com Baileys para integração WhatsApp
 * Versão robusta com reconexão automática, tratamento de erros e persistência de mensagens
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
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

// Configurações
const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0';
const SESSIONS_DIR = path.join(__dirname, '..', 'sessions');
const DATA_DIR = path.join(__dirname, '..', 'data');
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000;
const QR_TIMEOUT = 60000; // 60 segundos para escanear QR

// Criar diretórios se não existirem
[SESSIONS_DIR, DATA_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Inicializar Express
const app = express();
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Criar servidor HTTP
const server = http.createServer(app);

// Inicializar Socket.IO
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling']
});

// Armazenar sessões ativas
const sessions = new Map();
const reconnectAttempts = new Map();
const qrTimeouts = new Map();

// Logger silencioso
const logger = pino({ level: 'silent' });

// Armazenamento de mensagens em memória (persistido em arquivo)
let messagesStore = {};
let contactsStore = {};

// Carregar dados persistidos
function loadPersistedData() {
    try {
        const messagesPath = path.join(DATA_DIR, 'messages.json');
        const contactsPath = path.join(DATA_DIR, 'contacts.json');
        
        if (fs.existsSync(messagesPath)) {
            messagesStore = JSON.parse(fs.readFileSync(messagesPath, 'utf8'));
        }
        if (fs.existsSync(contactsPath)) {
            contactsStore = JSON.parse(fs.readFileSync(contactsPath, 'utf8'));
        }
        console.log('📂 Dados carregados com sucesso');
    } catch (error) {
        console.error('❌ Erro ao carregar dados:', error.message);
    }
}

// Salvar dados
function saveData() {
    try {
        fs.writeFileSync(path.join(DATA_DIR, 'messages.json'), JSON.stringify(messagesStore, null, 2));
        fs.writeFileSync(path.join(DATA_DIR, 'contacts.json'), JSON.stringify(contactsStore, null, 2));
    } catch (error) {
        console.error('❌ Erro ao salvar dados:', error.message);
    }
}

// Carregar dados ao iniciar
loadPersistedData();

// Salvar dados periodicamente
setInterval(saveData, 30000);

/**
 * Formatar número de telefone para JID
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
 * Criar sessão WhatsApp com reconexão automática
 */
async function createSession(sessionId, socket, attempt = 0) {
    const sessionPath = path.join(SESSIONS_DIR, sessionId);
    
    // Limpar timeout anterior se existir
    if (qrTimeouts.has(sessionId)) {
        clearTimeout(qrTimeouts.get(sessionId));
        qrTimeouts.delete(sessionId);
    }
    
    try {
        console.log(`[${sessionId}] Criando sessão... (Tentativa ${attempt + 1}/${MAX_RECONNECT_ATTEMPTS})`);
        
        // Carregar estado de autenticação
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
        
        // Obter versão mais recente
        const { version } = await fetchLatestBaileysVersion();
        console.log(`[${sessionId}] Usando Baileys versão: ${version.join('.')}`);
        
        // Criar socket WhatsApp
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
                // Buscar mensagem do store
                const jid = key.remoteJid;
                if (messagesStore[sessionId] && messagesStore[sessionId][jid]) {
                    const msg = messagesStore[sessionId][jid].find(m => m.id === key.id);
                    if (msg) return msg.message;
                }
                return { conversation: '' };
            }
        });
        
        // Salvar na lista de sessões
        sessions.set(sessionId, {
            socket: sock,
            clientSocket: socket,
            isConnected: false,
            user: null,
            reconnecting: false,
            qrGenerated: false
        });
        
        // Resetar contador de tentativas
        reconnectAttempts.set(sessionId, 0);
        
        // Eventos de conexão
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            const session = sessions.get(sessionId);
            
            if (qr) {
                try {
                    // Gerar QR Code como Data URL
                    const qrDataUrl = await qrcode.toDataURL(qr, {
                        width: 300,
                        margin: 2,
                        color: {
                            dark: '#000000',
                            light: '#ffffff'
                        }
                    });
                    
                    if (session) {
                        session.qrGenerated = true;
                    }
                    
                    socket.emit('qr', { 
                        qr: qrDataUrl, 
                        sessionId,
                        expiresIn: 30 // segundos
                    });
                    
                    console.log(`[${sessionId}] ✅ QR Code gerado com sucesso`);
                    
                    // Timeout para QR Code
                    const timeout = setTimeout(() => {
                        const currentSession = sessions.get(sessionId);
                        if (currentSession && !currentSession.isConnected) {
                            console.log(`[${sessionId}] ⏰ QR Code expirou`);
                            socket.emit('qr-expired', { sessionId });
                        }
                    }, QR_TIMEOUT);
                    
                    qrTimeouts.set(sessionId, timeout);
                    
                } catch (qrError) {
                    console.error(`[${sessionId}] ❌ Erro ao gerar QR Code:`, qrError.message);
                    socket.emit('error', { 
                        message: 'Erro ao gerar QR Code',
                        details: qrError.message
                    });
                }
            }
            
            if (connection === 'close') {
                // Limpar timeout do QR
                if (qrTimeouts.has(sessionId)) {
                    clearTimeout(qrTimeouts.get(sessionId));
                    qrTimeouts.delete(sessionId);
                }
                
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
                console.log(`[${sessionId}] Conexão fechada. Status: ${statusCode}. Reconectar: ${shouldReconnect}`);
                
                if (shouldReconnect) {
                    const currentAttempt = reconnectAttempts.get(sessionId) || 0;
                    
                    if (currentAttempt < MAX_RECONNECT_ATTEMPTS) {
                        reconnectAttempts.set(sessionId, currentAttempt + 1);
                        
                        if (session) {
                            session.reconnecting = true;
                            session.isConnected = false;
                        }
                        
                        socket.emit('reconnecting', { 
                            sessionId, 
                            attempt: currentAttempt + 1,
                            maxAttempts: MAX_RECONNECT_ATTEMPTS
                        });
                        
                        console.log(`[${sessionId}] Tentando reconectar em ${RECONNECT_DELAY}ms...`);
                        await delay(RECONNECT_DELAY);
                        
                        await createSession(sessionId, socket, currentAttempt + 1);
                    } else {
                        console.log(`[${sessionId}] Máximo de tentativas de reconexão atingido`);
                        sessions.delete(sessionId);
                        reconnectAttempts.delete(sessionId);
                        socket.emit('reconnect-failed', { sessionId });
                    }
                } else {
                    // Logout - limpar sessão
                    console.log(`[${sessionId}] Logout detectado - limpando sessão`);
                    sessions.delete(sessionId);
                    reconnectAttempts.delete(sessionId);
                    socket.emit('disconnected', { sessionId, reason: 'logged_out' });
                    
                    // Remover arquivos de sessão
                    if (fs.existsSync(sessionPath)) {
                        try {
                            fs.rmSync(sessionPath, { recursive: true, force: true });
                            console.log(`[${sessionId}] Arquivos de sessão removidos`);
                        } catch (error) {
                            console.error(`[${sessionId}] Erro ao remover arquivos:`, error.message);
                        }
                    }
                }
            }
            
            if (connection === 'connecting') {
                console.log(`[${sessionId}] Conectando...`);
                socket.emit('connecting', { sessionId });
            }
            
            if (connection === 'open') {
                // Limpar timeout do QR
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
                    
                    // Resetar tentativas
                    reconnectAttempts.set(sessionId, 0);
                    
                    // Inicializar store de mensagens para esta sessão
                    if (!messagesStore[sessionId]) {
                        messagesStore[sessionId] = {};
                    }
                    
                    socket.emit('connected', {
                        sessionId,
                        user: session.user
                    });
                    
                    // Broadcast para todos os clientes
                    io.emit('whatsapp-status', {
                        sessionId,
                        status: 'connected',
                        user: session.user
                    });
                    
                    console.log(`[${sessionId}] ✅ WhatsApp conectado: ${session.user.name} (${session.user.phone})`);
                }
            }
        });
        
        // Salvar credenciais
        sock.ev.on('creds.update', saveCreds);
        
        // Receber mensagens
        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type === 'notify' || type === 'append') {
                for (const msg of messages) {
                    const from = msg.key.remoteJid;
                    const isFromMe = msg.key.fromMe;
                    
                    // Ignorar mensagens de grupos por enquanto
                    if (from?.endsWith('@g.us')) continue;
                    
                    // Extrair texto da mensagem
                    let text = '';
                    if (msg.message) {
                        text = msg.message.conversation || 
                               msg.message.extendedTextMessage?.text || 
                               msg.message.imageMessage?.caption ||
                               msg.message.videoMessage?.caption ||
                               msg.message.documentMessage?.caption ||
                               '';
                    }
                    
                    // Determinar tipo de mídia
                    let mediaType = 'text';
                    if (msg.message?.imageMessage) mediaType = 'image';
                    else if (msg.message?.videoMessage) mediaType = 'video';
                    else if (msg.message?.audioMessage) mediaType = 'audio';
                    else if (msg.message?.documentMessage) mediaType = 'document';
                    else if (msg.message?.stickerMessage) mediaType = 'sticker';
                    
                    const messageData = {
                        id: msg.key.id,
                        sessionId,
                        from,
                        fromNumber: extractNumber(from),
                        text,
                        isFromMe,
                        mediaType,
                        timestamp: msg.messageTimestamp ? Number(msg.messageTimestamp) * 1000 : Date.now(),
                        pushName: msg.pushName || '',
                        status: isFromMe ? 'sent' : 'received'
                    };
                    
                    // Salvar mensagem no store
                    if (!messagesStore[sessionId]) {
                        messagesStore[sessionId] = {};
                    }
                    if (!messagesStore[sessionId][from]) {
                        messagesStore[sessionId][from] = [];
                    }
                    
                    // Evitar duplicatas
                    const exists = messagesStore[sessionId][from].find(m => m.id === messageData.id);
                    if (!exists) {
                        messagesStore[sessionId][from].push(messageData);
                        
                        // Manter apenas as últimas 100 mensagens por contato
                        if (messagesStore[sessionId][from].length > 100) {
                            messagesStore[sessionId][from] = messagesStore[sessionId][from].slice(-100);
                        }
                    }
                    
                    // Atualizar contato
                    if (!contactsStore[sessionId]) {
                        contactsStore[sessionId] = {};
                    }
                    contactsStore[sessionId][from] = {
                        jid: from,
                        number: extractNumber(from),
                        name: msg.pushName || extractNumber(from),
                        lastMessage: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
                        lastMessageTime: messageData.timestamp,
                        unreadCount: isFromMe ? 0 : (contactsStore[sessionId][from]?.unreadCount || 0) + 1
                    };
                    
                    // Emitir para o cliente conectado
                    const session = sessions.get(sessionId);
                    if (session && session.clientSocket) {
                        session.clientSocket.emit('message', messageData);
                    }
                    
                    // Broadcast para todos os clientes
                    io.emit('new-message', messageData);
                    
                    if (!isFromMe) {
                        console.log(`[${sessionId}] 📨 Mensagem de ${messageData.pushName || from}: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);
                    }
                }
            }
        });
        
        // Atualização de status de mensagem
        sock.ev.on('messages.update', (updates) => {
            for (const update of updates) {
                if (update.update.status) {
                    const statusMap = {
                        1: 'pending',
                        2: 'sent',
                        3: 'delivered',
                        4: 'read'
                    };
                    
                    io.emit('message-status', {
                        sessionId,
                        messageId: update.key.id,
                        remoteJid: update.key.remoteJid,
                        status: statusMap[update.update.status] || 'unknown'
                    });
                }
            }
        });
        
        // Tratamento de erros
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
            console.log(`[${sessionId}] Tentando novamente em ${RECONNECT_DELAY}ms...`);
            await delay(RECONNECT_DELAY);
            return await createSession(sessionId, socket, currentAttempt + 1);
        } else {
            socket.emit('error', { 
                message: 'Erro ao criar sessão WhatsApp após múltiplas tentativas',
                details: error.message
            });
            return null;
        }
    }
}

/**
 * Enviar mensagem com retry
 */
async function sendMessage(sessionId, to, message, type = 'text', retries = 3) {
    const session = sessions.get(sessionId);
    
    if (!session || !session.isConnected) {
        throw new Error('Sessão não está conectada');
    }
    
    const jid = formatJid(to);
    
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            let result;
            
            if (type === 'text') {
                result = await session.socket.sendMessage(jid, { text: message });
            } else if (type === 'image') {
                result = await session.socket.sendMessage(jid, {
                    image: { url: message.url },
                    caption: message.caption || ''
                });
            } else if (type === 'document') {
                result = await session.socket.sendMessage(jid, {
                    document: { url: message.url },
                    mimetype: message.mimetype || 'application/pdf',
                    fileName: message.fileName || 'document'
                });
            }
            
            // Salvar mensagem enviada
            const messageData = {
                id: result.key.id,
                sessionId,
                from: jid,
                fromNumber: extractNumber(jid),
                text: type === 'text' ? message : (message.caption || ''),
                isFromMe: true,
                mediaType: type,
                timestamp: Date.now(),
                status: 'sent'
            };
            
            if (!messagesStore[sessionId]) {
                messagesStore[sessionId] = {};
            }
            if (!messagesStore[sessionId][jid]) {
                messagesStore[sessionId][jid] = [];
            }
            messagesStore[sessionId][jid].push(messageData);
            
            console.log(`[${sessionId}] ✅ Mensagem enviada para ${to}`);
            return { ...result, messageData };
            
        } catch (error) {
            console.error(`[${sessionId}] ❌ Erro ao enviar mensagem (tentativa ${attempt + 1}/${retries}):`, error.message);
            
            if (attempt < retries - 1) {
                await delay(1000 * (attempt + 1));
            } else {
                throw error;
            }
        }
    }
}

/**
 * Verificar se sessão existe
 */
function sessionExists(sessionId) {
    const sessionPath = path.join(SESSIONS_DIR, sessionId);
    return fs.existsSync(sessionPath) && fs.existsSync(path.join(sessionPath, 'creds.json'));
}

// ============================================
// SOCKET.IO EVENTOS
// ============================================

io.on('connection', (socket) => {
    console.log('🔌 Cliente conectado:', socket.id);
    
    // Verificar sessão existente
    socket.on('check-session', async ({ sessionId }) => {
        console.log(`[${sessionId}] Verificando sessão...`);
        
        const session = sessions.get(sessionId);
        
        if (session && session.isConnected) {
            socket.emit('session-status', {
                status: 'connected',
                sessionId,
                user: session.user
            });
            console.log(`[${sessionId}] Sessão ativa encontrada`);
        } else if (sessionExists(sessionId)) {
            console.log(`[${sessionId}] Sessão salva encontrada - reconectando...`);
            socket.emit('session-status', {
                status: 'reconnecting',
                sessionId
            });
            await createSession(sessionId, socket);
        } else {
            socket.emit('session-status', {
                status: 'disconnected',
                sessionId
            });
            console.log(`[${sessionId}] Nenhuma sessão encontrada`);
        }
    });
    
    // Iniciar nova sessão
    socket.on('start-session', async ({ sessionId }) => {
        console.log(`[${sessionId}] 🚀 Iniciando nova sessão...`);
        
        // Verificar se já existe uma sessão ativa
        const existingSession = sessions.get(sessionId);
        if (existingSession && existingSession.isConnected) {
            socket.emit('session-status', {
                status: 'connected',
                sessionId,
                user: existingSession.user
            });
            return;
        }
        
        await createSession(sessionId, socket);
    });
    
    // Enviar mensagem
    socket.on('send-message', async ({ sessionId, to, message, type }) => {
        try {
            console.log(`[${sessionId}] 📤 Enviando mensagem para ${to}...`);
            const result = await sendMessage(sessionId, to, message, type);
            socket.emit('message-sent', {
                sessionId,
                to,
                message,
                messageId: result.key.id,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error(`[${sessionId}] ❌ Erro ao enviar:`, error.message);
            socket.emit('error', {
                message: error.message || 'Erro ao enviar mensagem',
                code: 'SEND_ERROR'
            });
        }
    });
    
    // Buscar mensagens de um contato
    socket.on('get-messages', ({ sessionId, contactJid }) => {
        const messages = messagesStore[sessionId]?.[contactJid] || [];
        socket.emit('messages-list', {
            sessionId,
            contactJid,
            messages: messages.sort((a, b) => a.timestamp - b.timestamp)
        });
    });
    
    // Buscar lista de contatos/conversas
    socket.on('get-contacts', ({ sessionId }) => {
        const contacts = contactsStore[sessionId] || {};
        const contactsList = Object.values(contacts).sort((a, b) => b.lastMessageTime - a.lastMessageTime);
        socket.emit('contacts-list', {
            sessionId,
            contacts: contactsList
        });
    });
    
    // Marcar conversa como lida
    socket.on('mark-read', ({ sessionId, contactJid }) => {
        if (contactsStore[sessionId] && contactsStore[sessionId][contactJid]) {
            contactsStore[sessionId][contactJid].unreadCount = 0;
        }
    });
    
    // Logout
    socket.on('logout', async ({ sessionId }) => {
        console.log(`[${sessionId}] 🚪 Logout solicitado`);
        const session = sessions.get(sessionId);
        
        // Limpar timeout do QR
        if (qrTimeouts.has(sessionId)) {
            clearTimeout(qrTimeouts.get(sessionId));
            qrTimeouts.delete(sessionId);
        }
        
        if (session) {
            try {
                await session.socket.logout();
            } catch (e) {
                console.log(`[${sessionId}] Erro ao fazer logout:`, e.message);
            }
            
            sessions.delete(sessionId);
            reconnectAttempts.delete(sessionId);
            
            // Remover arquivos de sessão
            const sessionPath = path.join(SESSIONS_DIR, sessionId);
            if (fs.existsSync(sessionPath)) {
                try {
                    fs.rmSync(sessionPath, { recursive: true, force: true });
                    console.log(`[${sessionId}] Arquivos removidos`);
                } catch (error) {
                    console.error(`[${sessionId}] Erro ao remover arquivos:`, error.message);
                }
            }
        }
        
        socket.emit('disconnected', { sessionId });
        io.emit('whatsapp-status', { sessionId, status: 'disconnected' });
    });
    
    // Reconectar sessão
    socket.on('reconnect-session', async ({ sessionId }) => {
        console.log(`[${sessionId}] 🔄 Reconexão solicitada`);
        const session = sessions.get(sessionId);
        
        if (session) {
            session.clientSocket = socket;
            if (session.isConnected) {
                socket.emit('session-status', {
                    status: 'connected',
                    sessionId,
                    user: session.user
                });
            } else if (session.reconnecting) {
                socket.emit('session-status', {
                    status: 'reconnecting',
                    sessionId
                });
            }
        } else if (sessionExists(sessionId)) {
            await createSession(sessionId, socket);
        }
    });
    
    // Desconexão
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
        sessions: sessions.size,
        activeSessions,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// Status de uma sessão
app.get('/api/session/:sessionId/status', (req, res) => {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);
    
    if (session) {
        res.json({
            status: session.isConnected ? 'connected' : (session.reconnecting ? 'reconnecting' : 'disconnected'),
            user: session.user,
            reconnecting: session.reconnecting
        });
    } else if (sessionExists(sessionId)) {
        res.json({ 
            status: 'saved',
            message: 'Sessão salva disponível para reconexão'
        });
    } else {
        res.json({ status: 'not_found' });
    }
});

// Enviar mensagem via API
app.post('/api/send', async (req, res) => {
    const { sessionId, to, message, type } = req.body;
    
    if (!sessionId || !to || !message) {
        return res.status(400).json({ 
            error: 'Parâmetros obrigatórios: sessionId, to, message' 
        });
    }
    
    try {
        const result = await sendMessage(sessionId, to, message, type || 'text');
        res.json({ 
            success: true, 
            message: 'Mensagem enviada',
            messageId: result.key.id,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ 
            error: error.message,
            code: 'SEND_ERROR'
        });
    }
});

// Buscar mensagens de um contato
app.get('/api/messages/:sessionId/:contactNumber', (req, res) => {
    const { sessionId, contactNumber } = req.params;
    const jid = formatJid(contactNumber);
    const messages = messagesStore[sessionId]?.[jid] || [];
    
    res.json({
        success: true,
        messages: messages.sort((a, b) => a.timestamp - b.timestamp)
    });
});

// Buscar lista de contatos
app.get('/api/contacts/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const contacts = contactsStore[sessionId] || {};
    const contactsList = Object.values(contacts).sort((a, b) => b.lastMessageTime - a.lastMessageTime);
    
    res.json({
        success: true,
        contacts: contactsList
    });
});

// Listar sessões
app.get('/api/sessions', (req, res) => {
    const sessionList = Array.from(sessions.entries()).map(([id, session]) => ({
        id,
        connected: session.isConnected,
        reconnecting: session.reconnecting,
        user: session.user
    }));
    
    res.json({
        sessions: sessionList,
        total: sessionList.length
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Rota principal - servir login.html como página inicial
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
});

// Outras rotas - servir arquivos estáticos
app.get('*', (req, res) => {
    const requestedFile = path.join(__dirname, '..', 'public', req.path);
    if (fs.existsSync(requestedFile)) {
        res.sendFile(requestedFile);
    } else {
        res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
    }
});

// ============================================
// TRATAMENTO DE ERROS GLOBAL
// ============================================

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
});

// ============================================
// INICIAR SERVIDOR
// ============================================

server.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║     SELF PROTEÇÃO VEICULAR - SERVIDOR WHATSAPP         ║');
    console.log('╠════════════════════════════════════════════════════════╣');
    console.log(`║  🚀 Servidor rodando na porta ${PORT}                      ║`);
    console.log(`║  📁 Sessões: ${SESSIONS_DIR.substring(0, 40).padEnd(40)} ║`);
    console.log(`║  🌐 URL: http://localhost:${PORT}                           ║`);
    console.log(`║  🔄 Reconexão automática: ${MAX_RECONNECT_ATTEMPTS} tentativas              ║`);
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('✅ Servidor pronto para receber conexões!');
    console.log('');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('⚠️  SIGTERM recebido, encerrando servidor...');
    
    // Salvar dados antes de encerrar
    saveData();
    
    // Fechar todas as sessões
    for (const [sessionId, session] of sessions.entries()) {
        try {
            await session.socket.end();
            console.log(`[${sessionId}] Sessão encerrada`);
        } catch (error) {
            console.error(`[${sessionId}] Erro ao encerrar:`, error.message);
        }
    }
    
    server.close(() => {
        console.log('✅ Servidor encerrado');
        process.exit(0);
    });
});

process.on('SIGINT', async () => {
    console.log('⚠️  SIGINT recebido, encerrando servidor...');
    saveData();
    process.exit(0);
});
