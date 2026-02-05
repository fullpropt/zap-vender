/**
 * Entry point mínimo: sobe o servidor com /health IMEDIATAMENTE.
 * Só depois carrega Baileys, DB e o restante (evita crash antes do listen no Railway).
 */
require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

const SESSIONS_DIR = process.env.SESSIONS_DIR || path.join(__dirname, '..', 'sessions');
const UPLOADS_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
const DATA_DIR = path.join(__dirname, '..', 'data');

[SESSIONS_DIR, UPLOADS_DIR, DATA_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

const app = express();
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '4.1.0',
        uptime: process.uptime()
    });
});

const server = http.createServer(app);

server.listen(PORT, HOST, () => {
    console.log(`[start] Servidor ouvindo em ${HOST}:${PORT} - /health OK`);
    setImmediate(() => {
        try {
            require('./index.js').attachFullApp(app, server);
        } catch (err) {
            console.error('[start] Erro ao carregar app completa:', err);
        }
    });
});
