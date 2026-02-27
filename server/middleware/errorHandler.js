/**
 * SELF PROTEÇÃO VEICULAR - Middleware de Tratamento de Erros
 * Captura e trata erros de forma consistente em toda a aplicação
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
 * Wrapper para funções assíncronas que captura erros automaticamente
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/**
 * Middleware de tratamento de erros global
 */
function errorHandler(err, req, res, next) {
    // Log do erro
    logger.error({
        err,
        req: {
            method: req.method,
            url: req.url,
            headers: req.headers,
            body: req.body,
            ip: req.ip
        }
    }, 'Erro na requisição');

    // Determinar código de status
    const statusCode = err.statusCode || err.status || 500;
    
    // Determinar mensagem de erro
    let message = err.message || 'Erro interno do servidor';
    
    // Em produção, não expor detalhes de erros internos
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
 * Middleware para rota não encontrada
 */
function notFoundHandler(req, res) {
    res.status(404).json({
        error: 'Rota não encontrada',
        path: req.path
    });
}

/**
 * Classe de erro customizada para validação
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
 * Classe de erro customizada para autenticação
 */
class AuthenticationError extends Error {
    constructor(message = 'Não autorizado') {
        super(message);
        this.name = 'AuthenticationError';
        this.statusCode = 401;
    }
}

/**
 * Classe de erro customizada para autorização
 */
class AuthorizationError extends Error {
    constructor(message = 'Acesso negado') {
        super(message);
        this.name = 'AuthorizationError';
        this.statusCode = 403;
    }
}

/**
 * Classe de erro customizada para recurso não encontrado
 */
class NotFoundError extends Error {
    constructor(message = 'Recurso não encontrado') {
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
