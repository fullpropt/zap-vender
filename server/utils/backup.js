/**
 * SELF PROTEÇÃO VEICULAR - Sistema de Backup
 * Backup automático do banco de dados SQLite
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DATABASE_PATH = process.env.DATABASE_PATH || path.join(__dirname, '..', '..', 'data', 'self.db');
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '..', '..', 'backups');
const MAX_BACKUPS = parseInt(process.env.MAX_BACKUPS) || 7; // Manter últimos 7 backups

/**
 * Cria diretório de backup se não existir
 */
function ensureBackupDir() {
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
        console.log(`📁 Diretório de backup criado: ${BACKUP_DIR}`);
    }
}

/**
 * Gera nome do arquivo de backup com timestamp
 */
function getBackupFileName() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T');
    const date = timestamp[0];
    const time = timestamp[1].split('-').slice(0, 3).join('-');
    return `self-backup-${date}_${time}.db`;
}

/**
 * Realiza backup do banco de dados
 */
function createBackup() {
    try {
        ensureBackupDir();
        
        // Verificar se o banco de dados existe
        if (!fs.existsSync(DATABASE_PATH)) {
            console.error('❌ Banco de dados não encontrado:', DATABASE_PATH);
            return false;
        }
        
        const backupFileName = getBackupFileName();
        const backupPath = path.join(BACKUP_DIR, backupFileName);
        
        // Copiar arquivo do banco de dados
        fs.copyFileSync(DATABASE_PATH, backupPath);
        
        const stats = fs.statSync(backupPath);
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        
        console.log(`✅ Backup criado com sucesso: ${backupFileName} (${sizeMB} MB)`);
        
        // Limpar backups antigos
        cleanOldBackups();
        
        return backupPath;
    } catch (error) {
        console.error('❌ Erro ao criar backup:', error.message);
        return false;
    }
}

/**
 * Remove backups antigos mantendo apenas os mais recentes
 */
function cleanOldBackups() {
    try {
        const files = fs.readdirSync(BACKUP_DIR)
            .filter(file => file.startsWith('self-backup-') && file.endsWith('.db'))
            .map(file => ({
                name: file,
                path: path.join(BACKUP_DIR, file),
                time: fs.statSync(path.join(BACKUP_DIR, file)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time); // Mais recentes primeiro
        
        // Remover backups excedentes
        if (files.length > MAX_BACKUPS) {
            const toRemove = files.slice(MAX_BACKUPS);
            toRemove.forEach(file => {
                fs.unlinkSync(file.path);
                console.log(`🗑️  Backup antigo removido: ${file.name}`);
            });
        }
        
        console.log(`📊 Total de backups mantidos: ${Math.min(files.length, MAX_BACKUPS)}`);
    } catch (error) {
        console.error('❌ Erro ao limpar backups antigos:', error.message);
    }
}

/**
 * Lista todos os backups disponíveis
 */
function listBackups() {
    try {
        ensureBackupDir();
        
        const files = fs.readdirSync(BACKUP_DIR)
            .filter(file => file.startsWith('self-backup-') && file.endsWith('.db'))
            .map(file => {
                const filePath = path.join(BACKUP_DIR, file);
                const stats = fs.statSync(filePath);
                return {
                    name: file,
                    path: filePath,
                    size: (stats.size / (1024 * 1024)).toFixed(2) + ' MB',
                    created: stats.mtime.toISOString()
                };
            })
            .sort((a, b) => new Date(b.created) - new Date(a.created));
        
        return files;
    } catch (error) {
        console.error('❌ Erro ao listar backups:', error.message);
        return [];
    }
}

/**
 * Restaura backup específico
 */
function restoreBackup(backupFileName) {
    try {
        const backupPath = path.join(BACKUP_DIR, backupFileName);
        
        if (!fs.existsSync(backupPath)) {
            console.error('❌ Backup não encontrado:', backupFileName);
            return false;
        }
        
        // Criar backup do banco atual antes de restaurar
        const currentBackup = path.join(BACKUP_DIR, `pre-restore-${Date.now()}.db`);
        if (fs.existsSync(DATABASE_PATH)) {
            fs.copyFileSync(DATABASE_PATH, currentBackup);
            console.log(`💾 Backup de segurança criado: ${path.basename(currentBackup)}`);
        }
        
        // Restaurar backup
        fs.copyFileSync(backupPath, DATABASE_PATH);
        
        console.log(`✅ Backup restaurado com sucesso: ${backupFileName}`);
        return true;
    } catch (error) {
        console.error('❌ Erro ao restaurar backup:', error.message);
        return false;
    }
}

/**
 * Agenda backup automático (executar via cron ou setInterval)
 */
function scheduleBackup(intervalHours = 24) {
    console.log(`⏰ Backup automático agendado a cada ${intervalHours} horas`);
    
    // Fazer backup imediato
    createBackup();
    
    // Agendar backups periódicos
    setInterval(() => {
        console.log('🔄 Iniciando backup automático...');
        createBackup();
    }, intervalHours * 60 * 60 * 1000);
}

// Se executado diretamente, criar backup
if (require.main === module) {
    console.log('🔄 Iniciando backup manual...');
    const result = createBackup();
    process.exit(result ? 0 : 1);
}

module.exports = {
    createBackup,
    listBackups,
    restoreBackup,
    scheduleBackup,
    cleanOldBackups
};
