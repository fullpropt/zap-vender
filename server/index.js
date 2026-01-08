/**
 * SERVIDOR WHATSAPP - SELF PROTEÇÃO VEICULAR
 * Servidor Node.js com Baileys para integração WhatsApp
 * Versão robusta com reconexão automática e tratamento de erros
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

// Configurações
const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0';
const SESSIONS_DIR = path.join(__dirname, '..', 'sessions');
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000;

// Criar diretório de sessões se não existir
if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

// Inicializar Express
const app = express();
app.use(cors());
app.use(express.json());
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
    pingInterval: 25000
});

// Armazenar sessões ativas
const sessions = new Map();
const reconnectAttempts = new Map();

// Logger silencioso
const logger = pino({ level: 'silent' });

/**
 * Criar sessão WhatsApp com reconexão automática
 */
async function createSession(sessionId, socket, attempt = 0) {
    const sessionPath = path.join(SESSIONS_DIR, sessionId);
    
    try {
        console.log(`[${sessionId}] Criando sessão... (Tentativa ${attempt + 1}/${MAX_RECONNECT_ATTEMPTS})`);
        
        // Carregar estado de autenticação
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
        
        // Obter versão mais recente
        const { version } = await fetchLatestBaileysVersion();
        
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
                return { conversation: '' };
            }
        });
        
        // Salvar na lista de sessões
        sessions.set(sessionId, {
            socket: sock,
            clientSocket: socket,
            isConnected: false,
            user: null,
            reconnecting: false
        });
        
        // Resetar contador de tentativas
        reconnectAttempts.set(sessionId, 0);
        
        // Eventos de conexão
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                // Gerar QR Code como Data URL
                const qrcode = require('qrcode');
                const qrDataUrl = await qrcode.toDataURL(qr);
                socket.emit('qr', { qr: qrDataUrl, sessionId });
                console.log(`[${sessionId}] QR Code gerado`);
            }
            
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
                console.log(`[${sessionId}] Conexão fechada. Status: ${statusCode}. Reconectar: ${shouldReconnect}`);
                
                if (shouldReconnect) {
                    const currentAttempt = reconnectAttempts.get(sessionId) || 0;
                    
                    if (currentAttempt < MAX_RECONNECT_ATTEMPTS) {
                        // Incrementar tentativas
                        reconnectAttempts.set(sessionId, currentAttempt + 1);
                        
                        // Marcar como reconectando
                        const session = sessions.get(sessionId);
                        if (session) {
                            session.reconnecting = true;
                            session.isConnected = false;
                        }
                        
                        // Notificar cliente
                        socket.emit('reconnecting', { 
                            sessionId, 
                            attempt: currentAttempt + 1,
                            maxAttempts: MAX_RECONNECT_ATTEMPTS
                        });
                        
                        // Aguardar antes de reconectar
                        console.log(`[${sessionId}] Tentando reconectar em ${RECONNECT_DELAY}ms...`);
                        await delay(RECONNECT_DELAY);
                        
                        // Tentar reconectar
                        await createSession(sessionId, socket, currentAttempt + 1);
                    } else {
                        // Máximo de tentativas atingido
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
                const session = sessions.get(sessionId);
                if (session) {
                    session.isConnected = true;
                    session.reconnecting = false;
                    session.user = {
                        id: sock.user?.id,
                        name: sock.user?.name || 'Usuário',
                        pushName: sock.user?.verifiedName || sock.user?.name
                    };
                    
                    // Resetar tentativas
                    reconnectAttempts.set(sessionId, 0);
                    
                    socket.emit('connected', {
                        sessionId,
                        user: session.user
                    });
                    
                    console.log(`[${sessionId}] ✅ WhatsApp conectado: ${session.user.name}`);
                }
            }
        });
        
        // Salvar credenciais
        sock.ev.on('creds.update', saveCreds);
        
        // Receber mensagens
        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type === 'notify') {
                for (const msg of messages) {
                    if (!msg.key.fromMe && msg.message) {
                        const from = msg.key.remoteJid;
                        const text = msg.message.conversation || 
                                    msg.message.extendedTextMessage?.text || 
                                    '';
                        
                        const messageData = {
                            sessionId,
                            from,
                            text,
                            timestamp: msg.messageTimestamp,
                            messageId: msg.key.id
                        };
                        
                        // Emitir para o cliente conectado
                        const session = sessions.get(sessionId);
                        if (session && session.clientSocket) {
                            session.clientSocket.emit('message', messageData);
                        }
                        
                        // Broadcast para todos os clientes
                        io.emit('message', messageData);
                        
                        console.log(`[${sessionId}] 📨 Mensagem de ${from}: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);
                    }
                }
            }
        });
        
        // Tratamento de erros
        sock.ev.on('error', (error) => {
            console.error(`[${sessionId}] ❌ Erro:`, error.message);
        });
        
        return sock;
        
    } catch (error) {
        console.error(`[${sessionId}] ❌ Erro ao criar sessão:`, error.message);
        
        // Tentar novamente se não atingiu o limite
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
    
    // Formatar número
    let jid = to.replace(/[^0-9]/g, '');
    if (!jid.includes('@')) {
        jid = jid + '@s.whatsapp.net';
    }
    
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
            }
            
            console.log(`[${sessionId}] ✅ Mensagem enviada para ${to}`);
            return result;
            
        } catch (error) {
            console.error(`[${sessionId}] ❌ Erro ao enviar mensagem (tentativa ${attempt + 1}/${retries}):`, error.message);
            
            if (attempt < retries - 1) {
                // Aguardar antes de tentar novamente
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
            // Sessão ativa
            socket.emit('session-status', {
                status: 'connected',
                sessionId,
                user: session.user
            });
            console.log(`[${sessionId}] Sessão ativa encontrada`);
        } else if (sessionExists(sessionId)) {
            // Sessão salva - tentar reconectar
            console.log(`[${sessionId}] Sessão salva encontrada - reconectando...`);
            socket.emit('session-status', {
                status: 'reconnecting',
                sessionId
            });
            await createSession(sessionId, socket);
        } else {
            // Nenhuma sessão
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
        await createSession(sessionId, socket);
    });
    
    // Enviar mensagem
    socket.on('send-message', async ({ sessionId, to, message, type }) => {
        try {
            console.log(`[${sessionId}] 📤 Enviando mensagem para ${to}...`);
            await sendMessage(sessionId, to, message, type);
            socket.emit('message-sent', {
                sessionId,
                to,
                message,
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
    
    // Logout
    socket.on('logout', async ({ sessionId }) => {
        console.log(`[${sessionId}] 🚪 Logout solicitado`);
        const session = sessions.get(sessionId);
        
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
        await sendMessage(sessionId, to, message, type || 'text');
        res.json({ 
            success: true, 
            message: 'Mensagem enviada',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ 
            error: error.message,
            code: 'SEND_ERROR'
        });
    }
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
    console.log(`║  📁 Sessões: ${SESSIONS_DIR.padEnd(40)} ║`);
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
