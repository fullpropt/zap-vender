/**
 * SELF PROTECAO VEICULAR - Connection Fixer
 * Corrige problemas comuns de conexao com modo conservador para auth state.
 */

const fs = require('fs');
const path = require('path');

class ConnectionFixer {
    constructor() {
        this.maxRetries = 5;
        this.retryDelays = [1000, 2000, 4000, 8000, 16000];
    }

    /**
     * Limpa sessao corrompida sem apagar chaves validas.
     * Remove somente creds.json quando o JSON esta de fato invalido.
     */
    async cleanCorruptedSession(sessionPath) {
        try {
            if (!fs.existsSync(sessionPath)) {
                return { cleaned: false, reason: 'Sessao nao existe' };
            }

            const credsPath = path.join(sessionPath, 'creds.json');

            if (fs.existsSync(credsPath)) {
                try {
                    const credsContent = fs.readFileSync(credsPath, 'utf8');
                    JSON.parse(credsContent);
                } catch (error) {
                    console.warn('[ConnectionFixer] Creds corrompidos, removendo creds.json...');
                    fs.unlinkSync(credsPath);
                }
            }

            return { cleaned: true, sessionPath };
        } catch (error) {
            console.error('[ConnectionFixer] Erro ao limpar sessao:', error.message);
            return { cleaned: false, error: error.message };
        }
    }

    /**
     * Regenera chaves de sessao (uso manual/assistido).
     * Nao deve ser executado automaticamente em erros de decrypt transitorios.
     */
    async regenerateSessionKeys(sessionPath) {
        try {
            const keysPath = path.join(sessionPath, 'keys');

            if (fs.existsSync(keysPath)) {
                fs.rmSync(keysPath, { recursive: true, force: true });
            }

            fs.mkdirSync(keysPath, { recursive: true });

            return { regenerated: true, keysPath };
        } catch (error) {
            console.error('[ConnectionFixer] Erro ao regenerar chaves:', error.message);
            return { regenerated: false, error: error.message };
        }
    }

    /**
     * Valida integridade minima da sessao.
     * Mantem checagem conservadora para evitar auto-fix destrutivo.
     */
    async validateSession(sessionPath) {
        const issues = [];

        try {
            if (!fs.existsSync(sessionPath)) {
                issues.push('Sessao nao existe');
                return { valid: false, issues };
            }

            const credsPath = path.join(sessionPath, 'creds.json');

            // Nao validamos estrutura de "keys" porque o formato do Baileys varia.
            if (!fs.existsSync(credsPath)) {
                issues.push('creds.json nao encontrado');
            } else {
                try {
                    const credsContent = fs.readFileSync(credsPath, 'utf8');
                    JSON.parse(credsContent);
                } catch (error) {
                    issues.push(`creds.json corrompido: ${error.message}`);
                }
            }

            return {
                valid: issues.length === 0,
                issues
            };
        } catch (error) {
            return {
                valid: false,
                issues: [`Erro ao validar: ${error.message}`]
            };
        }
    }

    /**
     * Corrige sessao automaticamente em modo conservador.
     */
    async fixSession(sessionPath) {
        try {
            console.log(`[ConnectionFixer] Corrigindo sessao: ${sessionPath}`);

            const validation = await this.validateSession(sessionPath);
            if (validation.valid) {
                return { fixed: false, reason: 'Sessao ja esta valida' };
            }

            console.log(`[ConnectionFixer] Problemas encontrados: ${validation.issues.join(', ')}`);

            await this.cleanCorruptedSession(sessionPath);

            return {
                fixed: true,
                cleaned: true,
                keysRegenerated: false,
                issues: validation.issues
            };
        } catch (error) {
            console.error('[ConnectionFixer] Erro ao corrigir sessao:', error.message);
            return {
                fixed: false,
                error: error.message
            };
        }
    }

    /**
     * Backoff exponencial para reconexao.
     */
    getRetryDelay(attempt) {
        if (attempt >= this.retryDelays.length) {
            return this.retryDelays[this.retryDelays.length - 1];
        }
        return this.retryDelays[attempt];
    }

    /**
     * Detecta tipo de erro de desconexao.
     */
    detectDisconnectReason(error) {
        const errorMessage = (error?.message || '').toLowerCase();
        const statusCode = error?.output?.statusCode;

        if (statusCode === 401) {
            return { type: 'auth_failed', action: 'clean_session' };
        }

        if (statusCode === 403 || errorMessage.includes('forbidden')) {
            return { type: 'blocked', action: 'wait_and_retry' };
        }

        if (statusCode === 408 || errorMessage.includes('timeout')) {
            return { type: 'timeout', action: 'retry' };
        }

        if (
            errorMessage.includes('bad mac')
            || errorMessage.includes('decrypt')
            || errorMessage.includes('invalid prekey')
        ) {
            // Bad MAC tende a ser transitorio durante rotacao de pre-key.
            // Evitar limpeza/regeneracao automatica de auth state.
            return { type: 'decrypt_failed', action: 'retry' };
        }

        if (errorMessage.includes('closed') || errorMessage.includes('connection closed')) {
            return { type: 'connection_closed', action: 'reconnect' };
        }

        return { type: 'unknown', action: 'retry' };
    }

    /**
     * Aplica acao baseada no tipo de erro.
     */
    async applyFixAction(sessionPath, action) {
        switch (action) {
            case 'clean_session':
                return await this.cleanCorruptedSession(sessionPath);

            case 'regenerate_keys':
                return await this.regenerateSessionKeys(sessionPath);

            case 'fix_session':
                return await this.fixSession(sessionPath);

            default:
                return { applied: false, reason: 'Acao desconhecida' };
        }
    }

    /**
     * Monitora saude da conexao.
     */
    createHealthMonitor(socket, sessionId) {
        let lastPing = Date.now();
        let consecutiveErrors = 0;
        const maxErrors = 3;

        const healthCheck = setInterval(() => {
            const timeSinceLastPing = Date.now() - lastPing;
            if (timeSinceLastPing > 5 * 60 * 1000) {
                console.warn(
                    `[ConnectionFixer] Sessao ${sessionId} pode estar desconectada (sem atividade ha ${Math.floor(timeSinceLastPing / 1000)}s)`
                );
            }
        }, 60000);

        socket.ev.on('connection.update', (update) => {
            if (update.connection === 'close') {
                consecutiveErrors += 1;
                lastPing = Date.now();

                if (consecutiveErrors >= maxErrors) {
                    console.error(`[ConnectionFixer] Muitos erros consecutivos na sessao ${sessionId}`);
                }
            } else if (update.connection === 'open') {
                consecutiveErrors = 0;
                lastPing = Date.now();
            }
        });

        return {
            stop: () => clearInterval(healthCheck),
            getStats: () => ({
                lastPing,
                consecutiveErrors,
                timeSinceLastPing: Date.now() - lastPing
            })
        };
    }
}

module.exports = new ConnectionFixer();
module.exports.ConnectionFixer = ConnectionFixer;
