/**
 * SELF PROTEÇÃO VEICULAR - Middleware de Autenticação
 * Gerencia autenticação JWT e controle de acesso
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { User } = require('../database/models');

const JWT_SECRET = process.env.JWT_SECRET || 'self-protecao-jwt-secret-2024';
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
        role: user.role
    };
    
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
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
    
    return jwt.sign(payload, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });
}

/**
 * Verificar token JWT
 */
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
}

/**
 * Middleware de autenticação
 */
function authenticate(req, res, next) {
    // Verificar header Authorization
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ 
            error: 'Token não fornecido',
            code: 'NO_TOKEN'
        });
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    
    if (!decoded) {
        return res.status(401).json({ 
            error: 'Token inválido ou expirado',
            code: 'INVALID_TOKEN'
        });
    }
    
    // Verificar se usuário existe
    const user = User.findById(decoded.id);
    
    if (!user) {
        return res.status(401).json({ 
            error: 'Usuário não encontrado',
            code: 'USER_NOT_FOUND'
        });
    }
    
    if (!user.is_active) {
        return res.status(401).json({ 
            error: 'Usuário desativado',
            code: 'USER_INACTIVE'
        });
    }
    
    // Adicionar usuário à requisição
    req.user = {
        id: user.id,
        uuid: user.uuid,
        email: user.email,
        name: user.name,
        role: user.role
    };
    
    next();
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
function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const decoded = verifyToken(token);
        
        if (decoded) {
            const user = User.findById(decoded.id);
            if (user && user.is_active) {
                req.user = {
                    id: user.id,
                    uuid: user.uuid,
                    email: user.email,
                    name: user.name,
                    role: user.role
                };
            }
        }
    }
    
    next();
}

/**
 * Rate limiter por IP
 */
const rateLimitStore = new Map();

function rateLimit(options = {}) {
    const windowMs = options.windowMs || 60000; // 1 minuto
    const max = options.max || 100;
    const message = options.message || 'Muitas requisições, tente novamente mais tarde';
    
    return (req, res, next) => {
        const ip = req.ip || req.connection.remoteAddress;
        const key = `${ip}:${req.path}`;
        const now = Date.now();
        
        if (!rateLimitStore.has(key)) {
            rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
            return next();
        }
        
        const record = rateLimitStore.get(key);
        
        if (now > record.resetAt) {
            rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
            return next();
        }
        
        record.count++;
        
        if (record.count > max) {
            return res.status(429).json({ 
                error: message,
                code: 'RATE_LIMIT_EXCEEDED',
                retryAfter: Math.ceil((record.resetAt - now) / 1000)
            });
        }
        
        next();
    };
}

/**
 * Limpar rate limit store periodicamente
 */
setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
        if (now > record.resetAt) {
            rateLimitStore.delete(key);
        }
    }
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
