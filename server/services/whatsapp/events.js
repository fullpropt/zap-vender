/**
 * WhatsApp Events - listeners Baileys
 * connection.update, messages.upsert, messages.update, presence.update
 */

const qrcode = require('qrcode');

/**
 * Registrar todos os eventos no socket
 * @param {object} opts - { sock, sessionId, clientSocket, io, session, sessionPath, handlers }
 */
function registerEvents(opts) {
    const {
        sock,
        sessionId,
        clientSocket,
        io,
        session,
        sessionPath,
        handlers
    } = opts;

    const {
        persistSession,
        connectionFixer,
        DisconnectReason,
        maxReconnectAttempts = 5,
        reconnectDelay = 3000,
        onClose,
        onOpen
    } = handlers;

    const disconnectReason = DisconnectReason || { loggedOut: 401 };

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr: qrData } = update;

        if (qrData) {
            try {
                const qrDataUrl = await qrcode.toDataURL(qrData, {
                    width: 300,
                    margin: 2,
                    color: { dark: '#000000', light: '#ffffff' }
                });
                if (session) session.qrGenerated = true;
                clientSocket.emit('qr', { qr: qrDataUrl, sessionId, expiresIn: 30 });
                io.emit('whatsapp-qr', { qr: qrDataUrl, sessionId });
                persistSession?.(sessionId, 'qr_pending', { qr_code: qrDataUrl });
            } catch (err) {
                clientSocket.emit('error', { message: 'Erro ao gerar QR Code' });
            }
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== disconnectReason.loggedOut;
            persistSession?.(sessionId, 'disconnected');

            if (connectionFixer) {
                const errorInfo = connectionFixer.detectDisconnectReason(lastDisconnect?.error);
                if (errorInfo.action === 'clean_session' || errorInfo.action === 'regenerate_keys') {
                    await connectionFixer.applyFixAction(sessionPath, errorInfo.action);
                }
            }

            if (onClose) {
                await onClose({ sessionId, statusCode, shouldReconnect, session, clientSocket, io, sessionPath });
            }
        }

        if (connection === 'connecting') {
            clientSocket.emit('connecting', { sessionId });
            io.emit('whatsapp-status', { sessionId, status: 'connecting' });
        }

        if (connection === 'open' && session) {
            session.isConnected = true;
            session.reconnecting = false;
            session.user = {
                id: sock.user?.id,
                name: sock.user?.name || 'Usuário',
                pushName: sock.user?.verifiedName || sock.user?.name,
                phone: extractNumber(sock.user?.id)
            };
            clientSocket.emit('connected', { sessionId, user: session.user });
            io.emit('whatsapp-status', { sessionId, status: 'connected', user: session.user });
            persistSession?.(sessionId, 'connected', { last_connected_at: new Date().toISOString() });
            if (onOpen) onOpen(sessionId, session);
        }
    });

    if (handlers.onMessagesUpsert) sock.ev.on('messages.upsert', handlers.onMessagesUpsert);
    if (handlers.onMessagesUpdate) sock.ev.on('messages.update', handlers.onMessagesUpdate);
    if (handlers.onPresenceUpdate) sock.ev.on('presence.update', handlers.onPresenceUpdate);
    sock.ev.on('creds.update', handlers.saveCreds);
    sock.ev.on('error', (err) => {
        clientSocket.emit('error', { message: err.message });
    });
}

function extractNumber(jid) {
    if (!jid) return '';
    return String(jid).replace('@s.whatsapp.net', '').replace('@g.us', '');
}

module.exports = {
    registerEvents,
    extractNumber
};
