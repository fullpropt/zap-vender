const EventEmitter = require('events');
const { getDatabase } = require('../database/connection');

class PostgresAdvisoryLock extends EventEmitter {
    constructor(options = {}) {
        super();
        this.name = String(options.name || 'worker').trim() || 'worker';
        this.key1 = Number.isFinite(Number(options.key1)) ? Math.trunc(Number(options.key1)) : 0;
        this.key2 = Number.isFinite(Number(options.key2)) ? Math.trunc(Number(options.key2)) : 0;
        this.pollMs = Number.isFinite(Number(options.pollMs)) && Number(options.pollMs) > 0
            ? Math.trunc(Number(options.pollMs))
            : 5000;
        this.enabled = options.enabled !== false;

        this.intervalId = null;
        this.client = null;
        this.clientErrorHandler = null;
        this.lockHeld = false;
        this.started = false;
        this.ensureInFlight = false;
        this.lastState = 'unknown';
    }

    isHeld() {
        if (!this.enabled) return true;
        return this.lockHeld === true;
    }

    async start() {
        if (this.started) return this.isHeld();
        this.started = true;

        if (!this.enabled) {
            this.lockHeld = true;
            this.lastState = 'disabled';
            console.log(`[LeaderLock][${this.name}] desabilitado (processando sem lock)`);
            return true;
        }

        await this.ensure();
        this.intervalId = setInterval(() => {
            this.ensure().catch((error) => {
                console.error(`[LeaderLock][${this.name}] erro ao verificar lock:`, error.message);
            });
        }, this.pollMs);

        return this.lockHeld;
    }

    async stop() {
        this.started = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        await this.release();
    }

    async ensure() {
        if (!this.started || !this.enabled) return this.isHeld();
        if (this.ensureInFlight) return this.isHeld();

        this.ensureInFlight = true;
        try {
            if (this.client) {
                try {
                    await this.client.query('SELECT 1');
                    this.setState('leader');
                    return true;
                } catch (error) {
                    await this.handleClientLoss(error);
                }
            }

            const pool = getDatabase();
            const client = await pool.connect();
            const onError = (error) => {
                this.handleClientLoss(error).catch(() => {});
            };

            client.on('error', onError);

            try {
                const result = await client.query(
                    'SELECT pg_try_advisory_lock($1, $2) AS locked',
                    [this.key1, this.key2]
                );
                const locked = result?.rows?.[0]?.locked === true;

                if (locked) {
                    this.client = client;
                    this.clientErrorHandler = onError;
                    const becameLeader = !this.lockHeld;
                    this.lockHeld = true;
                    this.setState('leader');
                    if (becameLeader) {
                        console.log(`[LeaderLock][${this.name}] lock adquirido (${this.key1}, ${this.key2})`);
                        this.emit('acquired');
                    }
                    return true;
                }
            } catch (error) {
                try {
                    client.removeListener('error', onError);
                } catch (_) {
                    // noop
                }
                try {
                    client.release();
                } catch (_) {
                    // noop
                }
                throw error;
            }

            try {
                client.removeListener('error', onError);
            } catch (_) {
                // noop
            }
            try {
                client.release();
            } catch (_) {
                // noop
            }

            if (this.lockHeld) {
                this.lockHeld = false;
                this.emit('released');
            }
            this.setState('follower');
            return false;
        } finally {
            this.ensureInFlight = false;
        }
    }

    async release() {
        const hadLock = this.lockHeld;
        const client = this.client;
        const onError = this.clientErrorHandler;

        this.client = null;
        this.clientErrorHandler = null;
        this.lockHeld = false;

        if (client) {
            try {
                await client.query('SELECT pg_advisory_unlock($1, $2)', [this.key1, this.key2]);
            } catch (_) {
                // ignore unlock errors during shutdown/reconnect
            }
            if (onError) {
                try {
                    client.removeListener('error', onError);
                } catch (_) {
                    // noop
                }
            }
            try {
                client.release();
            } catch (_) {
                // noop
            }
        }

        if (hadLock) {
            console.warn(`[LeaderLock][${this.name}] lock liberado (${this.key1}, ${this.key2})`);
            this.emit('released');
        }
        this.setState(this.enabled ? 'follower' : 'disabled');
    }

    async handleClientLoss(error) {
        if (!this.client && !this.lockHeld) return;
        const message = String(error?.message || error || 'erro desconhecido');

        const hadLock = this.lockHeld;
        const client = this.client;
        const onError = this.clientErrorHandler;
        this.client = null;
        this.clientErrorHandler = null;
        this.lockHeld = false;

        if (client && onError) {
            try {
                client.removeListener('error', onError);
            } catch (_) {
                // noop
            }
        }
        if (client) {
            try {
                client.release();
            } catch (_) {
                // noop
            }
        }

        this.setState('follower');
        if (hadLock) {
            console.warn(`[LeaderLock][${this.name}] lock perdido: ${message}`);
            this.emit('lost', error);
        }
    }

    setState(nextState) {
        if (this.lastState === nextState) return;
        this.lastState = nextState;

        if (nextState === 'follower') {
            console.log(`[LeaderLock][${this.name}] em standby (sem lock)`);
        }
    }
}

module.exports = {
    PostgresAdvisoryLock
};
