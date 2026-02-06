/**
 * SELF PROTEÇÃO VEICULAR - Health Check Avançado
 * Verifica status de todos os componentes críticos do sistema
 */

const fs = require('fs');
const path = require('path');

/**
 * Verifica se o banco de dados está acessível
 */
function checkDatabase() {
    try {
        const { query } = require('../database/connection');
        const result = query('SELECT 1 as test');
        return {
            status: 'healthy',
            message: 'Banco de dados conectado',
            responsive: true
        };
    } catch (error) {
        return {
            status: 'unhealthy',
            message: 'Erro ao conectar ao banco de dados',
            error: error.message,
            responsive: false
        };
    }
}

/**
 * Verifica status das sessões WhatsApp
 */
function checkWhatsAppSessions() {
    try {
        const whatsappService = require('../services/whatsapp');
        const sessions = whatsappService.sessions;
        
        const sessionList = Object.keys(sessions).map(sessionId => {
            const session = sessions[sessionId];
            return {
                id: sessionId,
                connected: session.isConnected || false,
                status: session.status || 'unknown'
            };
        });
        
        const connectedCount = sessionList.filter(s => s.connected).length;
        
        return {
            status: 'healthy',
            message: `${connectedCount} de ${sessionList.length} sessões conectadas`,
            sessions: sessionList,
            totalSessions: sessionList.length,
            connectedSessions: connectedCount
        };
    } catch (error) {
        return {
            status: 'degraded',
            message: 'Erro ao verificar sessões WhatsApp',
            error: error.message
        };
    }
}

/**
 * Verifica status da fila de mensagens
 */
function checkMessageQueue() {
    try {
        const { query } = require('../database/connection');
        
        const pending = query("SELECT COUNT(*) as count FROM message_queue WHERE status = 'pending'")[0]?.count || 0;
        const processing = query("SELECT COUNT(*) as count FROM message_queue WHERE status = 'processing'")[0]?.count || 0;
        const failed = query("SELECT COUNT(*) as count FROM message_queue WHERE status = 'failed'")[0]?.count || 0;
        
        return {
            status: 'healthy',
            message: 'Fila de mensagens operacional',
            queue: {
                pending,
                processing,
                failed,
                total: pending + processing + failed
            }
        };
    } catch (error) {
        return {
            status: 'unhealthy',
            message: 'Erro ao verificar fila de mensagens',
            error: error.message
        };
    }
}

/**
 * Verifica espaço em disco
 */
function checkDiskSpace() {
    try {
        const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
        const uploadsDir = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads');
        const sessionsDir = process.env.SESSIONS_DIR || path.join(__dirname, '..', '..', 'sessions');
        
        const getDirSize = (dirPath) => {
            if (!fs.existsSync(dirPath)) return 0;
            
            let size = 0;
            const files = fs.readdirSync(dirPath);
            
            for (const file of files) {
                const filePath = path.join(dirPath, file);
                const stats = fs.statSync(filePath);
                
                if (stats.isDirectory()) {
                    size += getDirSize(filePath);
                } else {
                    size += stats.size;
                }
            }
            
            return size;
        };
        
        const formatSize = (bytes) => {
            if (bytes < 1024) return bytes + ' B';
            if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
            if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
            return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
        };
        
        const dataSize = getDirSize(dataDir);
        const uploadsSize = getDirSize(uploadsDir);
        const sessionsSize = getDirSize(sessionsDir);
        const totalSize = dataSize + uploadsSize + sessionsSize;
        
        return {
            status: 'healthy',
            message: 'Espaço em disco verificado',
            disk: {
                data: formatSize(dataSize),
                uploads: formatSize(uploadsSize),
                sessions: formatSize(sessionsSize),
                total: formatSize(totalSize)
            }
        };
    } catch (error) {
        return {
            status: 'degraded',
            message: 'Erro ao verificar espaço em disco',
            error: error.message
        };
    }
}

/**
 * Verifica memória do processo
 */
function checkMemory() {
    const usage = process.memoryUsage();
    
    const formatMemory = (bytes) => {
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    };
    
    return {
        status: 'healthy',
        message: 'Uso de memória monitorado',
        memory: {
            rss: formatMemory(usage.rss),
            heapTotal: formatMemory(usage.heapTotal),
            heapUsed: formatMemory(usage.heapUsed),
            external: formatMemory(usage.external)
        }
    };
}

/**
 * Health check completo
 */
function getHealthStatus() {
    const startTime = Date.now();
    
    const checks = {
        database: checkDatabase(),
        whatsapp: checkWhatsAppSessions(),
        messageQueue: checkMessageQueue(),
        disk: checkDiskSpace(),
        memory: checkMemory()
    };
    
    // Determinar status geral
    let overallStatus = 'healthy';
    for (const check of Object.values(checks)) {
        if (check.status === 'unhealthy') {
            overallStatus = 'unhealthy';
            break;
        } else if (check.status === 'degraded' && overallStatus !== 'unhealthy') {
            overallStatus = 'degraded';
        }
    }
    
    const responseTime = Date.now() - startTime;
    
    return {
        status: overallStatus,
        version: '4.1.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        responseTime: `${responseTime}ms`,
        checks
    };
}

module.exports = {
    getHealthStatus,
    checkDatabase,
    checkWhatsAppSessions,
    checkMessageQueue,
    checkDiskSpace,
    checkMemory
};
