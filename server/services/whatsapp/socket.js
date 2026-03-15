/**
 * WhatsApp Socket - makeWASocket (Baileys)
 * Engine principal de conexão
 */

const path = require('path');
const pino = require('pino');
const { getBaileys } = require('./baileysLoader');
const { loadAuthState } = require('./auth');
const { registerEvents } = require('./events');

const logger = pino({ level: 'silent' });

/**
 * Criar socket WhatsApp para uma sessão
 * @param {object} opts
 * @param {string} opts.sessionId
 * @param {string} opts.sessionsDir
 * @param {object} opts.clientSocket - { emit }
 * @param {object} opts.io - Socket.IO server
 * @param {object} opts.session - referência do Map
 * @param {object} opts.handlers - getMessage, onMessagesUpsert, onMessagesUpdate, onPresenceUpdate, persistSession, onClose, onOpen, connectionFixer
 * @returns {Promise<object>} sock
 */
async function createSocket(opts) {
    const {
        sessionId,
        sessionsDir,
        clientSocket,
        io,
        session,
        handlers = {}
    } = opts;

    const baileys = await getBaileys();
    const { default: makeWASocket, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = baileys;

    const sessionPath = path.join(sessionsDir, sessionId);
    const { state, saveCreds } = await loadAuthState(sessionId, sessionsDir);
    const { version } = await fetchLatestBaileysVersion();

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
        getMessage: handlers.getMessage
    });

    registerEvents({
        sock,
        sessionId,
        clientSocket,
        io,
        session,
        sessionPath,
        handlers: {
            ...handlers,
            saveCreds,
            DisconnectReason: baileys.DisconnectReason
        }
    });

    return sock;
}

async function getDelay() {
    const baileys = await getBaileys();
    return baileys.delay;
}

module.exports = {
    createSocket,
    getDelay
};
