/**
 * SELF PROTEÇÃO VEICULAR - Bootstrap Mínimo
 * Sobe o servidor e /health ANTES de carregar Baileys, SQLite, etc.
 * Resolve healthcheck falhando no Railway (processo crashava durante require).
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// Criar diretórios necessários
[path.join(__dirname, '..', 'sessions'), path.join(__dirname, '..', 'data'), path.join(__dirname, '..', 'uploads')].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const app = express();
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy', version: '4.1.0', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

const server = http.createServer(app);
server.listen(PORT, HOST, () => {
    console.log(`[Bootstrap] Servidor ouvindo em ${HOST}:${PORT} - /health OK`);
    try {
        require('./index')(app, server);
    } catch (err) {
        console.error('[Bootstrap] Erro ao carregar app:', err.message);
        // /health continua respondendo mesmo se o app falhar
    }
});
