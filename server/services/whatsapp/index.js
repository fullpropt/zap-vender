/**
 * WhatsApp Service - Engine central (Baileys)
 * useMultiFileAuthState, reconexão, messages.upsert, connection.update
 */

const path = require('path');
const fs = require('fs');
const { loadAuthState, sessionExists } = require('./auth');
const { createSocket, getDelay } = require('./socket');

const sessions = new Map();
const reconnectAttempts = new Map();
const qrTimeouts = new Map();
const typingStatus = new Map();

/**
 * Formatar número para JID
 */
function formatJid(phone) {
    let cleaned = String(phone).replace(/[^0-9]/g, '');
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
    return String(jid).replace('@s.whatsapp.net', '').replace('@g.us', '');
}

/**
 * Verificar se sessão existe
 */
function hasSession(sessionId, sessionsDir) {
    return sessionExists(sessionId, sessionsDir);
}

/**
 * Obter sessão ativa
 */
function getSession(sessionId) {
    return sessions.get(sessionId);
}

/**
 * Obter socket de uma sessão conectada
 */
function getSocket(sessionId) {
    const s = sessions.get(sessionId);
    return s?.isConnected ? s.socket : null;
}

/**
 * Iniciar sessão WhatsApp
 */
async function startSession(opts) {
    const {
        sessionId,
        sessionsDir,
        clientSocket,
        io,
        persistSession,
        connectionFixer,
        getMessage,
        onMessagesUpsert,
        onMessagesUpdate,
        onPresenceUpdate,
        maxReconnectAttempts = 5,
        reconnectDelay = 3000,
        qrTimeout = 60000
    } = opts;

    const client = clientSocket || { emit: () => {} };
    const sessionPath = path.join(sessionsDir, sessionId);

    if (qrTimeouts.has(sessionId)) {
        clearTimeout(qrTimeouts.get(sessionId));
        qrTimeouts.delete(sessionId);
    }

    const attempt = reconnectAttempts.get(sessionId) || 0;

    try {
        persistSession?.(sessionId, 'connecting');

        if (connectionFixer?.validateSession) {
            const validation = await connectionFixer.validateSession(sessionPath);
            if (!validation.valid && attempt === 0) {
                await connectionFixer.fixSession(sessionPath);
            }
        }

        const session = {
            socket: null,
            clientSocket: client,
            isConnected: false,
            user: null,
            reconnecting: false,
            qrGenerated: false
        };
        sessions.set(sessionId, session);

        const sock = await createSocket({
            sessionId,
            sessionsDir,
            clientSocket: client,
            io,
            session,
            handlers: {
                getMessage,
                onMessagesUpsert: async (ev) => {
                    if (ev.type === 'notify' || ev.type === 'append') {
                        for (const msg of ev.messages || []) {
                            await onMessagesUpsert?.(sessionId, msg);
                        }
                    }
                },
                onMessagesUpdate: onMessagesUpdate,
                onPresenceUpdate: (presence) => {
                    const jid = presence.id;
                    const isTyping = presence.presences?.[jid]?.lastKnownPresence === 'composing';
                    typingStatus.set(jid, isTyping);
                    io.emit('typing-status', { sessionId, jid, isTyping, name: presence.presences?.[jid]?.name });
                },
                persistSession,
                connectionFixer,
                maxReconnectAttempts,
                reconnectDelay,
                onClose: async ({ sessionId: sid, statusCode, shouldReconnect, sessionPath: sp }) => {
                    if (!shouldReconnect) {
                        sessions.delete(sid);
                        reconnectAttempts.delete(sid);
                        client.emit('disconnected', { sessionId: sid, reason: 'logged_out' });
                        const p = sp || sessionPath;
                        if (fs.existsSync(p)) {
                            fs.rmSync(p, { recursive: true, force: true });
                        }
                        return;
                    }
                    const current = reconnectAttempts.get(sid) || 0;
                    if (current < maxReconnectAttempts) {
                        reconnectAttempts.set(sid, current + 1);
                        session.reconnecting = true;
                        session.isConnected = false;
                        client.emit('reconnecting', { sessionId: sid, attempt: current + 1 });
                        io.emit('whatsapp-status', { sessionId: sid, status: 'reconnecting' });
                        const delayFn = await getDelay();
                        await delayFn(reconnectDelay);
                        await startSession({ ...opts, clientSocket: client });
                    } else {
                        sessions.delete(sid);
                        reconnectAttempts.delete(sid);
                        client.emit('reconnect-failed', { sessionId: sid });
                    }
                },
                onOpen: (sid, s) => {
                    reconnectAttempts.set(sid, 0);
                    if (connectionFixer?.createHealthMonitor) {
                        s.healthMonitor = connectionFixer.createHealthMonitor(s.socket, sid);
                    }
                }
            }
        });

        session.socket = sock;
        return sock;
    } catch (error) {
        const current = reconnectAttempts.get(sessionId) || 0;
        if (current < maxReconnectAttempts) {
            reconnectAttempts.set(sessionId, current + 1);
            const delayFn = await getDelay();
            await delayFn(reconnectDelay);
            return startSession({ ...opts, clientSocket: client });
        }
        client.emit('error', { message: 'Erro ao criar sessão WhatsApp' });
        throw error;
    }
}

/**
 * Reidratar sessões salvas no boot
 */
async function rehydrateSessions(io, sessionsDir, query, persistSession, connectionFixer, getMessage, onMessagesUpsert, onMessagesUpdate) {
    try {
        const rows = query('SELECT session_id FROM whatsapp_sessions') || [];
        const list = Array.isArray(rows) ? rows : rows.rows || [];
        for (const row of list) {
            const sessionId = row.session_id;
            if (hasSession(sessionId, sessionsDir)) {
                await startSession({
                    sessionId,
                    sessionsDir,
                    clientSocket: null,
                    io,
                    persistSession,
                    connectionFixer,
                    getMessage,
                    onMessagesUpsert,
                    onMessagesUpdate
                });
            }
        }
    } catch (err) {
        console.error('❌ Erro ao reidratar sessões:', err.message);
    }
}

/**
 * Enviar mensagem via sessão
 */
async function sendMessage(sessionId, targetJid, content, options = {}) {
    const s = sessions.get(sessionId);
    if (!s?.isConnected || !s.socket) throw new Error('WhatsApp não está conectado');
    const jid = targetJid || formatJid(options.to);
    const { mediaType, mediaUrl, mimetype, fileName } = options;

    if (mediaType === 'image' && mediaUrl) {
        return s.socket.sendMessage(jid, { image: { url: mediaUrl }, caption: content || '' });
    }
    if (mediaType === 'document' && mediaUrl) {
        return s.socket.sendMessage(jid, {
            document: { url: mediaUrl },
            mimetype: mimetype || 'application/pdf',
            fileName: fileName || 'documento'
        });
    }
    if (mediaType === 'audio' && mediaUrl) {
        return s.socket.sendMessage(jid, {
            audio: { url: mediaUrl },
            mimetype: mimetype || 'audio/ogg; codecs=opus',
            ptt: options.ptt !== false
        });
    }
    return s.socket.sendMessage(jid, { text: content });
}

/**
 * Logout / desconectar sessão
 */
async function logoutSession(sessionId, sessionsDir) {
    const s = sessions.get(sessionId);
    if (s?.socket) {
        try { await s.socket.logout(); } catch (_) {}
    }
    sessions.delete(sessionId);
    reconnectAttempts.delete(sessionId);
    const sessionPath = path.join(sessionsDir, sessionId);
    if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
    }
}

module.exports = {
    sessions,
    reconnectAttempts,
    qrTimeouts,
    typingStatus,
    formatJid,
    extractNumber,
    hasSession,
    getSession,
    getSocket,
    startSession,
    rehydrateSessions,
    sendMessage,
    logoutSession
};
