/**
 * SELF PROTECAO VEICULAR - Middleware de Tratamento de Erros
 * Captura e trata erros de forma consistente em toda a aplicacao
 */

const pino = require('pino');
const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV !== 'production' ? {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname'
        }
    } : undefined
});

/**
 * Wrapper para funcoes assincronas que captura erros automaticamente
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

const SENSITIVE_HEADER_KEYS = new Set([
    'authorization',
    'proxy-authorization',
    'cookie',
    'set-cookie',
    'x-api-key'
]);

const SENSITIVE_BODY_KEYS = new Set([
    'password',
    'newpassword',
    'currentpassword',
    'token',
    'refreshtoken',
    'secret',
    'apikey',
    'api_key',
    'authorization',
    'cookie'
]);

function sanitizeHeadersForLog(headers = {}) {
    const safe = {};
    if (!headers || typeof headers !== 'object') return safe;

    for (const [key, value] of Object.entries(headers)) {
        const normalizedKey = String(key || '').toLowerCase().trim();
        if (!normalizedKey) continue;
        safe[key] = SENSITIVE_HEADER_KEYS.has(normalizedKey) ? '[REDACTED]' : value;
    }

    return safe;
}

function sanitizeBodyForLog(value, depth = 0) {
    if (value === null || value === undefined) return value;
    if (depth > 6) return '[TRUNCATED]';

    if (Array.isArray(value)) {
        return value.slice(0, 20).map((item) => sanitizeBodyForLog(item, depth + 1));
    }

    if (typeof value === 'object') {
        const safe = {};
        for (const [key, item] of Object.entries(value)) {
            const normalizedKey = String(key || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            if (SENSITIVE_BODY_KEYS.has(normalizedKey)) {
                safe[key] = '[REDACTED]';
                continue;
            }
            safe[key] = sanitizeBodyForLog(item, depth + 1);
        }
        return safe;
    }

    if (typeof value === 'string' && value.length > 600) {
        return `${value.slice(0, 600)}...[TRUNCATED]`;
    }

    return value;
}

/**
 * Middleware de tratamento de erros global
 */
function errorHandler(err, req, res, next) {
    const safeHeaders = sanitizeHeadersForLog(req.headers || {});
    const safeBody = sanitizeBodyForLog(req.body);

    // Log do erro
    logger.error({
        err,
        req: {
            method: req.method,
            url: req.url,
            headers: safeHeaders,
            body: safeBody,
            ip: req.ip
        }
    }, 'Erro na requisicao');

    // Determinar codigo de status
    const statusCode = err.statusCode || err.status || 500;

    // Determinar mensagem de erro
    let message = err.message || 'Erro interno do servidor';

    // Em producao, nao expor detalhes de erros internos
    if (process.env.NODE_ENV === 'production' && statusCode === 500) {
        message = 'Erro interno do servidor';
    }

    // Responder com erro
    res.status(statusCode).json({
        error: message,
        ...(process.env.NODE_ENV !== 'production' && {
            stack: err.stack,
            details: err.details
        })
    });
}

/**
 * Middleware para rota nao encontrada
 */
function notFoundHandler(req, res) {
    res.status(404).json({
        error: 'Rota nao encontrada',
        path: req.path
    });
}

/**
 * Classe de erro customizada para validacao
 */
class ValidationError extends Error {
    constructor(message, details = null) {
        super(message);
        this.name = 'ValidationError';
        this.statusCode = 400;
        this.details = details;
    }
}

/**
 * Classe de erro customizada para autenticacao
 */
class AuthenticationError extends Error {
    constructor(message = 'Nao autorizado') {
        super(message);
        this.name = 'AuthenticationError';
        this.statusCode = 401;
    }
}

/**
 * Classe de erro customizada para autorizacao
 */
class AuthorizationError extends Error {
    constructor(message = 'Acesso negado') {
        super(message);
        this.name = 'AuthorizationError';
        this.statusCode = 403;
    }
}

/**
 * Classe de erro customizada para recurso nao encontrado
 */
class NotFoundError extends Error {
    constructor(message = 'Recurso nao encontrado') {
        super(message);
        this.name = 'NotFoundError';
        this.statusCode = 404;
    }
}

module.exports = {
    asyncHandler,
    errorHandler,
    notFoundHandler,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    logger
};
