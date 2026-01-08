# 🚗 SELF Proteção Veicular - Sistema CRM com WhatsApp v2.0.0

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

Sistema completo de CRM com integração WhatsApp para gestão de leads e envio de mensagens automatizadas.

## ✨ Funcionalidades

- ✅ **Dashboard Profissional** com métricas e funil de vendas
- ✅ **Integração WhatsApp** via Baileys (sem API paga)
- ✅ **Inbox de Conversas** - chat em tempo real com leads
- ✅ **Conexão via QR Code** - similar ao BotConversa
- ✅ **Envio de mensagens** direto do sistema
- ✅ **Templates de mensagem** personalizáveis
- ✅ **Funil de vendas** com etapas
- ✅ **Sessão persistente** - conecta uma vez, usa sempre
- ✅ **Reconexão automática** - sistema robusto
- ✅ **Interface responsiva** para desktop e mobile

## 🛠️ Requisitos

- **Node.js** versão 18 ou superior
- **VPS/Servidor** com acesso SSH (ou Railway/Render)
- **PM2** (opcional, para manter o servidor rodando)

## 🚀 Instalação Local

### 1. Clone o repositório

```bash
git clone https://github.com/fullpropt/self-protecao-veicular.git
cd self-protecao-veicular
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Inicie o servidor

```bash
# Modo desenvolvimento
npm run dev

# Modo produção
npm start
```

### 4. Acesse o sistema

Abra no navegador: `http://localhost:3001`

## 🌐 Deploy no Railway

### Opção 1: Deploy Automático

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template)

### Opção 2: Deploy Manual

1. Acesse [Railway](https://railway.app)
2. Crie um novo projeto
3. Conecte seu repositório GitHub
4. Configure as variáveis de ambiente:
   - `PORT`: 3001 (ou deixe o Railway definir)
   - `NODE_ENV`: production
5. Deploy será automático a cada push

## 📱 Conectando o WhatsApp

1. Acesse o sistema no navegador
2. Clique em **"WhatsApp"** no menu lateral
3. Clique em **"Conectar WhatsApp"**
4. Escaneie o QR Code com seu celular
5. Pronto! A sessão fica salva automaticamente

## 📁 Estrutura do Projeto

```
self-protecao-veicular/
├── server/
│   └── index.js           # Servidor Node.js com Baileys
├── public/
│   ├── css/
│   │   └── style.css      # Estilos globais
│   ├── js/
│   │   └── config.js      # Configurações do frontend
│   ├── img/
│   │   └── logo-self.png  # Logo do sistema
│   ├── dashboard.html     # Dashboard principal
│   ├── whatsapp.html      # Conexão WhatsApp
│   ├── conversas.html     # Inbox de conversas
│   ├── funil.html         # Funil de vendas
│   ├── configuracoes.html # Configurações
│   └── login.html         # Página de login
├── sessions/              # Sessões WhatsApp (auto-gerado)
├── data/                  # Dados persistidos (auto-gerado)
├── package.json
├── railway.json           # Configuração Railway
├── Procfile               # Comando de inicialização
└── README.md
```

## ⚙️ Configurações

Edite o arquivo `public/js/config.js` para personalizar:

```javascript
const CONFIG = {
    // URL do servidor (detecta automaticamente)
    SOCKET_URL: window.location.hostname === 'localhost' 
        ? 'http://localhost:3001' 
        : window.location.origin,
    
    // ID da sessão WhatsApp
    SESSION_ID: 'self_whatsapp_session',
    
    // Código do país
    COUNTRY_CODE: '55',
    
    // Delay entre mensagens em massa (ms)
    BULK_MESSAGE_DELAY: 3000
};
```

## 🔧 API REST

### Status do servidor
```
GET /api/status
```

### Status da sessão
```
GET /api/session/:sessionId/status
```

### Enviar mensagem
```
POST /api/send
Content-Type: application/json

{
    "sessionId": "self_whatsapp_session",
    "to": "5527999999999",
    "message": "Olá! Esta é uma mensagem de teste.",
    "type": "text"
}
```

### Listar contatos
```
GET /api/contacts/:sessionId
```

### Listar mensagens
```
GET /api/messages/:sessionId/:contactNumber
```

### Health Check
```
GET /health
```

## 🔄 Eventos Socket.IO

### Cliente → Servidor

| Evento | Descrição |
|--------|-----------|
| `check-session` | Verificar sessão existente |
| `start-session` | Iniciar nova sessão |
| `send-message` | Enviar mensagem |
| `get-contacts` | Obter lista de contatos |
| `get-messages` | Obter mensagens de um contato |
| `mark-read` | Marcar conversa como lida |
| `logout` | Desconectar WhatsApp |

### Servidor → Cliente

| Evento | Descrição |
|--------|-----------|
| `qr` | QR Code para escaneamento |
| `connecting` | Conectando ao WhatsApp |
| `connected` | WhatsApp conectado |
| `disconnected` | WhatsApp desconectado |
| `new-message` | Nova mensagem recebida |
| `message-sent` | Mensagem enviada com sucesso |
| `message-status` | Atualização de status da mensagem |
| `error` | Erro na operação |

## 🌐 Deploy em VPS (Alternativo)

### Usando PM2 (Recomendado)

```bash
# Instalar PM2 globalmente
npm install -g pm2

# Iniciar aplicação
pm2 start server/index.js --name "self-whatsapp"

# Configurar para iniciar com o sistema
pm2 startup
pm2 save

# Ver logs
pm2 logs self-whatsapp

# Reiniciar
pm2 restart self-whatsapp
```

### Configurar Nginx (Proxy Reverso)

```nginx
server {
    listen 80;
    server_name seu-dominio.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Configurar SSL com Certbot

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d seu-dominio.com
```

## ❓ Problemas Comuns

### QR Code não aparece
- Verifique se o servidor está rodando
- Verifique o console do navegador para erros
- Tente limpar a pasta `sessions/` e reconectar

### Mensagens não enviam
- Verifique se o WhatsApp está conectado (indicador verde)
- Verifique se o número está no formato correto (com DDD)
- Verifique os logs do servidor

### Sessão desconecta sozinha
- O WhatsApp pode desconectar se o celular ficar muito tempo offline
- Mantenha o celular conectado à internet
- Verifique se não há outra sessão web ativa

## 📝 Variáveis de Ambiente

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `PORT` | Porta do servidor | 3001 |
| `NODE_ENV` | Ambiente (development/production) | development |
| `SESSIONS_DIR` | Diretório de sessões | ./sessions |
| `DATA_DIR` | Diretório de dados | ./data |

## 📞 Suporte

Para dúvidas ou problemas, abra uma issue no GitHub.

## 📄 Licença

MIT License - Livre para uso comercial e modificações.

---

**SELF Proteção Veicular** © 2026 - Todos os direitos reservados
