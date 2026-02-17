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

function resolveVolumeBase() {
    const envBase = process.env.RAILWAY_VOLUME_MOUNT_PATH
        || process.env.RAILWAY_VOLUME_PATH
        || process.env.RAILWAY_VOLUME
        || process.env.VOLUME_MOUNT_PATH;
    if (envBase) return envBase;
    if (fs.existsSync('/mnt/data')) return '/mnt/data';

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

if (volumeBase) {
    process.env.SESSIONS_DIR = process.env.SESSIONS_DIR || path.join(volumeBase, 'sessions');
    process.env.UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(volumeBase, 'uploads');
    console.log(`[Bootstrap] Volume persistente: ${volumeBase}`);
}

// Criar diretórios necessários
[
    process.env.SESSIONS_DIR || path.join(__dirname, '..', 'sessions'),
    process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads')
].forEach(dir => {
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
