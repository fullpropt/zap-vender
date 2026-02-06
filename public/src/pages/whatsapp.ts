// @ts-nocheck
// WhatsApp page logic migrated to module

// Configurações
const CONFIG = {
    SOCKET_URL: window.location.origin,
    SESSION_ID: 'self_whatsapp_session',
    QR_REFRESH_INTERVAL: 30000
};

// Estado
let socket = null;
let isConnected = false;
let isConnecting = false;
let qrTimer = null;
let timerCountdown = 30;
let contacts = [];

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    if (checkAuth()) {
        initSocket();
    }
});

function checkAuth() {
    const token = sessionStorage.getItem('selfDashboardToken');
    const expiry = sessionStorage.getItem('selfDashboardExpiry');
    if (!token || !expiry || Date.now() > parseInt(expiry)) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

// Inicializar Socket.IO
function initSocket() {
    console.log('🔌 Conectando ao servidor:', CONFIG.SOCKET_URL);

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

    socket = io(CONFIG.SOCKET_URL, socketOptions);
    
    socket.on('connect', function() {
        console.log('✅ Socket conectado');
        showToast('success', 'Conectado ao servidor');
        
        // Verificar sessão existente
        socket.emit('check-session', { sessionId: CONFIG.SESSION_ID });
    });
    
    socket.on('disconnect', function() {
        console.log('❌ Socket desconectado');
        showToast('warning', 'Conexão com servidor perdida');
    });
    
    socket.on('connect_error', function(error) {
        console.error('❌ Erro de conexão:', error);
        showToast('error', 'Erro ao conectar com servidor');
    });
    
    // Eventos do WhatsApp
    socket.on('session-status', function(data) {
        console.log('📱 Status da sessão:', data);
        if (data.status === 'connected') {
            handleConnected(data.user);
        } else {
            handleDisconnected();
        }
    });
    
    socket.on('qr', function(data) {
        console.log('📷 QR Code recebido');
        displayQRCode(data.qr);
        startQRTimer();
        // Garantir que o botão de conectar suma e o timer apareça
        document.getElementById('connect-btn').style.display = 'none';
        document.getElementById('qr-timer').style.display = 'block';
    });
    
    socket.on('connecting', function(data) {
        console.log('🔄 Conectando...');
        updateStatus('connecting', 'Conectando...');
        showQRLoading('Conectando ao WhatsApp...');
    });
    
    socket.on('connected', function(data) {
        console.log('✅ WhatsApp conectado:', data);
        handleConnected(data.user);
    });
    
    socket.on('disconnected', function(data) {
        console.log('❌ WhatsApp desconectado');
        handleDisconnected();
    });
    
    socket.on('contacts-list', function(data) {
        console.log('👥 Contatos recebidos:', data.contacts?.length);
        if (data.contacts) {
            contacts = data.contacts;
            renderContacts();
        }
    });
    
    socket.on('error', function(data) {
        console.error('❌ Erro:', data);
        showToast('error', data.message || 'Erro na operação');
        
        if (isConnecting) {
            isConnecting = false;
            updateConnectButton(false);
            showQRLoading('Erro ao conectar. Tente novamente.');
        }
    });
    
    socket.on('auth-failure', function(data) {
        console.error('❌ Falha na autenticação');
        showToast('error', 'Falha na autenticação. Tente novamente.');
        handleDisconnected();
    });
}

// Iniciar conexão
function startConnection() {
    if (isConnecting) return;
    
    isConnecting = true;
    updateConnectButton(true);
    showQRLoading('Gerando QR Code...');
    
    console.log('🚀 Iniciando conexão...');
    socket.emit('start-session', { sessionId: CONFIG.SESSION_ID });
}

// Desconectar
function disconnect() {
    if (confirm('Tem certeza que deseja desconectar o WhatsApp?')) {
        socket.emit('logout', { sessionId: CONFIG.SESSION_ID });
        handleDisconnected();
        showToast('info', 'WhatsApp desconectado');
    }
}

// Exibir QR Code
function displayQRCode(qrData) {
    console.log('🖼️ Renderizando QR Code...');
    const qrContainer = document.getElementById('qr-code');
    
    if (!qrData) {
        console.error('❌ Dados do QR Code vazios');
        return;
    }
    
    // Criar imagem do QR Code
    const img = document.createElement('img');
    img.src = qrData;
    img.alt = 'QR Code WhatsApp';
    img.style.cssText = 'width: 100%; height: 100%; object-fit: contain;';
    
    qrContainer.innerHTML = '';
    qrContainer.appendChild(img);
    
    isConnecting = false;
    updateConnectButton(false);
    document.getElementById('connect-btn').style.display = 'none';
}

// Mostrar loading do QR
function showQRLoading(message) {
    const qrContainer = document.getElementById('qr-code');
    qrContainer.innerHTML = `
        <div class="qr-loading">
            <div class="spinner"></div>
            <p>${message}</p>
        </div>
    `;
}

// Timer do QR Code
function startQRTimer() {
    clearInterval(qrTimer);
    timerCountdown = 30;
    
    const timerEl = document.getElementById('qr-timer');
    const countdownEl = document.getElementById('timer-countdown');
    timerEl.style.display = 'block';
    
    qrTimer = setInterval(function() {
        timerCountdown--;
        countdownEl.textContent = timerCountdown;
        
        if (timerCountdown <= 0) {
            clearInterval(qrTimer);
            timerEl.style.display = 'none';
            
            // Solicitar novo QR
            if (!isConnected) {
                showQRLoading('Atualizando QR Code...');
                socket.emit('refresh-qr', { sessionId: CONFIG.SESSION_ID });
            }
        }
    }, 1000);
}

// Handle conexão estabelecida
function handleConnected(user) {
    isConnected = true;
    isConnecting = false;
    clearInterval(qrTimer);
    
    // Atualizar UI
    updateStatus('connected', 'Conectado');
    document.getElementById('disconnected-state').style.display = 'none';
    document.getElementById('connected-state').style.display = 'block';
    
    // Atualizar informações do usuário
    if (user) {
        document.getElementById('user-name').textContent = user.name || '-';
        document.getElementById('user-phone').textContent = user.phone ? formatPhone(user.phone) : '-';
    }
    
    // Carregar contatos
    socket.emit('get-contacts', { sessionId: CONFIG.SESSION_ID });
    
    showToast('success', 'WhatsApp conectado com sucesso!');
}

// Handle desconexão
function handleDisconnected() {
    isConnected = false;
    isConnecting = false;
    clearInterval(qrTimer);
    
    // Atualizar UI
    updateStatus('disconnected', 'Desconectado');
    document.getElementById('disconnected-state').style.display = 'block';
    document.getElementById('connected-state').style.display = 'none';
    document.getElementById('connect-btn').style.display = 'flex';
    document.getElementById('qr-timer').style.display = 'none';
    
    showQRLoading('Aguardando conexão...');
    
    // Esconder contatos
    document.getElementById('contacts-empty').style.display = 'block';
    document.getElementById('contacts-list-wrapper').style.display = 'none';
}

// Atualizar status
function updateStatus(status, text) {
    const badge = document.getElementById('status-badge');
    const textEl = document.getElementById('status-text');
    
    badge.className = 'status-badge ' + status;
    textEl.textContent = text;
}

// Atualizar botão de conexão
function updateConnectButton(loading) {
    const btn = document.getElementById('connect-btn');
    if (loading) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner" style="width: 20px; height: 20px; border-width: 2px; margin: 0;"></span> Conectando...';
    } else {
        btn.disabled = false;
        btn.textContent = 'Conectar WhatsApp';
    }
}

// Renderizar contatos
function renderContacts() {
    const listWrapper = document.getElementById('contacts-list-wrapper');
    const emptyState = document.getElementById('contacts-empty');
    const listEl = document.getElementById('contacts-list');
    const countEl = document.getElementById('contacts-count');
    
    if (contacts.length === 0) {
        emptyState.style.display = 'block';
        listWrapper.style.display = 'none';
        return;
    }
    
    emptyState.style.display = 'none';
    listWrapper.style.display = 'block';
    countEl.textContent = contacts.length;
    
    listEl.innerHTML = contacts.slice(0, 20).map(contact => `
        <div class="contact-item" onclick="openChat('${contact.number}', '${contact.name || contact.number}')">
            <div class="contact-avatar">
                ${contact.name ? contact.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div class="contact-info">
                <div class="contact-name">${contact.name || contact.number}</div>
                <div class="contact-phone">${formatPhone(contact.number)}</div>
            </div>
            <button class="contact-action" onclick="event.stopPropagation(); openChat('${contact.number}', '${contact.name || contact.number}')">
                CHAT
            </button>
        </div>
    `).join('');
}

// Abrir chat
function openChat(phone, name) {
    const params = new URLSearchParams({ phone, name });
    window.location.href = `conversas.html?${params.toString()}`;
}

// Formatar telefone
function formatPhone(phone) {
    if (!phone) return '';
    const cleaned = phone.replace(/[^0-9]/g, '');
    if (cleaned.length === 13) {
        return `+${cleaned.slice(0,2)} (${cleaned.slice(2,4)}) ${cleaned.slice(4,9)}-${cleaned.slice(9)}`;
    } else if (cleaned.length === 11) {
        return `(${cleaned.slice(0,2)}) ${cleaned.slice(2,7)}-${cleaned.slice(7)}`;
    }
    return phone;
}

// Toast
function showToast(type, message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = { success: 'OK', error: 'ERR', warning: 'WARN', info: 'INFO' };
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || 'INFO'}</span>
        <span class="toast-message">${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(function() {
        toast.classList.add('fade-out');
        setTimeout(function() {
            toast.remove();
        }, 300);
    }, 4000);
}

// Toggle sidebar
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('active');
    document.querySelector('.sidebar-overlay').classList.toggle('active');
}

// Logout
function logout() {
    localStorage.removeItem('isLoggedIn');
    sessionStorage.removeItem('selfDashboardToken');
    sessionStorage.removeItem('selfDashboardExpiry');
    sessionStorage.removeItem('selfDashboardUser');
    window.location.href = 'login.html';
}

const windowAny = window as any;
windowAny.startConnection = startConnection;
windowAny.disconnect = disconnect;
windowAny.openChat = openChat;
windowAny.toggleSidebar = toggleSidebar;
windowAny.logout = logout;

export {};
