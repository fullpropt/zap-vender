/**
 * ZapVender - JavaScript Global
 * Sistema estilo BotConversa
 * Versão: 4.0.0
 */

declare const io:
    | undefined
    | ((url: string, options?: Record<string, unknown>) => {
          on: (event: string, handler: (data?: any) => void) => void;
          emit: (event: string, payload?: any) => void;
      });

type WhatsAppStatus = 'connected' | 'disconnected' | 'connecting' | 'qr';

type AppState = {
    version: string;
    socketUrl: string;
    sessionId: string;
    countryCode: string;
    socket: null | { on: (event: string, handler: (data?: any) => void) => void; emit: (event: string, payload?: any) => void };
    whatsappStatus: WhatsAppStatus;
    user: string | null;
};

type WindowHandlers = {
    handleQRCode?: (qr: string) => void;
    handleNewMessage?: (data: unknown) => void;
    handleMessageSent?: (data: unknown) => void;
};

type ApiRequestOptions = RequestInit & {
    body?: any;
    headers?: Record<string, string>;
};

// ============================================
// CONFIGURAÇÃO GLOBAL
// ============================================

const BUILD_ID = '2026-02-09T16:50:00Z';
const DEFAULT_SESSION_ID = 'default_whatsapp_session';
const LAST_IDENTITY_STORAGE_KEY = 'self_last_identity';
const APP_LOCAL_STORAGE_EXACT_KEYS = [
    'isLoggedIn',
    'selfSettings',
    'self_leads',
    'self_templates',
    'self_messages',
    'self_contacts',
    'whatsapp_connected',
    'whatsapp_user',
    'zapvender_active_whatsapp_session',
    'zapvender_inbox_session_filter',
    'zapvender_contacts_session_filter',
    'zapvender_last_open_flow_id'
];
const APP_LOCAL_STORAGE_PREFIXES = ['self_', 'zapvender_', 'whatsapp_'];

function sanitizeSessionId(value: unknown, fallback = '') {
    const normalized = String(value || '').trim();
    return normalized || fallback;
}

function normalizeIdentityPart(value: unknown): string {
    return String(value || '').trim().toLowerCase();
}

function clearAppLocalStorageState() {
    const toRemove: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
        const key = String(localStorage.key(index) || '');
        if (!key || key === LAST_IDENTITY_STORAGE_KEY) continue;
        const hasExactMatch = APP_LOCAL_STORAGE_EXACT_KEYS.includes(key);
        const hasPrefixMatch = APP_LOCAL_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix));
        if (hasExactMatch || hasPrefixMatch) {
            toRemove.push(key);
        }
    }
    toRemove.forEach((key) => localStorage.removeItem(key));
}

function resolveCurrentSessionIdentity(): string {
    const explicitIdentity = normalizeIdentityPart(sessionStorage.getItem('selfDashboardIdentity'));
    if (explicitIdentity) return explicitIdentity;

    const userId = normalizeIdentityPart(sessionStorage.getItem('selfDashboardUserId'));
    if (userId) return `id:${userId}`;

    const userEmail = normalizeIdentityPart(sessionStorage.getItem('selfDashboardUserEmail'));
    if (userEmail) return `email:${userEmail}`;

    const userName = normalizeIdentityPart(sessionStorage.getItem('selfDashboardUser'));
    return userName ? `name:${userName}` : '';
}

function ensureStorageIdentityConsistency() {
    const currentIdentity = resolveCurrentSessionIdentity();
    if (!currentIdentity) return;

    const previousIdentity = normalizeIdentityPart(localStorage.getItem(LAST_IDENTITY_STORAGE_KEY));
    if (previousIdentity && previousIdentity !== currentIdentity) {
        clearAppLocalStorageState();
    }

    localStorage.setItem(LAST_IDENTITY_STORAGE_KEY, currentIdentity);
}

function resolveInitialSessionId() {
    const stored = sanitizeSessionId(localStorage.getItem('zapvender_active_whatsapp_session'));
    return stored || DEFAULT_SESSION_ID;
}

function isPayloadForCurrentSession(payload: any) {
    const payloadSessionId = sanitizeSessionId(payload?.sessionId);
    if (!payloadSessionId) return true;
    const activeSessionId = sanitizeSessionId(APP.sessionId, DEFAULT_SESSION_ID);
    return payloadSessionId === activeSessionId;
}

const APP: AppState = {
    version: '4.1.1',
    socketUrl: window.location.hostname === 'localhost' 
        ? 'http://localhost:3001' 
        : window.location.origin,
    sessionId: resolveInitialSessionId(),
    countryCode: '55',
    socket: null,
    whatsappStatus: 'disconnected',
    user: null
};


function isAppShell() {
    return true;
}

function buildAppUrl(path: string, query?: string) {
    const suffix = query ? `?${query}` : '';
    return `#/${path}${suffix}`;
}

function buildLegacyUrl(page: string, query?: string) {
    const suffix = query ? `?${query}` : '';
    return `${page}.html${suffix}`;
}

function isLoginRoute() {
    return window.location.hash.startsWith('#/login');
}

function getLoginUrl() {
    return buildAppUrl('login');
}

// ============================================
// INICIALIZAÇÃO
// ============================================

function onReady(callback: () => void) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback);
    } else {
        setTimeout(callback, 0);
    }
}

onReady(initApp);

function initApp() {
    // Verificar autenticação
    checkAuth();
    
    // Inicializar Socket.IO
    initSocket();
    
    // Inicializar sidebar
    initSidebar();
    
    // Inicializar modais
    initModals();
    
    // Carregar dados iniciais
    loadInitialData();
}

// ============================================
// AUTENTICAÇÃO
// ============================================

function checkAuth() {
    ensureStorageIdentityConsistency();

    const token = sessionStorage.getItem('selfDashboardToken');
    const expiry = sessionStorage.getItem('selfDashboardExpiry');
    const user = sessionStorage.getItem('selfDashboardUser');
    
    if (!token || !expiry || Date.now() > parseInt(expiry)) {
        // Não redirecionar se já estiver na página de login
        if (!isLoginRoute()) {
            window.location.href = getLoginUrl();
        }
        return false;
    }
    
    APP.user = user;
    updateUserInfo();
    return true;
}

function updateUserInfo() {
    const userElements = document.querySelectorAll('.user-name');
    userElements.forEach(el => {
        el.textContent = APP.user || 'Usuário';
    });
    
    const dateElements = document.querySelectorAll('.current-date');
    dateElements.forEach(el => {
        el.textContent = formatDate(new Date(), 'full');
    });
}

function logout() {
    sessionStorage.removeItem('selfDashboardToken');
    sessionStorage.removeItem('selfDashboardUser');
    sessionStorage.removeItem('selfDashboardExpiry');
    sessionStorage.removeItem('selfDashboardRefreshToken');
    sessionStorage.removeItem('selfDashboardUserId');
    sessionStorage.removeItem('selfDashboardUserEmail');
    sessionStorage.removeItem('selfDashboardIdentity');
    window.location.href = getLoginUrl();
}

// ============================================
// SOCKET.IO
// ============================================

function initSocket() {
    if (typeof io === 'undefined') {
        console.warn('Socket.IO não carregado');
        return;
    }

    const token = sessionStorage.getItem('selfDashboardToken');
    const socketOptions: {
        transports: string[];
        reconnection: boolean;
        reconnectionAttempts: number;
        reconnectionDelay: number;
        auth?: { token: string };
    } = {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 2000
    };

    if (token) {
        socketOptions.auth = { token };
    }

    APP.socket = io(APP.socketUrl, socketOptions);
    
    APP.socket.on('connect', () => {
        console.log('Socket conectado');
        APP.socket.emit('check-session', { sessionId: APP.sessionId });
    });
    
    APP.socket.on('disconnect', () => {
        console.log('Socket desconectado');
        updateWhatsAppStatus('disconnected');
    });
    
    APP.socket.on('whatsapp-status', (data) => {
        if (!isPayloadForCurrentSession(data)) return;
        updateWhatsAppStatus(data?.status as WhatsAppStatus);
    });
    
    APP.socket.on('connected', (data) => {
        if (!isPayloadForCurrentSession(data)) return;
        updateWhatsAppStatus('connected');
        showToast('success', 'WhatsApp Conectado', 'Conexão estabelecida com sucesso!');
    });
    
    APP.socket.on('disconnected', (data) => {
        if (!isPayloadForCurrentSession(data)) return;
        updateWhatsAppStatus('disconnected');
    });
    
    APP.socket.on('qr', (data) => {
        if (!isPayloadForCurrentSession(data)) return;
        updateWhatsAppStatus('qr');
        const handlers = window as Window & WindowHandlers;
        handlers.handleQRCode?.(data?.qr);
    });
    
    APP.socket.on('new-message', (data) => {
        const handlers = window as Window & WindowHandlers;
        handlers.handleNewMessage?.(data);
        updateUnreadCount();
    });
    
    APP.socket.on('message-sent', (data) => {
        const handlers = window as Window & WindowHandlers;
        handlers.handleMessageSent?.(data);
    });
    
    APP.socket.on('error', (data) => {
        showToast('error', 'Erro', data.message || 'Ocorreu um erro');
    });
}

function updateWhatsAppStatus(status: WhatsAppStatus) {
    APP.whatsappStatus = status;

    const indicators = document.querySelectorAll('.status-indicator');
    indicators.forEach(el => {
        el.className = 'status-indicator';
        if (status === 'connected') {
            el.classList.add('connected');
        } else if (status === 'connecting' || status === 'qr') {
            el.classList.add('connecting');
        } else {
            el.classList.add('disconnected');
        }
    });
    
    const statusTexts = document.querySelectorAll('.whatsapp-status-text');
    statusTexts.forEach(el => {
        const texts: Record<WhatsAppStatus, string> = {
            connected: 'Conectado',
            disconnected: 'Desconectado',
            connecting: 'Conectando...',
            qr: 'Aguardando QR Code'
        };
        el.textContent = texts[status] || 'Desconectado';
    });
}

function refreshWhatsAppStatus() {
    updateWhatsAppStatus(APP.whatsappStatus);
}

// ============================================
// SIDEBAR
// ============================================

function initSidebar() {
    // No App React, o controle de sidebar é feito pelos componentes/roteador.
    // Evita duplo toggle no mesmo clique em mobile.
    if (document.getElementById('root')) {
        return;
    }

    const toggle = document.querySelector('.mobile-menu-toggle') as HTMLElement | null;
    const sidebar = document.querySelector('.sidebar') as HTMLElement | null;
    const overlay = document.querySelector('.sidebar-overlay') as HTMLElement | null;
    
    if (toggle) {
        toggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            overlay.classList.toggle('active');
        });
    }
    
    if (overlay) {
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
        });
    }
    
    // Marcar item ativo no menu
    const currentPage = window.location.hash || '#/dashboard';
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPage) {
            link.classList.add('active');
        }
    });
}

// ============================================
// MODAIS
// ============================================

function initModals() {
    // Fechar modal ao clicar no overlay
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeModal((overlay as HTMLElement).id);
            }
        });
    });
    
    // Fechar modal com botão X
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.modal-overlay') as HTMLElement | null;
            if (modal) {
                closeModal(modal.id);
            }
        });
    });
    
    // Fechar modal com ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const activeModal = document.querySelector('.modal-overlay.active');
            if (activeModal) {
                closeModal(activeModal.id);
            }
        }
    });
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================

function showToast(type: 'success' | 'error' | 'warning' | 'info', title: string, message: string, duration = 5000) {
    let container = document.querySelector('.toast-container') as HTMLElement | null;
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    
    const icons = {
        success: 'OK',
        error: 'ERRO',
        warning: 'AVISO',
        info: 'INFO'
    };
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    container.appendChild(toast);
    
    // Animar entrada
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Remover após duração
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ============================================
// API HELPERS
// ============================================

async function apiRequest(endpoint: string, options: ApiRequestOptions = {}) {
    const url = `${APP.socketUrl}${endpoint}`;
    const token = sessionStorage.getItem('selfDashboardToken');
    
    const defaultOptions: ApiRequestOptions = {
        headers: {
            'Content-Type': 'application/json'
        }
    };
    
    const config: ApiRequestOptions = { ...defaultOptions, ...options };

    config.headers = {
        ...(defaultOptions.headers || {}),
        ...(options.headers || {})
    };

    if (token) {
        config.headers = {
            ...config.headers,
            Authorization: `Bearer ${token}`
        };
    }
    
    if (options.body && typeof options.body === 'object') {
        config.body = JSON.stringify(options.body);
    }
    
    try {
        const response = await fetch(url, config);
        const data = await response.json();
        
        if (response.status === 401 && !isLoginRoute()) {
            logout();
            throw new Error(data.error || 'Sessão expirada');
        }

        if (!response.ok) {
            throw new Error(data.error || 'Erro na requisição');
        }
        
        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// Atalhos para métodos HTTP
const api = {
    get: (endpoint: string) => apiRequest(endpoint, { method: 'GET' }),
    post: (endpoint: string, body?: any) => apiRequest(endpoint, { method: 'POST', body }),
    put: (endpoint: string, body?: any) => apiRequest(endpoint, { method: 'PUT', body }),
    delete: (endpoint: string) => apiRequest(endpoint, { method: 'DELETE' })
};

// ============================================
// FORMATADORES
// ============================================

function formatPhone(phone: string) {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
        return `(${cleaned.slice(0,2)}) ${cleaned.slice(2,7)}-${cleaned.slice(7)}`;
    } else if (cleaned.length === 10) {
        return `(${cleaned.slice(0,2)}) ${cleaned.slice(2,6)}-${cleaned.slice(6)}`;
    }
    return phone;
}

function formatDate(date: Date | string | number, format: keyof typeof DATE_FORMATS = 'short') {
    if (!date) return '';
    const d = new Date(date);

    const options = DATE_FORMATS;
    
    return d.toLocaleDateString('pt-BR', options[format] || options.short);
}

const DATE_FORMATS: Record<string, Intl.DateTimeFormatOptions> = {
    short: { day: '2-digit', month: '2-digit', year: 'numeric' },
    medium: { day: '2-digit', month: 'short', year: 'numeric' },
    long: { day: '2-digit', month: 'long', year: 'numeric' },
    full: { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' },
    time: { hour: '2-digit', minute: '2-digit' },
    datetime: { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }
};

function formatCurrency(value: number) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value || 0);
}

function formatNumber(value: number) {
    return new Intl.NumberFormat('pt-BR').format(value || 0);
}

function formatPercent(value: number, decimals = 1) {
    return `${(value || 0).toFixed(decimals)}%`;
}

function timeAgo(date: Date | string | number) {
    if (!date) return '';

    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    
    const intervals: Record<string, number> = {
        ano: 31536000,
        mês: 2592000,
        semana: 604800,
        dia: 86400,
        hora: 3600,
        minuto: 60
    };
    
    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
        const interval = Math.floor(seconds / secondsInUnit);
        if (interval >= 1) {
            const plural = interval > 1 ? (unit === 'mês' ? 'meses' : unit + 's') : unit;
            return `há ${interval} ${plural}`;
        }
    }
    
    return 'agora';
}

// ============================================
// UTILIDADES
// ============================================

function debounce<T extends (...args: any[]) => void>(func: T, wait: number) {
    let timeout: number | undefined;
    return function executedFunction(...args: Parameters<T>) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = window.setTimeout(later, wait);
    };
}

function throttle<T extends (...args: any[]) => void>(func: T, limit: number) {
    let inThrottle = false;
    return function executedFunction(...args: Parameters<T>) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function getInitials(name: string) {
    if (!name) return '?';
    return name.split(' ')
        .map(word => word[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
}

function getAvatarColor(name: string) {
    const colors = [
        '#5a2a6b', '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
        '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316'
    ];
    
    if (!name) return colors[0];
    
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
}

function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('success', 'Copiado!', 'Texto copiado para a área de transferência');
    }).catch(() => {
        showToast('error', 'Erro', 'Não foi possível copiar o texto');
    });
}

function downloadFile(data: string, filename: string, type = 'text/plain') {
    const blob = new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function parseCSV(text: string) {
    const lines = text.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const data: Array<Record<string, string>> = [];
    
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        const row: Record<string, string> = {};
        
        headers.forEach((header, index) => {
            row[header] = values[index] || '';
        });
        
        data.push(row);
    }
    
    return data;
}

function exportToCSV(data: Array<Record<string, string | number | null | undefined>>, filename: string) {
    if (!data.length) return;
    
    const headers = Object.keys(data[0]);
    const csv = [
        headers.join(','),
        ...data.map(row => headers.map(h => `"${row[h] || ''}"`).join(','))
    ].join('\n');
    
    downloadFile(csv, filename, 'text/csv');
}

// ============================================
// VALIDAÇÕES
// ============================================

function validatePhone(phone: string) {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length >= 10 && cleaned.length <= 11;
}

function validateEmail(email: string) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function validateRequired(value: string | number | null | undefined) {
    return value !== null && value !== undefined && value.toString().trim() !== '';
}

// ============================================
// LOADING STATE
// ============================================

function showLoading(message = 'Carregando...') {
    let overlay = document.querySelector('.loading-overlay') as HTMLElement | null;
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div class="loading-spinner"></div>
            <div class="loading-text">${message}</div>
        `;
        document.body.appendChild(overlay);
    } else {
        const text = overlay.querySelector('.loading-text') as HTMLElement | null;
        if (text) {
            text.textContent = message;
        }
        overlay.style.display = 'flex';
    }
}

function hideLoading() {
    const overlay = document.querySelector('.loading-overlay') as HTMLElement | null;
    if (overlay) {
        overlay.style.display = 'none';
    }
}

// ============================================
// DADOS INICIAIS
// ============================================

async function loadInitialData() {
    try {
        // Carregar status do servidor
        const status = await api.get('/api/status');
        console.log('Server status:', status);

        // Sincronizar status do WhatsApp para a UI atual
        try {
            const waStatus = await api.get(`/api/whatsapp/status?sessionId=${encodeURIComponent(APP.sessionId)}`);
            if (typeof waStatus?.connected === 'boolean') {
                updateWhatsAppStatus(waStatus.connected ? 'connected' : 'disconnected');
            }
        } catch (error) {
            console.warn('Erro ao carregar status do WhatsApp:', error);
        }
        
        // Atualizar contador de mensagens não lidas
        updateUnreadCount();
        
    } catch (error) {
        console.error('Erro ao carregar dados iniciais:', error);
    }
}

async function updateUnreadCount() {
    try {
        const response = await api.get('/api/conversations?status=active');
        const unread = response.conversations?.filter((c: { unread_count?: number }) => (c.unread_count || 0) > 0).length || 0;
        
        const badges = document.querySelectorAll(
            '.nav-link[href="#/conversas"] .badge, .nav-link[href="#/inbox"] .badge'
        );
        badges.forEach(badge => {
            const badgeEl = badge as HTMLElement;
            if (unread > 0) {
                badgeEl.textContent = unread > 99 ? '99+' : String(unread);
                badgeEl.style.display = 'inline-flex';
            } else {
                badgeEl.style.display = 'none';
            }
        });
    } catch (error) {
        console.error('Erro ao atualizar contagem:', error);
    }
}

// ============================================
// STATUS DOS LEADS
// ============================================

const LEAD_STATUS: Record<number, { label: string; color: string }> = {
    1: { label: 'Novo', color: 'info' },
    2: { label: 'Em Andamento', color: 'warning' },
    3: { label: 'Concluído', color: 'success' },
    4: { label: 'Perdido', color: 'danger' }
};

function getStatusBadge(status: number) {
    const s = LEAD_STATUS[status] || LEAD_STATUS[1];
    return `<span class="badge badge-${s.color}">${s.label}</span>`;
}

function getStatusLabel(status: number) {
    return LEAD_STATUS[status]?.label || 'Desconhecido';
}

// ============================================
// ETAPAS DO FUNIL
// ============================================

const FUNNEL_STAGES: Array<{ id: number; name: string; label: string }> = [
    { id: 1, name: 'Etapa 1', label: 'Novo Lead' },
    { id: 2, name: 'Etapa 2', label: 'Em Contato' },
    { id: 3, name: 'Etapa 3', label: 'Negociação' },
    { id: 4, name: 'Concluído', label: 'Fechado' }
];

// ============================================
// EXPORTAR FUNÇÕES GLOBAIS
// ============================================

const windowAny = window as Window & {
    APP?: AppState;
    api?: typeof api;
    showToast?: typeof showToast;
    openModal?: typeof openModal;
    closeModal?: typeof closeModal;
    showLoading?: typeof showLoading;
    hideLoading?: typeof hideLoading;
    formatPhone?: typeof formatPhone;
    formatDate?: typeof formatDate;
    formatNumber?: typeof formatNumber;
    formatPercent?: typeof formatPercent;
    timeAgo?: typeof timeAgo;
    getInitials?: typeof getInitials;
    getAvatarColor?: typeof getAvatarColor;
    copyToClipboard?: typeof copyToClipboard;
    exportToCSV?: typeof exportToCSV;
    parseCSV?: typeof parseCSV;
    debounce?: typeof debounce;
    logout?: typeof logout;
    getStatusBadge?: typeof getStatusBadge;
    LEAD_STATUS?: typeof LEAD_STATUS;
    FUNNEL_STAGES?: typeof FUNNEL_STAGES;
    BUILD_ID?: string;
};
windowAny.APP = APP;
windowAny.BUILD_ID = BUILD_ID;
console.info('ZapVender build', BUILD_ID);
windowAny.api = api;
windowAny.showToast = showToast;
windowAny.openModal = openModal;
windowAny.closeModal = closeModal;
windowAny.showLoading = showLoading;
windowAny.hideLoading = hideLoading;
windowAny.formatPhone = formatPhone;
windowAny.formatDate = formatDate;
windowAny.formatNumber = formatNumber;
windowAny.formatPercent = formatPercent;
windowAny.timeAgo = timeAgo;
windowAny.getInitials = getInitials;
windowAny.getAvatarColor = getAvatarColor;
windowAny.copyToClipboard = copyToClipboard;
windowAny.exportToCSV = exportToCSV;
windowAny.parseCSV = parseCSV;
windowAny.debounce = debounce;
windowAny.logout = logout;
windowAny.refreshWhatsAppStatus = refreshWhatsAppStatus;
windowAny.getStatusBadge = getStatusBadge;
windowAny.LEAD_STATUS = LEAD_STATUS;
windowAny.FUNNEL_STAGES = FUNNEL_STAGES;

export {};
