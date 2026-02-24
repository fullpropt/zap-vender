const { query, queryOne, run } = require('../../database/connection');
const fs = require('fs');

const AUTH_STATE_TABLE = 'whatsapp_auth_state';
const CREDS_TYPE = 'creds';
const CREDS_KEY = '__creds__';

let ensureSchemaPromise = null;
const sessionWriteLocks = new Map();

function normalizeSessionId(value) {
    return String(value || '').trim();
}

function normalizeDriver(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return 'db';
    if (['db', 'database', 'postgres', 'postgresql', 'sql'].includes(normalized)) return 'db';
    if (['multi_file', 'multifile', 'file', 'files'].includes(normalized)) return 'multi_file';
    return normalized;
}

function buildLogger(logPrefix = '') {
    const prefix = String(logPrefix || '').trim();
    return {
        info: (...args) => console.log(prefix, ...args),
        warn: (...args) => console.warn(prefix, ...args),
        error: (...args) => console.error(prefix, ...args)
    };
}

async function ensureAuthStateSchema() {
    if (ensureSchemaPromise) return ensureSchemaPromise;

    ensureSchemaPromise = (async () => {
        await run(`
            CREATE TABLE IF NOT EXISTS ${AUTH_STATE_TABLE} (
                id SERIAL PRIMARY KEY,
                session_id TEXT NOT NULL,
                state_type TEXT NOT NULL,
                state_key TEXT NOT NULL,
                data_json TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (session_id, state_type, state_key)
            )
        `);
        await run(`CREATE INDEX IF NOT EXISTS idx_whatsapp_auth_state_session ON ${AUTH_STATE_TABLE}(session_id)`);
        await run(`CREATE INDEX IF NOT EXISTS idx_whatsapp_auth_state_lookup ON ${AUTH_STATE_TABLE}(session_id, state_type)`);
    })().catch((error) => {
        ensureSchemaPromise = null;
        throw error;
    });

    return ensureSchemaPromise;
}

async function withSessionWriteLock(sessionId, fn) {
    const key = normalizeSessionId(sessionId) || '__unknown__';
    const previous = sessionWriteLocks.get(key) || Promise.resolve();

    let release;
    const next = new Promise((resolve) => {
        release = resolve;
    });
    sessionWriteLocks.set(key, previous.then(() => next, () => next));

    try {
        await previous;
        return await fn();
    } finally {
        release();
        if (sessionWriteLocks.get(key) === next) {
            sessionWriteLocks.delete(key);
        }
    }
}

function serializeAuthValue(value, BufferJSON) {
    return JSON.stringify(value, BufferJSON?.replacer);
}

function deserializeAuthValue(raw, BufferJSON) {
    if (raw === null || raw === undefined || raw === '') return null;
    return JSON.parse(String(raw), BufferJSON?.reviver);
}

function maybeHydrateAppStateSyncKey(type, value, proto) {
    if (type !== 'app-state-sync-key' || !value || !proto?.Message?.AppStateSyncKeyData?.fromObject) {
        return value;
    }
    try {
        return proto.Message.AppStateSyncKeyData.fromObject(value);
    } catch (_) {
        return value;
    }
}

async function upsertAuthRow(sessionId, stateType, stateKey, payloadJson) {
    return await run(`
        INSERT INTO ${AUTH_STATE_TABLE} (session_id, state_type, state_key, data_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (session_id, state_type, state_key)
        DO UPDATE SET data_json = EXCLUDED.data_json, updated_at = CURRENT_TIMESTAMP
    `, [sessionId, stateType, stateKey, payloadJson]);
}

async function deleteAuthRow(sessionId, stateType, stateKey) {
    return await run(`
        DELETE FROM ${AUTH_STATE_TABLE}
        WHERE session_id = ? AND state_type = ? AND state_key = ?
    `, [sessionId, stateType, stateKey]);
}

async function loadDbAuthState(sessionId, baileys) {
    const normalizedSessionId = normalizeSessionId(sessionId);
    if (!normalizedSessionId) {
        throw new Error('sessionId invalido para auth state');
    }

    const { initAuthCreds, BufferJSON, proto } = baileys;
    if (typeof initAuthCreds !== 'function' || !BufferJSON) {
        throw new Error('Baileys nao exporta initAuthCreds/BufferJSON para auth state custom');
    }

    await ensureAuthStateSchema();

    const credsRow = await queryOne(
        `SELECT data_json FROM ${AUTH_STATE_TABLE} WHERE session_id = ? AND state_type = ? AND state_key = ? LIMIT 1`,
        [normalizedSessionId, CREDS_TYPE, CREDS_KEY]
    );
    const hasStoredState = Boolean(credsRow?.data_json);
    const creds = credsRow?.data_json
        ? (deserializeAuthValue(credsRow.data_json, BufferJSON) || initAuthCreds())
        : initAuthCreds();

    return {
        hasStoredState,
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const idList = Array.isArray(ids)
                        ? ids.map((id) => String(id || '')).filter(Boolean)
                        : [];
                    const response = {};

                    if (!idList.length) return response;

                    const placeholders = idList.map(() => '?').join(', ');
                    const rows = await query(
                        `SELECT state_key, data_json
                         FROM ${AUTH_STATE_TABLE}
                         WHERE session_id = ?
                           AND state_type = ?
                           AND state_key IN (${placeholders})`,
                        [normalizedSessionId, String(type || ''), ...idList]
                    );

                    const byKey = new Map();
                    for (const row of rows || []) {
                        byKey.set(String(row.state_key), row.data_json);
                    }

                    for (const id of idList) {
                        const rawValue = byKey.has(id) ? byKey.get(id) : null;
                        const parsed = rawValue ? deserializeAuthValue(rawValue, BufferJSON) : null;
                        response[id] = maybeHydrateAppStateSyncKey(String(type || ''), parsed, proto);
                    }

                    return response;
                },
                set: async (data) => {
                    await withSessionWriteLock(normalizedSessionId, async () => {
                        for (const category of Object.keys(data || {})) {
                            const categoryEntries = data?.[category] || {};
                            for (const id of Object.keys(categoryEntries)) {
                                const value = categoryEntries[id];
                                if (value) {
                                    await upsertAuthRow(
                                        normalizedSessionId,
                                        String(category),
                                        String(id),
                                        serializeAuthValue(value, BufferJSON)
                                    );
                                } else {
                                    await deleteAuthRow(normalizedSessionId, String(category), String(id));
                                }
                            }
                        }
                    });
                }
            }
        },
        saveCreds: async () => {
            await withSessionWriteLock(normalizedSessionId, async () => {
                await upsertAuthRow(
                    normalizedSessionId,
                    CREDS_TYPE,
                    CREDS_KEY,
                    serializeAuthValue(creds, BufferJSON)
                );
            });
        }
    };
}

async function hasPersistedBaileysAuthState(sessionId) {
    const normalizedSessionId = normalizeSessionId(sessionId);
    if (!normalizedSessionId) return false;
    await ensureAuthStateSchema();
    const row = await queryOne(
        `SELECT id
         FROM ${AUTH_STATE_TABLE}
         WHERE session_id = ?
         LIMIT 1`,
        [normalizedSessionId]
    );
    return !!row;
}

async function clearPersistedBaileysAuthState(sessionId) {
    const normalizedSessionId = normalizeSessionId(sessionId);
    if (!normalizedSessionId) return { changes: 0 };
    await ensureAuthStateSchema();
    return await run(`DELETE FROM ${AUTH_STATE_TABLE} WHERE session_id = ?`, [normalizedSessionId]);
}

async function createBaileysAuthState(options = {}) {
    const {
        sessionId,
        sessionPath,
        baileys,
        preferredDriver = 'db',
        fallbackToMultiFile = true,
        logPrefix = ''
    } = options;

    const logger = buildLogger(logPrefix);
    const driver = normalizeDriver(preferredDriver);
    if (!baileys || typeof baileys !== 'object') {
        throw new Error('Modulo Baileys obrigatorio para criar auth state');
    }

    if (driver === 'multi_file') {
        const { useMultiFileAuthState } = baileys;
        if (typeof useMultiFileAuthState !== 'function') {
            throw new Error('Baileys nao exporta useMultiFileAuthState');
        }
        const result = await useMultiFileAuthState(sessionPath);
        return { ...result, driver: 'multi_file' };
    }

    try {
        const result = await loadDbAuthState(sessionId, baileys);
        const hasLocalFolder = Boolean(sessionPath && fs.existsSync(sessionPath));
        if (!result.hasStoredState && hasLocalFolder) {
            throw new Error('Auth state DB vazio e sessao local existente (preservando multi_file)');
        }
        return { ...result, driver: 'db' };
    } catch (error) {
        if (!fallbackToMultiFile) {
            throw error;
        }

        const { useMultiFileAuthState } = baileys;
        if (typeof useMultiFileAuthState !== 'function') {
            throw error;
        }

        logger.warn(`Falha no auth state em banco (${error.message}). Usando fallback multi_file.`);
        const result = await useMultiFileAuthState(sessionPath);
        return { ...result, driver: 'multi_file' };
    }
}

module.exports = {
    createBaileysAuthState,
    ensureAuthStateSchema,
    hasPersistedBaileysAuthState,
    clearPersistedBaileysAuthState
};
