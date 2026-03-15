/**
 * SELF PROTEÇÃO VEICULAR - Middleware de Validação
 * Valida dados de entrada para prevenir injeções e dados inválidos
 */

const { ValidationError } = require('./errorHandler');
const { DEFAULT_WHATSAPP_SESSION_ID } = require('../config/sessionDefaults');

/**
 * Valida se um campo é obrigatório
 */
function required(value, fieldName) {
    if (value === undefined || value === null || value === '') {
        throw new ValidationError(`O campo '${fieldName}' é obrigatório`);
    }
    return value;
}

/**
 * Valida email
 */
function isEmail(value, fieldName = 'email') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
        throw new ValidationError(`O campo '${fieldName}' deve ser um email válido`);
    }
    return value;
}

/**
 * Valida telefone brasileiro
 */
function isPhone(value, fieldName = 'phone') {
    const cleaned = String(value).replace(/\D/g, '');
    if (cleaned.length < 10 || cleaned.length > 13) {
        throw new ValidationError(`O campo '${fieldName}' deve ser um telefone válido`);
    }
    return cleaned;
}

/**
 * Valida string com tamanho mínimo e máximo
 */
function isString(value, fieldName, options = {}) {
    const { min = 0, max = Infinity, pattern = null } = options;
    
    if (typeof value !== 'string') {
        throw new ValidationError(`O campo '${fieldName}' deve ser uma string`);
    }
    
    if (value.length < min) {
        throw new ValidationError(`O campo '${fieldName}' deve ter no mínimo ${min} caracteres`);
    }
    
    if (value.length > max) {
        throw new ValidationError(`O campo '${fieldName}' deve ter no máximo ${max} caracteres`);
    }
    
    if (pattern && !pattern.test(value)) {
        throw new ValidationError(`O campo '${fieldName}' possui formato inválido`);
    }
    
    return value;
}

/**
 * Valida número inteiro
 */
function isInteger(value, fieldName, options = {}) {
    const { min = -Infinity, max = Infinity } = options;
    const num = parseInt(value);
    
    if (isNaN(num)) {
        throw new ValidationError(`O campo '${fieldName}' deve ser um número inteiro`);
    }
    
    if (num < min || num > max) {
        throw new ValidationError(`O campo '${fieldName}' deve estar entre ${min} e ${max}`);
    }
    
    return num;
}

/**
 * Valida se valor está em uma lista de opções
 */
function isIn(value, fieldName, options) {
    if (!options.includes(value)) {
        throw new ValidationError(`O campo '${fieldName}' deve ser um dos seguintes valores: ${options.join(', ')}`);
    }
    return value;
}

/**
 * Sanitiza string removendo caracteres perigosos
 */
function sanitizeString(value) {
    if (typeof value !== 'string') return value;
    
    // Remove tags HTML
    let sanitized = value.replace(/<[^>]*>/g, '');
    
    // Remove caracteres de controle
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
    
    return sanitized.trim();
}

/**
 * Sanitiza objeto recursivamente
 */
function sanitizeObject(obj) {
    if (typeof obj !== 'object' || obj === null) {
        return sanitizeString(obj);
    }
    
    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
    }
    
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitizeObject(value);
    }
    
    return sanitized;
}

/**
 * Middleware de validação para criação de lead
 */
function validateLeadCreation(req, res, next) {
    try {
        const { phone, name, email, vehicle, plate } = req.body;
        
        // Validações obrigatórias
        required(phone, 'phone');
        const validPhone = isPhone(phone, 'phone');
        
        // Validações opcionais
        const validData = {
            phone: validPhone,
            phone_formatted: req.body.phone_formatted || phone
        };
        
        if (name) {
            validData.name = isString(sanitizeString(name), 'name', { min: 2, max: 100 });
        }
        
        if (email) {
            validData.email = isEmail(sanitizeString(email), 'email');
        }
        
        if (vehicle) {
            validData.vehicle = isString(sanitizeString(vehicle), 'vehicle', { max: 100 });
        }
        
        if (plate) {
            validData.plate = isString(sanitizeString(plate), 'plate', { max: 20 });
        }
        
        if (req.body.status) {
            validData.status = isInteger(req.body.status, 'status', { min: 1, max: 5 });
        }
        
        // Substituir body com dados validados
        req.validatedData = validData;
        next();
    } catch (error) {
        next(error);
    }
}

/**
 * Middleware de validação para envio de mensagem
 */
function validateMessageSend(req, res, next) {
    try {
        const { to, message, sessionId, type } = req.body;
        
        required(to, 'to');
        required(message, 'message');
        
        const validData = {
            to: isPhone(to, 'to'),
            message: isString(sanitizeString(message), 'message', { min: 1, max: 4096 }),
            sessionId: sessionId || DEFAULT_WHATSAPP_SESSION_ID
        };
        
        if (type) {
            validData.type = isIn(type, 'type', ['text', 'image', 'video', 'audio', 'document']);
        }
        
        req.validatedData = validData;
        next();
    } catch (error) {
        next(error);
    }
}

/**
 * Middleware de validação para login
 */
function validateLogin(req, res, next) {
    try {
        const { email, password } = req.body;
        
        required(email, 'email');
        required(password, 'password');
        
        const validData = {
            email: sanitizeString(email).toLowerCase().trim(),
            password: password
        };
        
        req.validatedData = validData;
        next();
    } catch (error) {
        next(error);
    }
}

/**
 * Middleware de validação para paginação
 */
function validatePagination(req, res, next) {
    try {
        const limit = req.query.limit ? isInteger(req.query.limit, 'limit', { min: 1, max: 100 }) : 50;
        const offset = req.query.offset ? isInteger(req.query.offset, 'offset', { min: 0 }) : 0;
        
        req.pagination = { limit, offset };
        next();
    } catch (error) {
        next(error);
    }
}

/**
 * Middleware genérico de sanitização
 */
function sanitizeInput(req, res, next) {
    if (req.body) {
        req.body = sanitizeObject(req.body);
    }
    if (req.query) {
        req.query = sanitizeObject(req.query);
    }
    next();
}

module.exports = {
    required,
    isEmail,
    isPhone,
    isString,
    isInteger,
    isIn,
    sanitizeString,
    sanitizeObject,
    sanitizeInput,
    validateLeadCreation,
    validateMessageSend,
    validateLogin,
    validatePagination
};
