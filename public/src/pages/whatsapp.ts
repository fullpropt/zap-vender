// WhatsApp page logic migrated to module

declare const io:
    | undefined
    | ((url: string, options?: Record<string, unknown>) => {
          on: (event: string, handler: (data?: any) => void) => void;
          emit: (event: string, payload?: any) => void;
      });
declare const api:
    | undefined
    | {
          get: (endpoint: string) => Promise<any>;
      };

type WhatsappSessionItem = {
    session_id: string;
    connected?: boolean;
    status?: string;
    name?: string;
    phone?: string;
    campaign_enabled?: boolean | number;
};

// Configurações
const CONFIG = {
    SOCKET_URL: window.location.origin,
    DEFAULT_SESSION_ID: 'default_whatsapp_session',
    QR_REFRESH_INTERVAL: 30000
};
const LEGACY_DEFAULT_SESSION_ID = 'self_whatsapp_session';

// Estado
let socket: null | { on: (event: string, handler: (data?: any) => void) => void; emit: (event: string, payload?: any) => void } = null;
let socketBound = false;
let currentSessionId = CONFIG.DEFAULT_SESSION_ID;
let preferredDefaultSessionId = CONFIG.DEFAULT_SESSION_ID;
let availableSessions: WhatsappSessionItem[] = [];
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

function sanitizeSessionId(value: string | null | undefined, fallback = '') {
    const normalized = String(value || '').trim();
    return normalized || fallback;
}

function escapeHtml(value: string) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getDefaultSessionId() {
    return sanitizeSessionId(preferredDefaultSessionId, CONFIG.DEFAULT_SESSION_ID);
}

function normalizeSessionToken(value: string) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function buildCompanyDefaultSessionId(companyName: unknown) {
    const normalized = normalizeSessionToken(String(companyName || ''));
    if (!normalized) return CONFIG.DEFAULT_SESSION_ID;
    if (normalized.endsWith('_session')) return normalized;
    return `${normalized}_session`;
}

async function resolvePreferredDefaultSessionId() {
    try {
        if (!api?.get) throw new Error('API indisponivel');
        const response = await api.get('/api/settings');
        preferredDefaultSessionId = buildCompanyDefaultSessionId(response?.settings?.company_name);
    } catch (_) {
        preferredDefaultSessionId = CONFIG.DEFAULT_SESSION_ID;
    }
}

function getStoredSessionId() {
    return sanitizeSessionId(localStorage.getItem('zapvender_active_whatsapp_session'), getDefaultSessionId());
}

function persistCurrentSessionId(sessionId: string) {
    localStorage.setItem('zapvender_active_whatsapp_session', sessionId);
}

function getCurrentSessionId() {
    return sanitizeSessionId(currentSessionId, getDefaultSessionId());
}

function getSessionSelectElement() {
    return document.getElementById('whatsapp-session-select') as HTMLSelectElement | null;
}

function syncGlobalAppSessionId(sessionId: string) {
    const app = (window as Window & { APP?: { sessionId?: string } }).APP;
    if (app) {
        app.sessionId = sessionId;
    }
}

function isPayloadForCurrentSession(payload: any) {
    const payloadSessionId = sanitizeSessionId(payload?.sessionId);
    if (!payloadSessionId) return true;
    return payloadSessionId === getCurrentSessionId();
}

function isConnectedSession(session: WhatsappSessionItem) {
    return Boolean(session.connected) || String(session.status || '').toLowerCase() === 'connected';
}

function getSessionStatusLabel(session: WhatsappSessionItem) {
    return isConnectedSession(session) ? 'Conectada' : 'Desconectada';
}

function getSessionDisplayName(session: WhatsappSessionItem) {
    const sessionId = sanitizeSessionId(session.session_id);
    const name = String(session.name || '').trim();
    if (name) return name;
    const phone = String(session.phone || '').trim();
    if (phone) return phone;
    return sessionId;
}

function getSuggestedNewSessionId() {
    const used = new Set(
        (availableSessions || [])
            .map((item) => sanitizeSessionId(item.session_id))
            .filter(Boolean)
    );

    const base = getDefaultSessionId();
    if (!used.has(base)) return base;

    let counter = 2;
    while (counter < 100) {
        const candidate = `${base}_${counter}`;
        if (!used.has(candidate)) return candidate;
        counter += 1;
    }
    return `${base}_${Date.now()}`;
}

function renderSessionOptions() {
    const select = getSessionSelectElement();
    if (!select) return;

    const sessions = Array.isArray(availableSessions) ? [...availableSessions] : [];
    const uniqueSessions: WhatsappSessionItem[] = [];
    const seenSessionIds = new Set<string>();

    for (const session of sessions) {
        const normalizedSessionId = sanitizeSessionId(session.session_id);
        if (!normalizedSessionId || seenSessionIds.has(normalizedSessionId)) continue;
        seenSessionIds.add(normalizedSessionId);
        uniqueSessions.push({
            ...session,
            session_id: normalizedSessionId
        });
    }

    const defaultSessionId = getDefaultSessionId();
    if (!seenSessionIds.has(defaultSessionId)) {
        seenSessionIds.add(defaultSessionId);
        uniqueSessions.push({
            session_id: defaultSessionId,
            status: 'disconnected',
            connected: false
        });
    }

    uniqueSessions.sort((a, b) => {
        const byConnected = Number(isConnectedSession(b)) - Number(isConnectedSession(a));
        if (byConnected !== 0) return byConnected;
        const aLabel = getSessionDisplayName(a);
        const bLabel = getSessionDisplayName(b);
        return aLabel.localeCompare(bLabel);
    });
    availableSessions = uniqueSessions;

    select.innerHTML = uniqueSessions.map((session) => {
        const status = getSessionStatusLabel(session);
        const labelBase = getSessionDisplayName(session);
        const sessionId = sanitizeSessionId(session.session_id);
        const label = labelBase === sessionId
            ? `${labelBase} - ${status}`
            : `${labelBase} - ${sessionId} - ${status}`;
        return `<option value="${escapeHtml(sessionId)}">${escapeHtml(label)}</option>`;
    }).join('');

    let currentId = getCurrentSessionId();
    const hasCurrent = uniqueSessions.some((session) => sanitizeSessionId(session.session_id) === currentId);
    if (!hasCurrent && uniqueSessions.length) {
        currentId = sanitizeSessionId(uniqueSessions[0].session_id, getDefaultSessionId());
        currentSessionId = currentId;
        persistCurrentSessionId(currentId);
        syncGlobalAppSessionId(currentId);
    }

    select.value = currentId;
}

async function loadSessionOptions(preferredSessionId?: string) {
    const fallbackSessionId = sanitizeSessionId(preferredSessionId, getCurrentSessionId());
    try {
        if (!api?.get) throw new Error('API indisponivel');
        const response = await api.get('/api/whatsapp/sessions?includeDisabled=true');
        availableSessions = Array.isArray(response?.sessions) ? response.sessions : [];
    } catch (error) {
        availableSessions = [];
    }

    const availableSessionIds = new Set(
        (availableSessions || [])
            .map((session) => sanitizeSessionId(session?.session_id))
            .filter(Boolean)
    );

    const storedSessionId = getStoredSessionId();
    const candidates = [
        fallbackSessionId,
        storedSessionId,
        getCurrentSessionId(),
        getDefaultSessionId(),
        CONFIG.DEFAULT_SESSION_ID,
        LEGACY_DEFAULT_SESSION_ID
    ];
    let nextSessionId = candidates.find((candidate) => {
        const normalizedCandidate = sanitizeSessionId(candidate);
        if (!normalizedCandidate) return false;
        if (!availableSessionIds.size) return true;
        return availableSessionIds.has(normalizedCandidate);
    });

    if (!nextSessionId) {
        nextSessionId = sanitizeSessionId(availableSessions[0]?.session_id, getDefaultSessionId());
    }

    currentSessionId = sanitizeSessionId(nextSessionId, getDefaultSessionId());
    persistCurrentSessionId(currentSessionId);
    syncGlobalAppSessionId(currentSessionId);
    renderSessionOptions();
}

function resetConnectionUi() {
    isConnected = false;
    isConnecting = false;
    if (qrTimer) clearInterval(qrTimer);
    hidePairingCode();
    updateConnectButton(false);
    updatePairingButton(false);
    updateStatus('disconnected', 'Desconectado');

    const disconnected = document.getElementById('disconnected-state') as HTMLElement | null;
    const connected = document.getElementById('connected-state') as HTMLElement | null;
    const connectBtn = document.getElementById('connect-btn') as HTMLElement | null;
    const qrTimerEl = document.getElementById('qr-timer') as HTMLElement | null;
    if (disconnected) disconnected.style.display = 'block';
    if (connected) connected.style.display = 'none';
    if (connectBtn) connectBtn.style.display = 'flex';
    if (qrTimerEl) qrTimerEl.style.display = 'none';
    showQRLoading('Aguardando conexao...');
}

function changeSession(sessionId: string) {
    const normalizedSessionId = sanitizeSessionId(sessionId, getDefaultSessionId());
    currentSessionId = normalizedSessionId;
    persistCurrentSessionId(normalizedSessionId);
    syncGlobalAppSessionId(normalizedSessionId);
    renderSessionOptions();
    resetConnectionUi();
    socket?.emit('check-session', { sessionId: normalizedSessionId });
}

async function createSessionPrompt() {
    const suggestedSessionId = getSuggestedNewSessionId();
    const rawInput = window.prompt(
        'Informe o identificador da nova conta WhatsApp (ex: vendas_sp_session):',
        suggestedSessionId
    );
    if (rawInput === null) return;

    const normalized = sanitizeSessionId(rawInput)
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

    if (!normalized) {
        showToast('warning', 'Identificador da conta invalido');
        return;
    }

    const alreadyExists = availableSessions.some((session) => sanitizeSessionId(session.session_id) === normalized);
    if (!alreadyExists) {
        availableSessions.push({
            session_id: normalized,
            status: 'disconnected',
            connected: false
        });
    }

    changeSession(normalized);
    showToast('info', `Conta selecionada: ${normalized}`);
}

// Inicializa??o
function initWhatsapp() {
    if (!checkAuth()) return;

    void (async () => {
        await resolvePreferredDefaultSessionId();
        currentSessionId = getStoredSessionId();
        syncGlobalAppSessionId(currentSessionId);
        renderSessionOptions();
        initSocket();
        bindPairingCodeCopy();
        await loadSessionOptions(currentSessionId);
    })();
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
        socket.emit('check-session', { sessionId: getCurrentSessionId() });
        void loadSessionOptions(getCurrentSessionId());
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
        if (!isPayloadForCurrentSession(data)) return;
        console.log('📱 Status da sessão:', data);
        if (data.status === 'connected') {
            handleConnected(data.user);
        } else {
            handleDisconnected();
        }
    });
    
    socket.on('qr', function(data) {
        if (!isPayloadForCurrentSession(data)) return;
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
        if (!isPayloadForCurrentSession(data)) return;
        console.log('Pairing code recebido');
        displayPairingCode(data?.code || '', data?.phoneNumber || data?.phone || '');
        isConnecting = false;
        updateConnectButton(false);
        updatePairingButton(false);
        showToast('success', 'Codigo de pareamento gerado com sucesso');
    });
    
    socket.on('connecting', function(data) {
        if (!isPayloadForCurrentSession(data)) return;
        console.log('🔄 Conectando...');
        updateStatus('connecting', 'Conectando...');
        showQRLoading('Conectando ao WhatsApp...');
    });
    
    socket.on('connected', function(data) {
        if (!isPayloadForCurrentSession(data)) return;
        console.log('✅ WhatsApp conectado:', data);
        void loadSessionOptions(getCurrentSessionId());
        handleConnected(data.user);
    });
    
    socket.on('disconnected', function(data) {
        if (!isPayloadForCurrentSession(data)) return;
        console.log('❌ WhatsApp desconectado');
        void loadSessionOptions(getCurrentSessionId());
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
        if (!isPayloadForCurrentSession(data)) return;
        console.error('❌ Falha na autenticação');
        showToast('error', 'Falha na autenticação. Tente novamente.');
        handleDisconnected();
    });
    socket.emit('check-session', { sessionId: getCurrentSessionId() });
}

// Iniciar conexão
function startConnection() {
    if (isConnecting) return;
    const sessionId = getCurrentSessionId();
    
    isConnecting = true;
    updateConnectButton(true);
    updatePairingButton(true);
    hidePairingCode();
    showQRLoading('Gerando QR Code...');
    
    console.log('🚀 Iniciando conexão...');
    socket?.emit('start-session', { sessionId });
}

function requestPairingCode() {
    if (isConnecting) return;
    const sessionId = getCurrentSessionId();

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
        sessionId,
        phoneNumber: normalizedPhone
    });
}

// Desconectar
function disconnect() {
    const sessionId = getCurrentSessionId();
    if (confirm(`Tem certeza que deseja desconectar a conta ${sessionId}?`)) {
        socket?.emit('logout', { sessionId });
        handleDisconnected();
        void loadSessionOptions(sessionId);
        showToast('info', `Conta desconectada: ${sessionId}`);
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
                socket?.emit('refresh-qr', { sessionId: getCurrentSessionId() });
            }
        }
    }, 1000);
}

// Handle conexão estabelecida
function handleConnected(user: { name?: string; phone?: string } | undefined) {
    const wasConnected = isConnected;
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
    
    if (!wasConnected) {
        showToast('success', 'WhatsApp conectado com sucesso!');
    }
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
    document.body.setAttribute('data-whatsapp-connection-status', status);
    document.body.setAttribute('data-whatsapp-connection-label', text);
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
    sessionStorage.removeItem('selfDashboardRefreshToken');
    sessionStorage.removeItem('selfDashboardUserId');
    sessionStorage.removeItem('selfDashboardUserEmail');
    sessionStorage.removeItem('selfDashboardIdentity');
    window.location.href = getLoginUrl();
}

const windowAny = window as Window & {
    initWhatsapp?: () => void;
    startConnection?: () => void;
    requestPairingCode?: () => void;
    disconnect?: () => void;
    changeSession?: (sessionId: string) => void;
    createSessionPrompt?: () => void;
    toggleSidebar?: () => void;
    logout?: () => void;
};
windowAny.initWhatsapp = initWhatsapp;
windowAny.startConnection = startConnection;
windowAny.requestPairingCode = requestPairingCode;
windowAny.disconnect = disconnect;
windowAny.changeSession = changeSession;
windowAny.createSessionPrompt = createSessionPrompt;
windowAny.toggleSidebar = toggleSidebar;
windowAny.logout = logout;

export { initWhatsapp };
