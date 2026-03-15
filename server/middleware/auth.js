/**
 * SELF PROTEÇÃO VEICULAR - Middleware de Autenticação
 * Gerencia autenticação JWT e controle de acesso
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { User } = require('../database/models');
const { queryOne, run } = require('../database/connection');

const JWT_SECRET = String(process.env.JWT_SECRET || '').trim();
const JWT_SECRET_DEV = String(process.env.JWT_SECRET_DEV || '').trim();
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production');
}
const JWT_SECRET_EFFECTIVE = JWT_SECRET || JWT_SECRET_DEV || crypto.randomBytes(32).toString('hex');
if (!JWT_SECRET && process.env.NODE_ENV !== 'production' && !JWT_SECRET_DEV) {
    console.warn('[Auth] JWT_SECRET nao definido; usando segredo efemero para ambiente local.');
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

/**
 * Gerar hash de senha
 */
function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
}

/**
 * Verificar senha
 */
function verifyPassword(password, storedHash) {
    if (!password || !storedHash) return false;

    // Hash legado em formato salt:hash (pbkdf2)
    if (storedHash.includes(':')) {
        const [salt, hash] = storedHash.split(':');
        if (!salt || !hash) return false;
        const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
        return hash === verifyHash;
    }

    // Compatibilidade com hashes bcrypt já existentes no banco
    try {
        return bcrypt.compareSync(password, storedHash);
    } catch (error) {
        return false;
    }
}

/**
 * Gerar token JWT
 */
function generateToken(user) {
    const payload = {
        id: user.id,
        uuid: user.uuid,
        email: user.email,
        role: user.role,
        owner_user_id: user.owner_user_id
    };
    
    return jwt.sign(payload, JWT_SECRET_EFFECTIVE, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Gerar refresh token
 */
function generateRefreshToken(user) {
    const payload = {
        id: user.id,
        uuid: user.uuid,
        type: 'refresh'
    };
    
    return jwt.sign(payload, JWT_SECRET_EFFECTIVE, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });
}

/**
 * Verificar token JWT
 */
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET_EFFECTIVE);
    } catch (error) {
        return null;
    }
}

/**
 * Middleware de autenticação
 */
async function authenticate(req, res, next) {
    try {
        // Verificar header Authorization
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                error: 'Token n?o fornecido',
                code: 'NO_TOKEN'
            });
        }
        
        const token = authHeader.split(' ')[1];
        const decoded = verifyToken(token);
        
        if (!decoded) {
            return res.status(401).json({ 
                error: 'Token inv?lido ou expirado',
                code: 'INVALID_TOKEN'
            });
        }
        
        // Verificar se usu?rio existe
        const user = await User.findById(decoded.id);
        
        if (!user) {
            return res.status(401).json({ 
                error: 'Usu?rio n?o encontrado',
                code: 'USER_NOT_FOUND'
            });
        }
        
        if (!user.is_active) {
            return res.status(401).json({ 
                error: 'Usu?rio desativado',
                code: 'USER_INACTIVE'
            });
        }
        
        // Adicionar usu?rio ? requisi??o
        req.user = {
            id: user.id,
            uuid: user.uuid,
            email: user.email,
            name: user.name,
            role: user.role,
            owner_user_id: user.owner_user_id
        };
        
        next();
    } catch (error) {
        return res.status(500).json({
            error: 'Erro interno de autentica??o',
            code: 'AUTH_INTERNAL_ERROR'
        });
    }
}

/**
 * Middleware de autorização por role
 */
function authorize(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ 
                error: 'Não autenticado',
                code: 'NOT_AUTHENTICATED'
            });
        }
        
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ 
                error: 'Acesso negado',
                code: 'ACCESS_DENIED'
            });
        }
        
        next();
    };
}

/**
 * Middleware opcional de autenticação (não bloqueia)
 */
async function optionalAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const decoded = verifyToken(token);
            
            if (decoded) {
                const user = await User.findById(decoded.id);
                if (user && user.is_active) {
                    req.user = {
                        id: user.id,
                        uuid: user.uuid,
                        email: user.email,
                        name: user.name,
                        role: user.role,
                        owner_user_id: user.owner_user_id
                    };
                }
            }
        }
    } catch (error) {
        // Autentica??o opcional n?o deve quebrar a request
    }
    
    next();
}

/**
 * Rate limiter por IP
 */
const rateLimitStore = new Map();
const RATE_LIMIT_STORAGE_MODE = String(process.env.RATE_LIMIT_STORAGE || 'database').trim().toLowerCase();
const DISTRIBUTED_RATE_LIMIT_ENABLED = RATE_LIMIT_STORAGE_MODE !== 'memory';
let rateLimitStorageReady = false;
let rateLimitStorageReadyPromise = null;

async function ensureRateLimitStorageReady() {
    if (!DISTRIBUTED_RATE_LIMIT_ENABLED) return false;
    if (rateLimitStorageReady) return true;
    if (rateLimitStorageReadyPromise) return rateLimitStorageReadyPromise;

    rateLimitStorageReadyPromise = (async () => {
        await run(`
            CREATE TABLE IF NOT EXISTS api_rate_limits (
                bucket_key TEXT PRIMARY KEY,
                count INTEGER NOT NULL DEFAULT 0,
                reset_at TIMESTAMPTZ NOT NULL,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await run('CREATE INDEX IF NOT EXISTS idx_api_rate_limits_reset ON api_rate_limits(reset_at)');
        rateLimitStorageReady = true;
        return true;
    })().finally(() => {
        rateLimitStorageReadyPromise = null;
    });

    return rateLimitStorageReadyPromise;
}

function applyInMemoryRateLimit(key, nowMs, windowMs, max) {
    if (!rateLimitStore.has(key)) {
        rateLimitStore.set(key, { count: 1, resetAt: nowMs + windowMs });
        return { allowed: true, retryAfter: Math.ceil(windowMs / 1000) };
    }

    const record = rateLimitStore.get(key);
    if (!record || nowMs > Number(record.resetAt || 0)) {
        rateLimitStore.set(key, { count: 1, resetAt: nowMs + windowMs });
        return { allowed: true, retryAfter: Math.ceil(windowMs / 1000) };
    }

    record.count = Number(record.count || 0) + 1;
    const retryAfter = Math.max(1, Math.ceil((Number(record.resetAt || nowMs) - nowMs) / 1000));
    return {
        allowed: Number(record.count || 0) <= max,
        retryAfter
    };
}

async function applyDistributedRateLimit(key, nowMs, windowMs, max) {
    await ensureRateLimitStorageReady();
    const resetAtIso = new Date(nowMs + windowMs).toISOString();

    const row = await queryOne(`
        INSERT INTO api_rate_limits (bucket_key, count, reset_at, updated_at)
        VALUES (?, 1, ?, CURRENT_TIMESTAMP)
        ON CONFLICT (bucket_key)
        DO UPDATE SET
            count = CASE
                WHEN api_rate_limits.reset_at <= CURRENT_TIMESTAMP THEN 1
                ELSE api_rate_limits.count + 1
            END,
            reset_at = CASE
                WHEN api_rate_limits.reset_at <= CURRENT_TIMESTAMP THEN EXCLUDED.reset_at
                ELSE api_rate_limits.reset_at
            END,
            updated_at = CURRENT_TIMESTAMP
        RETURNING count, reset_at
    `, [key, resetAtIso]);

    const count = Number(row?.count || 0);
    const resetAtMs = Date.parse(String(row?.reset_at || ''));
    const retryAfter = Number.isFinite(resetAtMs)
        ? Math.max(1, Math.ceil((resetAtMs - nowMs) / 1000))
        : Math.ceil(windowMs / 1000);

    return {
        allowed: count <= max,
        retryAfter
    };
}

function cleanupInMemoryRateLimit() {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
        if (now > Number(record?.resetAt || 0)) {
            rateLimitStore.delete(key);
        }
    }
}

async function cleanupDistributedRateLimit() {
    if (!DISTRIBUTED_RATE_LIMIT_ENABLED) return;
    if (!rateLimitStorageReady) return;
    await run(`
        DELETE FROM api_rate_limits
        WHERE reset_at <= (CURRENT_TIMESTAMP - INTERVAL '1 minute')
    `);
}

function rateLimit(options = {}) {
    const windowMs = options.windowMs || 60000; // 1 minuto
    const max = options.max || 100;
    const message = options.message || 'Muitas requisições, tente novamente mais tarde';
    
    return async (req, res, next) => {
        const ip = req.ip || req.connection.remoteAddress;
        const key = `${ip}:${req.path}`;
        const now = Date.now();

        let result;
        if (DISTRIBUTED_RATE_LIMIT_ENABLED) {
            try {
                result = await applyDistributedRateLimit(key, now, windowMs, max);
            } catch (_) {
                result = applyInMemoryRateLimit(key, now, windowMs, max);
            }
        } else {
            result = applyInMemoryRateLimit(key, now, windowMs, max);
        }

        if (!result?.allowed) {
            return res.status(429).json({ 
                error: message,
                code: 'RATE_LIMIT_EXCEEDED',
                retryAfter: Number(result?.retryAfter || Math.ceil(windowMs / 1000))
            });
        }

        next();
    };
}

/**
 * Limpar rate limit store periodicamente
 */
setInterval(() => {
    cleanupInMemoryRateLimit();
    void cleanupDistributedRateLimit();
}, 60000);

/**
 * Middleware de sanitização de entrada
 */
function sanitize(req, res, next) {
    const sanitizeValue = (value) => {
        if (typeof value === 'string') {
            // Remover caracteres perigosos
            return value
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/javascript:/gi, '')
                .replace(/on\w+=/gi, '');
        }
        if (typeof value === 'object' && value !== null) {
            for (const key in value) {
                value[key] = sanitizeValue(value[key]);
            }
        }
        return value;
    };
    
    if (req.body) {
        req.body = sanitizeValue(req.body);
    }
    
    if (req.query) {
        req.query = sanitizeValue(req.query);
    }
    
    if (req.params) {
        req.params = sanitizeValue(req.params);
    }
    
    next();
}

/**
 * Middleware de log de requisições
 */
function requestLogger(req, res, next) {
    const start = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        const log = {
            method: req.method,
            path: req.path,
            status: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip || req.connection.remoteAddress,
            user: req.user?.email || 'anonymous'
        };
        
        if (res.statusCode >= 400) {
            console.error('❌ Request:', JSON.stringify(log));
        } else if (process.env.NODE_ENV !== 'production') {
            console.log('📝 Request:', JSON.stringify(log));
        }
    });
    
    next();
}

/**
 * Middleware de CORS configurável
 */
function corsMiddleware(options = {}) {
    const allowedOrigins = options.origins || ['*'];
    const allowedMethods = options.methods || ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];
    const allowedHeaders = options.headers || ['Content-Type', 'Authorization', 'X-Requested-With'];
    
    return (req, res, next) => {
        const origin = req.headers.origin;
        
        if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin || '*');
        }
        
        res.setHeader('Access-Control-Allow-Methods', allowedMethods.join(', '));
        res.setHeader('Access-Control-Allow-Headers', allowedHeaders.join(', '));
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Max-Age', '86400');
        
        if (req.method === 'OPTIONS') {
            return res.status(204).end();
        }
        
        next();
    };
}

module.exports = {
    hashPassword,
    verifyPassword,
    generateToken,
    generateRefreshToken,
    verifyToken,
    authenticate,
    authorize,
    optionalAuth,
    rateLimit,
    sanitize,
    requestLogger,
    corsMiddleware
};
