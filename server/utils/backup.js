/**
 * SELF PROTECAO VEICULAR - Sistema de Backup
 * Backup para banco Postgres (pg_dump/psql)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DATABASE_URL = String(process.env.DATABASE_URL || '').trim();
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '..', '..', 'backups');
const MAX_BACKUPS = parseInt(process.env.MAX_BACKUPS, 10) || 7;

function ensureDatabaseUrl() {
    if (!DATABASE_URL) {
        throw new Error('DATABASE_URL nao configurada. Backup requer Postgres.');
    }
}

function ensureBackupDir() {
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
        console.log(`Diretorio de backup criado: ${BACKUP_DIR}`);
    }
}

function getBackupFileName() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T');
    const date = timestamp[0];
    const time = timestamp[1].split('-').slice(0, 3).join('-');
    return `self-backup-${date}_${time}.sql`;
}

function shellQuote(value) {
    return `"${String(value).replace(/"/g, '\\"')}"`;
}

function createBackup() {
    try {
        ensureDatabaseUrl();
        ensureBackupDir();

        const backupFileName = getBackupFileName();
        const backupPath = path.join(BACKUP_DIR, backupFileName);

        const cmd = `pg_dump --dbname=${shellQuote(DATABASE_URL)} --no-owner --no-privileges --format=plain --file=${shellQuote(backupPath)}`;
        execSync(cmd, { stdio: 'pipe' });

        const stats = fs.statSync(backupPath);
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        console.log(`Backup criado com sucesso: ${backupFileName} (${sizeMB} MB)`);

        cleanOldBackups();
        return backupPath;
    } catch (error) {
        console.error('Erro ao criar backup:', error.message);
        return false;
    }
}

function cleanOldBackups() {
    try {
        const files = fs.readdirSync(BACKUP_DIR)
            .filter(file => file.startsWith('self-backup-') && file.endsWith('.sql'))
            .map(file => ({
                name: file,
                path: path.join(BACKUP_DIR, file),
                time: fs.statSync(path.join(BACKUP_DIR, file)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time);

        if (files.length > MAX_BACKUPS) {
            const toRemove = files.slice(MAX_BACKUPS);
            toRemove.forEach(file => {
                fs.unlinkSync(file.path);
                console.log(`Backup antigo removido: ${file.name}`);
            });
        }

        console.log(`Total de backups mantidos: ${Math.min(files.length, MAX_BACKUPS)}`);
    } catch (error) {
        console.error('Erro ao limpar backups antigos:', error.message);
    }
}

function listBackups() {
    try {
        ensureBackupDir();

        return fs.readdirSync(BACKUP_DIR)
            .filter(file => file.startsWith('self-backup-') && file.endsWith('.sql'))
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
    } catch (error) {
        console.error('Erro ao listar backups:', error.message);
        return [];
    }
}

function restoreBackup(backupFileName) {
    try {
        ensureDatabaseUrl();
        const backupPath = path.join(BACKUP_DIR, backupFileName);

        if (!fs.existsSync(backupPath)) {
            console.error('Backup nao encontrado:', backupFileName);
            return false;
        }

        const cmd = `psql ${shellQuote(DATABASE_URL)} -f ${shellQuote(backupPath)}`;
        execSync(cmd, { stdio: 'pipe' });
        console.log(`Backup restaurado com sucesso: ${backupFileName}`);
        return true;
    } catch (error) {
        console.error('Erro ao restaurar backup:', error.message);
        return false;
    }
}

function scheduleBackup(intervalHours = 24) {
    console.log(`Backup automatico agendado a cada ${intervalHours} horas`);

    createBackup();

    setInterval(() => {
        console.log('Iniciando backup automatico...');
        createBackup();
    }, intervalHours * 60 * 60 * 1000);
}

if (require.main === module) {
    console.log('Iniciando backup manual...');
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
