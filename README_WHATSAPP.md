# 📱 Integração WhatsApp - SELF Proteção Veicular

Sistema completo de integração WhatsApp com gerenciamento de conversas e leads.

## 🚀 Funcionalidades

### ✅ Implementadas

- **Conexão WhatsApp via QR Code**
  - Geração automática de QR Code
  - Reconexão automática em caso de queda
  - Persistência de sessão entre reinicializações
  - Até 5 tentativas de reconexão automática

- **Gerenciamento de Conversas**
  - Interface completa de chat em tempo real
  - Lista de conversas com leads
  - Busca de conversas
  - Indicador de mensagens não lidas
  - Histórico de mensagens persistente

- **Envio de Mensagens**
  - Envio de mensagens de texto
  - Retry automático (até 3 tentativas)
  - Confirmação de envio
  - Indicadores de status (enviado/erro)

- **Servidor Robusto**
  - Tratamento de erros completo
  - Reconexão automática
  - Logs detalhados
  - API REST para integração externa
  - Socket.IO para comunicação em tempo real

## 📋 Pré-requisitos

- Node.js >= 18.0.0
- NPM ou Yarn
- Conexão com internet

## 🔧 Instalação

1. **Clonar o repositório**
```bash
git clone https://github.com/seu-usuario/zap-vender.git
cd zap-vender
```

2. **Instalar dependências**
```bash
npm install
```

3. **Iniciar o servidor**
```bash
npm start
```

Ou em modo de desenvolvimento (com auto-reload):
```bash
npm run dev
```

## 🌐 Acesso

Após iniciar o servidor, acesse:

- **Frontend**: http://localhost:3001
- **API Status**: http://localhost:3001/api/status
- **API Sessões**: http://localhost:3001/api/sessions

## 📱 Como Conectar o WhatsApp

1. Acesse a página **WhatsApp** no menu lateral
2. Clique em **"Conectar WhatsApp"**
3. Aguarde o QR Code ser gerado
4. Abra o WhatsApp no seu celular
5. Vá em **Configurações > Dispositivos conectados**
6. Toque em **"Conectar dispositivo"**
7. Escaneie o QR Code exibido na tela

## 💬 Gerenciamento de Conversas

### Acessar Conversas

1. Clique em **"Conversas"** no menu lateral
2. Você verá a lista de todos os leads/contatos
3. Clique em um contato para abrir o chat

### Enviar Mensagens

1. Selecione um contato da lista
2. Digite sua mensagem no campo de texto
3. Pressione **Enter** ou clique no botão de envio ✈️
4. A mensagem será enviada via WhatsApp

### Buscar Conversas

Use a barra de busca no topo da lista de conversas para filtrar por:
- Nome do contato
- Número de telefone

## 🔄 Reconexão Automática

O sistema possui reconexão automática em caso de:
- Perda de conexão com internet
- Queda do servidor
- Problemas temporários com WhatsApp

**Configurações de reconexão:**
- Máximo de tentativas: 5
- Intervalo entre tentativas: 3 segundos
- Aumento progressivo do delay

## 📊 API REST

### Status do Servidor
```bash
GET /api/status
```

Resposta:
```json
{
  "status": "online",
  "sessions": 1,
  "activeSessions": [
    {
      "id": "default",
      "connected": true,
      "user": "Nome do Usuário"
    }
  ],
  "uptime": 3600,
  "timestamp": "2026-01-08T16:30:00.000Z"
}
```

### Status de uma Sessão
```bash
GET /api/session/:sessionId/status
```

### Enviar Mensagem via API
```bash
POST /api/send
Content-Type: application/json

{
  "sessionId": "default",
  "to": "5511999999999",
  "message": "Olá! Como posso ajudar?",
  "type": "text"
}
```

### Listar Sessões
```bash
GET /api/sessions
```

## 🗂️ Estrutura de Arquivos

```
zap-vender/
├── server/
│   └── index.js              # Servidor Node.js com Baileys
├── public/
│   ├── index.html            # Dashboard principal
│   ├── whatsapp.html         # Página de conexão WhatsApp
│   ├── conversas.html        # Página de conversas (NOVO)
│   ├── funil.html            # Funil de vendas
│   ├── configuracoes.html    # Configurações
│   ├── css/
│   │   └── style.css         # Estilos globais
│   ├── js/
│   │   ├── config.js         # Configurações do frontend
│   │   ├── whatsapp.js       # Módulo de integração WhatsApp
│   │   └── dashboard.js      # Lógica do dashboard
│   └── img/
│       └── logo-self.png     # Logo
├── sessions/                 # Sessões WhatsApp (gerado automaticamente)
├── package.json
└── README.md
```

## 🔐 Segurança

- **Sessões**: Armazenadas localmente em `sessions/`
- **Credenciais**: Criptografadas pelo Baileys
- **Não compartilhe**: Nunca compartilhe a pasta `sessions/`

## 🐛 Solução de Problemas

### QR Code não aparece
1. Verifique se o servidor está rodando
2. Limpe o cache do navegador
3. Tente desconectar e conectar novamente

### WhatsApp desconecta sozinho
1. Verifique sua conexão com internet
2. Certifique-se de que o celular está conectado
3. Aguarde a reconexão automática (até 5 tentativas)

### Mensagens não são enviadas
1. Verifique se o WhatsApp está conectado (indicador verde)
2. Confirme que o número está no formato correto
3. Verifique os logs do servidor no terminal

### Limpar sessão e começar do zero
```bash
# Parar o servidor (Ctrl+C)
rm -rf sessions/
npm start
```

## 📝 Logs

O servidor exibe logs detalhados no terminal:
- 🔌 Conexões de clientes
- 📨 Mensagens recebidas
- ✅ Mensagens enviadas
- 🔄 Tentativas de reconexão
- ❌ Erros e problemas

## 🚀 Deploy em Produção

### Railway / Render / Heroku

1. Configure a variável de ambiente `PORT`
2. Certifique-se de que a pasta `sessions/` persiste
3. Use um volume persistente para `sessions/`

### VPS / Servidor Próprio

```bash
# Instalar PM2
npm install -g pm2

# Iniciar com PM2
pm2 start server/index.js --name whatsapp-server

# Auto-start no boot
pm2 startup
pm2 save
```

## 📞 Suporte

Para problemas ou dúvidas:
- Verifique os logs do servidor
- Consulte a documentação do Baileys
- Abra uma issue no GitHub

## 📄 Licença

MIT License - SELF Proteção Veicular

---

**Desenvolvido com ❤️ para SELF Proteção Veicular**
