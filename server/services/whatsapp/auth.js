/**
 * WhatsApp Auth - useMultiFileAuthState (Baileys)
 * Persistência de sessão em disco para reconexão sem QR
 */

const path = require('path');
const fs = require('fs');
const { getBaileys } = require('./baileysLoader');

/**
 * Carregar auth state de uma sessão
 * @param {string} sessionId
 * @param {string} sessionsDir
 * @returns {Promise<{state: object, saveCreds: function}>}
 */
async function loadAuthState(sessionId, sessionsDir) {
    const sessionPath = path.join(sessionsDir, sessionId);
    if (!fs.existsSync(sessionPath)) {
        fs.mkdirSync(sessionPath, { recursive: true });
    }
    const baileys = await getBaileys();
    return baileys.useMultiFileAuthState(sessionPath);
}

/**
 * Verificar se sessão existe (creds.json presente)
 * @param {string} sessionId
 * @param {string} sessionsDir
 */
function sessionExists(sessionId, sessionsDir) {
    const sessionPath = path.join(sessionsDir, sessionId);
    return fs.existsSync(sessionPath) && fs.existsSync(path.join(sessionPath, 'creds.json'));
}

module.exports = {
    loadAuthState,
    sessionExists
};
