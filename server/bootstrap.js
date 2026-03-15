/**
 * Bootstrap - Inicia servidor e /health ANTES de carregar módulos pesados (Baileys, DB).
 * Railway/load balancer recebem 200 imediatamente.
 */
require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');

const PORT = parseInt(process.env.PORT, 10) || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// Criar diretórios
const dirs = [
  process.env.SESSIONS_DIR || path.join(__dirname, '..', 'sessions'),
  process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads'),
  path.join(__dirname, '..', 'data')
];
dirs.forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
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
  console.log(`✅ Servidor ouvindo em ${HOST}:${PORT}`);
  setImmediate(() => {
    try {
      require('./index.js').attachToServer(app, server);
    } catch (err) {
      console.error('❌ Erro ao carregar aplicação:', err);
    }
  });
});
