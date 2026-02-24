/**
 * SELF PROTEÇÃO VEICULAR - Bootstrap Mínimo
 * Sobe o servidor e /health ANTES de carregar Baileys e demais serviços.
 * Resolve healthcheck falhando no Railway (processo crashava durante require).
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

function normalizeDirValue(value) {
    const normalized = String(value || '').trim();
    return normalized || '';
}

function resolveVolumeBase() {
    const envBase = process.env.RAILWAY_VOLUME_MOUNT_PATH
        || process.env.RAILWAY_VOLUME_PATH
        || process.env.RAILWAY_VOLUME
        || process.env.VOLUME_MOUNT_PATH;
    if (envBase) return normalizeDirValue(envBase);
    if (fs.existsSync('/mnt/data')) return '/mnt/data';
    if (fs.existsSync('/data')) return '/data';

    const bindRoot = '/var/lib/containers/railwayapp/bind-mounts';
    if (fs.existsSync(bindRoot)) {
        const tenants = fs.readdirSync(bindRoot, { withFileTypes: true })
            .filter(entry => entry.isDirectory())
            .map(entry => path.join(bindRoot, entry.name));

        for (const tenantPath of tenants) {
            const volumes = fs.readdirSync(tenantPath, { withFileTypes: true })
                .filter(entry => entry.isDirectory() && entry.name.startsWith('vol_'))
                .map(entry => path.join(tenantPath, entry.name));
            if (volumes.length > 0) return volumes[0];
        }
    }

    return null;
}

const volumeBase = process.env.NODE_ENV === 'production' ? resolveVolumeBase() : null;
const explicitSessionsDir = normalizeDirValue(process.env.SESSIONS_DIR);
const explicitUploadDir = normalizeDirValue(process.env.UPLOAD_DIR);

const sessionsDir = explicitSessionsDir || (volumeBase ? path.join(volumeBase, 'sessions') : path.join(__dirname, '..', 'sessions'));
const uploadsDir = explicitUploadDir || (volumeBase ? path.join(volumeBase, 'uploads') : path.join(__dirname, '..', 'uploads'));

process.env.SESSIONS_DIR = sessionsDir;
process.env.UPLOAD_DIR = uploadsDir;

if (process.env.NODE_ENV === 'production') {
    if (volumeBase) {
        console.log(`[Bootstrap] Volume persistente detectado: ${volumeBase}`);
    } else if (explicitSessionsDir || explicitUploadDir) {
        console.log('[Bootstrap] Diretorios de sessao/upload configurados via variavel de ambiente.');
    } else {
        console.warn('[Bootstrap] Volume persistente nao detectado. Configure UPLOAD_DIR/SESSIONS_DIR em volume para manter arquivos entre reinicios.');
    }
}

// Criar diretórios necessários
[
    sessionsDir,
    uploadsDir
].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const app = express();
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy', version: '4.1.0', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

const server = http.createServer(app);
server.listen(PORT, HOST, () => {
    console.log(`[Bootstrap] Servidor ouvindo em ${HOST}:${PORT} - /health OK`);
    // Carregar app em setImmediate para /health responder antes do init pesado
    setImmediate(() => {
        try {
            require('./index')(app, server);
        } catch (err) {
            console.error('[Bootstrap] Erro ao carregar app:', err.message);
        }
    });
});
