/**
 * SELF PROTEÇÃO VEICULAR - Módulo de Criptografia
 * Criptografia AES-256 para mensagens e dados sensíveis
 */

const crypto = require('crypto');

// Configurações
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 64;
const PBKDF2_ITERATIONS = 100000;

// Chave mestra (deve ser configurada via variável de ambiente)
const MASTER_KEY = process.env.ENCRYPTION_KEY || 'self-protecao-veicular-master-key-2024';

/**
 * Derivar chave a partir de senha
 */
function deriveKey(password, salt) {
    return crypto.pbkdf2Sync(
        password,
        salt,
        PBKDF2_ITERATIONS,
        KEY_LENGTH,
        'sha512'
    );
}

/**
 * Gerar chave de criptografia derivada da chave mestra
 */
function getEncryptionKey() {
    // Usar hash SHA-256 da chave mestra como chave de criptografia
    return crypto.createHash('sha256').update(MASTER_KEY).digest();
}

/**
 * Criptografar texto
 * @param {string} plaintext - Texto a ser criptografado
 * @returns {string} - Texto criptografado em formato base64
 */
function encrypt(plaintext) {
    if (!plaintext) return null;
    
    try {
        const key = getEncryptionKey();
        const iv = crypto.randomBytes(IV_LENGTH);
        
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
        
        let encrypted = cipher.update(plaintext, 'utf8', 'base64');
        encrypted += cipher.final('base64');
        
        const authTag = cipher.getAuthTag();
        
        // Formato: iv:authTag:encrypted
        return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
    } catch (error) {
        console.error('Erro ao criptografar:', error.message);
        return null;
    }
}

/**
 * Descriptografar texto
 * @param {string} ciphertext - Texto criptografado
 * @returns {string} - Texto original
 */
function decrypt(ciphertext) {
    if (!ciphertext) return null;
    
    try {
        const parts = ciphertext.split(':');
        if (parts.length !== 3) {
            // Tentar formato antigo (CryptoJS)
            return decryptLegacy(ciphertext);
        }
        
        const [ivBase64, authTagBase64, encrypted] = parts;
        
        const key = getEncryptionKey();
        const iv = Buffer.from(ivBase64, 'base64');
        const authTag = Buffer.from(authTagBase64, 'base64');
        
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(encrypted, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (error) {
        console.error('Erro ao descriptografar:', error.message);
        return null;
    }
}

/**
 * Descriptografar formato legado (CryptoJS AES)
 */
function decryptLegacy(ciphertext) {
    try {
        // Tentar descriptografar usando CryptoJS compatível
        const CryptoJS = require('crypto-js');
        const bytes = CryptoJS.AES.decrypt(ciphertext, MASTER_KEY);
        return bytes.toString(CryptoJS.enc.Utf8);
    } catch (error) {
        return null;
    }
}

/**
 * Criptografar objeto
 * @param {object} obj - Objeto a ser criptografado
 * @returns {string} - Objeto criptografado em formato base64
 */
function encryptObject(obj) {
    if (!obj) return null;
    return encrypt(JSON.stringify(obj));
}

/**
 * Descriptografar objeto
 * @param {string} ciphertext - Objeto criptografado
 * @returns {object} - Objeto original
 */
function decryptObject(ciphertext) {
    const decrypted = decrypt(ciphertext);
    if (!decrypted) return null;
    
    try {
        return JSON.parse(decrypted);
    } catch (error) {
        return null;
    }
}

/**
 * Gerar hash de dados (one-way)
 * @param {string} data - Dados para hash
 * @returns {string} - Hash em formato hex
 */
function hash(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Gerar hash com salt
 * @param {string} data - Dados para hash
 * @returns {string} - Salt:Hash em formato hex
 */
function hashWithSalt(data) {
    const salt = crypto.randomBytes(SALT_LENGTH).toString('hex');
    const hashed = crypto.pbkdf2Sync(data, salt, PBKDF2_ITERATIONS, 64, 'sha512').toString('hex');
    return `${salt}:${hashed}`;
}

/**
 * Verificar hash com salt
 * @param {string} data - Dados para verificar
 * @param {string} storedHash - Hash armazenado (salt:hash)
 * @returns {boolean} - Se o hash corresponde
 */
function verifyHash(data, storedHash) {
    const [salt, hash] = storedHash.split(':');
    const verifyHash = crypto.pbkdf2Sync(data, salt, PBKDF2_ITERATIONS, 64, 'sha512').toString('hex');
    return hash === verifyHash;
}

/**
 * Gerar token aleatório
 * @param {number} length - Tamanho do token em bytes
 * @returns {string} - Token em formato hex
 */
function generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
}

/**
 * Gerar UUID v4
 * @returns {string} - UUID
 */
function generateUUID() {
    return crypto.randomUUID();
}

/**
 * Mascarar dados sensíveis
 * @param {string} data - Dados para mascarar
 * @param {number} visibleStart - Caracteres visíveis no início
 * @param {number} visibleEnd - Caracteres visíveis no final
 * @returns {string} - Dados mascarados
 */
function mask(data, visibleStart = 3, visibleEnd = 3) {
    if (!data || data.length <= visibleStart + visibleEnd) {
        return data;
    }
    
    const start = data.substring(0, visibleStart);
    const end = data.substring(data.length - visibleEnd);
    const middle = '*'.repeat(data.length - visibleStart - visibleEnd);
    
    return `${start}${middle}${end}`;
}

/**
 * Mascarar telefone
 * @param {string} phone - Número de telefone
 * @returns {string} - Telefone mascarado
 */
function maskPhone(phone) {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 8) return mask(phone);
    
    // Mostrar DDD e últimos 4 dígitos
    const ddd = cleaned.substring(0, 2);
    const last4 = cleaned.substring(cleaned.length - 4);
    const middle = '*'.repeat(cleaned.length - 6);
    
    return `(${ddd}) ${middle}-${last4}`;
}

/**
 * Mascarar email
 * @param {string} email - Email
 * @returns {string} - Email mascarado
 */
function maskEmail(email) {
    if (!email || !email.includes('@')) return mask(email);
    
    const [local, domain] = email.split('@');
    const maskedLocal = local.length > 2 
        ? local[0] + '*'.repeat(local.length - 2) + local[local.length - 1]
        : local[0] + '*';
    
    return `${maskedLocal}@${domain}`;
}

/**
 * Criptografar campos sensíveis de um objeto
 * @param {object} obj - Objeto com dados
 * @param {string[]} fields - Campos para criptografar
 * @returns {object} - Objeto com campos criptografados
 */
function encryptFields(obj, fields) {
    const result = { ...obj };
    
    for (const field of fields) {
        if (result[field]) {
            result[`${field}_encrypted`] = encrypt(result[field]);
            delete result[field];
        }
    }
    
    return result;
}

/**
 * Descriptografar campos de um objeto
 * @param {object} obj - Objeto com dados criptografados
 * @param {string[]} fields - Campos para descriptografar
 * @returns {object} - Objeto com campos descriptografados
 */
function decryptFields(obj, fields) {
    const result = { ...obj };
    
    for (const field of fields) {
        const encryptedField = `${field}_encrypted`;
        if (result[encryptedField]) {
            result[field] = decrypt(result[encryptedField]);
        }
    }
    
    return result;
}

/**
 * Gerar chave de API
 * @returns {object} - { key, hash }
 */
function generateApiKey() {
    const key = `sk_live_${generateToken(24)}`;
    const keyHash = hash(key);
    return { key, hash: keyHash };
}

/**
 * Verificar chave de API
 * @param {string} key - Chave de API
 * @param {string} storedHash - Hash armazenado
 * @returns {boolean} - Se a chave é válida
 */
function verifyApiKey(key, storedHash) {
    return hash(key) === storedHash;
}

module.exports = {
    encrypt,
    decrypt,
    encryptObject,
    decryptObject,
    hash,
    hashWithSalt,
    verifyHash,
    generateToken,
    generateUUID,
    mask,
    maskPhone,
    maskEmail,
    encryptFields,
    decryptFields,
    generateApiKey,
    verifyApiKey,
    deriveKey
};
