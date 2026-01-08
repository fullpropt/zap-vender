# 🚗 SELF Proteção Veicular - Sistema CRM com WhatsApp

Sistema completo de CRM com integração WhatsApp para gestão de leads e envio de mensagens automatizadas.

## ✨ Funcionalidades

- ✅ **Dashboard completo** com estatísticas de leads
- ✅ **Integração WhatsApp** via Baileys (sem API paga)
- ✅ **Envio de mensagens** direto do dashboard (sem abrir nova guia)
- ✅ **Templates de mensagem** personalizáveis
- ✅ **Funil de vendas** com etapas
- ✅ **Sessão persistente** - conecta uma vez, usa sempre
- ✅ **Interface responsiva** para desktop e mobile

## 🛠️ Requisitos

- **Node.js** versão 18 ou superior
- **VPS/Servidor** com acesso SSH (HostGator compartilhado NÃO funciona)
- **PM2** (opcional, para manter o servidor rodando)

## 🚀 Instalação

### 1. Clone o repositório

```bash
git clone https://github.com/SEU_USUARIO/self-protecao-veicular.git
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

## 📱 Conectando o WhatsApp

1. Acesse o sistema no navegador
2. Clique em **"WhatsApp"** no menu lateral
3. Clique em **"Conectar WhatsApp"**
4. Escaneie o QR Code com seu celular
5. Pronto! A sessão fica salva automaticamente

## 🌐 Deploy em Produção

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

## 📁 Estrutura do Projeto

```
self-protecao-veicular/
├── public/                 # Arquivos estáticos (frontend)
│   ├── css/
│   │   └── style.css      # Estilos globais
│   ├── js/
│   │   ├── config.js      # Configurações
│   │   ├── whatsapp.js    # Módulo WhatsApp
│   │   └── dashboard.js   # Lógica do dashboard
│   ├── img/
│   │   └── logo-self.png  # Logo
│   ├── index.html         # Dashboard principal
│   ├── whatsapp.html      # Página de conexão WhatsApp
│   ├── funil.html         # Funil de vendas
│   └── configuracoes.html # Configurações
├── server/
│   └── index.js           # Servidor Node.js
├── sessions/              # Sessões WhatsApp (auto-gerado)
├── package.json
└── README.md
```

## ⚙️ Configurações

Edite o arquivo `public/js/config.js` para personalizar:

```javascript
const CONFIG = {
    // URL do servidor (altere para seu domínio em produção)
    SOCKET_URL: 'http://localhost:3001',
    
    // ID da sessão WhatsApp
    SESSION_ID: 'self_whatsapp_session',
    
    // Código do país
    COUNTRY_CODE: '55',
    
    // Delay entre mensagens em massa (ms)
    BULK_MESSAGE_DELAY: 3000
};
```

## 🔧 API REST

O servidor também expõe uma API REST:

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

## 📞 Suporte

Para dúvidas ou problemas, abra uma issue no GitHub.

## 📄 Licença

MIT License - Livre para uso comercial e modificações.
