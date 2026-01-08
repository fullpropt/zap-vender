/**
 * SERVIDOR WHATSAPP - SELF PROTEÇÃO VEICULAR
 * Servidor Node.js com Baileys para integração WhatsApp
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
    makeCacheableSignalKeyStore
} = require('@whiskeysockets/baileys');
const pino = require('pino');

// Configurações
const PORT = process.env.PORT || 3001;
const SESSIONS_DIR = path.join(__dirname, '..', 'sessions');

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
    }
});

// Armazenar sessões ativas
const sessions = new Map();

// Logger silencioso
const logger = pino({ level: 'silent' });

/**
 * Criar sessão WhatsApp
 */
async function createSession(sessionId, socket) {
    const sessionPath = path.join(SESSIONS_DIR, sessionId);
    
    try {
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
            generateHighQualityLinkPreview: true
        });
        
        // Salvar na lista de sessões
        sessions.set(sessionId, {
            socket: sock,
            clientSocket: socket,
            isConnected: false,
            user: null
        });
        
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
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log(`[${sessionId}] Conexão fechada. Reconectar: ${shouldReconnect}`);
                
                if (shouldReconnect) {
                    // Tentar reconectar
                    setTimeout(() => createSession(sessionId, socket), 3000);
                } else {
                    // Limpar sessão
                    sessions.delete(sessionId);
                    socket.emit('disconnected', { sessionId });
                    
                    // Remover arquivos de sessão
                    if (fs.existsSync(sessionPath)) {
                        fs.rmSync(sessionPath, { recursive: true, force: true });
                    }
                }
            }
            
            if (connection === 'open') {
                const session = sessions.get(sessionId);
                if (session) {
                    session.isConnected = true;
                    session.user = {
                        id: sock.user?.id,
                        name: sock.user?.name || 'Usuário'
                    };
                    
                    socket.emit('connected', {
                        sessionId,
                        user: session.user
                    });
                    
                    console.log(`[${sessionId}] WhatsApp conectado: ${session.user.name}`);
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
                        
                        socket.emit('message', {
                            sessionId,
                            from,
                            text,
                            timestamp: msg.messageTimestamp
                        });
                        
                        console.log(`[${sessionId}] Mensagem recebida de ${from}: ${text.substring(0, 50)}`);
                    }
                }
            }
        });
        
        return sock;
        
    } catch (error) {
        console.error(`[${sessionId}] Erro ao criar sessão:`, error);
        socket.emit('error', { message: 'Erro ao criar sessão WhatsApp' });
        return null;
    }
}

/**
 * Enviar mensagem
 */
async function sendMessage(sessionId, to, message, type = 'text') {
    const session = sessions.get(sessionId);
    
    if (!session || !session.isConnected) {
        throw new Error('Sessão não está conectada');
    }
    
    // Formatar número
    let jid = to.replace(/[^0-9]/g, '');
    if (!jid.includes('@')) {
        jid = jid + '@s.whatsapp.net';
    }
    
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
        
        console.log(`[${sessionId}] Mensagem enviada para ${to}`);
        return result;
        
    } catch (error) {
        console.error(`[${sessionId}] Erro ao enviar mensagem:`, error);
        throw error;
    }
}

// ============================================
// SOCKET.IO EVENTOS
// ============================================

io.on('connection', (socket) => {
    console.log('Cliente conectado:', socket.id);
    
    // Verificar sessão existente
    socket.on('check-session', async ({ sessionId }) => {
        const session = sessions.get(sessionId);
        
        if (session && session.isConnected) {
            socket.emit('session-status', {
                status: 'connected',
                sessionId,
                user: session.user
            });
        } else {
            // Verificar se existe sessão salva
            const sessionPath = path.join(SESSIONS_DIR, sessionId);
            if (fs.existsSync(sessionPath)) {
                // Tentar reconectar
                await createSession(sessionId, socket);
            } else {
                socket.emit('session-status', {
                    status: 'disconnected',
                    sessionId
                });
            }
        }
    });
    
    // Iniciar nova sessão
    socket.on('start-session', async ({ sessionId }) => {
        console.log(`Iniciando sessão: ${sessionId}`);
        await createSession(sessionId, socket);
    });
    
    // Enviar mensagem
    socket.on('send-message', async ({ sessionId, to, message, type }) => {
        try {
            await sendMessage(sessionId, to, message, type);
            socket.emit('message-sent', {
                sessionId,
                to,
                message,
                timestamp: Date.now()
            });
        } catch (error) {
            socket.emit('error', {
                message: error.message || 'Erro ao enviar mensagem'
            });
        }
    });
    
    // Logout
    socket.on('logout', async ({ sessionId }) => {
        const session = sessions.get(sessionId);
        
        if (session) {
            try {
                await session.socket.logout();
            } catch (e) {
                console.log('Erro ao fazer logout:', e.message);
            }
            
            sessions.delete(sessionId);
            
            // Remover arquivos de sessão
            const sessionPath = path.join(SESSIONS_DIR, sessionId);
            if (fs.existsSync(sessionPath)) {
                fs.rmSync(sessionPath, { recursive: true, force: true });
            }
        }
        
        socket.emit('disconnected', { sessionId });
    });
    
    // Reconectar sessão
    socket.on('reconnect-session', async ({ sessionId }) => {
        const session = sessions.get(sessionId);
        if (session) {
            session.clientSocket = socket;
            if (session.isConnected) {
                socket.emit('session-status', {
                    status: 'connected',
                    sessionId,
                    user: session.user
                });
            }
        }
    });
    
    // Desconexão
    socket.on('disconnect', () => {
        console.log('Cliente desconectado:', socket.id);
    });
});

// ============================================
// ROTAS API REST
// ============================================

// Status do servidor
app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        sessions: sessions.size,
        uptime: process.uptime()
    });
});

// Status de uma sessão
app.get('/api/session/:sessionId/status', (req, res) => {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);
    
    if (session) {
        res.json({
            status: session.isConnected ? 'connected' : 'disconnected',
            user: session.user
        });
    } else {
        res.json({ status: 'not_found' });
    }
});

// Enviar mensagem via API
app.post('/api/send', async (req, res) => {
    const { sessionId, to, message, type } = req.body;
    
    if (!sessionId || !to || !message) {
        return res.status(400).json({ error: 'Parâmetros obrigatórios: sessionId, to, message' });
    }
    
    try {
        await sendMessage(sessionId, to, message, type || 'text');
        res.json({ success: true, message: 'Mensagem enviada' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Rota principal - servir index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
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
    console.log(`║  📁 Sessões: ${SESSIONS_DIR}`);
    console.log('║  📱 Acesse: http://localhost:' + PORT + '                       ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log('');
});
