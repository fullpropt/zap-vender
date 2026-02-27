/**
 * Loader dinâmico para @whiskeysockets/baileys (ESM)
 * Evita erro: require() of ES Module not supported
 */

let baileysModule = null;

/**
 * Carregar Baileys via import() dinâmico (compatível com ESM)
 * @returns {Promise<object>} Módulo Baileys
 */
async function getBaileys() {
    if (baileysModule) return baileysModule;
    baileysModule = await import('@whiskeysockets/baileys');
    return baileysModule;
}

module.exports = { getBaileys };
