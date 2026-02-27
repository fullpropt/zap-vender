/**
 * SELF PROTEÇÃO VEICULAR - Connection Fixer
 * Corrige problemas comuns de conexão identificados nos projetos GitHub
 * Baseado em análise de problemas: Bad Mac, Failed to Decrypt, Closed Session
 */

const fs = require('fs');
const path = require('path');

class ConnectionFixer {
    constructor() {
        this.maxRetries = 5;
        this.retryDelays = [1000, 2000, 4000, 8000, 16000]; // Backoff exponencial
    }

    /**
     * Limpa sessão corrompida
     * Corrige problema: Bad Mac, Failed to Decrypt
     */
    async cleanCorruptedSession(sessionPath) {
        try {
            if (!fs.existsSync(sessionPath)) {
                return { cleaned: false, reason: 'Sessão não existe' };
            }

            const credsPath = path.join(sessionPath, 'creds.json');
            const keysPath = path.join(sessionPath, 'keys');

            // Verificar se creds.json está corrompido
            if (fs.existsSync(credsPath)) {
                try {
                    const credsContent = fs.readFileSync(credsPath, 'utf8');
                    JSON.parse(credsContent);
                } catch (error) {
                    console.warn(`[ConnectionFixer] Creds corrompidos, removendo...`);
                    fs.unlinkSync(credsPath);
                }
            }

            // Limpar chaves se necessário
            if (fs.existsSync(keysPath)) {
                const keyFiles = fs.readdirSync(keysPath);
                if (keyFiles.length === 0) {
                    fs.rmdirSync(keysPath);
                }
            }

            return { cleaned: true, sessionPath };
        } catch (error) {
            console.error('[ConnectionFixer] Erro ao limpar sessão:', error.message);
            return { cleaned: false, error: error.message };
        }
    }

    /**
     * Regenera chaves de sessão
     * Corrige problema: Invalid PreKey, No session
     */
    async regenerateSessionKeys(sessionPath) {
        try {
            const keysPath = path.join(sessionPath, 'keys');
            
            if (fs.existsSync(keysPath)) {
                // Remover chaves antigas
                fs.rmSync(keysPath, { recursive: true, force: true });
            }

            // Criar diretório de chaves novamente
            fs.mkdirSync(keysPath, { recursive: true });

            return { regenerated: true, keysPath };
        } catch (error) {
            console.error('[ConnectionFixer] Erro ao regenerar chaves:', error.message);
            return { regenerated: false, error: error.message };
        }
    }

    /**
     * Valida integridade da sessão
     */
    async validateSession(sessionPath) {
        const issues = [];
        
        try {
            if (!fs.existsSync(sessionPath)) {
                issues.push('Sessão não existe');
                return { valid: false, issues };
            }

            const credsPath = path.join(sessionPath, 'creds.json');
            const keysPath = path.join(sessionPath, 'keys');

            // Verificar creds.json
            if (!fs.existsSync(credsPath)) {
                issues.push('creds.json não encontrado');
            } else {
                try {
                    const credsContent = fs.readFileSync(credsPath, 'utf8');
                    const creds = JSON.parse(credsContent);
                    
                    if (!creds.me || !creds.me.id) {
                        issues.push('creds.json inválido (sem me.id)');
                    }
                } catch (error) {
                    issues.push(`creds.json corrompido: ${error.message}`);
                }
            }

            // Verificar chaves
            if (!fs.existsSync(keysPath)) {
                issues.push('Diretório de chaves não encontrado');
            } else {
                const keyFiles = fs.readdirSync(keysPath);
                if (keyFiles.length === 0) {
                    issues.push('Nenhuma chave encontrada');
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
     * Corrige sessão automaticamente
     */
    async fixSession(sessionPath) {
        try {
            console.log(`[ConnectionFixer] Corrigindo sessão: ${sessionPath}`);

            // Validar primeiro
            const validation = await this.validateSession(sessionPath);
            
            if (validation.valid) {
                return { fixed: false, reason: 'Sessão já está válida' };
            }

            console.log(`[ConnectionFixer] Problemas encontrados: ${validation.issues.join(', ')}`);

            // Limpar sessão corrompida
            await this.cleanCorruptedSession(sessionPath);

            // Regenerar chaves se necessário
            const keysResult = await this.regenerateSessionKeys(sessionPath);

            return {
                fixed: true,
                cleaned: true,
                keysRegenerated: keysResult.regenerated,
                issues: validation.issues
            };
        } catch (error) {
            console.error('[ConnectionFixer] Erro ao corrigir sessão:', error.message);
            return {
                fixed: false,
                error: error.message
            };
        }
    }

    /**
     * Backoff exponencial para reconexão
     * Corrige problema: Reconexão muito rápida causando bloqueios
     */
    getRetryDelay(attempt) {
        if (attempt >= this.retryDelays.length) {
            return this.retryDelays[this.retryDelays.length - 1];
        }
        return this.retryDelays[attempt];
    }

    /**
     * Detecta tipo de erro de desconexão
     */
    detectDisconnectReason(error) {
        const errorMessage = error?.message?.toLowerCase() || '';
        const statusCode = error?.output?.statusCode;

        if (statusCode === 401 || errorMessage.includes('bad mac')) {
            return { type: 'auth_failed', action: 'clean_session' };
        }
        
        if (statusCode === 403 || errorMessage.includes('forbidden')) {
            return { type: 'blocked', action: 'wait_and_retry' };
        }
        
        if (statusCode === 408 || errorMessage.includes('timeout')) {
            return { type: 'timeout', action: 'retry' };
        }
        
        if (errorMessage.includes('decrypt') || errorMessage.includes('invalid prekey')) {
            return { type: 'decrypt_failed', action: 'regenerate_keys' };
        }
        
        if (errorMessage.includes('closed') || errorMessage.includes('connection closed')) {
            return { type: 'connection_closed', action: 'reconnect' };
        }

        return { type: 'unknown', action: 'retry' };
    }

    /**
     * Aplica ação baseada no tipo de erro
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
                return { applied: false, reason: 'Ação desconhecida' };
        }
    }

    /**
     * Monitora saúde da conexão
     */
    createHealthMonitor(socket, sessionId) {
        let lastPing = Date.now();
        let consecutiveErrors = 0;
        const maxErrors = 3;

        const healthCheck = setInterval(() => {
            const timeSinceLastPing = Date.now() - lastPing;
            
            // Se não houve atividade em 5 minutos, pode estar desconectado
            if (timeSinceLastPing > 5 * 60 * 1000) {
                console.warn(`[ConnectionFixer] Sessão ${sessionId} pode estar desconectada (sem atividade há ${Math.floor(timeSinceLastPing / 1000)}s)`);
            }
        }, 60000); // Verificar a cada minuto

        // Monitorar erros
        socket.ev.on('connection.update', (update) => {
            if (update.connection === 'close') {
                consecutiveErrors++;
                lastPing = Date.now();

                if (consecutiveErrors >= maxErrors) {
                    console.error(`[ConnectionFixer] Muitos erros consecutivos na sessão ${sessionId}`);
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
