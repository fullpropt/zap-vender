// WhatsApp page logic migrated to module

declare const io:
    | undefined
    | ((url: string, options?: Record<string, unknown>) => {
          on: (event: string, handler: (data?: any) => void) => void;
          emit: (event: string, payload?: any) => void;
      });

// Configurações
const CONFIG = {
    SOCKET_URL: window.location.origin,
    SESSION_ID: 'self_whatsapp_session',
    QR_REFRESH_INTERVAL: 30000
};

// Estado
let socket: null | { on: (event: string, handler: (data?: any) => void) => void; emit: (event: string, payload?: any) => void } = null;
let socketBound = false;
let isConnected = false;
let isConnecting = false;
let qrTimer: number | null = null;
let timerCountdown = 30;
let pairingCodeHideTimer: number | null = null;
let pairingCodeVisible = false;
let lastPairingCode = '';

// Inicialização
function onReady(callback: () => void) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback);
    } else {
        callback();
    }
}


function getLoginUrl() {
    return '#/login';
}

function normalizePairingPhoneInput(value: string) {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) return '';

    if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('55')) {
        return `55${digits}`;
    }

    return digits;
}

// Inicializa??o
function initWhatsapp() {
    if (checkAuth()) {
        initSocket();
        bindPairingCodeCopy();
    }
}

onReady(initWhatsapp);

function checkAuth() {
    const token = sessionStorage.getItem('selfDashboardToken');
    const expiry = sessionStorage.getItem('selfDashboardExpiry');
    if (!token || !expiry || Date.now() > parseInt(expiry)) {
        window.location.href = getLoginUrl();
        return false;
    }
    return true;
}

// Inicializar Socket.IO
function initSocket() {
    const win = window as Window & {
        APP?: {
            socket?: { on: (event: string, handler: (data?: any) => void) => void; emit: (event: string, payload?: any) => void };
        };
    };

    if (win.APP?.socket) {
        socket = win.APP.socket;
    }
    console.log('🔌 Conectando ao servidor:', CONFIG.SOCKET_URL);

    const token = sessionStorage.getItem('selfDashboardToken');
    const socketOptions: {
        transports: string[];
        reconnection: boolean;
        reconnectionAttempts: number;
        reconnectionDelay: number;
        timeout: number;
        auth?: { token: string };
    } = {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        timeout: 20000
    };

    if (token) {
        socketOptions.auth = { token };
    }
    if (!socket) {
        if (!io) {
            console.warn('Socket.IO nao carregado');
            return;
        }
        socket = io(CONFIG.SOCKET_URL, socketOptions);
    }

    if (socketBound) return;
    socketBound = true;

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
        const connectBtn = document.getElementById('connect-btn') as HTMLElement | null;
        const qrTimerEl = document.getElementById('qr-timer') as HTMLElement | null;
        if (connectBtn) connectBtn.style.display = 'none';
        if (qrTimerEl) qrTimerEl.style.display = 'block';
        updatePairingButton(false);
    });

    socket.on('pairing-code', function(data) {
        console.log('Pairing code recebido');
        displayPairingCode(data?.code || '', data?.phoneNumber || data?.phone || '');
        isConnecting = false;
        updateConnectButton(false);
        updatePairingButton(false);
        showToast('success', 'Codigo de pareamento gerado com sucesso');
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
    
    socket.on('error', function(data) {
        console.error('❌ Erro:', data);
        showToast('error', data.message || 'Erro na operação');
        
        if (isConnecting) {
            isConnecting = false;
            updateConnectButton(false);
            updatePairingButton(false);
            showQRLoading('Erro ao conectar. Tente novamente.');
        }
    });
    
    socket.on('auth-failure', function(data) {
        console.error('❌ Falha na autenticação');
        showToast('error', 'Falha na autenticação. Tente novamente.');
        handleDisconnected();
    });
    socket.emit('check-session', { sessionId: CONFIG.SESSION_ID });
}

// Iniciar conexão
function startConnection() {
    if (isConnecting) return;
    
    isConnecting = true;
    updateConnectButton(true);
    updatePairingButton(true);
    hidePairingCode();
    showQRLoading('Gerando QR Code...');
    
    console.log('🚀 Iniciando conexão...');
    socket?.emit('start-session', { sessionId: CONFIG.SESSION_ID });
}

function requestPairingCode() {
    if (isConnecting) return;

    const phoneInput = document.getElementById('pairing-phone') as HTMLInputElement | null;
    const normalizedPhone = normalizePairingPhoneInput(phoneInput?.value || '');

    if (!normalizedPhone || normalizedPhone.length < 12 || normalizedPhone.length > 15) {
        showToast('warning', 'Informe o numero com DDI + DDD + numero');
        return;
    }

    if (phoneInput) {
        phoneInput.value = normalizedPhone;
    }

    isConnecting = true;
    updateConnectButton(true);
    updatePairingButton(true);
    showPairingCodeLoading('Gerando codigo de pareamento...');

    socket?.emit('request-pairing-code', {
        sessionId: CONFIG.SESSION_ID,
        phoneNumber: normalizedPhone
    });
}

// Desconectar
function disconnect() {
    if (confirm('Tem certeza que deseja desconectar o WhatsApp?')) {
        socket?.emit('logout', { sessionId: CONFIG.SESSION_ID });
        handleDisconnected();
        showToast('info', 'WhatsApp desconectado');
    }
}

// Exibir QR Code
function displayQRCode(qrData: string) {
    console.log('🖼️ Renderizando QR Code...');
    const qrContainer = document.getElementById('qr-code') as HTMLElement | null;
    
    if (!qrData) {
        console.error('❌ Dados do QR Code vazios');
        return;
    }
    if (!qrContainer) return;
    
    // Criar imagem do QR Code
    const img = document.createElement('img');
    img.src = qrData;
    img.alt = 'QR Code WhatsApp';
    img.style.cssText = 'width: 100%; height: 100%; object-fit: contain;';
    
    qrContainer.innerHTML = '';
    qrContainer.appendChild(img);
    
    isConnecting = false;
    updateConnectButton(false);
    const connectBtn = document.getElementById('connect-btn') as HTMLElement | null;
    if (connectBtn) connectBtn.style.display = 'none';
}

// Mostrar loading do QR
function showQRLoading(message: string) {
    const qrContainer = document.getElementById('qr-code') as HTMLElement | null;
    if (!qrContainer) return;
    qrContainer.innerHTML = `
        <div class="qr-loading">
            <div class="spinner"></div>
            <p>${message}</p>
        </div>
    `;
}

function showPairingCodeLoading(message: string) {
    const pairingBox = document.getElementById('pairing-code-box') as HTMLElement | null;
    const pairingValue = document.getElementById('pairing-code-value') as HTMLElement | null;
    if (!pairingBox || !pairingValue) return;

    pairingCodeVisible = true;
    pairingBox.style.display = 'block';
    pairingBox.classList.add('loading');
    pairingValue.textContent = message;
}

function displayPairingCode(code: string, phoneNumber: string) {
    const pairingBox = document.getElementById('pairing-code-box') as HTMLElement | null;
    const pairingValue = document.getElementById('pairing-code-value') as HTMLElement | null;
    const pairingMeta = document.getElementById('pairing-code-meta') as HTMLElement | null;
    if (!pairingBox || !pairingValue) return;

    pairingCodeVisible = true;
    lastPairingCode = String(code || '').trim();
    pairingBox.style.display = 'block';
    pairingBox.classList.remove('loading');
    pairingValue.textContent = code || '-';
    pairingValue.title = 'Toque para copiar';
    if (pairingMeta) {
        pairingMeta.textContent = phoneNumber ? `Numero: +${phoneNumber}` : '';
    }

    if (pairingCodeHideTimer) clearTimeout(pairingCodeHideTimer);
    pairingCodeHideTimer = window.setTimeout(() => {
        if (!isConnected) {
            hidePairingCode();
        }
    }, 180000);
}

function hidePairingCode() {
    const pairingBox = document.getElementById('pairing-code-box') as HTMLElement | null;
    const pairingValue = document.getElementById('pairing-code-value') as HTMLElement | null;
    const pairingMeta = document.getElementById('pairing-code-meta') as HTMLElement | null;

    pairingCodeVisible = false;
    lastPairingCode = '';
    if (pairingBox) {
        pairingBox.style.display = 'none';
        pairingBox.classList.remove('loading');
    }
    if (pairingValue) pairingValue.textContent = '';
    if (pairingMeta) pairingMeta.textContent = '';

    if (pairingCodeHideTimer) {
        clearTimeout(pairingCodeHideTimer);
        pairingCodeHideTimer = null;
    }
}

// Timer do QR Code
function startQRTimer() {
    if (qrTimer) clearInterval(qrTimer);
    timerCountdown = 30;
    
    const timerEl = document.getElementById('qr-timer') as HTMLElement | null;
    const countdownEl = document.getElementById('timer-countdown') as HTMLElement | null;
    if (timerEl) timerEl.style.display = 'block';
    
    qrTimer = window.setInterval(function() {
        timerCountdown--;
        if (countdownEl) countdownEl.textContent = String(timerCountdown);
        
        if (timerCountdown <= 0) {
            if (qrTimer) clearInterval(qrTimer);
            if (timerEl) timerEl.style.display = 'none';
            
            // Solicitar novo QR
            if (!isConnected) {
                showQRLoading('Atualizando QR Code...');
                socket?.emit('refresh-qr', { sessionId: CONFIG.SESSION_ID });
            }
        }
    }, 1000);
}

// Handle conexão estabelecida
function handleConnected(user: { name?: string; phone?: string } | undefined) {
    isConnected = true;
    isConnecting = false;
    if (qrTimer) clearInterval(qrTimer);
    hidePairingCode();
    updatePairingButton(false);
    updateConnectButton(false);
    
    // Atualizar UI
    updateStatus('connected', 'Conectado');
    const disconnected = document.getElementById('disconnected-state') as HTMLElement | null;
    const connected = document.getElementById('connected-state') as HTMLElement | null;
    if (disconnected) disconnected.style.display = 'none';
    if (connected) connected.style.display = 'block';
    
    // Atualizar informações do usuário
    if (user) {
        const userName = document.getElementById('user-name') as HTMLElement | null;
        const userPhone = document.getElementById('user-phone') as HTMLElement | null;
        if (userName) userName.textContent = user.name || '-';
        if (userPhone) userPhone.textContent = user.phone ? formatPhone(user.phone) : '-';
    }
    
    showToast('success', 'WhatsApp conectado com sucesso!');
}

// Handle desconexão
function handleDisconnected() {
    isConnected = false;
    isConnecting = false;
    if (qrTimer) clearInterval(qrTimer);
    if (!pairingCodeVisible) {
        hidePairingCode();
    }
    updateConnectButton(false);
    updatePairingButton(false);
    
    // Atualizar UI
    updateStatus('disconnected', 'Desconectado');
    const disconnected = document.getElementById('disconnected-state') as HTMLElement | null;
    const connected = document.getElementById('connected-state') as HTMLElement | null;
    const connectBtn = document.getElementById('connect-btn') as HTMLElement | null;
    const qrTimerEl = document.getElementById('qr-timer') as HTMLElement | null;
    if (disconnected) disconnected.style.display = 'block';
    if (connected) connected.style.display = 'none';
    if (connectBtn) connectBtn.style.display = 'flex';
    if (qrTimerEl) qrTimerEl.style.display = 'none';
    
    showQRLoading('Aguardando conexão...');
}

// Atualizar status
function updateStatus(status: 'connected' | 'disconnected' | 'connecting' | 'qr', text: string) {
    const badge = document.getElementById('status-badge') as HTMLElement | null;
    const textEl = document.getElementById('status-text') as HTMLElement | null;
    
    if (badge) badge.className = 'status-badge ' + status;
    if (textEl) textEl.textContent = text;
}

// Atualizar botão de conexão
function updateConnectButton(loading: boolean) {
    const btn = document.getElementById('connect-btn') as HTMLButtonElement | null;
    if (!btn) return;
    if (loading) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner" style="width: 20px; height: 20px; border-width: 2px; margin: 0;"></span> Conectando...';
    } else {
        btn.disabled = false;
        btn.textContent = 'Conectar WhatsApp';
    }
}

function updatePairingButton(loading: boolean) {
    const btn = document.getElementById('pairing-btn') as HTMLButtonElement | null;
    if (!btn) return;

    if (loading) {
        btn.disabled = true;
        btn.textContent = 'Gerando...';
    } else {
        btn.disabled = false;
        btn.textContent = 'Gerar codigo';
    }
}

// Formatar telefone
function formatPhone(phone: string) {
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
function showToast(type: 'success' | 'error' | 'warning' | 'info', message: string) {
    const container = document.getElementById('toast-container') as HTMLElement | null;
    if (!container) return;
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

async function copyTextToClipboard(text: string) {
    const value = String(text || '').trim();
    if (!value) return false;

    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(value);
            return true;
        }
    } catch (error) {
        // fallback below
    }

    try {
        const textarea = document.createElement('textarea');
        textarea.value = value;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const copied = document.execCommand('copy');
        document.body.removeChild(textarea);
        return copied;
    } catch (error) {
        return false;
    }
}

async function copyPairingCode() {
    const pairingValue = document.getElementById('pairing-code-value') as HTMLElement | null;
    const currentText = String(pairingValue?.textContent || '').trim();
    const code = lastPairingCode || currentText;

    if (!code || code.includes('Gerando')) {
        showToast('warning', 'Aguarde o codigo de pareamento');
        return;
    }

    const copied = await copyTextToClipboard(code);
    if (copied) {
        showToast('success', 'Codigo copiado');
        return;
    }
    showToast('warning', 'Nao foi possivel copiar automaticamente');
}

function bindPairingCodeCopy() {
    const pairingValue = document.getElementById('pairing-code-value') as HTMLElement | null;
    if (!pairingValue || pairingValue.dataset.copyBound === '1') return;

    pairingValue.dataset.copyBound = '1';
    pairingValue.style.cursor = 'pointer';
    pairingValue.addEventListener('click', () => {
        copyPairingCode();
    });
}

// Toggle sidebar
function toggleSidebar() {
    document.getElementById('sidebar')?.classList.toggle('active');
    document.querySelector('.sidebar-overlay')?.classList.toggle('active');
}

// Logout
function logout() {
    localStorage.removeItem('isLoggedIn');
    sessionStorage.removeItem('selfDashboardToken');
    sessionStorage.removeItem('selfDashboardExpiry');
    sessionStorage.removeItem('selfDashboardUser');
    window.location.href = getLoginUrl();
}

const windowAny = window as Window & {
    initWhatsapp?: () => void;
    startConnection?: () => void;
    requestPairingCode?: () => void;
    disconnect?: () => void;
    toggleSidebar?: () => void;
    logout?: () => void;
};
windowAny.initWhatsapp = initWhatsapp;
windowAny.startConnection = startConnection;
windowAny.requestPairingCode = requestPairingCode;
windowAny.disconnect = disconnect;
windowAny.toggleSidebar = toggleSidebar;
windowAny.logout = logout;

export { initWhatsapp };
