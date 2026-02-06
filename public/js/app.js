/**
 * SELF Proteção Veicular - JavaScript Global
 * Sistema estilo BotConversa
 * Versão: 4.0.0
 */

// ============================================
// CONFIGURAÇÃO GLOBAL
// ============================================

const APP = {
    version: '4.0.0',
    socketUrl: window.location.hostname === 'localhost' 
        ? 'http://localhost:3001' 
        : window.location.origin,
    sessionId: 'self_whatsapp_session',
    countryCode: '55',
    socket: null,
    whatsappStatus: 'disconnected',
    user: null
};

// ============================================
// INICIALIZAÇÃO
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

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
    const token = sessionStorage.getItem('selfDashboardToken');
    const expiry = sessionStorage.getItem('selfDashboardExpiry');
    const user = sessionStorage.getItem('selfDashboardUser');
    
    if (!token || !expiry || Date.now() > parseInt(expiry)) {
        // Não redirecionar se já estiver na página de login
        if (!window.location.pathname.includes('login.html')) {
            window.location.href = 'login.html';
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
    window.location.href = 'login.html';
}

// ============================================
// SOCKET.IO
// ============================================

function initSocket() {
    if (typeof io === 'undefined') {
        console.warn('Socket.IO não carregado');
        return;
    }
    
    APP.socket = io(APP.socketUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 2000
    });
    
    APP.socket.on('connect', () => {
        console.log('✅ Socket conectado');
        APP.socket.emit('check-session', { sessionId: APP.sessionId });
    });
    
    APP.socket.on('disconnect', () => {
        console.log('❌ Socket desconectado');
        updateWhatsAppStatus('disconnected');
    });
    
    APP.socket.on('whatsapp-status', (data) => {
        updateWhatsAppStatus(data.status);
    });
    
    APP.socket.on('connected', (data) => {
        updateWhatsAppStatus('connected');
        showToast('success', 'WhatsApp Conectado', 'Conexão estabelecida com sucesso!');
    });
    
    APP.socket.on('disconnected', () => {
        updateWhatsAppStatus('disconnected');
    });
    
    APP.socket.on('qr', (data) => {
        updateWhatsAppStatus('qr');
        if (typeof handleQRCode === 'function') {
            handleQRCode(data.qr);
        }
    });
    
    APP.socket.on('new-message', (data) => {
        if (typeof handleNewMessage === 'function') {
            handleNewMessage(data);
        }
        updateUnreadCount();
    });
    
    APP.socket.on('message-sent', (data) => {
        if (typeof handleMessageSent === 'function') {
            handleMessageSent(data);
        }
    });
    
    APP.socket.on('error', (data) => {
        showToast('error', 'Erro', data.message || 'Ocorreu um erro');
    });
}

function updateWhatsAppStatus(status) {
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
        const texts = {
            connected: 'Conectado',
            disconnected: 'Desconectado',
            connecting: 'Conectando...',
            qr: 'Aguardando QR Code'
        };
        el.textContent = texts[status] || 'Desconectado';
    });
}

// ============================================
// SIDEBAR
// ============================================

function initSidebar() {
    const toggle = document.querySelector('.mobile-menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    
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
    const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
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
                closeModal(overlay.id);
            }
        });
    });
    
    // Fechar modal com botão X
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.modal-overlay');
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

function showToast(type, title, message, duration = 5000) {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
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

async function apiRequest(endpoint, options = {}) {
    const url = `${APP.socketUrl}${endpoint}`;
    const token = sessionStorage.getItem('selfDashboardToken');
    
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json'
        }
    };
    
    const config = { ...defaultOptions, ...options };

    config.headers = {
        ...defaultOptions.headers,
        ...(options.headers || {})
    };

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    
    if (options.body && typeof options.body === 'object') {
        config.body = JSON.stringify(options.body);
    }
    
    try {
        const response = await fetch(url, config);
        const data = await response.json();
        
        if (response.status === 401 && !window.location.pathname.includes('login.html')) {
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
    get: (endpoint) => apiRequest(endpoint, { method: 'GET' }),
    post: (endpoint, body) => apiRequest(endpoint, { method: 'POST', body }),
    put: (endpoint, body) => apiRequest(endpoint, { method: 'PUT', body }),
    delete: (endpoint) => apiRequest(endpoint, { method: 'DELETE' })
};

// ============================================
// FORMATADORES
// ============================================

function formatPhone(phone) {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
        return `(${cleaned.slice(0,2)}) ${cleaned.slice(2,7)}-${cleaned.slice(7)}`;
    } else if (cleaned.length === 10) {
        return `(${cleaned.slice(0,2)}) ${cleaned.slice(2,6)}-${cleaned.slice(6)}`;
    }
    return phone;
}

function formatDate(date, format = 'short') {
    if (!date) return '';
    const d = new Date(date);
    
    const options = {
        short: { day: '2-digit', month: '2-digit', year: 'numeric' },
        medium: { day: '2-digit', month: 'short', year: 'numeric' },
        long: { day: '2-digit', month: 'long', year: 'numeric' },
        full: { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' },
        time: { hour: '2-digit', minute: '2-digit' },
        datetime: { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    };
    
    return d.toLocaleDateString('pt-BR', options[format] || options.short);
}

function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value || 0);
}

function formatNumber(value) {
    return new Intl.NumberFormat('pt-BR').format(value || 0);
}

function formatPercent(value, decimals = 1) {
    return `${(value || 0).toFixed(decimals)}%`;
}

function timeAgo(date) {
    if (!date) return '';
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    
    const intervals = {
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

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
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

function getInitials(name) {
    if (!name) return '?';
    return name.split(' ')
        .map(word => word[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
}

function getAvatarColor(name) {
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

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('success', 'Copiado!', 'Texto copiado para a área de transferência');
    }).catch(() => {
        showToast('error', 'Erro', 'Não foi possível copiar o texto');
    });
}

function downloadFile(data, filename, type = 'text/plain') {
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

function parseCSV(text) {
    const lines = text.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        const row = {};
        
        headers.forEach((header, index) => {
            row[header] = values[index] || '';
        });
        
        data.push(row);
    }
    
    return data;
}

function exportToCSV(data, filename) {
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

function validatePhone(phone) {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length >= 10 && cleaned.length <= 11;
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function validateRequired(value) {
    return value !== null && value !== undefined && value.toString().trim() !== '';
}

// ============================================
// LOADING STATE
// ============================================

function showLoading(message = 'Carregando...') {
    let overlay = document.querySelector('.loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div class="loading-spinner"></div>
            <div class="loading-text">${message}</div>
        `;
        document.body.appendChild(overlay);
    } else {
        overlay.querySelector('.loading-text').textContent = message;
        overlay.style.display = 'flex';
    }
}

function hideLoading() {
    const overlay = document.querySelector('.loading-overlay');
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
        
        // Atualizar contador de mensagens não lidas
        updateUnreadCount();
        
    } catch (error) {
        console.error('Erro ao carregar dados iniciais:', error);
    }
}

async function updateUnreadCount() {
    try {
        const response = await api.get('/api/conversations?status=active');
        const unread = response.conversations?.filter(c => c.unread_count > 0).length || 0;
        
        const badges = document.querySelectorAll('.nav-link[href="conversas.html"] .badge, .nav-link[href="inbox.html"] .badge');
        badges.forEach(badge => {
            if (unread > 0) {
                badge.textContent = unread > 99 ? '99+' : unread;
                badge.style.display = 'inline-flex';
            } else {
                badge.style.display = 'none';
            }
        });
    } catch (error) {
        console.error('Erro ao atualizar contagem:', error);
    }
}

// ============================================
// STATUS DOS LEADS
// ============================================

const LEAD_STATUS = {
    1: { label: 'Novo', color: 'info', icon: '🆕' },
    2: { label: 'Em Andamento', color: 'warning', icon: '⏳' },
    3: { label: 'Concluído', color: 'success', icon: '✅' },
    4: { label: 'Perdido', color: 'danger', icon: '❌' }
};

function getStatusBadge(status) {
    const s = LEAD_STATUS[status] || LEAD_STATUS[1];
    return `<span class="badge badge-${s.color}">${s.icon} ${s.label}</span>`;
}

function getStatusLabel(status) {
    return LEAD_STATUS[status]?.label || 'Desconhecido';
}

// ============================================
// ETAPAS DO FUNIL
// ============================================

const FUNNEL_STAGES = [
    { id: 1, name: 'Etapa 1', label: 'Novo Lead' },
    { id: 2, name: 'Etapa 2', label: 'Em Contato' },
    { id: 3, name: 'Etapa 3', label: 'Negociação' },
    { id: 4, name: 'Concluído', label: 'Fechado' }
];

// ============================================
// EXPORTAR FUNÇÕES GLOBAIS
// ============================================

window.APP = APP;
window.api = api;
window.showToast = showToast;
window.openModal = openModal;
window.closeModal = closeModal;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.formatPhone = formatPhone;
window.formatDate = formatDate;
window.formatNumber = formatNumber;
window.formatPercent = formatPercent;
window.timeAgo = timeAgo;
window.getInitials = getInitials;
window.getAvatarColor = getAvatarColor;
window.copyToClipboard = copyToClipboard;
window.exportToCSV = exportToCSV;
window.parseCSV = parseCSV;
window.debounce = debounce;
window.logout = logout;
window.getStatusBadge = getStatusBadge;
window.LEAD_STATUS = LEAD_STATUS;
window.FUNNEL_STAGES = FUNNEL_STAGES;
