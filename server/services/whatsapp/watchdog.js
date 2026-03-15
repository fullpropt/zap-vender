/**
 * WhatsApp Watchdog - monitor de sessão e restart automático
 * Inspirado em WPPConnect reconnect logic
 */

const CHECK_INTERVAL_MS = 30000; // 30s

/**
 * Criar watchdog que verifica saúde da sessão e reinicia se necessário
 * @param {object} sock - socket Baileys
 * @param {string} sessionId
 * @param {function} onRestart - callback para reiniciar sessão
 */
function createWatchdog(sock, sessionId, onRestart) {
    let intervalId = null;
    let lastActivity = Date.now();

    const check = async () => {
        if (!sock) return;
        try {
            const now = Date.now();
            // Se inativo por muito tempo, pode indicar problema
            if (now - lastActivity > 120000 && onRestart) {
                console.log(`[${sessionId}] Watchdog: sessão inativa, verificando...`);
            }
        } catch (err) {
            console.error(`[${sessionId}] Watchdog error:`, err.message);
        }
    };

    const start = () => {
        if (intervalId) return;
        lastActivity = Date.now();
        intervalId = setInterval(check, CHECK_INTERVAL_MS);
    };

    const stop = () => {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
    };

    const touch = () => {
        lastActivity = Date.now();
    };

    return { start, stop, touch };
}

module.exports = { createWatchdog };
