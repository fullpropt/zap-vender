/**
 * WHATSAPP INTEGRATION MODULE
 * Módulo para integração com WhatsApp via Socket.IO
 */

const WhatsApp = {
    socket: null,
    isConnected: false,
    user: null,
    callbacks: {
        onConnect: null,
        onDisconnect: null,
        onMessage: null,
        onMessageSent: null,
        onError: null
    },
    
    /**
     * Inicializa conexão com servidor WhatsApp
     */
    init: function(callbacks = {}) {
        this.callbacks = { ...this.callbacks, ...callbacks };
        
        if (typeof io === 'undefined') {
            console.error('[WhatsApp] Socket.IO não está carregado');
            return false;
        }
        
        try {
            const token = sessionStorage.getItem('selfDashboardToken');
            const socketOptions = {
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionAttempts: 10,
                reconnectionDelay: 1000,
                timeout: 20000
            };

            if (token) {
                socketOptions.auth = { token };
            }

            this.socket = io(CONFIG.SOCKET_URL, socketOptions);
            
            this.setupEventListeners();
            return true;
            
        } catch (error) {
            console.error('[WhatsApp] Erro ao conectar:', error);
            return false;
        }
    },
    
    /**
     * Configura listeners de eventos
     */
    setupEventListeners: function() {
        const self = this;
        
        // Conexão estabelecida com servidor
        this.socket.on('connect', function() {
            console.log('[WhatsApp] Conectado ao servidor');
            // Verificar status da sessão WhatsApp
            self.socket.emit('check-session', { sessionId: CONFIG.SESSION_ID });
        });
        
        // Desconexão do servidor
        this.socket.on('disconnect', function() {
            console.log('[WhatsApp] Desconectado do servidor');
            self.isConnected = false;
            self.user = null;
            if (self.callbacks.onDisconnect) {
                self.callbacks.onDisconnect();
            }
        });
        
        // WhatsApp conectado
        this.socket.on('connected', function(data) {
            console.log('[WhatsApp] WhatsApp conectado:', data);
            self.isConnected = true;
            self.user = data.user;
            localStorage.setItem(CONFIG.STORAGE_KEYS.WHATSAPP_CONNECTED, 'true');
            localStorage.setItem(CONFIG.STORAGE_KEYS.WHATSAPP_USER, JSON.stringify(data.user));
            if (self.callbacks.onConnect) {
                self.callbacks.onConnect(data);
            }
        });
        
        // Status de conexão
        this.socket.on('connection-status', function(data) {
            console.log('[WhatsApp] Status:', data);
            if (data.status === 'connected') {
                self.isConnected = true;
                self.user = data.user;
                if (self.callbacks.onConnect) {
                    self.callbacks.onConnect(data);
                }
            } else {
                self.isConnected = false;
                self.user = null;
                if (self.callbacks.onDisconnect) {
                    self.callbacks.onDisconnect();
                }
            }
        });
        
        // Status da sessão
        this.socket.on('session-status', function(data) {
            console.log('[WhatsApp] Status da sessão:', data);
            if (data.status === 'connected') {
                self.isConnected = true;
                self.user = data.user;
                if (self.callbacks.onConnect) {
                    self.callbacks.onConnect(data);
                }
            } else {
                self.isConnected = false;
                if (self.callbacks.onDisconnect) {
                    self.callbacks.onDisconnect();
                }
            }
        });
        
        // Nova mensagem recebida
        this.socket.on('message', function(data) {
            console.log('[WhatsApp] Nova mensagem:', data);
            if (self.callbacks.onMessage) {
                self.callbacks.onMessage(data);
            }
        });
        
        // Mensagem enviada com sucesso
        this.socket.on('message-sent', function(data) {
            console.log('[WhatsApp] Mensagem enviada:', data);
            if (self.callbacks.onMessageSent) {
                self.callbacks.onMessageSent(data);
            }
        });
        
        // Erro
        this.socket.on('error', function(data) {
            console.error('[WhatsApp] Erro:', data);
            if (self.callbacks.onError) {
                self.callbacks.onError(data);
            }
        });
    },
    
    /**
     * Envia mensagem de texto
     */
    sendMessage: function(to, message) {
        const self = this;
        
        return new Promise(function(resolve, reject) {
            if (!self.isConnected) {
                reject(new Error('WhatsApp não está conectado'));
                return;
            }
            
            if (!to || !message) {
                reject(new Error('Número e mensagem são obrigatórios'));
                return;
            }
            
            // Formatar número
            const phone = Utils.formatPhoneWhatsApp(to);
            
            // Validar número
            if (!Utils.validatePhone(phone)) {
                reject(new Error('Número de telefone inválido'));
                return;
            }
            
            // Listeners temporários para resposta
            const onSuccess = function(data) {
                self.socket.off('message-sent', onSuccess);
                self.socket.off('error', onError);
                clearTimeout(timeout);
                resolve(data);
            };
            
            const onError = function(data) {
                self.socket.off('message-sent', onSuccess);
                self.socket.off('error', onError);
                clearTimeout(timeout);
                reject(new Error(data.message || 'Erro ao enviar mensagem'));
            };
            
            self.socket.once('message-sent', onSuccess);
            self.socket.once('error', onError);
            
            // Enviar mensagem
            self.socket.emit('send-message', {
                sessionId: CONFIG.SESSION_ID,
                to: phone,
                message: message,
                type: 'text'
            });
            
            // Timeout
            const timeout = setTimeout(function() {
                self.socket.off('message-sent', onSuccess);
                self.socket.off('error', onError);
                reject(new Error('Timeout ao enviar mensagem'));
            }, CONFIG.SEND_TIMEOUT);
        });
    },
    
    /**
     * Envia mensagem com template
     */
    sendTemplateMessage: function(to, template, variables) {
        let message = template;
        
        // Substituir variáveis
        for (const key in variables) {
            const regex = new RegExp('\\{\\{' + key + '\\}\\}', 'g');
            message = message.replace(regex, variables[key]);
        }
        
        return this.sendMessage(to, message);
    },
    
    /**
     * Verifica se está conectado
     */
    isWhatsAppConnected: function() {
        return this.isConnected;
    },
    
    /**
     * Obtém usuário conectado
     */
    getUser: function() {
        return this.user;
    },
    
    /**
     * Reconecta sessão existente
     */
    reconnect: function() {
        if (this.socket && this.socket.connected) {
            this.socket.emit('reconnect-session', { sessionId: CONFIG.SESSION_ID });
        }
    }
};
